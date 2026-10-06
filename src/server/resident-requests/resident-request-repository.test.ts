import type { SupabaseClient } from "@supabase/supabase-js";

import { listResidentRequests } from "./resident-request-repository";
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
  resident_onboarding_requests: [
    {
      id: "q1",
      edificio_id: "e1",
      unidad_id: "u1",
      first_name: "Ana",
      last_name: "Paz",
      email: "a@x.com",
      phone: "11",
      relationship_type_code: "propietario",
      status: "PENDING_VERIFICATION",
      created_at: "2026-09-24T10:00:00Z",
    },
    {
      id: "q2",
      edificio_id: "e2",
      unidad_id: "u2",
      first_name: "Beto",
      last_name: "Ruiz",
      email: "b@x.com",

      phone: null,
      relationship_type_code: "inquilino",
      status: "APPROVED",
      created_at: "2026-09-23T10:00:00Z",
    },
  ],
  unidades: [
    { id: "u1", numero: "1A" },
    { id: "u2", numero: "7B" },
  ],
  edificios: [
    { id: "e1", nombre: "Ugarte 2200" },
    { id: "e2", nombre: "Sandbox Belgrano" },
  ],
};

test("con todos los consorcios devuelve todas las solicitudes con consorcio y unidad", async () => {
  const { client } = createFakeClient(ROWS);

  const requests = await listResidentRequests(client, ORGANIZATION_ID, { kind: "all_consorcios" });

  assert.deepEqual(requests[0], {
    id: "q1",
    name: "Ana Paz",
    phone: "11",
    email: "a@x.com",
    communityName: "Ugarte 2200",
    unitNumber: "1A",
    relationship: "propietario",
    status: "PENDING_VERIFICATION",
    createdAt: "2026-09-24T10:00:00Z",
  });
  assert.deepEqual(
    requests.map((request) => [request.name, request.communityName, request.unitNumber]),
    [
      ["Ana Paz", "Ugarte 2200", "1A"],
      ["Beto Ruiz", "Sandbox Belgrano", "7B"],
    ],
  );
});

test("con consorcios asignados solo devuelve solicitudes de esos consorcios", async () => {
  const { client } = createFakeClient(ROWS);

  const requests = await listResidentRequests(client, ORGANIZATION_ID, { kind: "explicit", consorcioIds: ["e1"] });

  assert.deepEqual(
    requests.map((request) => request.id),
    ["q1"],
  );
});

test("con scope explicit vacío no consulta", async () => {
  const { client, calls } = createFakeClient(ROWS);

  const requests = await listResidentRequests(client, ORGANIZATION_ID, { kind: "explicit", consorcioIds: [] });

  assert.deepEqual(requests, []);
  assert.equal(calls.length, 0);
});

test("filtra todas las tablas por organization_id", async () => {
  const { client, calls } = createFakeClient(ROWS);

  await listResidentRequests(client, ORGANIZATION_ID, { kind: "all_consorcios" });

  for (const table of ["resident_onboarding_requests", "unidades", "edificios"]) {
    const orgFilter = calls.find(
      (call) => call.table === table && call.method === "eq" && call.args[0] === "organization_id",
    );
    assert.deepEqual(orgFilter?.args, ["organization_id", ORGANIZATION_ID], table);
  }
});
