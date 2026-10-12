// Reads units from a CSV file or cells pasted from a spreadsheet: one unit per line, number and
// optional floor. Accepts comma, semicolon (Excel in Spanish) or tab (pasted cells), with or without
// a header row.

export const MAX_IMPORT_ROWS = 500;

export type ParsedUnitRow = {
  line: number;
  number: string;
  floor: string | null;
  status: "new" | "existing" | "duplicate" | "invalid";
  reason?: string;
};

export type ParsedUnits = { rows: ParsedUnitRow[]; tooMany: boolean };

const NUMBER_HEADERS = ["numero", "unidad", "nro", "departamento", "depto", "uf"];
const FLOOR_HEADERS = ["piso"];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function delimiterOf(line: string) {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  return ",";
}

// Splits one line, honoring double quotes ("a;b" stays one cell, "" is a quote).
function splitLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

// Excel shows numbers like "10E2" as "1.00E+03" and saves them that way.
const SCIENTIFIC = /^\d+[.,]\d+e[+-]\d+$/i;

export function parseUnitsCsv(text: string, existingNumbers: string[]): ParsedUnits {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((content, index) => ({ content, line: index + 1 }))
    .filter(({ content }) => content.trim() !== "");
  if (lines.length === 0) return { rows: [], tooMany: false };

  const delimiter = delimiterOf(lines[0].content);
  const firstCells = splitLine(lines[0].content, delimiter).map(normalize);
  const numberColumn = firstCells.findIndex((cell) => NUMBER_HEADERS.includes(cell));
  const hasHeader = numberColumn !== -1;
  const floorColumn = hasHeader ? firstCells.findIndex((cell) => FLOOR_HEADERS.includes(cell)) : 1;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const existing = new Set(existingNumbers.map(normalize));
  const seen = new Set<string>();
  const rows = dataLines.map(({ content, line }): ParsedUnitRow => {
    const cells = splitLine(content, delimiter);
    const number = cells[hasHeader ? numberColumn : 0] ?? "";
    const floor = (floorColumn >= 0 ? cells[floorColumn] : undefined) || null;
    const key = normalize(number);
    if (!number) return { line, number, floor, status: "invalid", reason: "Falta el número de unidad." };
    if (SCIENTIFIC.test(number)) {
      return { line, number, floor, status: "invalid", reason: "Excel lo cambió a notación científica." };
    }
    if (seen.has(key)) return { line, number, floor, status: "duplicate", reason: "Repetida en el archivo." };
    seen.add(key);
    if (existing.has(key)) return { line, number, floor, status: "existing", reason: "Ya existe en el consorcio." };
    return { line, number, floor, status: "new" };
  });

  return { rows, tooMany: rows.length > MAX_IMPORT_ROWS };
}

// Semicolon, so Excel in Spanish opens it in two columns; the BOM keeps accents readable.
export const UNITS_TEMPLATE = "﻿numero;piso\n1A;1\n1B;1\nPB;PB\n";
