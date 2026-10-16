export type OnboardingPeriod = "all" | "week" | "month" | "year";

type DatedCase = { created_at: string };

export type OnboardingExportRow = {
  organization_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  status: string;
  progress: number;
  requested_plan_code: string | null;
  organization_id: string | null;
  subscription_id: string | null;
  created_at: string;
  updated_at: string;
  safe_failure_code: string | null;
};

function periodRange(period: OnboardingPeriod, now: Date): [Date, Date] | null {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "all") return null;
  if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return [start, end];
  }
  if (period === "month")
    return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
  return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear() + 1, 0, 1)];
}

export function filterCasesByPeriod<T extends DatedCase>(cases: T[], period: OnboardingPeriod, now = new Date()): T[] {
  const range = periodRange(period, now);
  if (!range) return cases;
  const [start, end] = range;
  return cases.filter((item) => {
    const createdAt = Date.parse(item.created_at);
    return Number.isFinite(createdAt) && createdAt >= start.getTime() && createdAt < end.getTime();
  });
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function createOnboardingCsv(rows: OnboardingExportRow[]): string {
  const columns: Array<[string, (row: OnboardingExportRow) => unknown]> = [
    ["Administración", (row) => row.organization_name],
    ["Contacto", (row) => row.contact_name],
    ["Email", (row) => row.contact_email],
    ["Teléfono", (row) => row.contact_phone],
    ["Estado", (row) => row.status],
    ["Progreso (etapas)", (row) => row.progress],
    ["Plan solicitado", (row) => row.requested_plan_code],
    ["Organización vinculada", (row) => row.organization_id],
    ["Suscripción vinculada", (row) => row.subscription_id],
    ["Fecha de alta", (row) => row.created_at],
    ["Última actualización", (row) => row.updated_at],
    ["Incidencia", (row) => row.safe_failure_code],
  ];
  return [
    columns.map(([label]) => csvCell(label)).join(","),
    ...rows.map((row) => columns.map(([, getValue]) => csvCell(getValue(row))).join(",")),
  ].join("\r\n");
}
