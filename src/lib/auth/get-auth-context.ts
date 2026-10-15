import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { AuthContext, PlatformRole, TenantRole, UnresolvedReason } from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const PLATFORM_ROLES = ["PLATFORM_OWNER", "PLATFORM_ADMIN", "SUPPORT", "PLATFORM_VIEWER"] as const;
const TENANT_ROLES = ["TENANT_OWNER", "ADMIN", "OPERATOR", "VIEWER"] as const;
const PLATFORM_STATUSES = ["active", "suspended", "inactive"] as const;
const MEMBERSHIP_STATUSES = ["active", "suspended", "inactive", "invited"] as const;
const ORGANIZATION_STATUSES = ["active", "suspended", "cancelled", "archived"] as const;

type AuthUser = {
  id: string;
  email?: string | null;
};

type PlatformUserRow = {
  user_id: string;
  role: string;
  status: string;
};

type AuthMembershipStateRow = {
  organization_id: string;
  membership_role: string;
  membership_status: string;
  organization_status: string;
};

type ValidTenantMembership = AuthMembershipStateRow & {
  membership_role: TenantRole;
  membership_status: "active";
  organization_status: "active";
};

type ResolvedPlatformUser = PlatformUserRow & {
  role: PlatformRole;
  status: "active";
};

type AuthIdentity = {
  userId: string;
  email?: string | null;
};

const ACTIVE_STATUS = "active";

function isPlatformRole(role: string): role is PlatformRole {
  return PLATFORM_ROLES.includes(role as PlatformRole);
}

function isTenantRole(role: string): role is TenantRole {
  return TENANT_ROLES.includes(role as TenantRole);
}

function isPlatformStatus(status: string): status is (typeof PLATFORM_STATUSES)[number] {
  return PLATFORM_STATUSES.includes(status as (typeof PLATFORM_STATUSES)[number]);
}

function isMembershipStatus(status: string): status is (typeof MEMBERSHIP_STATUSES)[number] {
  return MEMBERSHIP_STATUSES.includes(status as (typeof MEMBERSHIP_STATUSES)[number]);
}

function isOrganizationStatus(status: string): status is (typeof ORGANIZATION_STATUSES)[number] {
  return ORGANIZATION_STATUSES.includes(status as (typeof ORGANIZATION_STATUSES)[number]);
}

function getAuthenticatedBase(user: AuthUser) {
  return {
    authenticated: true as const,
    userId: user.id,
    email: user.email ?? null,
  };
}

function getUnauthenticatedContext(): AuthContext {
  return {
    authenticated: false,
    userId: null,
    email: null,
    userType: null,
    role: null,
    organizationId: null,
    status: "unauthenticated",
  };
}

function getControlledAuthenticatedContext(
  identity: AuthIdentity,
  status: "unresolved" | "organization_selection_required",
  reason?: UnresolvedReason,
): AuthContext {
  if (status === "unresolved") {
    return {
      authenticated: true,
      userId: identity.userId,
      email: identity.email ?? null,
      userType: null,
      role: null,
      organizationId: null,
      status,
      reason: reason ?? "unknown_internal_user",
    };
  }

  return {
    authenticated: true,
    userId: identity.userId,
    email: identity.email ?? null,
    userType: null,
    role: null,
    organizationId: null,
    status,
  };
}

async function getPlatformUsers(supabase: SupabaseServerClient, userId: string): Promise<PlatformUserRow[]> {
  const { data, error } = await supabase
    .from("platform_users")
    .select("user_id, role, status")
    .eq("user_id", userId)
    .limit(3);

  if (error) {
    throw new Error(`Failed to resolve platform auth context: ${error.message}`);
  }

  return (data ?? []) as PlatformUserRow[];
}

async function getAuthMembershipStates(supabase: SupabaseServerClient): Promise<AuthMembershipStateRow[]> {
  const { data, error } = await supabase.rpc("get_auth_membership_states");

  if (error) {
    throw new Error(`Failed to resolve tenant auth state: ${error.message}`);
  }

  return (data ?? []) as AuthMembershipStateRow[];
}

async function getPaidOrganizationIds(supabase: SupabaseServerClient): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_postpay_paid_organization_ids");
  if (error) throw new Error(`Failed to verify post-payment access: ${error.message}`);
  return new Set(Array.isArray(data) ? data.filter((id): id is string => typeof id === "string") : []);
}

function getUnresolvedContext(identity: AuthIdentity, reason: UnresolvedReason): AuthContext {
  return getControlledAuthenticatedContext(identity, "unresolved", reason);
}

export async function getAuthContext(client?: SupabaseServerClient): Promise<AuthContext> {
  const supabase = client ?? (await createClient());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return getUnauthenticatedContext();
  }

  return getAuthContextForIdentity(supabase, {
    userId: user.id,
    email: user.email ?? null,
  });
}

// Resolved once per server render and shared by the layout, the page and its loaders.
// Not for server actions that change the session (e.g. login), which need a fresh read.
export const getRequestAuthContext = cache(() => getAuthContext());

export async function getAuthContextForIdentity(
  supabase: SupabaseServerClient,
  identity: AuthIdentity,
): Promise<AuthContext> {
  const base = getAuthenticatedBase({
    id: identity.userId,
    email: identity.email ?? null,
  });
  // Both lookups are independent; start the membership one now so it runs alongside platform_users.
  // Its error only surfaces if the result is used, as before.
  const membershipStatesPromise = getAuthMembershipStates(supabase);
  membershipStatesPromise.catch(() => {
    // Handled where the result is awaited; this only avoids an unhandled rejection meanwhile.
  });
  const platformUsers = await getPlatformUsers(supabase, identity.userId);
  const activePlatformUsers = platformUsers.filter((platformUser) => platformUser.status === ACTIVE_STATUS);
  const resolvedPlatformUser: ResolvedPlatformUser | null =
    activePlatformUsers.length === 1 && isPlatformRole(activePlatformUsers[0].role)
      ? { ...activePlatformUsers[0], role: activePlatformUsers[0].role, status: "active" }
      : null;

  if (resolvedPlatformUser) {
    return {
      ...base,
      userType: "platform",
      role: resolvedPlatformUser.role,
      organizationId: null,
      status: "resolved",
    };
  }

  const membershipStates = await membershipStatesPromise;
  const paidOrganizationIds = membershipStates.some((state) => state.organization_status === "pending_payment")
    ? await getPaidOrganizationIds(supabase)
    : new Set<string>();
  const validMemberships = membershipStates.filter(
    (membershipState): membershipState is ValidTenantMembership =>
      isTenantRole(membershipState.membership_role) &&
      membershipState.membership_status === ACTIVE_STATUS &&
      (membershipState.organization_status === ACTIVE_STATUS ||
        (membershipState.organization_status === "pending_payment" &&
          paidOrganizationIds.has(membershipState.organization_id))),
  );

  if (validMemberships.length === 1) {
    return {
      ...base,
      userType: "tenant",
      role: validMemberships[0].membership_role,
      organizationId: validMemberships[0].organization_id,
      status: "resolved",
    };
  }

  if (validMemberships.length > 1) {
    return getControlledAuthenticatedContext(identity, "organization_selection_required");
  }

  const hasInvalidConfiguration =
    activePlatformUsers.length > 1 ||
    platformUsers.some(
      (platformUser) => !isPlatformRole(platformUser.role) || !isPlatformStatus(platformUser.status),
    ) ||
    membershipStates.some(
      (membershipState) =>
        !isTenantRole(membershipState.membership_role) ||
        !isMembershipStatus(membershipState.membership_status) ||
        !isOrganizationStatus(membershipState.organization_status),
    );

  if (hasInvalidConfiguration) {
    return getUnresolvedContext(identity, "invalid_configuration");
  }

  if (platformUsers.some((platformUser) => platformUser.status === "suspended")) {
    return getUnresolvedContext(identity, "platform_suspended");
  }

  if (platformUsers.some((platformUser) => platformUser.status === "inactive")) {
    return getUnresolvedContext(identity, "platform_inactive");
  }

  if (membershipStates.some((membershipState) => membershipState.organization_status === "suspended")) {
    return getUnresolvedContext(identity, "organization_suspended");
  }

  if (membershipStates.some((membershipState) => membershipState.organization_status === "cancelled")) {
    return getUnresolvedContext(identity, "organization_cancelled");
  }

  if (membershipStates.some((membershipState) => membershipState.organization_status === "archived")) {
    return getUnresolvedContext(identity, "organization_archived");
  }

  if (membershipStates.some((membershipState) => membershipState.membership_status === "suspended")) {
    return getUnresolvedContext(identity, "membership_suspended");
  }

  if (membershipStates.some((membershipState) => membershipState.membership_status === "inactive")) {
    return getUnresolvedContext(identity, "membership_inactive");
  }

  if (membershipStates.some((membershipState) => membershipState.membership_status === "invited")) {
    return getUnresolvedContext(identity, "membership_invited");
  }

  return getUnresolvedContext(identity, "unknown_internal_user");
}
