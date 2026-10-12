import { MAX_IMPORT_ROWS, parseUnitsCsv, UNITS_TEMPLATE } from "./parse-units-csv";
import assert from "node:assert/strict";
import { test } from "node:test";

const summary = (text: string, existing: string[] = []) =>
  parseUnitsCsv(text, existing).rows.map((row) => `${row.number}|${row.floor ?? ""}|${row.status}`);

test("lee el CSV con encabezado y punto y coma, como lo guarda Excel en español", () => {
  assert.deepEqual(summary("numero;piso\n1A;1\n1B;1\n"), ["1A|1|new", "1B|1|new"]);
});

test("acepta coma, tabulación (celdas pegadas) y encabezados con tilde o mayúsculas", () => {
  assert.deepEqual(summary("Número,Piso\n2A,2"), ["2A|2|new"]);
  assert.deepEqual(summary("Unidad\tPiso\n3A\t3"), ["3A|3|new"]);
  assert.deepEqual(summary("piso;depto\n4;4A"), ["4A|4|new"]);
});

test("sin encabezado, la primera columna es el número y la segunda el piso", () => {
  assert.deepEqual(summary("1A\t1\nPB"), ["1A|1|new", "PB||new"]);
});

test("el piso es opcional y las líneas vacías se ignoran", () => {
  assert.deepEqual(summary("numero\n\n1A\n\n1B\n"), ["1A||new", "1B||new"]);
});

test("respeta comillas y el BOM de Excel", () => {
  assert.deepEqual(summary('﻿numero,piso\n"Local 1, PB","PB"'), ["Local 1, PB|PB|new"]);
});

test("marca las que ya existen y las repetidas, sin distinguir mayúsculas", () => {
  assert.deepEqual(summary("numero\n1A\n1a\n2B", ["2b"]), ["1A||new", "1a||duplicate", "2B||existing"]);
});

test("marca las filas sin número y los números que Excel pasó a notación científica", () => {
  const rows = parseUnitsCsv("numero;piso\n;2\n1,00E+03;3", []).rows;
  assert.deepEqual(
    rows.map((row) => [row.line, row.status, row.reason]),
    [
      [2, "invalid", "Falta el número de unidad."],
      [3, "invalid", "Excel lo cambió a notación científica."],
    ],
  );
});

test("avisa si hay más filas que el máximo", () => {
  const text = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, index) => `U${index}`).join("\n");
  assert.equal(parseUnitsCsv(text, []).tooMany, true);
  assert.equal(parseUnitsCsv("1A", []).tooMany, false);
});

test("la plantilla se lee sin errores", () => {
  assert.deepEqual(summary(UNITS_TEMPLATE), ["1A|1|new", "1B|1|new", "PB|PB|new"]);
});
