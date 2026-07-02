import type { Plan } from "@prisma/client";

export type PlanLimits = {
  maxLinks: number | null;
  customSlug: boolean;
  qrLogo: boolean;
  qrGradient: boolean;
  desktopLinks: boolean;
  parameterForwarding: boolean;
  fullAnalytics: boolean;
  showBranding: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: { maxLinks: 3, customSlug: false, qrLogo: false, qrGradient: false,
    desktopLinks: false, parameterForwarding: false, fullAnalytics: false, showBranding: true },
  PRO: { maxLinks: null, customSlug: true, qrLogo: true, qrGradient: true,
    desktopLinks: true, parameterForwarding: true, fullAnalytics: true, showBranding: false },
};

export function canCreateLink(plan: Plan, currentCount: number): boolean {
  const max = PLAN_LIMITS[plan].maxLinks;
  return max === null || currentCount < max;
}
