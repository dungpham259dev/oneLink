"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const download = (ext: "png" | "svg", size?: number) => {
    if (size) qrRef.current?.update({ ...buildQrOptions(url, cfg), width: size, height: size });
    qrRef.current?.download({ name: "qr", extension: ext });
    if (size) qrRef.current?.update(buildQrOptions(url, cfg));
  };

  const uploadLogo = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload-logo", { method: "POST", body: fd });
    const json = await res.json();
    if (res.ok) setCfg({ ...cfg, logoUrl: json.url }); else toast.error(json.error);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div ref={ref} className="flex items-center justify-center rounded border p-4" />
      <div className="grid gap-3">
        <label className="text-sm">Foreground
          <Input type="color" value={cfg.fgColor} onChange={(e) => setCfg({ ...cfg, fgColor: e.target.value })} /></label>
        <label className="text-sm">Background
          <Input type="color" value={cfg.bgColor} onChange={(e) => setCfg({ ...cfg, bgColor: e.target.value })} /></label>
        <label className="text-sm">Dot style
          <select className="w-full rounded border p-2" value={cfg.dotStyle}
            onChange={(e) => setCfg({ ...cfg, dotStyle: e.target.value as QrConfigInput["dotStyle"] })}>
            <option value="square">Square</option><option value="rounded">Rounded</option><option value="dots">Dots</option>
          </select></label>
        {isPro && <label className="text-sm">Logo
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} /></label>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => download("png", 300)}>PNG S</Button>
          <Button variant="outline" onClick={() => download("png", 1024)}>PNG L</Button>
          <Button variant="outline" onClick={() => download("svg")}>SVG</Button>
        </div>
        <Button disabled={pending}
          onClick={() => start(async () => {
            const r = await saveQrConfig(linkId, cfg);
            if (r.ok) toast.success("QR saved"); else toast.error(r.error);
          })}>Save</Button>
      </div>
    </div>
  );
}
