import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config.
 *
 * This file MUST remain importable from the Edge runtime (middleware.ts).
 * Do NOT import PrismaAdapter, @auth/prisma-adapter, nodemailer, or lib/db
 * here — those are Node-only and will break the Edge bundle.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;
