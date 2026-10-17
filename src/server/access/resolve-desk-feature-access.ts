import "server-only";

import { cache } from "react";

import { type FeatureId, featureCatalog } from "@/features/catalog/feature-catalog";
import type {
  ContextualFeatureAvailability,
  EffectiveFeatureAccess,
  FeatureOverrideEffect,
} from "@/lib/access/feature-access-types";
import type { ConsorcioScope, TenantFeatureId } from "@/lib/access/feature-scope-types";
import { resolveFeatureAccess } from "@/lib/access/resolve-feature-access";
import { resolveFeatureScope } from "@/lib/access/resolve-feature-scope";
import { createClient } from "@/lib/supabase/server";

export type DeskFeatureAccessState = "resolved" | "denied" | "coming_soon" | "unavailable" | "error";

export type DeskFeatureAccessView = {
  featureId: FeatureId;
  lifecycle: (typeof featureCatalog)[number]["lifecycle"];
  contextualAvailability: ContextualFeatureAvailability;
  rolePresetAllowed: boolean;
  override: FeatureOverrideEffect | null;
  effectiveAccess: boolean;
  accessReason: EffectiveFeatureAccess["reason"] | "resolution_error";
  consorcioScope: ConsorcioScope | null;
  state: DeskFeatureAccessState;
};

export type DeskFeatureAccessPresentation = Pick<DeskFeatureAccessView, "featureId" | "lifecycle" | "state">;

type BaseScopeRow = {
  scope_kind: unknown;
  consorcio_ids: unknown;
};

type OverrideRow = {
  feature_id: unknown;
  effect: unknown;
};

type FeatureScopeRow = {
  feature_id: unknown;
  scope_mode: unknown;
  consorcio_ids: unknown;
};

const tenantFeatureIds = new Set<TenantFeatureId>([
  "tickets",
  "consorcios",
  "residentes",
  "documentos",
  "notificaciones",
  "reservas",
  "equipo",
  "seguridad",
  "tenant_settings",
  "tenant_support",
  "reporting",
  "contable",
  "legales",
]);

const scopeRequiredFeatureIds = new Set<TenantFeatureId>([
  "tickets",
  "residentes",
  "documentos",
  "notificaciones",
  "reservas",
  "reporting",
  "contable",
  "legales",
]);

function isTenantFeatureId(value: unknown): value is TenantFeatureId {
  return typeof value === "string" && tenantFeatureIds.has(value as TenantFeatureId);
}

function parseUuidArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || id.length === 0)) return null;
  return [...new Set(value)];
}

function parseBaseScope(row: BaseScopeRow): ConsorcioScope | null {
  if (row.scope_kind === "all_consorcios" && row.consorcio_ids === null) return { kind: "all_consorcios" };
  if (row.scope_kind === "explicit") {
    const consorcioIds = parseUuidArray(row.consorcio_ids);
    return consorcioIds === null ? null : { kind: "explicit", consorcioIds };
  }
  return null;
}

function parseOverride(row: OverrideRow): { featureId: TenantFeatureId; effect: FeatureOverrideEffect } | null {
  if (!isTenantFeatureId(row.feature_id) || (row.effect !== "grant" && row.effect !== "deny")) return null;
  return { featureId: row.feature_id, effect: row.effect };
}

function parseScope(row: FeatureScopeRow): {
  featureId: TenantFeatureId;
  scopeMode: "all_consorcios" | "explicit_list";
  consorcioIds: string[];
} | null {
  if (!isTenantFeatureId(row.feature_id)) return null;
  if (row.scope_mode === "all_consorcios" && row.consorcio_ids === null) {
    return { featureId: row.feature_id, scopeMode: "all_consorcios", consorcioIds: [] };
  }
  if (row.scope_mode === "explicit_list") {
    const consorcioIds = parseUuidArray(row.consorcio_ids);
    if (consorcioIds === null) return null;
    return { featureId: row.feature_id, scopeMode: "explicit_list", consorcioIds };
  }
  return null;
}

function errorViews(): DeskFeatureAccessView[] {
  return featureCatalog
    .filter((entry) => tenantFeatureIds.has(entry.id as TenantFeatureId))
    .map((entry) => ({
      featureId: entry.id,
      lifecycle: entry.lifecycle,
      contextualAvailability: "unavailable",
      rolePresetAllowed: false,
      override: null,
      effectiveAccess: false,
      accessReason: "resolution_error",
      consorcioScope: null,
      state: "error",
    }));
}

export const resolveDeskFeatureAccess = cache(async (): Promise<DeskFeatureAccessView[]> => {
  const supabase = await createClient();
  const [baseResult, overridesResult, scopesResult] = await Promise.all([
    supabase.rpc("get_current_membership_base_scope"),
    supabase.rpc("get_current_membership_feature_overrides"),
    supabase.rpc("get_current_membership_feature_scopes"),
  ]);

  if (baseResult.error || overridesResult.error || scopesResult.error) return errorViews();

  const baseRows = (baseResult.data ?? []) as BaseScopeRow[];
  if (baseRows.length !== 1) return errorViews();
  const baseScope = parseBaseScope(baseRows[0]);
  if (baseScope === null) return errorViews();

  const overrideRows = (overridesResult.data ?? []) as OverrideRow[];
  const scopeRows = (scopesResult.data ?? []) as FeatureScopeRow[];
  const overrides = new Map<TenantFeatureId, FeatureOverrideEffect>();
  const scopes = new Map<
    TenantFeatureId,
    { featureId: TenantFeatureId; scopeMode: "all_consorcios" | "explicit_list"; consorcioIds: string[] }
  >();

  // biome-ignore lint/plugin: corta en la primera fila inválida o repetida y devuelve todo como error
  for (const row of overrideRows) {
    const parsed = parseOverride(row);
    if (parsed === null || overrides.has(parsed.featureId)) return errorViews();
    overrides.set(parsed.featureId, parsed.effect);
  }

  // biome-ignore lint/plugin: corta en la primera fila inválida o repetida y devuelve todo como error
  for (const row of scopeRows) {
    const parsed = parseScope(row);
    if (parsed === null || scopes.has(parsed.featureId)) return errorViews();
    scopes.set(parsed.featureId, parsed);
  }

  return featureCatalog
    .filter((entry) => tenantFeatureIds.has(entry.id as TenantFeatureId))
    .map((entry) => {
      const featureId = entry.id as TenantFeatureId;
      const contextualAvailability: ContextualFeatureAvailability = "available";
      const rolePresetAllowed = true;
      const override = overrides.get(featureId) ?? null;
      const effectiveAccess = resolveFeatureAccess({
        featureId,
        lifecycle: entry.lifecycle,
        contextualAvailability,
        rolePresetAllowed,
        override,
      });
      const featureScope = scopes.get(featureId);
      const consorcioScope = resolveFeatureScope({
        featureId,
        effectiveAccess,
        baseScope,
        override: featureScope
          ? {
              featureId,
              scopeMode: featureScope.scopeMode,
              consorcioIds: featureScope.consorcioIds,
            }
          : null,
      });

      let state: DeskFeatureAccessState;
      if (entry.lifecycle === "coming_soon") state = "coming_soon";
      else if (!effectiveAccess.allowed) state = "denied";
      else if (
        scopeRequiredFeatureIds.has(featureId) &&
        (consorcioScope === null || (consorcioScope.kind === "explicit" && consorcioScope.consorcioIds.length === 0))
      )
        state = "unavailable";
      else state = "resolved";

      return {
        featureId: entry.id,
        lifecycle: entry.lifecycle,
        contextualAvailability,
        rolePresetAllowed,
        override,
        effectiveAccess: effectiveAccess.allowed,
        accessReason: effectiveAccess.reason,
        consorcioScope,
        state,
      };
    });
});

export const getDeskFeatureAccess = cache(async (featureId: FeatureId): Promise<DeskFeatureAccessView | null> => {
  const views = await resolveDeskFeatureAccess();
  return views.find((view) => view.featureId === featureId) ?? null;
});
