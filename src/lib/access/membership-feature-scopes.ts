"use server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

import type { CreateMembershipFeatureScopeInput, MembershipFeatureScope, TenantFeatureId } from "./feature-scope-types";

type MembershipFeatureScopeRow = {
  id: string;
  organization_id: string;
  membership_id: string;
  feature_id: TenantFeatureId;
  scope_mode: MembershipFeatureScope["scopeMode"];
  created_at: string;
  updated_at: string;
};

type MembershipFeatureScopeEdificioRow = {
  scope_id: string;
  edificio_id: string;
};

function toMembershipFeatureScope(
  row: MembershipFeatureScopeRow,
  consorcioIds: readonly string[],
): MembershipFeatureScope {
  return {
    id: row.id,
    organizationId: row.organization_id,
    membershipId: row.membership_id,
    featureId: row.feature_id,
    scopeMode: row.scope_mode,
    consorcioIds: [...consorcioIds],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getPlatformScopeClient() {
  const supabase = await createClient();
  const context = await getAuthContext(supabase);

  if (
    !context.authenticated ||
    context.status !== "resolved" ||
    context.userType !== "platform" ||
    (context.role !== "PLATFORM_OWNER" && context.role !== "PLATFORM_ADMIN")
  ) {
    throw new Error("No autorizado para administrar alcances de módulos.");
  }

  return supabase;
}

export async function readMembershipFeatureScopes(membershipId: string): Promise<MembershipFeatureScope[]> {
  const supabase = await getPlatformScopeClient();
  const [{ data: scopeRows, error: scopeError }, { data: edificioRows, error: edificioError }] = await Promise.all([
    supabase
      .from("membership_feature_scopes")
      .select("id, organization_id, membership_id, feature_id, scope_mode, created_at, updated_at")
      .eq("membership_id", membershipId)
      .order("feature_id"),
    supabase
      .from("membership_feature_scope_edificios")
      .select("scope_id, edificio_id")
      .eq("membership_id", membershipId),
  ]);

  if (scopeError) {
    throw new Error(`No se pudieron leer los alcances de módulos: ${scopeError.message}`);
  }

  if (edificioError) {
    throw new Error(`No se pudieron leer los consorcios de los alcances: ${edificioError.message}`);
  }

  const idsByScope = new Map<string, string[]>();
  ((edificioRows as MembershipFeatureScopeEdificioRow[] | null) ?? []).forEach((row) => {
    const ids = idsByScope.get(row.scope_id) ?? [];
    ids.push(row.edificio_id);
    idsByScope.set(row.scope_id, ids);
  });

  return ((scopeRows as MembershipFeatureScopeRow[] | null) ?? []).map((row) =>
    toMembershipFeatureScope(row, idsByScope.get(row.id) ?? []),
  );
}

export async function createMembershipFeatureScope(
  input: CreateMembershipFeatureScopeInput,
): Promise<MembershipFeatureScope> {
  const supabase = await getPlatformScopeClient();
  const consorcioIds = [...new Set(input.consorcioIds ?? [])];
  const { data: scopeId, error } = await supabase.rpc("set_membership_feature_scope", {
    target_organization_id: input.organizationId,
    target_membership_id: input.membershipId,
    target_feature_id: input.featureId,
    target_scope_mode: input.scopeMode,
    target_edificio_ids: input.scopeMode === "explicit_list" ? consorcioIds : [],
  });

  if (error) {
    throw new Error(`No se pudo crear el alcance de módulo: ${error.message}`);
  }

  const scopes = await readMembershipFeatureScopes(input.membershipId);
  const scope = scopes.find((candidate) => candidate.id === (scopeId as string));
  if (!scope) {
    throw new Error("No se pudo leer el alcance de módulo después de guardarlo.");
  }

  return scope;
}

export async function removeMembershipFeatureScope(scopeId: string): Promise<void> {
  const supabase = await getPlatformScopeClient();
  const { error } = await supabase.rpc("delete_membership_feature_scope", {
    target_scope_id: scopeId,
  });

  if (error) {
    throw new Error(`No se pudo eliminar el alcance de módulo: ${error.message}`);
  }
}
