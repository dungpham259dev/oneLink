import { z } from "zod";

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const linkInputSchema = z.object({
  name: z.string().max(100).optional(),
  customSlug: z.string().optional(),
  iosUrl: optionalUrl,
  ipadUrl: optionalUrl,
  androidUrl: optionalUrl,
  huaweiUrl: optionalUrl,
  windowsUrl: optionalUrl,
  macUrl: optionalUrl,
  fallbackUrl: optionalUrl,
  parameterForwarding: z.boolean().default(false),
});

export type LinkInput = z.infer<typeof linkInputSchema>;
