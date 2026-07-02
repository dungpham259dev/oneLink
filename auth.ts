import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    ...authConfig.providers,
    Nodemailer({ server: process.env.EMAIL_SERVER!, from: process.env.EMAIL_FROM! }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      // @ts-expect-error augmented below
      session.user.plan = (user as { plan?: string }).plan ?? "FREE";
      return session;
    },
  },
});
