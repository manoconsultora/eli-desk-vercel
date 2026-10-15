import type { CommunityUnit } from "@/server/communities/community-repository";

import { ALL, filterUnits, sortUnits, statusOptions } from "./filter-units";
import assert from "node:assert/strict";
import { test } from "node:test";

function unit(id: string, status: string | null, residentNames: string[] = []): CommunityUnit {
  return {
    id,
    number: id,
    floor: null,
    type: null,
    status,
    residents: residentNames.map((name) => ({
      id: name,
      name,
      relationship: null,
      isPrimary: false,
      phone: null,
      email: null,
    })),
  };
}

const UNITS = [unit("1A", "ocupado", ["Ana Pérez"]), unit("1B", "ocupado"), unit("2A", "desocupado")];
const NO_FILTERS = { search: "", status: ALL, residents: ALL } as const;
const ids = (units: CommunityUnit[]) => units.map((item) => item.id);

test("sin filtros devuelve todas las unidades", () => {
  assert.deepEqual(ids(filterUnits(UNITS, NO_FILTERS)), ["1A", "1B", "2A"]);
});

test("busca por número de unidad y por nombre de residente", () => {
  assert.deepEqual(ids(filterUnits(UNITS, { ...NO_FILTERS, search: "2a" })), ["2A"]);
  assert.deepEqual(ids(filterUnits(UNITS, { ...NO_FILTERS, search: "pérez" })), ["1A"]);
});

test("filtra por estado", () => {
  assert.deepEqual(ids(filterUnits(UNITS, { ...NO_FILTERS, status: "desocupado" })), ["2A"]);
});

test("filtra con y sin residentes", () => {
  assert.deepEqual(ids(filterUnits(UNITS, { ...NO_FILTERS, residents: "con" })), ["1A"]);
  assert.deepEqual(ids(filterUnits(UNITS, { ...NO_FILTERS, residents: "sin" })), ["1B", "2A"]);
});

test("combina filtros", () => {
  assert.deepEqual(ids(filterUnits(UNITS, { search: "1", status: "ocupado", residents: "sin" })), ["1B"]);
});

test("las opciones de estado salen de los datos, sin repetidos ni vacíos", () => {
  assert.deepEqual(statusOptions([...UNITS, unit("3A", null)]), ["desocupado", "ocupado"]);
});

test("ordena PB primero y después los pisos, cada uno por letra", () => {
  const units = ["2B", "10A", "1B", "PB B", "2A", "PB A", "1A", "s/d"].map((id) => unit(id, null));
  assert.deepEqual(ids(sortUnits(units)), ["PB A", "PB B", "1A", "1B", "2A", "2B", "10A", "s/d"]);
});

test("usa el piso cuando viene cargado aparte del número", () => {
  const units = [
    { ...unit("B", null), floor: "1" },
    { ...unit("A", null), floor: "1" },
    { ...unit("B", null), floor: "PB" },
    { ...unit("A", null), floor: "PB" },
  ];
  assert.deepEqual(
    sortUnits(units).map((item) => `${item.floor} ${item.number}`),
    ["PB A", "PB B", "1 A", "1 B"],
  );
});
