"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { normalizeEmail, parseUnitRows, validateCommercialSelection } from "@/lib/platform-onboarding/validation";
import { noSendAuthInvitationAdapter } from "@/server/platform-onboarding/auth-invitation";
import { requireActivePlatformOwner } from "@/server/platform-onboarding/authorization";
import { command, PlatformOnboardingRepositoryError } from "@/server/platform-onboarding/repository";

const caseIdSchema = z.string().uuid();
const actionSchema = z.enum([
  "start_review",
  "commercial_review",
  "cancel",
  "reject",
  "reopen",
  "retry",
  "mark_duplicate",
]);

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function safeCode(error: unknown): string {
  if (error instanceof PlatformOnboardingRepositoryError) return error.safeCode;
  if (error instanceof z.ZodError) return "invalid_input";
  if (error instanceof Error && error.message === "invalid_units") return "invalid_units";
  return "command_failed";
}

async function redirectAfterCommand(path: string, operation: () => Promise<unknown>) {
  let result: unknown;
  try {
    result = await operation();
  } catch (error) {
    redirect(`${path}?notice=${encodeURIComponent(safeCode(error))}`);
  }
  revalidatePath("/platform/onboarding");
  if (path !== "/platform/onboarding") revalidatePath(path);
  const destination = typeof result === "string" ? `/platform/onboarding/${result}` : path;
  redirect(`${destination}?notice=updated`);
}

export async function createOnboardingCaseAction(formData: FormData) {
  const parsed = z
    .object({
      contactName: z.string().trim().min(2).max(160),
      contactEmail: z.string().trim().email().max(254),
      contactPhone: z.string().trim().max(80).optional(),
      organizationName: z.string().trim().min(2).max(200),
      requestSummary: z.string().trim().min(3).max(3000),
      requestedPlanCode: z.string().trim().max(80).optional(),
      idempotencyKey: z.string().min(8).max(160),
    })
    .parse({
      contactName: readString(formData, "contact_name"),
      contactEmail: readString(formData, "contact_email"),
      contactPhone: readString(formData, "contact_phone"),
      organizationName: readString(formData, "organization_name"),
      requestSummary: readString(formData, "request_summary"),
      requestedPlanCode: readString(formData, "requested_plan_code"),
      idempotencyKey: readString(formData, "idempotency_key"),
    });

  await redirectAfterCommand("/platform/onboarding", async () => {
    const { supabase } = await requireActivePlatformOwner();
    const result = await command<string>(supabase, "platform_onboarding_create_case", {
      p_payload: {
        contact_name: parsed.contactName,
        contact_email: normalizeEmail(parsed.contactEmail),
        contact_phone: parsed.contactPhone || null,
        organization_name: parsed.organizationName,
        request_summary: parsed.requestSummary,
        requested_plan_code: parsed.requestedPlanCode || null,
      },
      p_idempotency_key: parsed.idempotencyKey,
    });
    return result;
  });
}

export async function transitionOnboardingCaseAction(formData: FormData) {
  const caseId = caseIdSchema.parse(readString(formData, "case_id"));
  const action = actionSchema.parse(readString(formData, "action"));
  const reason = z.string().trim().min(3).max(500).parse(readString(formData, "reason"));
  const duplicateOf = readString(formData, "duplicate_of");
  const path = `/platform/onboarding/${caseId}`;
  await redirectAfterCommand(path, async () => {
    const { supabase } = await requireActivePlatformOwner();
    await command(supabase, "platform_onboarding_transition_case", {
      p_case_id: caseId,
      p_action: action,
      p_reason: reason,
      p_duplicate_of: duplicateOf || null,
    });
  });
}

export async function assignOnboardingCommercialAction(formData: FormData) {
  const caseId = caseIdSchema.parse(readString(formData, "case_id"));
  const mode = readString(formData, "commercial_mode");
  const planId = readString(formData, "plan_id");
  const reason = readString(formData, "reason");
  const freeExpiryRaw = readString(formData, "free_expires_at");
  const validation = validateCommercialSelection({ mode, planId, reason, freeExpiresAt: freeExpiryRaw || undefined });
  if (!validation.ok) throw new Error(validation.code);
  const expiresAt = freeExpiryRaw ? new Date(freeExpiryRaw).toISOString() : null;
  const path = `/platform/onboarding/${caseId}`;
  await redirectAfterCommand(path, async () => {
    const { supabase } = await requireActivePlatformOwner();
    await command(supabase, "platform_onboarding_assign_commercial", {
      p_case_id: caseId,
      p_plan_id: planId,
      p_mode: validation.mode,
      p_reason: reason,
      p_expires_at: expiresAt,
    });
  });
}

export async function provisionOnboardingOrganizationAction(formData: FormData) {
  const caseId = caseIdSchema.parse(readString(formData, "case_id"));
  const path = `/platform/onboarding/${caseId}`;
  await redirectAfterCommand(path, async () => {
    const { supabase } = await requireActivePlatformOwner();
    const invitation = await noSendAuthInvitationAdapter.prepare({
      caseId,
      recipientEmail: readString(formData, "owner_email"),
      role: "TENANT_OWNER",
    });
    if (invitation.state !== "deferred_no_send") throw new Error("unsafe_invitation_adapter");
    try {
      await command(supabase, "platform_onboarding_provision_organization", { p_case_id: caseId });
    } catch (error) {
      await recordSafeFailure(supabase, { caseId, stage: "provisioning", error });
      throw error;
    }
  });
}

export async function verifyOwnerAcceptanceAction(formData: FormData) {
  const caseId = caseIdSchema.parse(readString(formData, "case_id"));
  const reason = z.string().trim().min(3).max(500).parse(readString(formData, "reason"));
  const path = `/platform/onboarding/${caseId}`;
  await redirectAfterCommand(path, async () => {
    const { supabase } = await requireActivePlatformOwner();
    await command(supabase, "platform_onboarding_verify_owner_acceptance", { p_case_id: caseId, p_reason: reason });
  });
}

export async function addInitialPropertyAction(formData: FormData) {
  const caseId = caseIdSchema.parse(readString(formData, "case_id"));
  const buildingName = z.string().trim().min(2).max(200).parse(readString(formData, "building_name"));
  const buildingAddress = z.string().trim().min(2).max(300).parse(readString(formData, "building_address"));
  const unitRows = parseUnitRows(readString(formData, "unit_numbers"));
  if (unitRows.length > 1000) throw new Error("invalid_units");
  const path = `/platform/onboarding/${caseId}`;
  await redirectAfterCommand(path, async () => {
    const { supabase } = await requireActivePlatformOwner();
    try {
      await command(supabase, "platform_onboarding_add_initial_property", {
        p_case_id: caseId,
        p_edificio_name: buildingName,
        p_edificio_address: buildingAddress,
        p_units: unitRows,
      });
    } catch (error) {
      await recordSafeFailure(supabase, { caseId, stage: "initial_data", error });
      throw error;
    }
  });
}

export async function activateOnboardingCaseAction(formData: FormData) {
  const caseId = caseIdSchema.parse(readString(formData, "case_id"));
  const path = `/platform/onboarding/${caseId}`;
  await redirectAfterCommand(path, async () => {
    const { supabase } = await requireActivePlatformOwner();
    try {
      await command(supabase, "platform_onboarding_activate", { p_case_id: caseId });
    } catch (error) {
      await recordSafeFailure(supabase, { caseId, stage: "activation", error });
      throw error;
    }
  });
}

export async function revokeInternalFreeGrantAction(formData: FormData) {
  const caseId = caseIdSchema.parse(readString(formData, "case_id"));
  const reason = z.string().trim().min(3).max(500).parse(readString(formData, "reason"));
  const path = `/platform/onboarding/${caseId}`;
  await redirectAfterCommand(path, async () => {
    const { supabase } = await requireActivePlatformOwner();
    await command(supabase, "platform_onboarding_revoke_free_grant", { p_case_id: caseId, p_reason: reason });
  });
}

async function recordSafeFailure(
  client: unknown,
  { caseId, stage, error }: { caseId: string; stage: string; error: unknown },
) {
  try {
    await command(client, "platform_onboarding_mark_failure", {
      p_case_id: caseId,
      p_stage: stage,
      p_safe_code: safeCode(error),
    });
  } catch {
    // Preserve the original safe outcome; never expose provider/database detail.
  }
}
