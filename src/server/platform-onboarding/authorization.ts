import { getAuthContext } from "@/lib/auth/get-auth-context";
import { canAccessPlatformOnboarding } from "@/lib/platform-onboarding/authorization-policy";
import { createClient } from "@/lib/supabase/server";

export class PlatformOnboardingAuthorizationError extends Error {
  constructor() {
    super("platform_owner_required");
    this.name = "PlatformOnboardingAuthorizationError";
  }
}

export async function requireActivePlatformOwner() {
  const supabase = await createClient();
  const context = await getAuthContext(supabase);
  if (!context.authenticated || context.status !== "resolved" || context.userType !== "platform") {
    throw new PlatformOnboardingAuthorizationError();
  }
  const { data, error } = await supabase
    .from("platform_users")
    .select("role, status")
    .eq("user_id", context.userId)
    .limit(2);
  if (error || !canAccessPlatformOnboarding(context, (data ?? []) as Array<{ role: string; status: string }>)) {
    throw new PlatformOnboardingAuthorizationError();
  }
  return { supabase, actorId: context.userId };
}
