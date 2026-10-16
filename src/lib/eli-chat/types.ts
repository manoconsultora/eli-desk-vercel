export type FiscalSnapshot = {
  email?: string | null;
  organization_id: string;
  user_id: string;
  answers: Record<string, string | string[]>;
  revision: number;
  last_request_id: string | null;
  confirmed_revision: number | null;
  confirmed_at: string | null;
  confirmed_data: Record<string, string | string[]> | null;
  progress: {
    version: number;
    status: "draft" | "confirmed";
    step: number;
    review_mode: "confirm" | "chooseField" | null;
  } | null;
};
export type FiscalSave = {
  answers: Record<string, string | string[]>;
  expectedRevision: number;
  requestId: string;
  step: number;
  reviewMode: "confirm" | "chooseField" | null;
  complete: boolean;
};
export type FiscalResult =
  | { data: FiscalSnapshot; error?: never }
  | { data?: never; error: string; conflict?: boolean };
export function isCaba(value = "") {
  return ["caba", "ciudad autonoma de buenos aires", "capital federal", "capital"].includes(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(),
  );
}
export const jurisdictions = [
  "Ciudad Autónoma de Buenos Aires",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

export type FiscalBackup = {
  version: 1;
  answers: Record<string, string>;
  revision: number;
  step: number;
  reviewMode: "confirm" | "chooseField" | null;
  pending?: FiscalSave;
  unreadable?: boolean;
};
export function parseFiscalBackup(raw: string): FiscalBackup {
  const value = JSON.parse(raw);
  const object = (item: unknown): item is Record<string, unknown> =>
    !!item && typeof item === "object" && !Array.isArray(item);
  const step = (item: unknown) => Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 11;
  const review = (item: unknown) => item === null || item === "confirm" || item === "chooseField";
  if (
    !object(value) ||
    value.version !== 1 ||
    !object(value.answers) ||
    !Object.values(value.answers).every((item) => typeof item === "string") ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) < 0 ||
    !step(value.step) ||
    !review(value.reviewMode)
  )
    throw new Error("Invalid backup");
  if (value.pending !== undefined) {
    const pending = value.pending;
    if (
      !object(pending) ||
      !object(pending.answers) ||
      !Object.values(pending.answers).every(
        (item) => typeof item === "string" || (Array.isArray(item) && item.every((entry) => typeof entry === "string")),
      ) ||
      !Number.isInteger(pending.expectedRevision) ||
      Number(pending.expectedRevision) < 0 ||
      typeof pending.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pending.requestId) ||
      !step(pending.step) ||
      !review(pending.reviewMode) ||
      typeof pending.complete !== "boolean"
    )
      throw new Error("Invalid pending backup");
  }
  return value as FiscalBackup;
}
export function fiscalBackupDiffers(local: FiscalBackup, remote: FiscalBackup) {
  const comparable = (answers: Record<string, string>) =>
    JSON.stringify(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)));
  return (
    !!local.pending ||
    local.revision !== remote.revision ||
    local.step !== remote.step ||
    local.reviewMode !== remote.reviewMode ||
    comparable(local.answers) !== comparable(remote.answers)
  );
}
