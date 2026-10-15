import type { SupabaseClient } from "@supabase/supabase-js";

import type { DeskTicketScope } from "@/server/access/resolve-desk-ticket-scope";

import { closeTicket, createTicket, updateTicket, updateTicketStatus } from "./ticket-repository";
import assert from "node:assert/strict";
import { test } from "node:test";

const ORGANIZATION_ID = "org-1";
const IN_SCOPE = "edificio-a";
const OUT_OF_SCOPE = "edificio-b";
const EXPLICIT_SCOPE: DeskTicketScope = { kind: "explicit", consorcioIds: [IN_SCOPE] };

const TICKET_ROW = {
  id: "t1",
  organization_id: ORGANIZATION_ID,
  edificio_id: IN_SCOPE,
  ticket_code: "ELI-2609-0001",
  chat_id: "dashboard-manual",
};

const TICKET_INPUT = {
  ticket_type: "reclamo",
  priority: "media",
  category: null,
  description: "x",
} as const;

type RecordedCall = { method: string; args: unknown[] };

/** Cliente falso: registra los filtros encadenados en lugar de consultar la base. */
function createRecordingClient() {
  const calls: RecordedCall[] = [];
  const builder: Record<string, unknown> = {};

  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };

  for (const method of ["select", "update", "insert", "eq", "in", "is", "order", "lt"]) {
    builder[method] = record(method);
  }
  builder.single = () => Promise.resolve({ data: TICKET_ROW, error: null });
  builder.maybeSingle = () => Promise.resolve({ data: { id: IN_SCOPE }, error: null });

  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

function edificioFilter(calls: RecordedCall[]) {
  return calls.find((call) => call.method === "in" && call.args[0] === "edificio_id");
}

test("updateTicket filtra por edificio_id cuando el scope es explicit", async () => {
  const { client, calls } = createRecordingClient();

  await updateTicket(client, ORGANIZATION_ID, EXPLICIT_SCOPE, "t1", {
    edificio_id: IN_SCOPE,
    ...TICKET_INPUT,
  });

  assert.deepEqual(edificioFilter(calls)?.args, ["edificio_id", [IN_SCOPE]]);
});

test("updateTicketStatus filtra por edificio_id cuando el scope es explicit", async () => {
  const { client, calls } = createRecordingClient();

  await updateTicketStatus(client, ORGANIZATION_ID, EXPLICIT_SCOPE, "t1", "en_proceso");

  assert.deepEqual(edificioFilter(calls)?.args, ["edificio_id", [IN_SCOPE]]);
});

test("closeTicket filtra por edificio_id cuando el scope es explicit", async () => {
  const { client, calls } = createRecordingClient();

  await closeTicket(client, ORGANIZATION_ID, EXPLICIT_SCOPE, "t1", "resuelto");

  assert.deepEqual(edificioFilter(calls)?.args, ["edificio_id", [IN_SCOPE]]);
});

test("closeTicket no filtra por edificio_id cuando el scope es all_consorcios", async () => {
  const { client, calls } = createRecordingClient();

  await closeTicket(client, ORGANIZATION_ID, { kind: "all_consorcios" }, "t1", "resuelto");

  assert.equal(edificioFilter(calls), undefined);
});

test("createTicket rechaza un consorcio fuera del scope", async () => {
  const { client } = createRecordingClient();

  await assert.rejects(
    () =>
      createTicket(client, ORGANIZATION_ID, EXPLICIT_SCOPE, "user-1", {
        edificio_id: OUT_OF_SCOPE,
        ...TICKET_INPUT,
      }),
    /no está habilitado para el acceso actual/,
  );
});

test("createTicket acepta un consorcio dentro del scope", async () => {
  const { client, calls } = createRecordingClient();

  await createTicket(client, ORGANIZATION_ID, EXPLICIT_SCOPE, "user-1", {
    edificio_id: IN_SCOPE,
    ...TICKET_INPUT,
  });

  assert.ok(calls.some((call) => call.method === "insert"));
});

test("updateTicket rechaza mover el ticket a un consorcio fuera del scope", async () => {
  const { client } = createRecordingClient();

  await assert.rejects(
    () =>
      updateTicket(client, ORGANIZATION_ID, EXPLICIT_SCOPE, "t1", {
        edificio_id: OUT_OF_SCOPE,
        ...TICKET_INPUT,
      }),
    /no está habilitado para el acceso actual/,
  );
});
