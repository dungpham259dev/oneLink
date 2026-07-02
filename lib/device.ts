import type { DeviceType } from "@prisma/client";

export function detectDevice(userAgent: string): { device: DeviceType; os: string } {
  const ua = userAgent || "";
  if (/iPad/.test(ua)) return { device: "IPADOS", os: "iPadOS" };
  if (/iPhone|iPod/.test(ua)) return { device: "IOS", os: "iOS" };
  if (/Android/.test(ua)) {
    if (/HUAWEI|HarmonyOS|; HMSCore/i.test(ua)) return { device: "HUAWEI", os: "HarmonyOS/Android" };
    return { device: "ANDROID", os: "Android" };
  }
  if (/Windows NT/.test(ua)) return { device: "WINDOWS", os: "Windows" };
  if (/Macintosh|Mac OS X/.test(ua)) return { device: "MACOS", os: "macOS" };
  return { device: "OTHER", os: "unknown" };
}
