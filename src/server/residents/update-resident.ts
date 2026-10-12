import type { SupabaseClient } from "@supabase/supabase-js";

// The database rejects with these messages (eli-database-platform 20261012150000).
const UPDATE_ERRORS: Record<string, string> = {
  forbidden: "No tenés permiso para editar a este residente.",
  invalid_name: "Ingresá el nombre.",
  invalid_email: "Ingresá un email válido.",
  invalid_phone: "Ingresá un teléfono válido, con código de área.",
  email_in_use: "Ese email ya lo usa otro residente de la administración.",
};

export class UpdateResidentError extends Error {}

export type ResidentDetails = { name: string; email: string; phone: string };

export async function updateResident(
  supabase: SupabaseClient,
  residentId: string,
  { name, email, phone }: ResidentDetails,
): Promise<void> {
  const { error } = await supabase.rpc("update_resident", {
    p_resident_id: residentId,
    p_name: name,
    p_email: email,
    p_phone: phone,
  });
  if (!error) return;
  const message = UPDATE_ERRORS[error.message];
  if (message) throw new UpdateResidentError(message);
  throw new Error(error.message);
}
