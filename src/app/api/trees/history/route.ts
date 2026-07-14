import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getSessionId } from "@/lib/rate-limit/identifier";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { handleSafeError } from "@/lib/errors/response";
import { RateLimitError } from "@/lib/errors/api-error";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const sessionId = getSessionId(request);

    // Check rate limits
    const rateLimit = await checkRateLimit(sessionId, ip);
    if (!rateLimit.success) {
      throw new RateLimitError("Too many requests. Please try again in a few minutes.");
    }

    // Since the application deliberately has no persistent database and keeps uploads in memory only
    // (as documented in our architecture decision), the server does not store or return past uploads.
    // We return an empty history list. In a production environment with database backing,
    // this would query tree analysis records by session_id/user_id.
    return NextResponse.json([]);
  } catch (error) {
    return handleSafeError(error);
  }
}
