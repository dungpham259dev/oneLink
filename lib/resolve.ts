import type { DeviceType, RedirectTarget } from "@prisma/client";

export type LinkConfig = {
  slug: string;
  iosUrl?: string | null; ipadUrl?: string | null; androidUrl?: string | null;
  huaweiUrl?: string | null; windowsUrl?: string | null; macUrl?: string | null;
  fallbackUrl?: string | null; parameterForwarding: boolean;
};

function pickUrl(c: LinkConfig, device: DeviceType): string | null {
  switch (device) {
    case "IOS": return c.iosUrl ?? null;
    case "IPADOS": return c.ipadUrl ?? c.iosUrl ?? null;
    case "ANDROID": return c.androidUrl ?? null;
    case "HUAWEI": return c.huaweiUrl ?? c.androidUrl ?? null;
    case "WINDOWS": return c.windowsUrl ?? null;
    case "MACOS": return c.macUrl ?? null;
    default: return null;
  }
}

function appendQuery(url: string, query: string): string {
  if (!query) return url;
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
}

export function resolveDestination(
  config: LinkConfig, device: DeviceType, incomingQuery: string
): { url: string | null; target: RedirectTarget } {
  const matched = pickUrl(config, device);
  if (matched) {
    const url = config.parameterForwarding ? appendQuery(matched, incomingQuery) : matched;
    return { url, target: "MATCHED" };
  }
  if (config.fallbackUrl) {
    const url = config.parameterForwarding ? appendQuery(config.fallbackUrl, incomingQuery) : config.fallbackUrl;
    return { url, target: "FALLBACK" };
  }
  return { url: null, target: "LANDING" };
}
