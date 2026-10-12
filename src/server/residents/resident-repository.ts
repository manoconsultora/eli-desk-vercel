import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConsorcioScope } from "@/lib/access/feature-scope-types";

// Domain uses resident/unit/community; the DB still names them residentes/unidades/edificios.
export type ResidentUnit = {
  linkId: string;
  unitId: string;
  unitNumber: string | null;
  communityId: string;
  communityName: string;
  relationship: string | null;
  isPrimary: boolean;
};

export type ResidentSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  units: ResidentUnit[];
};

type ResidentRow = {
  id: string;
  nombre_completo: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean | null;
};
type LinkRow = {
  id: string;
  residente_id: string;
  unidad_id: string;
  relationship_type: string | null;
  is_primary: boolean | null;
};
type UnitRow = { id: string; numero: string | null; edificio_id: string };
type CommunityRow = { id: string; nombre: string };

function throwOnError<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

export async function listResidents(
  supabase: SupabaseClient,
  organizationId: string,
  scope: ConsorcioScope,
): Promise<ResidentSummary[]> {
  if (scope.kind === "explicit" && scope.consorcioIds.length === 0) return [];

  let unitsQuery = supabase.from("unidades").select("id, numero, edificio_id").eq("organization_id", organizationId);
  let communitiesQuery = supabase.from("edificios").select("id, nombre").eq("organization_id", organizationId);
  if (scope.kind === "explicit") {
    unitsQuery = unitsQuery.in("edificio_id", scope.consorcioIds);
    communitiesQuery = communitiesQuery.in("id", scope.consorcioIds);
  }

  const [residents, links, units, communities] = await Promise.all([
    supabase
      .from("residentes")
      .select("id, nombre_completo, telefono, email, activo")
      .eq("organization_id", organizationId)
      .order("nombre_completo"),
    supabase
      .from("resident_unit_links")
      .select("id, residente_id, unidad_id, relationship_type, is_primary")
      .eq("organization_id", organizationId)
      .eq("active", true),
    unitsQuery,
    communitiesQuery,
  ]);

  const unitById = new Map(throwOnError<UnitRow[]>(units).map((unit) => [unit.id, unit]));
  const communityById = new Map(throwOnError<CommunityRow[]>(communities).map((row) => [row.id, row]));

  const unitsByResident = new Map<string, ResidentUnit[]>();
  for (const link of throwOnError<LinkRow[]>(links)) {
    const unit = unitById.get(link.unidad_id);
    const community = unit ? communityById.get(unit.edificio_id) : undefined;
    // Units outside the scope were not fetched, so their links drop here.
    if (!unit || !community) continue;
    const residentUnits = unitsByResident.get(link.residente_id) ?? [];
    residentUnits.push({
      linkId: link.id,
      unitId: unit.id,
      unitNumber: unit.numero,
      communityId: community.id,
      communityName: community.nombre,
      relationship: link.relationship_type,
      isPrimary: link.is_primary === true,
    });
    unitsByResident.set(link.residente_id, residentUnits);
  }

  return throwOnError<ResidentRow[]>(residents)
    .map((row) => ({
      id: row.id,
      name: row.nombre_completo ?? "Sin nombre",
      phone: row.telefono,
      email: row.email,
      active: row.activo === true,
      units: unitsByResident.get(row.id) ?? [],
    }))
    .filter((resident) => scope.kind === "all_consorcios" || resident.units.length > 0);
}
