import type { SupabaseClient } from "@supabase/supabase-js";

// ELI Join resolves the token from this URL; the QR encodes the same URL.
export const JOIN_BASE_URL = "https://join.eli.ma-no.work";

export type JoinLinkSummary = {
  id: string;
  status: "active" | "revoked";
  createdAt: string;
  revokedAt: string | null;
  // null for links created before the token was stored: their QR can't be rebuilt.
  url: string | null;
};

export type CreatedJoinLink = { id: string; url: string; createdAt: string };

type JoinLinkRow = {
  id: string;
  status: "active" | "revoked";
  created_at: string;
  revoked_at: string | null;
  token: string | null;
};
type CreatedRow = { id: string; token: string; created_at: string };

// RLS limits the rows to consorcios the user can access. Newest first.
export async function listJoinLinks(supabase: SupabaseClient, communityId: string): Promise<JoinLinkSummary[]> {
  const { data, error } = await supabase
    .from("resident_join_links")
    .select("id, status, created_at, revoked_at, token")
    .eq("edificio_id", communityId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data as JoinLinkRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    url: row.token ? `${JOIN_BASE_URL}/${row.token}` : null,
  }));
}

// The database generates the token; Desk only builds the URL from it.
export async function createJoinLink(supabase: SupabaseClient, communityId: string): Promise<CreatedJoinLink> {
  const { data, error } = await supabase.rpc("create_resident_join_link", { p_edificio_id: communityId });
  if (error) throw new Error(error.message);

  const [row] = data as CreatedRow[];
  return { id: row.id, url: `${JOIN_BASE_URL}/${row.token}`, createdAt: row.created_at };
}

// Revoking is final; a link that was already revoked stays as is.
export async function revokeJoinLink(supabase: SupabaseClient, linkId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_resident_join_link", { p_link_id: linkId });
  if (error) throw new Error(error.message);
}
