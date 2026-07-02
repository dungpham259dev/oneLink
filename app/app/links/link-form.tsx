"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <Input placeholder="Name (internal)" value={form.name} onChange={set("name")} />
      {isPro && (
        <Input placeholder="Custom slug" value={form.customSlug} onChange={set("customSlug")} />
      )}
      <Input placeholder="iOS App Store URL" value={form.iosUrl} onChange={set("iosUrl")} />
      <Input placeholder="Google Play URL" value={form.androidUrl} onChange={set("androidUrl")} />
      <Input placeholder="Fallback URL" value={form.fallbackUrl} onChange={set("fallbackUrl")} />
      <Button type="submit" disabled={pending}>
        Create link
      </Button>
    </form>
  );
}
