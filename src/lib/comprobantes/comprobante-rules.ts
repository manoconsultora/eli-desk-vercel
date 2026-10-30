// The bucket and the database enforce the same limits; these give a clear message before the upload starts.
const COMPROBANTE_MAX_BYTES = 10 * 1024 * 1024;
const COMPROBANTE_MAX_NAME = 200;
export const COMPROBANTE_BUCKET = "comprobantes";

// The Documentos folders, in the order Desk shows them. The database checks the same list.
export const CARPETAS = ["liquidaciones", "comprobantes"] as const;
export type Carpeta = (typeof CARPETAS)[number];

export function isCarpeta(value: unknown): value is Carpeta {
  return CARPETAS.includes(value as Carpeta);
}

// What one file of each folder is called, for the messages.
export const CARPETA_ITEM: Record<Carpeta, { singular: string; plural: string }> = {
  liquidaciones: { singular: "liquidación", plural: "liquidaciones" },
  comprobantes: { singular: "comprobante", plural: "comprobantes" },
};

const MONTH_INPUT = /^([1-9]\d{3})-(0[1-9]|1[0-2])$/;

// "2026-10" (a month option) → "2026-10-01", the first day the database stores.
export function periodFromMonthInput(value: string): string | null {
  return MONTH_INPUT.test(value) ? `${value}-01` : null;
}

// Same check in the browser and in the server action. The browser also checks the declared type.
export function comprobanteFileProblem(file: { name: string; size: number }): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Solo se aceptan PDF.";
  if (file.name.length > COMPROBANTE_MAX_NAME) return "El nombre del archivo es demasiado largo.";
  if (file.size <= 0) return "El archivo está vacío.";
  if (file.size > COMPROBANTE_MAX_BYTES) return "Pesa más de 10 MB.";
  return null;
}

// The month options to upload to: this one and the ones before it, newest first, as "2026-10".
export function recentMonthInputs(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, back) => {
    const month = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  });
}

const sizeFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}
