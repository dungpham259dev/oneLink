"use client";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createLink } from "./actions";

type FormState = {
  name: string;
  customSlug: string;
  iosUrl: string;
  androidUrl: string;
  fallbackUrl: string;
};

const initialForm: FormState = {
  name: "",
  customSlug: "",
  iosUrl: "",
  androidUrl: "",
  fallbackUrl: "",
};

function Field({
  id,
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} {...props} />
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export function LinkForm({ isPro }: { isPro: boolean }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState<FormState>(initialForm);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    start(async () => {
      const r = await createLink({
        name: form.name || undefined,
        iosUrl: form.iosUrl || undefined,
        androidUrl: form.androidUrl || undefined,
        fallbackUrl: form.fallbackUrl || undefined,
        customSlug: isPro && form.customSlug ? form.customSlug : undefined,
        parameterForwarding: false,
      });
      if (r.ok) {
        toast.success("Link created");
        setForm(initialForm);
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="link-name"
          label="Name"
          hint="Only you see this."
          placeholder="My app"
          value={form.name}
          onChange={set("name")}
        />
        {isPro && (
          <Field
            id="link-slug"
            label="Custom slug"
            hint="Appears in the URL: /r/your-slug"
            placeholder="your-app"
            className="font-mono"
            value={form.customSlug}
            onChange={set("customSlug")}
          />
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id="link-ios"
          label="App Store (iOS)"
          placeholder="https://apps.apple.com/…"
          value={form.iosUrl}
          onChange={set("iosUrl")}
        />
        <Field
          id="link-android"
          label="Google Play (Android)"
          placeholder="https://play.google.com/…"
          value={form.androidUrl}
          onChange={set("androidUrl")}
        />
        <Field
          id="link-fallback"
          label="Fallback (everything else)"
          placeholder="https://your-site.com"
          value={form.fallbackUrl}
          onChange={set("fallbackUrl")}
        />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />
          {pending ? "Creating…" : "Create link"}
        </Button>
      </div>
    </form>
  );
}
