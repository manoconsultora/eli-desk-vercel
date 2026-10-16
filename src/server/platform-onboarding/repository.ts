import type { OnboardingCase, OnboardingEvent, OnboardingPlan } from "@/lib/platform-onboarding/contracts";

type RpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

export class PlatformOnboardingRepositoryError extends Error {
  readonly safeCode: string;

  constructor(code: string) {
    super(code);
    this.name = "PlatformOnboardingRepositoryError";
    this.safeCode = code;
  }
}

const SAFE_DATABASE_CODES = new Set([
  "platform_owner_required",
  "invalid_idempotency_key",
  "invalid_case_payload",
  "case_not_found",
  "reason_required",
  "unsupported_case_action",
  "invalid_case_transition",
  "invalid_duplicate_link",
  "provisioned_case_cannot_be_linked_as_duplicate",
  "provisioned_case_reopen_requires_successor_case",
  "canonical_case_not_found",
  "commercial_reason_and_mode_required",
  "active_plan_required",
  "free_grant_expiry_must_be_future",
  "invalid_commercial_transition",
  "commercial_approval_required",
  "organization_provisioning_required",
  "confirmed_owner_auth_identity_not_found",
  "owner_acceptance_reason_required",
  "owner_membership_conflict",
  "building_and_units_required",
  "building_capacity_exceeded",
  "unit_capacity_exceeded",
  "unit_number_required",
  "activation_prerequisites_missing",
  "audited_internal_free_grant_required",
  "subscription_not_eligible",
  "active_plan_and_subscription_required",
  "intended_owner_membership_required",
  "same_organization_building_and_unit_required",
  "plan_capacity_exceeded",
  "case_not_ready_to_activate",
  "free_grant_not_found",
  "active_free_grant_not_found",
  "active_tenant_free_revoke_requires_subscription_lifecycle",
  "plan_trial_days_required",
  "invalid_units",
]);

function safeErrorCode(error: { code?: string; message: string }): string {
  const match = [...SAFE_DATABASE_CODES].find((code) => error.message.includes(code));
  return match ?? (error.code === "42501" ? "platform_owner_required" : "command_failed");
}

async function callRpc<T>(client: unknown, name: string, args?: Record<string, unknown>): Promise<T> {
  const rpcClient = client as RpcClient;
  const { data, error } = await rpcClient.rpc(name, args);
  if (error) throw new PlatformOnboardingRepositoryError(safeErrorCode(error));
  return data as T;
}

export async function listCases(client: unknown): Promise<OnboardingCase[]> {
  return (await callRpc<OnboardingCase[]>(client, "platform_onboarding_list_cases")) ?? [];
}

export async function getCase(client: unknown, caseId: string): Promise<OnboardingCase | null> {
  const rows = await callRpc<OnboardingCase[]>(client, "platform_onboarding_get_case", { p_case_id: caseId });
  return rows?.[0] ?? null;
}

export async function getCaseEvents(client: unknown, caseId: string): Promise<OnboardingEvent[]> {
  return (await callRpc<OnboardingEvent[]>(client, "platform_onboarding_get_events", { p_case_id: caseId })) ?? [];
}

export async function listPlans(client: unknown): Promise<OnboardingPlan[]> {
  return (await callRpc<OnboardingPlan[]>(client, "platform_onboarding_list_plans")) ?? [];
}

export async function command<T>(client: unknown, name: string, args: Record<string, unknown>): Promise<T> {
  return callRpc<T>(client, name, args);
}
