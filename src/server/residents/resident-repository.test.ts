import type { SupabaseClient } from "@supabase/supabase-js";

import { listResidents } from "./resident-repository";
import assert from "node:assert/strict";
import { test } from "node:test";

const ORGANIZATION_ID = "org-1";

type RecordedCall = { table: string; method: string; args: unknown[] };

/** Cliente falso: devuelve filas por tabla, aplica los filtros `in` y registra los filtros encadenados. */
function createFakeClient(rows: Record<string, Record<string, unknown>[]>) {
  const calls: RecordedCall[] = [];

  const client = {
    from(table: string) {
      calls.push({ table, method: "from", args: [] });
      let data = rows[table] ?? [];
      const builder = {} as Record<string, unknown>;
      for (const method of ["select", "eq", "order"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.in = (column: string, values: unknown[]) => {
        calls.push({ table, method: "in", args: [column, values] });
        data = data.filter((row) => values.includes(row[column]));
        return builder;
      };
      // biome-ignore lint/suspicious/noThenProperty: fake thenable query builder
      builder.then = (resolve: (value: unknown) => void) => resolve({ data, error: null });
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

const ROWS = {
  residentes: [
    { id: "r1", nombre_completo: "Ana", telefono: "11", email: "a@x.com", activo: true },
    { id: "r2", nombre_completo: "Beto", telefono: null, email: null, activo: false },
    { id: "r3", nombre_completo: "Caro", telefono: null, email: null, activo: true },
  ],
  resident_unit_links: [
    { id: "l1", residente_id: "r1", unidad_id: "u1", relationship_type: "propietario", is_primary: true },
    { id: "l2", residente_id: "r2", unidad_id: "u2", relationship_type: "inquilino", is_primary: false },
  ],
  unidades: [
    { id: "u1", numero: "1A", edificio_id: "e1" },
    { id: "u2", numero: "7B", edificio_id: "e2" },
  ],
  edificios: [
    { id: "e1", nombre: "Ugarte 2200" },
    { id: "e2", nombre: "Sandbox Belgrano" },
  ],
};

test("con todos los consorcios devuelve todos los residentes, con y sin unidad", async () => {
  const { client } = createFakeClient(ROWS);

  const residents = await listResidents(client, ORGANIZATION_ID, { kind: "all_consorcios" });

  assert.deepEqual(
    residents.map((resident) => [resident.name, resident.units.map((unit) => unit.communityName)]),
    [
      ["Ana", ["Ugarte 2200"]],
      ["Beto", ["Sandbox Belgrano"]],
      ["Caro", []],
    ],
  );
});

test("con consorcios asignados solo devuelve residentes de unidades de esos consorcios", async () => {
  const { client } = createFakeClient(ROWS);

  const residents = await listResidents(client, ORGANIZATION_ID, { kind: "explicit", consorcioIds: ["e1"] });

  assert.deepEqual(
    residents.map((resident) => resident.id),
    ["r1"],
  );
  assert.deepEqual(residents[0].units[0], {
    linkId: "l1",
    unitId: "u1",
    unitNumber: "1A",
    communityId: "e1",
    communityName: "Ugarte 2200",
    relationship: "propietario",
    isPrimary: true,
  });
});

test("con scope explicit vacío no consulta", async () => {
  const { client, calls } = createFakeClient(ROWS);

  const residents = await listResidents(client, ORGANIZATION_ID, { kind: "explicit", consorcioIds: [] });

  assert.deepEqual(residents, []);
  assert.equal(calls.length, 0);
});

test("filtra todas las tablas por organization_id", async () => {
  const { client, calls } = createFakeClient(ROWS);

  await listResidents(client, ORGANIZATION_ID, { kind: "all_consorcios" });

  for (const table of ["residentes", "resident_unit_links", "unidades", "edificios"]) {
    const orgFilter = calls.find(
      (call) => call.table === table && call.method === "eq" && call.args[0] === "organization_id",
    );
    assert.deepEqual(orgFilter?.args, ["organization_id", ORGANIZATION_ID], table);
  }
});
