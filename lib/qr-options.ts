import type { Options } from "qr-code-styling";
import type { QrConfigInput } from "@/lib/validation/qr";

export function buildQrOptions(data: string, cfg: QrConfigInput): Options {
  const dotColor = cfg.gradient
    ? undefined
    : cfg.fgColor;
  return {
    type: "svg",
    data,
    width: cfg.size,
    height: cfg.size,
    margin: cfg.margin,
    image: cfg.logoUrl ?? undefined,
    dotsOptions: {
      color: dotColor,
      type: cfg.dotStyle,
      gradient: cfg.gradient
        ? { type: cfg.gradient.type, colorStops: [{ offset: 0, color: cfg.gradient.from }, { offset: 1, color: cfg.gradient.to }] }
        : undefined,
    },
    cornersSquareOptions: { type: cfg.cornerStyle === "rounded" ? "extra-rounded" : "square" },
    backgroundOptions: { color: cfg.bgColor },
    imageOptions: { crossOrigin: "anonymous", margin: 4 },
  };
}
