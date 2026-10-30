import type { SupabaseClient } from "@supabase/supabase-js";

import type { Carpeta } from "@/lib/comprobantes/comprobante-rules";

export type ComprobanteSummary = {
  id: string;
  // First day of the month, as the database stores it: "2026-10-01". Null in the folders without month.
  period: string | null;
  name: string;
  uploadedAt: string;
  sizeBytes: number;
  // The uploader's name, saved when it was uploaded.
  uploadedBy: string;
};

export type CreatedComprobante = { id: string; storagePath: string };

export type ComprobanteRef = { organizationId: string; communityId: string; storagePath: string; uploaded: boolean };

type ComprobanteRow = {
  id: string;
  periodo: string | null;
  nombre: string;
  uploaded_at: string;
  size_bytes: number;
  created_by_name: string;
};
type CreatedRow = { comprobante_id: string; storage_path: string };

// RLS limits the rows to the consorcios where the user has Documentos; the caller checks the active organization.
// Only the folder's files already in the bucket, newest month first.
export async function listComprobantes(
  supabase: SupabaseClient,
  communityId: string,
  carpeta: Carpeta,
): Promise<ComprobanteSummary[]> {
  const { data, error } = await supabase
    .from("consorcio_comprobantes")
    .select("id, periodo, nombre, uploaded_at, size_bytes, created_by_name")
    .eq("edificio_id", communityId)
    .eq("carpeta", carpeta)
    .not("uploaded_at", "is", null)
    .order("periodo", { ascending: false })
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);

  return (data as ComprobanteRow[]).map((row) => ({
    id: row.id,
    period: row.periodo,
    name: row.nombre,
    uploadedAt: row.uploaded_at,
    sizeBytes: row.size_bytes,
    uploadedBy: row.created_by_name,
  }));
}

// The database checks the role and chooses the path; the file name never goes into it.
export async function createComprobante(
  supabase: SupabaseClient,
  input: { communityId: string; carpeta: Carpeta; period: string | null; name: string },
): Promise<CreatedComprobante> {
  const { data, error } = await supabase.rpc("create_consorcio_comprobante", {
    p_edificio_id: input.communityId,
    p_periodo: input.period,
    p_nombre: input.name,
    p_carpeta: input.carpeta,
  });
  if (error) throw new Error(error.message);

  const [row] = data as CreatedRow[];
  return { id: row.comprobante_id, storagePath: row.storage_path };
}

// Fails with file_not_uploaded if the file is not in the bucket yet.
export async function confirmComprobante(supabase: SupabaseClient, comprobanteId: string): Promise<void> {
  const { error } = await supabase.rpc("confirm_consorcio_comprobante", { p_comprobante_id: comprobanteId });
  if (error) throw new Error(error.message);
}

// Returns the path so the caller can delete the file through the Storage API.
export async function deleteComprobante(supabase: SupabaseClient, comprobanteId: string): Promise<string> {
  const { data, error } = await supabase.rpc("delete_consorcio_comprobante", { p_comprobante_id: comprobanteId });
  if (error) throw new Error(error.message);
  return data as string;
}

// Through RLS: a row the user can't see comes back as null. Pending rows too, so a failed upload can be removed.
export async function findComprobanteRef(
  supabase: SupabaseClient,
  comprobanteId: string,
): Promise<ComprobanteRef | null> {
  const { data, error } = await supabase
    .from("consorcio_comprobantes")
    .select("organization_id, edificio_id, storage_path, uploaded_at")
    .eq("id", comprobanteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    organization_id: string;
    edificio_id: string;
    storage_path: string;
    uploaded_at: string | null;
  };
  return {
    organizationId: row.organization_id,
    communityId: row.edificio_id,
    storagePath: row.storage_path,
    uploaded: row.uploaded_at !== null,
  };
}

// Through RLS: the organization of a consorcio the user can see, or null.
export async function findCommunityOrganization(supabase: SupabaseClient, communityId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("edificios")
    .select("organization_id")
    .eq("id", communityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { organization_id: string } | null)?.organization_id ?? null;
}
