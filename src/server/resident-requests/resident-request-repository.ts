import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConsorcioScope } from "@/lib/access/feature-scope-types";

export type ResidentRequest = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  communityName: string;
  communityAddress: string | null;
  communityUnitCount: number;
  unitNumber: string | null;
  relationship: string;
  status: string;
  rejectionReason: string | null;
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
  rejection_reason: string | null;
  created_at: string;
};
type UnitRow = { id: string; numero: string | null; edificio_id: string };
type CommunityRow = { id: string; nombre: string; direccion: string | null };

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
      "id, edificio_id, unidad_id, first_name, last_name, email, phone, relationship_type_code, status, rejection_reason, created_at",
    )
    .eq("organization_id", organizationId);
  let unitsQuery = supabase.from("unidades").select("id, numero, edificio_id").eq("organization_id", organizationId);
  let communitiesQuery = supabase
    .from("edificios")
    .select("id, nombre, direccion")
    .eq("organization_id", organizationId);
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
  const unitRows = throwOnError<UnitRow[]>(units);
  const unitById = new Map(unitRows.map((unit) => [unit.id, unit]));
  const unitCountByCommunity = new Map<string, number>();
  for (const unit of unitRows) {
    unitCountByCommunity.set(unit.edificio_id, (unitCountByCommunity.get(unit.edificio_id) ?? 0) + 1);
  }
  const communityById = new Map(throwOnError<CommunityRow[]>(communities).map((row) => [row.id, row]));

  return throwOnError<RequestRow[]>(requests).map((row) => ({
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    communityName: communityById.get(row.edificio_id)?.nombre ?? "Sin consorcio",
    communityAddress: communityById.get(row.edificio_id)?.direccion ?? null,
    communityUnitCount: unitCountByCommunity.get(row.edificio_id) ?? 0,
    unitNumber: unitById.get(row.unidad_id)?.numero ?? null,
    relationship: row.relationship_type_code,
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  }));
}
