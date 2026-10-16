export type OnboardingVisualState = "active" | "inactive" | "abandoned";

export function caseVisualState(status: string): OnboardingVisualState {
  if (status === "active") return "active";
  if (status === "cancelled" || status === "rejected") return "abandoned";
  return "inactive";
}
