import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }),
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
  pages: { signIn: "/login" },
});
