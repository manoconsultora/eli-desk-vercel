import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConsorcioScope } from "@/lib/access/feature-scope-types";
import { normalizePhone } from "@/lib/phone";

import type { ResidentDetails } from "./update-resident";

// The database rejects with these messages (eli-database-platform 20261012200000).
const ADD_ERRORS: Record<string, string> = {
  forbidden: "No tenés permiso para dar de alta residentes en esa unidad.",
  invalid_relationship: "Elegí la relación con la unidad.",
  invalid_name: "Ingresá el nombre.",
  invalid_email: "Ingresá un email válido.",
  invalid_phone: "Ingresá un celular válido, con código de área.",
  contact_blocked: "Ese email o teléfono está en la blacklist.",
  unit_limit_reached: "La unidad ya tiene 5 residentes activos.",
  already_in_unit: "Ya es residente de esa unidad.",
};

export class AddResidentToUnitError extends Error {}

export type UnitOption = { id: string; number: string; communityId: string; communityName: string };
export type RelationshipOption = { code: string; label: string };

// Creates the resident, or reuses the one with that email without overwriting their details.
export async function addResidentToUnit(
  supabase: SupabaseClient,
  { unitId, relationship }: { unitId: string; relationship: string },
  { name, email, phone }: ResidentDetails,
): Promise<{ created: boolean }> {
  const { data, error } = await supabase
    .rpc("add_resident_to_unit", {
      p_unidad_id: unitId,
      p_name: name,
      p_email: email,
      p_phone: normalizePhone(phone) ?? phone,
      p_relationship_type: relationship,
    })
    .single<{ resident_id: string; created: boolean }>();
  if (error) {
    const message = ADD_ERRORS[error.message];
    if (message) throw new AddResidentToUnitError(message);
    throw new Error(error.message);
  }
  return { created: data.created };
}

function throwOnError<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

// The units a resident can be added to: every unit of the consorcios in scope.
export async function listUnitOptions(
  supabase: SupabaseClient,
  organizationId: string,
  scope: ConsorcioScope,
): Promise<UnitOption[]> {
  if (scope.kind === "explicit" && scope.consorcioIds.length === 0) return [];

  let unitsQuery = supabase.from("unidades").select("id, numero, edificio_id").eq("organization_id", organizationId);
  let communitiesQuery = supabase.from("edificios").select("id, nombre").eq("organization_id", organizationId);
  if (scope.kind === "explicit") {
    unitsQuery = unitsQuery.in("edificio_id", scope.consorcioIds);
    communitiesQuery = communitiesQuery.in("id", scope.consorcioIds);
  }
  const [units, communities] = await Promise.all([unitsQuery, communitiesQuery]);

  const communityById = new Map(
    throwOnError<{ id: string; nombre: string }[]>(communities).map((row) => [row.id, row.nombre]),
  );
  return throwOnError<{ id: string; numero: string; edificio_id: string }[]>(units)
    .flatMap((unit) => {
      const communityName = communityById.get(unit.edificio_id);
      return communityName ? [{ id: unit.id, number: unit.numero, communityId: unit.edificio_id, communityName }] : [];
    })
    .sort(
      (a, b) =>
        a.communityName.localeCompare(b.communityName) ||
        a.number.localeCompare(b.number, undefined, { numeric: true }),
    );
}

export async function listRelationshipOptions(supabase: SupabaseClient): Promise<RelationshipOption[]> {
  const result = await supabase
    .from("resident_relationship_types")
    .select("code, label")
    .eq("active", true)
    .order("sort_order");
  return throwOnError<RelationshipOption[]>(result);
}
