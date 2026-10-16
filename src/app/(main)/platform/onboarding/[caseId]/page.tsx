import { notFound } from "next/navigation";

import { z } from "zod";

import { OnboardingDetail } from "@/app/(main)/platform/onboarding/_components/onboarding-detail";
import type { OnboardingCase } from "@/lib/platform-onboarding/contracts";
import {
  PlatformOnboardingAuthorizationError,
  requireActivePlatformOwner,
} from "@/server/platform-onboarding/authorization";
import { getOrganizationFiscalData } from "@/server/platform-onboarding/fiscal";
import { getCase, getCaseEvents } from "@/server/platform-onboarding/repository";

type Props = { params: Promise<{ caseId: string }>; searchParams: Promise<{ view?: string }> };

export default async function PlatformOnboardingCasePage({ params, searchParams }: Props) {
  let supabase: Awaited<ReturnType<typeof requireActivePlatformOwner>>["supabase"];
  try {
    ({ supabase } = await requireActivePlatformOwner());
  } catch (error) {
    if (error instanceof PlatformOnboardingAuthorizationError) notFound();
    throw error;
  }

  const [{ caseId }, search] = await Promise.all([params, searchParams]);
  if (!z.string().uuid().safeParse(caseId).success) notFound();
  let item: OnboardingCase | null;
  try {
    item = await getCase(supabase, caseId);
  } catch {
    return <OnboardingDetail loadError />;
  }
  if (!item) notFound();
  try {
    const [events, fiscal] = await Promise.all([
      getCaseEvents(supabase, caseId),
      getOrganizationFiscalData(supabase, caseId),
    ]);
    return (
      <OnboardingDetail item={item} events={events} fiscal={fiscal} initialFiscalOpen={search.view === "fiscal"} />
    );
  } catch {
    return <OnboardingDetail loadError />;
  }
}
