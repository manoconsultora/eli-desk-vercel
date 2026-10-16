export type OnboardingProgress =
  | "unknown"
  | "initial_data_saved"
  | "setup_in_progress"
  | "checkout_started"
  | "completed";

export function onboardingProgressValue(progress: string): number {
  return (
    {
      unknown: 0,
      initial_data_saved: 1,
      setup_in_progress: 2,
      checkout_started: 3,
      completed: 5,
    }[progress as OnboardingProgress] ?? 0
  );
}
