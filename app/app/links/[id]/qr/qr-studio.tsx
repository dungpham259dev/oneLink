"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { buildQrOptions } from "@/lib/qr-options";
import type { QrConfigInput } from "@/lib/validation/qr";
import { saveQrConfig } from "./actions";

export function QrStudio({ linkId, url, initial, isPro }: {
  linkId: string; url: string; initial: QrConfigInput; isPro: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const qrRef = useRef<import("qr-code-styling").default | null>(null);
  const [cfg, setCfg] = useState<QrConfigInput>(initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    let active = true;
    import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (!active || !ref.current) return;
      qrRef.current = new QRCodeStyling(buildQrOptions(url, cfg));
      ref.current.innerHTML = "";
      qrRef.current.append(ref.current);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { qrRef.current?.update(buildQrOptions(url, cfg)); }, [cfg, url]);

  const download = async (ext: "png" | "svg", size?: number) => {
    const qr = qrRef.current;
    if (!qr) return;
    try {
      if (size) {
        qr.update({ ...buildQrOptions(url, cfg), width: size, height: size });
      }
      // download() is async (it must wait for the canvas/logo to finish
      // rendering). Awaiting it prevents capturing a blank/half-rendered image.
      await qr.download({ name: "qr", extension: ext });
    } catch (err) {
      console.error("QR download failed", err);
      toast.error("Không tải được mã QR, vui lòng thử lại.");
    } finally {
      if (size) qr.update(buildQrOptions(url, cfg));
    }
  };

  const uploadLogo = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload-logo", { method: "POST", body: fd });
    const json = await res.json();
    if (res.ok) setCfg({ ...cfg, logoUrl: json.url }); else toast.error(json.error);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex items-center justify-center rounded-2xl border bg-card p-8 shadow-sm">
        <div ref={ref} />
      </div>
      <div className="grid content-start gap-5 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="qr-fg" className="text-xs text-muted-foreground">
              Foreground
            </Label>
            <Input
              id="qr-fg"
              type="color"
              className="h-10 cursor-pointer p-1"
              value={cfg.fgColor}
              onChange={(e) => setCfg({ ...cfg, fgColor: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qr-bg" className="text-xs text-muted-foreground">
              Background
            </Label>
            <Input
              id="qr-bg"
              type="color"
              className="h-10 cursor-pointer p-1"
              value={cfg.bgColor}
              onChange={(e) => setCfg({ ...cfg, bgColor: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Dot style</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["square", "rounded", "dots"] as const).map((style) => (
              <Button
                key={style}
                type="button"
                variant={cfg.dotStyle === style ? "default" : "outline"}
                size="sm"
                onClick={() => setCfg({ ...cfg, dotStyle: style })}
              >
                {style === "square" ? "Square" : style === "rounded" ? "Rounded" : "Dots"}
              </Button>
            ))}
          </div>
        </div>
        {isPro && (
          <div className="grid gap-1.5">
            <Label htmlFor="qr-logo" className="text-xs text-muted-foreground">
              Logo
            </Label>
            <Input
              id="qr-logo"
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Download</Label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => download("png", 300)}>
              <Download className="size-3.5" />
              PNG · 300
            </Button>
            <Button variant="outline" size="sm" onClick={() => download("png", 1024)}>
              <Download className="size-3.5" />
              PNG · 1024
            </Button>
            <Button variant="outline" size="sm" onClick={() => download("svg")}>
              <Download className="size-3.5" />
              SVG
            </Button>
          </div>
        </div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveQrConfig(linkId, cfg);
              if (r.ok) toast.success("QR saved");
              else toast.error(r.error);
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
