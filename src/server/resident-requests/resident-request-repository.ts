import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConsorcioScope } from "@/lib/access/feature-scope-types";

export type ResidentRequest = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  communityName: string;
  unitNumber: string | null;
  relationship: string;
  status: string;
  createdAt: string;
};

type RequestRow = {
  id: string;
  edificio_id: string;
  unidad_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  relationship_type_code: string;
  status: string;
  created_at: string;
};
type UnitRow = { id: string; numero: string | null };
type CommunityRow = { id: string; nombre: string };

function throwOnError<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

export async function listResidentRequests(
  supabase: SupabaseClient,
  organizationId: string,
  scope: ConsorcioScope,
): Promise<ResidentRequest[]> {
  if (scope.kind === "explicit" && scope.consorcioIds.length === 0) return [];

  let requestsQuery = supabase
    .from("resident_onboarding_requests")
    .select(
      "id, edificio_id, unidad_id, first_name, last_name, email, phone, relationship_type_code, status, created_at",
    )
    .eq("organization_id", organizationId);
  let unitsQuery = supabase.from("unidades").select("id, numero").eq("organization_id", organizationId);
  let communitiesQuery = supabase.from("edificios").select("id, nombre").eq("organization_id", organizationId);
  if (scope.kind === "explicit") {
    requestsQuery = requestsQuery.in("edificio_id", scope.consorcioIds);
    unitsQuery = unitsQuery.in("edificio_id", scope.consorcioIds);
    communitiesQuery = communitiesQuery.in("id", scope.consorcioIds);
  }

  const [requests, units, communities] = await Promise.all([
    requestsQuery.order("created_at", { ascending: false }),
    unitsQuery,
    communitiesQuery,
  ]);
  const unitById = new Map(throwOnError<UnitRow[]>(units).map((unit) => [unit.id, unit]));
  const communityById = new Map(throwOnError<CommunityRow[]>(communities).map((row) => [row.id, row]));

  return throwOnError<RequestRow[]>(requests).map((row) => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    phone: row.phone,
    email: row.email,
    communityName: communityById.get(row.edificio_id)?.nombre ?? "Sin consorcio",
    unitNumber: unitById.get(row.unidad_id)?.numero ?? null,
    relationship: row.relationship_type_code,
    status: row.status,
    createdAt: row.created_at,
  }));
}
