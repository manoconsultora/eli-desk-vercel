import { notFound } from "next/navigation";

import { OnboardingList } from "@/app/(main)/platform/onboarding/_components/onboarding-list";
import {
  PlatformOnboardingAuthorizationError,
  requireActivePlatformOwner,
} from "@/server/platform-onboarding/authorization";
import { listCases } from "@/server/platform-onboarding/repository";

export default async function PlatformOnboardingPage() {
  let supabase: Awaited<ReturnType<typeof requireActivePlatformOwner>>["supabase"];
  try {
    ({ supabase } = await requireActivePlatformOwner());
  } catch (error) {
    if (error instanceof PlatformOnboardingAuthorizationError) notFound();
    throw error;
  }

  try {
    return <OnboardingList cases={await listCases(supabase)} />;
  } catch {
    return <OnboardingList cases={[]} loadError />;
  }
}
