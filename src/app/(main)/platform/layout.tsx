import type { ReactNode } from "react";

import { PlatformShellClient } from "@/app/(main)/platform/_components/platform-shell-client";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { canAccessPlatformOnboarding } from "@/lib/platform-onboarding/authorization-policy";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/server/server-actions";

export default async function PlatformLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const authContext = await getAuthContext(supabase);
  const platformUserRows =
    authContext.authenticated && authContext.status === "resolved" && authContext.userType === "platform"
      ? await supabase.from("platform_users").select("role, status").eq("user_id", authContext.userId).limit(2)
      : { data: [], error: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  const fullName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const name = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  const avatarUrl = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url.trim() : "";
  const picture = typeof user?.user_metadata?.picture === "string" ? user.user_metadata.picture.trim() : "";

  return (
    <PlatformShellClient
      currentUser={{
        name: fullName || name || email,
        email,
        avatar: avatarUrl || picture || "",
        canAccessOnboarding:
          !platformUserRows.error &&
          canAccessPlatformOnboarding(
            authContext,
            (platformUserRows.data ?? []) as Array<{ role: string; status: string }>,
          ),
      }}
      logoutAction={logoutAction}
    >
      {children}
    </PlatformShellClient>
  );
}
