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
      for (const method of ["select", "eq", "not", "order"]) {
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
      rejection_reason: null,
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
      rejection_reason: null,
      created_at: "2026-09-23T10:00:00Z",
    },
  ],
  unidades: [
    { id: "u1", numero: "1A", edificio_id: "e1" },
    { id: "u3", numero: "1B", edificio_id: "e1" },
    { id: "u2", numero: "7B", edificio_id: "e2" },
  ],
  edificios: [
    { id: "e1", nombre: "Ugarte 2200", direccion: "Ugarte 2200, CABA" },
    { id: "e2", nombre: "Sandbox Belgrano", direccion: null },
  ],
  // Newest first, as the query orders them.
  resident_email_outbox: [
    {
      request_id: "q2",
      recipient_email: "b@x.com",
      status: "sent",
      attempts: 1,
      sent_at: "2026-09-23T11:00:00Z",
      created_at: "2026-09-23T11:00:00Z",
      delivery_status: "bounced",
      delivery_event_at: "2026-09-23T11:01:00Z",
    },
    {
      request_id: "q2",
      recipient_email: "viejo@x.com",
      status: "sent",
      attempts: 1,
      sent_at: "2026-09-22T11:00:00Z",
      created_at: "2026-09-22T11:00:00Z",
      delivery_status: "delivered",
      delivery_event_at: "2026-09-22T11:01:00Z",
    },
  ],
};

test("con todos los consorcios devuelve todas las solicitudes con consorcio y unidad", async () => {
  const { client } = createFakeClient(ROWS);

  const requests = await listResidentRequests(client, ORGANIZATION_ID, { kind: "all_consorcios" });

  assert.deepEqual(requests[0], {
    id: "q1",
    name: "Ana Paz",
    firstName: "Ana",
    lastName: "Paz",
    phone: "11",
    email: "a@x.com",
    communityName: "Ugarte 2200",
    communityAddress: "Ugarte 2200, CABA",
    communityUnitCount: 2,
    unitNumber: "1A",
    relationship: "propietario",
    status: "PENDING_VERIFICATION",
    rejectionReason: null,
    createdAt: "2026-09-24T10:00:00Z",
    emailDelivery: null,
  });
  assert.deepEqual(
    requests.map((request) => [request.name, request.communityName, request.unitNumber]),
    [
      ["Ana Paz", "Ugarte 2200", "1A"],
      ["Beto Ruiz", "Sandbox Belgrano", "7B"],
    ],
  );
});

test("cada solicitud trae el estado de su último mail", async () => {
  const { client } = createFakeClient(ROWS);

  const requests = await listResidentRequests(client, ORGANIZATION_ID, { kind: "all_consorcios" });

  assert.deepEqual(
    requests.map((request) => [request.id, request.emailDelivery?.state ?? null, request.emailDelivery?.recipient]),
    [
      ["q1", null, undefined],
      ["q2", "not_delivered", "b@x.com"],
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

  for (const table of ["resident_onboarding_requests", "unidades", "edificios", "resident_email_outbox"]) {
    const orgFilter = calls.find(
      (call) => call.table === table && call.method === "eq" && call.args[0] === "organization_id",
    );
    assert.deepEqual(orgFilter?.args, ["organization_id", ORGANIZATION_ID], table);
  }
});
