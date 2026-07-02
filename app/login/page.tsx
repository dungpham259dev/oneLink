import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/app" });
        }}
      >
        <Button className="w-full" type="submit">
          Continue with Google
        </Button>
      </form>
      <form
        className="flex flex-col gap-2"
        action={async (fd: FormData) => {
          "use server";
          await signIn("nodemailer", { email: String(fd.get("email")), redirectTo: "/app" });
        }}
      >
        <Input name="email" type="email" placeholder="you@example.com" required />
        <Button className="w-full" variant="outline" type="submit">
          Email me a magic link
        </Button>
      </form>
    </div>
  );
}
