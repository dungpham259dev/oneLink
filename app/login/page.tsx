import Link from "next/link";
import { signIn } from "@/auth";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Link href="/" className="mb-10 transition-opacity hover:opacity-70">
        <Wordmark />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to manage your smart links.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/app" });
          }}
        >
          <Button className="w-full" type="submit">
            Continue with Google
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <form
          className="grid gap-3"
          action={async (fd: FormData) => {
            "use server";
            await signIn("nodemailer", { email: String(fd.get("email")), redirectTo: "/app" });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <Button className="w-full" variant="outline" type="submit">
            Email me a magic link
          </Button>
        </form>
      </div>
    </div>
  );
}
