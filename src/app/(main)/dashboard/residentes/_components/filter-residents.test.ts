import type { ResidentSummary, ResidentUnit } from "@/server/residents/resident-repository";

import { ALL, communityOptions, filterResidents } from "./filter-residents";
import assert from "node:assert/strict";
import { test } from "node:test";

function unit(communityId: string, communityName: string): ResidentUnit {
  return {
    linkId: `${communityId}-l`,
    unitId: `${communityId}-u`,
    unitNumber: "1A",
    communityId,
    communityName,
    relationship: null,
    isPrimary: false,
  };
}

function resident(id: string, name: string, active: boolean, units: ResidentUnit[], phone: string | null = null) {
  return { id, name, phone, email: `${id}@x.com`, active, units } satisfies ResidentSummary;
}

const RESIDENTS = [
  resident("r1", "Ana Pérez", true, [unit("e1", "Ugarte 2200")], "1155"),
  resident("r2", "Beto", false, [unit("e2", "Belgrano")]),
  resident("r3", "Caro", true, []),
];
const NO_FILTERS = { search: "", communityId: ALL, status: ALL } as const;
const ids = (residents: ResidentSummary[]) => residents.map((item) => item.id);

test("sin filtros devuelve todos", () => {
  assert.deepEqual(ids(filterResidents(RESIDENTS, NO_FILTERS)), ["r1", "r2", "r3"]);
});

test("busca por nombre, teléfono o email", () => {
  assert.deepEqual(ids(filterResidents(RESIDENTS, { ...NO_FILTERS, search: "pérez" })), ["r1"]);
  assert.deepEqual(ids(filterResidents(RESIDENTS, { ...NO_FILTERS, search: "1155" })), ["r1"]);
  assert.deepEqual(ids(filterResidents(RESIDENTS, { ...NO_FILTERS, search: "r2@" })), ["r2"]);
});

test("filtra por consorcio y por estado", () => {
  assert.deepEqual(ids(filterResidents(RESIDENTS, { ...NO_FILTERS, communityId: "e2" })), ["r2"]);
  assert.deepEqual(ids(filterResidents(RESIDENTS, { ...NO_FILTERS, status: "activos" })), ["r1", "r3"]);
  assert.deepEqual(ids(filterResidents(RESIDENTS, { ...NO_FILTERS, status: "inactivos" })), ["r2"]);
});

test("las opciones de consorcio salen de las unidades, ordenadas y sin repetir", () => {
  assert.deepEqual(communityOptions([...RESIDENTS, resident("r4", "Dani", true, [unit("e1", "Ugarte 2200")])]), [
    { id: "e2", name: "Belgrano" },
    { id: "e1", name: "Ugarte 2200" },
  ]);
});
