import type { ComprobanteSummary } from "@/server/comprobantes/comprobante-repository";

export function filterComprobantes(comprobantes: ComprobanteSummary[], search: string) {
  const query = search.trim().toLowerCase();
  return query ? comprobantes.filter((comprobante) => comprobante.name.toLowerCase().includes(query)) : comprobantes;
}

// Keeps the order it gets (newest month first), so the groups come out in that order too.
export function groupByPeriod(comprobantes: ComprobanteSummary[]): [string, ComprobanteSummary[]][] {
  const groups = new Map<string, ComprobanteSummary[]>();
  comprobantes.forEach((comprobante) => {
    groups.set(comprobante.period, [...(groups.get(comprobante.period) ?? []), comprobante]);
  });
  return [...groups.entries()];
}
