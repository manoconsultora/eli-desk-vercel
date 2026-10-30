const UNIT_WORDS = /(?:departamento|depto|dpto|dto|unidad|piso)/g;

/**
 * Canonical form used to compare a unit number typed by a resident with stored unit numbers.
 * NFKD, no combining marks, lowercase, no ordinal signs, spaces, dots, hyphens or other punctuation,
 * and no leading/inner "piso", "dto", "depto", "unidad" words.
 */
export function canonicalUnitNumber(value: string): string {
  return value
    .replace(/[º°ª˚]/g, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(UNIT_WORDS, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const CONSORCIO_LABEL_MAX_LENGTH = 24;

/** Short consorcio label shown to the resident: the consorcio name truncated (no short-name field exists). */
export function shortConsorcioLabel(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim().replace(/\s+/g, " ");
  return trimmed.length > CONSORCIO_LABEL_MAX_LENGTH
    ? `${trimmed.slice(0, CONSORCIO_LABEL_MAX_LENGTH - 1).trimEnd()}…`
    : trimmed;
}

export const MAX_UNIT_OPTIONS = 5;
