import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Edge-safe route guard.
 *
 * The app uses NextAuth's database session strategy, so the session cookie is
 * an opaque session-token reference — NOT a decryptable JWE. We therefore must
 * NOT run `auth()` (which tries to JWT-decode the cookie and throws
 * JWEInvalid) here. This middleware performs a cheap presence check on the
 * session cookie to keep unauthenticated users out of /app; the actual session
 * is verified in the /app server layout via getCurrentUser (a DB lookup).
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export default function middleware(req: NextRequest) {
  const isApp = req.nextUrl.pathname.startsWith("/app");
  if (!isApp) return NextResponse.next();

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
