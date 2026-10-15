import type { CommunityUnit } from "@/server/communities/community-repository";

export const ALL = "todas";

export type ResidentsFilter = typeof ALL | "con" | "sin";

export type UnitFilters = { search: string; status: string; residents: ResidentsFilter };

export function filterUnits(units: CommunityUnit[], filters: UnitFilters) {
  const query = filters.search.trim().toLowerCase();

  return units.filter((unit) => {
    const matchesSearch =
      !query ||
      unit.number?.toLowerCase().includes(query) ||
      unit.residents.some((resident) => resident.name.toLowerCase().includes(query));
    const matchesStatus = filters.status === ALL || unit.status === filters.status;
    const matchesResidents = filters.residents === ALL || (filters.residents === "con") === unit.residents.length > 0;
    return matchesSearch && matchesStatus && matchesResidents;
  });
}

// Status options come from the data, so unknown values still get an option.
export function statusOptions(units: CommunityUnit[]) {
  return [...new Set(units.map((unit) => unit.status).filter((status): status is string => Boolean(status)))].sort();
}

// PB first, then numbered floors; units on the same floor go A, B, C… Unknown floors go last.
function floorRank(unit: CommunityUnit) {
  const floor = (unit.floor ?? unit.number ?? "").trim().match(/^(pb|\d+)/i)?.[1];
  if (!floor) return Number.POSITIVE_INFINITY;
  return floor.toLowerCase() === "pb" ? 0 : Number(floor) + 1;
}

export function sortUnits(units: CommunityUnit[]) {
  return [...units].sort(
    (a, b) => floorRank(a) - floorRank(b) || (a.number ?? "").localeCompare(b.number ?? "", "es", { numeric: true }),
  );
}
