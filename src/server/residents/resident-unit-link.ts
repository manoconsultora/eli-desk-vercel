import type { SupabaseClient } from "@supabase/supabase-js";

// The database rejects with these messages (eli-database-platform 20261012120000).
const END_ERRORS: Record<string, string> = {
  forbidden: "No tenés permiso para dar de baja a este residente.",
  link_not_active: "Ya estaba dado de baja de esa unidad.",
};

export class EndResidentUnitLinkError extends Error {}

// The link stays as history; if it was the resident's last unit, the resident becomes inactive.
export async function endResidentUnitLink(supabase: SupabaseClient, linkId: string): Promise<void> {
  const { error } = await supabase.rpc("end_resident_unit_link", { p_link_id: linkId });
  if (!error) return;
  const message = END_ERRORS[error.message];
  if (message) throw new EndResidentUnitLinkError(message);
  throw new Error(error.message);
}
