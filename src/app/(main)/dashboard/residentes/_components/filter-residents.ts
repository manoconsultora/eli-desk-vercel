import type { ResidentSummary } from "@/server/residents/resident-repository";

export const ALL = "todos";

export type StatusFilter = typeof ALL | "activos" | "inactivos";

export type ResidentFilters = { search: string; communityId: string; status: StatusFilter };

export function filterResidents(residents: ResidentSummary[], filters: ResidentFilters) {
  const query = filters.search.trim().toLowerCase();

  return residents.filter((resident) => {
    const matchesSearch =
      !query || [resident.name, resident.phone, resident.email].some((value) => value?.toLowerCase().includes(query));
    const matchesCommunity =
      filters.communityId === ALL || resident.units.some((unit) => unit.communityId === filters.communityId);
    const matchesStatus = filters.status === ALL || (filters.status === "activos") === resident.active;
    return matchesSearch && matchesCommunity && matchesStatus;
  });
}

export function communityOptions(residents: ResidentSummary[]) {
  const names = new Map<string, string>();
  for (const unit of residents.flatMap((resident) => resident.units)) names.set(unit.communityId, unit.communityName);
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
