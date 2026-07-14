import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getSessionId } from "@/lib/rate-limit/identifier";
import { checkUploadRateLimit } from "@/lib/rate-limit/limiter";
import { analyzeTreeImage } from "@/lib/weather-ai/service";
import { handleSafeError } from "@/lib/errors/response";
import { BadRequestError, RateLimitError } from "@/lib/errors/api-error";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const sessionId = getSessionId(request);

    // 1. Check strict upload rate limits (session and IP level)
    const rateLimit = await checkUploadRateLimit(sessionId, ip);
    if (!rateLimit.success) {
      throw new RateLimitError("Upload limit exceeded. You can only perform 5 uploads every 15 minutes.");
    }

    // 2. Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (_) {
      throw new BadRequestError("Invalid form data submission");
    }

    const file = formData.get("image");
    
    // Validate that the image file exists and is indeed a File object
    if (!file || !(file instanceof File)) {
      throw new BadRequestError("An image file is required under the 'image' field.");
    }

    // 3. File type validation (Allowed: JPEG, PNG, WEBP)
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.type)) {
      throw new BadRequestError(`Unsupported image format. Allowed formats: ${allowedMimeTypes.join(", ")}`);
    }

    // 4. File size validation (Maximum 20 MB)
    const maxSizeBytes = 20 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestError("Image file size exceeds the 20MB limit.");
    }

    // Parse optional metadata fields
    const acresStr = formData.get("landAcres");
    const acres = acresStr ? parseFloat(acresStr.toString()) : undefined;
    const farmerId = formData.get("farmerId")?.toString();
    const county = formData.get("county")?.toString();
    const notes = formData.get("notes")?.toString();

    if (acres !== undefined && (isNaN(acres) || acres <= 0)) {
      throw new BadRequestError("Land acres must be a positive number.");
    }

    console.log(`[Upload] Uploaded image for tree analysis: name=${file.name}, type=${file.type}, size=${file.size} bytes`);

    // 5. Call service layer (directly forwards multipart payload, keeps image in RAM only)
    const analysisResult = await analyzeTreeImage(
      file,
      acres,
      farmerId,
      county,
      notes
    );

    return NextResponse.json(analysisResult);
  } catch (error) {
    return handleSafeError(error);
  }
}
