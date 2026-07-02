import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isApp = req.nextUrl.pathname.startsWith("/app");
  if (isApp && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = { matcher: ["/app/:path*"] };
