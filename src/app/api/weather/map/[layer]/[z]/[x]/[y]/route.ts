import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  try {
    const params = await segmentData.params;
    const { layer, z, x, y } = params;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return new NextResponse("API Key not configured", { status: 500 });
    }

    const tileUrl = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`;
    const response = await fetch(tileUrl);

    if (!response.ok) {
      return new NextResponse(`Upstream failed: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get("Content-Type") || "image/png";
    const blob = await response.blob();

    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[Map Tile Proxy Error]:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
