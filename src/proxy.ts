import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets and public files to avoid running logic unnecessarily
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // Retrieve existing session_id cookie
  const sessionCookie = request.cookies.get("session_id");
  let sessionId = sessionCookie?.value;
  let isNewSession = false;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    isNewSession = true;
  }

  // Clone request headers to inject the session ID header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-session-id", sessionId);

  // Propagate the session ID header to downstream route handlers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // If a new session was generated, set the HttpOnly cookie in the response
  if (isNewSession) {
    response.cookies.set({
      name: "session_id",
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year TTL
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Run on API routes and page navigation, excluding static files
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
