import type { SupabaseClient } from "@supabase/supabase-js";

export type BlacklistEntry = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneDigits: string | null;
  reason: string | null;
  createdAt: string;
};

type BlacklistRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_digits: string | null;
  reason: string | null;
  created_at: string;
};

export class BlacklistError extends Error {}

function throwBlacklistError(error: { message: string }, forbidden: string): never {
  if (error.message === "forbidden") throw new BlacklistError(forbidden);
  throw new Error(error.message);
}

// The blacklist applies to the whole organization: it isn't filtered by consorcio.
export async function listBlacklist(supabase: SupabaseClient, organizationId: string): Promise<BlacklistEntry[]> {
  const { data, error } = await supabase
    .from("resident_blacklist")
    .select("id, name, email, phone, phone_digits, reason, created_at")
    .eq("organization_id", organizationId)
    .is("removed_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as BlacklistRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    phoneDigits: row.phone_digits,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

export async function addToBlacklist(supabase: SupabaseClient, requestId: string, reason: string | null) {
  const { error } = await supabase.rpc("add_resident_to_blacklist", { p_request_id: requestId, p_reason: reason });
  if (error) throwBlacklistError(error, "No tenés permiso para agregar este contacto a la blacklist.");
}

export async function removeFromBlacklist(supabase: SupabaseClient, entryId: string) {
  const { error } = await supabase.rpc("remove_resident_from_blacklist", { p_entry_id: entryId });
  if (error) throwBlacklistError(error, "No tenés permiso para quitar contactos de la blacklist.");
}

// Same match as the database: email ignoring case, phone by its digits.
export function isBlacklisted(contact: { email: string; phone: string | null }, entries: BlacklistEntry[]) {
  const email = contact.email.trim().toLowerCase();
  const digits = contact.phone?.replace(/\D/g, "") || null;
  return entries.some((entry) => entry.email === email || (digits !== null && entry.phoneDigits === digits));
}
