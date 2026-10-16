import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { DashboardShellClient } from "@/app/(main)/dashboard/_components/dashboard-shell-client";
import { FiscalProvider } from "@/app/(main)/dashboard/_components/fiscal-chat/fiscal-provider";
import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { SIDEBAR_COLLAPSIBLE_VALUES, SIDEBAR_VARIANT_VALUES } from "@/lib/preferences/layout";
import { createClient } from "@/lib/supabase/server";
import { resolveDeskFeatureAccess } from "@/server/access/resolve-desk-feature-access";
import { getDeskPlanMenuData } from "@/server/desk-account";
import { getDeskFiscalInitial } from "@/server/desk-fiscal";
import { getPreference, logoutAction } from "@/server/server-actions";
import { listTicketEdificios } from "@/server/tickets/ticket-actions";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [variant, collapsible, authContext, ticketEdificios] = await Promise.all([
    getPreference("sidebar_variant", SIDEBAR_VARIANT_VALUES, "inset"),
    getPreference("sidebar_collapsible", SIDEBAR_COLLAPSIBLE_VALUES, "icon"),
    getRequestAuthContext(),
    listTicketEdificios(),
  ]);
  const [accessRows, planMenu] = await Promise.all([resolveDeskFeatureAccess(), getDeskPlanMenuData()]);
  const deskAccess = accessRows.map(({ featureId, lifecycle, state }) => ({
    featureId,
    lifecycle,
    state,
  }));
  const fiscal = await getDeskFiscalInitial();
  const email = user?.email ?? "";
  const fullName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const name = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  const displayName = fullName || name;
  const firstName = displayName.split(/\s+/)[0] || email.split("@")[0] || "Usuario";
  const avatarUrl = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url.trim() : "";
  const picture = typeof user?.user_metadata?.picture === "string" ? user.user_metadata.picture.trim() : "";
  const currentUser = {
    id: user?.id ?? "",
    name: firstName,
    email,
    avatar: avatarUrl || picture || "",
  };
  const deploymentVersion = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

  const ticketRealtimeScope = {
    organizationId:
      authContext.status === "resolved" && authContext.userType === "tenant" ? authContext.organizationId : null,
    consorcioIds: ticketEdificios.success ? ticketEdificios.data.map((edificio) => edificio.id) : [],
  };

  return (
    <FiscalProvider key={fiscal.sessionKey ?? "fiscal-unavailable"} initial={fiscal}>
      <DashboardShellClient
        defaultOpen={defaultOpen}
        variant={variant}
        collapsible={collapsible}
        currentUser={currentUser}
        logoutAction={logoutAction}
        deskAccess={deskAccess}
        planMenu={planMenu}
        deploymentVersion={deploymentVersion}
        ticketRealtimeScope={ticketRealtimeScope}
      >
        {children}
      </DashboardShellClient>
    </FiscalProvider>
  );
}
