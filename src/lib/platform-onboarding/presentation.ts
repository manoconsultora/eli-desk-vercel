import type { OnboardingCase, OnboardingStatus } from "./contracts";
import { onboardingStatusLabels } from "./contracts";

export { caseVisualState } from "./case-visual-state";
export { onboardingProgressValue } from "./onboarding-progress";

export function caseStatusLabel(status: string): string {
  return onboardingStatusLabels[status as OnboardingStatus] ?? status;
}

export function caseProgress(status: string): number {
  if (status === "active") return 5;
  if (status === "ready_to_activate" || status === "activation_failed") return 4;
  if (status === "needs_initial_data" || status === "awaiting_owner_acceptance") return 3;
  if (status === "provisioning" || status === "provisioning_failed" || status === "approved_to_provision") return 2;
  return 1;
}

export function caseNeedsAttention(item: OnboardingCase): boolean {
  return (
    Boolean(item.safe_failure_code) ||
    ["received", "commercial_review", "provisioning_failed", "activation_failed"].includes(item.status)
  );
}

export function caseAgeDays(createdAt: string): number {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) ? Math.max(0, Math.floor((Date.now() - created) / 86400000)) : 0;
}
