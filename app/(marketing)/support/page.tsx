import { Mail } from "lucide-react";

export default function Support() {
  return (
    <div className="mx-auto max-w-xl py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
      <p className="mt-6 leading-relaxed text-muted-foreground">
        Questions, bugs, or feature requests — we read every message and usually reply within
        a day.
      </p>
      <a
        href="mailto:support@buildsolo.online"
        className="mt-8 inline-flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 shadow-sm transition-colors hover:border-brand"
      >
        <Mail className="size-5 text-brand" strokeWidth={1.75} />
        <span className="font-mono text-sm">support@buildsolo.online</span>
      </a>
    </div>
  );
}
