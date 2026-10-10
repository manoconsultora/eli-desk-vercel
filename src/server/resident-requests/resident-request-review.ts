import type { SupabaseClient } from "@supabase/supabase-js";

// The database rejects with these messages (eli-database-platform 20261005130000 and 20261010180000).
const REVIEW_ERRORS: Record<string, string> = {
  forbidden: "No tenés permiso para revisar esta solicitud.",
  request_not_pending: "La solicitud ya fue revisada.",
  unit_limit_reached: "La unidad ya tiene 5 residentes activos.",
  request_not_editable: "Esta solicitud ya no se puede corregir.",
  invalid_email: "Ingresá un email válido.",
  email_unchanged: "Es el mismo email que ya tiene la solicitud.",
  contact_blocked: "Ese email está en la blacklist.",
  email_in_use: "Ese email ya lo usa otro vecino de la administración.",
};

export class ResidentRequestReviewError extends Error {}

function throwReviewError(error: { message: string }): never {
  const message = REVIEW_ERRORS[error.message];
  if (message) throw new ResidentRequestReviewError(message);
  throw new Error(error.message);
}

// Returns the resident created or reused for the request.
export async function approveResidentRequest(supabase: SupabaseClient, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc("approve_resident_onboarding_request", { p_request_id: requestId });
  if (error) throwReviewError(error);
  return data as string;
}

export async function rejectResidentRequest(
  supabase: SupabaseClient,
  requestId: string,
  reason: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("reject_resident_onboarding_request", {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) throwReviewError(error);
}

// Fixes the email and, when the request was already reviewed, queues its email again to the new address.
export async function correctResidentRequestEmail(
  supabase: SupabaseClient,
  requestId: string,
  email: string,
): Promise<void> {
  const { error } = await supabase.rpc("correct_resident_request_email", { p_request_id: requestId, p_email: email });
  if (error) throwReviewError(error);
}
