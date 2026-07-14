import type { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",");
    const clientIp = ips[0].trim();
    if (clientIp) return clientIp;
  }
  
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "127.0.0.1";
}

export function getSessionId(request: NextRequest): string {
  // Read the custom header set by our proxy.ts
  const sessionId = request.headers.get("x-session-id");
  if (sessionId) return sessionId;

  // Fallback to cookie directly if header wasn't set (e.g. direct asset request)
  const sessionCookie = request.cookies.get("session_id");
  if (sessionCookie?.value) return sessionCookie.value;

  // Final fallback to IP address to ensure we don't return an empty string
  return getClientIp(request);
}
