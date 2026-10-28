import type { ComprobanteSummary } from "@/server/comprobantes/comprobante-repository";

import { filterComprobantes, groupByPeriod } from "./filter-comprobantes";
import assert from "node:assert/strict";
import { test } from "node:test";

function comprobante(id: string, period: string, name: string): ComprobanteSummary {
  return { id, period, name, uploadedAt: "2026-10-28T12:00:00Z", sizeBytes: 1024, uploadedBy: "dueno" };
}

const COMPROBANTES = [
  comprobante("c1", "2026-10-01", "ABL octubre.pdf"),
  comprobante("c2", "2026-10-01", "Edesur.pdf"),
  comprobante("c3", "2026-09-01", "Edesur septiembre.pdf"),
];
const ids = (comprobantes: ComprobanteSummary[]) => comprobantes.map((item) => item.id);

test("sin búsqueda devuelve todos", () => {
  assert.deepEqual(ids(filterComprobantes(COMPROBANTES, "  ")), ["c1", "c2", "c3"]);
});

test("busca por nombre sin distinguir mayúsculas", () => {
  assert.deepEqual(ids(filterComprobantes(COMPROBANTES, "EDESUR")), ["c2", "c3"]);
  assert.deepEqual(ids(filterComprobantes(COMPROBANTES, "gas")), []);
});

test("agrupa por mes en el orden en que llegan", () => {
  const groups = groupByPeriod(COMPROBANTES);
  assert.deepEqual(
    groups.map(([period, items]) => [period, ids(items)]),
    [
      ["2026-10-01", ["c1", "c2"]],
      ["2026-09-01", ["c3"]],
    ],
  );
});
