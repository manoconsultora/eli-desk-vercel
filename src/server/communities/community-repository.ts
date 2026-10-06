import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConsorcioScope } from "@/lib/access/feature-scope-types";

// Domain uses community/unit; the DB still names them edificios/unidades.
export type CommunitySummary = {
  id: string;
  name: string;
  address: string;
  status: string | null;
  unitCount: number;
  activeTicketCount: number;
};

export type CommunityResident = {
  id: string;
  name: string;
  relationship: string | null;
  isPrimary: boolean;
  phone: string | null;
  email: string | null;
};

export type CommunityUnit = {
  id: string;
  number: string | null;
  floor: string | null;
  type: string | null;
  status: string | null;
  residents: CommunityResident[];
};

export type CommunityTicket = {
  id: string;
  code: string;
  unitNumber: string | null;
  description: string | null;
  status: string;
  createdAt: string;
};

export type CommunityDetail = {
  id: string;
  name: string;
  address: string;
  status: string | null;
  createdAt: string | null;
  units: CommunityUnit[];
  activeTickets: CommunityTicket[];
};

const ACTIVE_TICKET_STATUSES = ["abierto", "en_proceso"];

type CommunityRow = { id: string; nombre: string; direccion: string; estado: string | null };

function countBy(rows: { edificio_id: unknown }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = String(row.edificio_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function listCommunities(
  supabase: SupabaseClient,
  organizationId: string,
  scope: ConsorcioScope,
): Promise<CommunitySummary[]> {
  if (scope.kind === "explicit" && scope.consorcioIds.length === 0) return [];

  let communitiesQuery = supabase
    .from("edificios")
    .select("id, nombre, direccion, estado")
    .eq("organization_id", organizationId)
    .order("nombre");
  let unitsQuery = supabase.from("unidades").select("edificio_id").eq("organization_id", organizationId);
  let ticketsQuery = supabase
    .from("tickets")
    .select("edificio_id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ACTIVE_TICKET_STATUSES);

  if (scope.kind === "explicit") {
    communitiesQuery = communitiesQuery.in("id", scope.consorcioIds);
    unitsQuery = unitsQuery.in("edificio_id", scope.consorcioIds);
    ticketsQuery = ticketsQuery.in("edificio_id", scope.consorcioIds);
  }

  const [communities, units, tickets] = await Promise.all([communitiesQuery, unitsQuery, ticketsQuery]);
  if (communities.error) throw new Error(communities.error.message);
  if (units.error) throw new Error(units.error.message);
  if (tickets.error) throw new Error(tickets.error.message);

  const unitCounts = countBy(units.data ?? []);
  const ticketCounts = countBy(tickets.data ?? []);

  return ((communities.data ?? []) as CommunityRow[]).map((row) => ({
    id: row.id,
    name: row.nombre,
    address: row.direccion,
    status: row.estado,
    unitCount: unitCounts.get(row.id) ?? 0,
    activeTicketCount: ticketCounts.get(row.id) ?? 0,
  }));
}

type UnitRow = { id: string; numero: string | null; piso: string | null; tipo: string | null; estado: string | null };
type LinkRow = {
  unidad_id: string;
  residente_id: string;
  relationship_type: string | null;
  is_primary: boolean | null;
};
type ResidentRow = { id: string; nombre_completo: string | null; telefono: string | null; email: string | null };
type TicketRow = {
  id: string;
  ticket_code: string;
  unidad_id: string | null;
  description: string | null;
  status: string;
  created_at: string;
};

export async function getCommunityDetail(
  supabase: SupabaseClient,
  organizationId: string,
  scope: ConsorcioScope,
  communityId: string,
): Promise<CommunityDetail | null> {
  if (scope.kind === "explicit" && !scope.consorcioIds.includes(communityId)) return null;

  // Units and tickets are filtered by the same org and community, so they can load alongside the community check.
  const [community, units, tickets] = await Promise.all([
    supabase
      .from("edificios")
      .select("id, nombre, direccion, estado, created_at")
      .eq("id", communityId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("unidades")
      .select("id, numero, piso, tipo, estado")
      .eq("organization_id", organizationId)
      .eq("edificio_id", communityId)
      .order("numero"),
    supabase
      .from("tickets")
      .select("id, ticket_code, unidad_id, description, status, created_at")
      .eq("organization_id", organizationId)
      .eq("edificio_id", communityId)
      .is("deleted_at", null)
      .in("status", ACTIVE_TICKET_STATUSES)
      .order("created_at", { ascending: false }),
  ]);
  if (community.error) throw new Error(community.error.message);
  if (!community.data) return null;
  if (units.error) throw new Error(units.error.message);
  if (tickets.error) throw new Error(tickets.error.message);

  const unitRows = (units.data ?? []) as UnitRow[];
  const unitNumberById = new Map(unitRows.map((unit) => [unit.id, unit.numero]));
  const residentsByUnit = await listResidentsByUnit(
    supabase,
    organizationId,
    unitRows.map((unit) => unit.id),
  );

  return {
    id: community.data.id,
    name: community.data.nombre,
    address: community.data.direccion,
    status: community.data.estado,
    createdAt: community.data.created_at,
    units: unitRows.map((unit) => ({
      id: unit.id,
      number: unit.numero,
      floor: unit.piso,
      type: unit.tipo,
      status: unit.estado,
      residents: residentsByUnit.get(unit.id) ?? [],
    })),
    activeTickets: ((tickets.data ?? []) as TicketRow[]).map((ticket) => ({
      id: ticket.id,
      code: ticket.ticket_code,
      unitNumber: ticket.unidad_id ? (unitNumberById.get(ticket.unidad_id) ?? null) : null,
      description: ticket.description,
      status: ticket.status,
      createdAt: ticket.created_at,
    })),
  };
}

async function listResidentsByUnit(supabase: SupabaseClient, organizationId: string, unitIds: string[]) {
  const residentsByUnit = new Map<string, CommunityResident[]>();
  if (unitIds.length === 0) return residentsByUnit;

  const links = await supabase
    .from("resident_unit_links")
    .select("unidad_id, residente_id, relationship_type, is_primary")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .in("unidad_id", unitIds);
  if (links.error) throw new Error(links.error.message);

  const linkRows = (links.data ?? []) as LinkRow[];
  if (linkRows.length === 0) return residentsByUnit;

  const residents = await supabase
    .from("residentes")
    .select("id, nombre_completo, telefono, email")
    .eq("organization_id", organizationId)
    .eq("activo", true)
    .in("id", [...new Set(linkRows.map((link) => link.residente_id))]);
  if (residents.error) throw new Error(residents.error.message);

  const residentById = new Map(((residents.data ?? []) as ResidentRow[]).map((row) => [row.id, row]));
  for (const link of linkRows) {
    const resident = residentById.get(link.residente_id);
    if (!resident) continue;
    const unitResidents = residentsByUnit.get(link.unidad_id) ?? [];
    unitResidents.push({
      id: resident.id,
      name: resident.nombre_completo ?? "Sin nombre",
      relationship: link.relationship_type,
      isPrimary: link.is_primary === true,
      phone: resident.telefono,
      email: resident.email,
    });
    residentsByUnit.set(link.unidad_id, unitResidents);
  }
  for (const unitResidents of residentsByUnit.values()) {
    unitResidents.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  }
  return residentsByUnit;
}

export type NewUnit = { number: string; floor: string | null };
export type CreateUnitResult = { ok: true } | { ok: false; reason: "duplicate" | "forbidden" };

// RLS decides who can insert (TENANT_OWNER, or ADMIN and OPERATOR assigned to the consorcio).
export async function createUnit(
  supabase: SupabaseClient,
  organizationId: string,
  communityId: string,
  unit: NewUnit,
): Promise<CreateUnitResult> {
  const { error } = await supabase.from("unidades").insert({
    organization_id: organizationId,
    edificio_id: communityId,
    numero: unit.number,
    piso: unit.floor,
  });
  if (!error) return { ok: true };
  // unidades_edificio_id_numero_key: the number already exists in this consorcio.
  if (error.code === "23505") return { ok: false, reason: "duplicate" };
  if (error.code === "42501") return { ok: false, reason: "forbidden" };
  throw new Error(error.message);
}
