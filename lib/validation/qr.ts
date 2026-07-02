import { z } from "zod";

const hex = z.string().regex(/^#([0-9a-fA-F]{6})$/);

export const qrConfigSchema = z.object({
  fgColor: hex.default("#000000"),
  bgColor: hex.default("#ffffff"),
  dotStyle: z.enum(["square", "rounded", "dots"]).default("square"),
  cornerStyle: z.enum(["square", "rounded"]).default("square"),
  margin: z.number().int().min(0).max(50).default(10),
  size: z.number().int().min(100).max(1000).default(300),
  gradient: z
    .object({ from: hex, to: hex, type: z.enum(["linear", "radial"]) })
    .nullable()
    .default(null),
  logoUrl: z.string().url().nullable().default(null),
});

export type QrConfigInput = z.infer<typeof qrConfigSchema>;
