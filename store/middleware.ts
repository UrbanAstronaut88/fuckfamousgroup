import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const headers = response.headers;
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("X-Frame-Options", "DENY");
  // React's streaming bootstrap currently needs inline scripts. No eval in production.
  headers.set("Content-Security-Policy", [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    "form-action 'self'", `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob:",
    "media-src 'self'", `connect-src 'self'${process.env.NODE_ENV === "development" ? " ws: wss:" : ""}`,
  ].join("; "));
  if (new URL(request.url).protocol === "https:")
    headers.set("Strict-Transport-Security", "max-age=31536000");
  if (/^\/(?:admin|dima_dinamo_admin|api\/admin)(?:\/|$)/.test(request.nextUrl.pathname)) {
    headers.set("Cache-Control", "no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}
export const config = { matcher: ["/((?!assets/|_next/static/|audio/|icons/|images/).*)"] };
