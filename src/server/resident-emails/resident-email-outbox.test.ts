import type { SupabaseClient } from "@supabase/supabase-js";

import { drainResidentEmailOutbox, resendConfigFromEnv } from "./resident-email-outbox";
import assert from "node:assert/strict";
import { test } from "node:test";

type Call = { method: string; args: unknown[] };

const ROWS = [
  {
    id: "m1",
    template_key: "resident_request_approved",
    recipient_email: "laura@x.com",
    payload: { first_name: "Laura", edificio_nombre: "Ugarte 2200", unidad_numero: "2A" },
    attempts: 0,
  },
  {
    id: "m2",
    template_key: "resident_request_rejected",
    recipient_email: "carla@x.com",
    payload: { first_name: "<b>Carla</b>" },
    attempts: 1,
  },
];

// Each query records its chain; the select returns ROWS and a claim returns the row unless it was taken.
function createFakeAdmin(taken: string[] = []) {
  const queries: Call[][] = [];
  const admin = {
    from: () => {
      const calls: Call[] = [];
      queries.push(calls);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "update", "eq", "in", "lte", "order", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return builder;
        };
      }
      // biome-ignore lint/suspicious/noThenProperty: fake thenable query builder
      builder.then = (resolve: (value: unknown) => void) => {
        const update = calls.find((call) => call.method === "update");
        if (!update) return resolve({ data: ROWS, error: null });
        const id = calls.find((call) => call.method === "eq")?.args[1] as string;
        const isClaim = (update.args[0] as { status: string }).status === "sending";
        return resolve({ data: isClaim && !taken.includes(id) ? [{ id }] : [], error: null });
      };
      return builder;
    },
  };
  const updates = (id: string) =>
    queries
      .filter((calls) => calls.some((call) => call.method === "eq" && call.args[1] === id))
      .map((calls) => calls.find((call) => call.method === "update")?.args[0] as Record<string, unknown>);
  return { admin: admin as unknown as SupabaseClient, updates };
}

function fakeResend(status = 200) {
  const requests: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const send = (async (_url: string, init: RequestInit) => {
    requests.push({ headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify({ id: `re_${requests.length}` }), { status });
  }) as typeof fetch;
  return { send, requests };
}

const CONFIG = { apiKey: "test-key", from: "ELI <hola@eli.test>" };

test("sin Resend habilitado no consulta ni envía", async () => {
  const { admin, updates } = createFakeAdmin();
  const { send, requests } = fakeResend();

  const result = await drainResidentEmailOutbox(admin, null, send);

  assert.deepEqual(result, { gate: "resend_configuration_required", sent: 0 });
  assert.equal(requests.length, 0);
  assert.deepEqual(updates("m1"), []);
});

test("resendConfigFromEnv exige RESEND_ENABLED=true, clave y remitente", () => {
  assert.equal(resendConfigFromEnv({ RESEND_API_KEY: "k", RESEND_FROM: "f" }), null);
  assert.equal(resendConfigFromEnv({ RESEND_ENABLED: "true", RESEND_FROM: "f" }), null);
  assert.deepEqual(resendConfigFromEnv({ RESEND_ENABLED: "true", RESEND_API_KEY: " k ", RESEND_FROM: "f" }), {
    apiKey: "k",
    from: "f",
  });
});

test("envía cada mail y lo marca como enviado", async () => {
  const { admin, updates } = createFakeAdmin();
  const { send, requests } = fakeResend();

  const result = await drainResidentEmailOutbox(admin, CONFIG, send);

  assert.deepEqual(result, { gate: "open", sent: 2 });
  assert.deepEqual(
    requests.map((request) => [request.body.to, request.headers["Idempotency-Key"]]),
    [
      [["laura@x.com"], "eli-resident-email-m1"],
      [["carla@x.com"], "eli-resident-email-m2"],
    ],
  );
  assert.match(String(requests[0].body.html), /Ugarte 2200 \(unidad 2A\)/);
  assert.match(String(requests[1].body.html), /&#60;b&#62;Carla/, "escapa el HTML del payload");
  const [claim, done] = updates("m1");
  assert.deepEqual(claim, { status: "sending", attempts: 1 });
  assert.equal(done.status, "sent");
  assert.equal(done.provider_message_id, "re_1");
});

test("no envía un mail que otro proceso ya tomó", async () => {
  const { admin } = createFakeAdmin(["m1"]);
  const { send, requests } = fakeResend();

  const result = await drainResidentEmailOutbox(admin, CONFIG, send);

  assert.equal(result.sent, 1);
  assert.deepEqual(
    requests.map((request) => request.body.to),
    [["carla@x.com"]],
  );
});

test("si Resend falla lo marca failed y lo reprograma", async () => {
  const { admin, updates } = createFakeAdmin();
  const { send } = fakeResend(500);

  const result = await drainResidentEmailOutbox(admin, CONFIG, send);

  assert.equal(result.sent, 0);
  const [, failed] = updates("m2");
  assert.equal(failed.status, "failed");
  assert.equal(failed.last_error, "resend_failed:500");
  assert.ok(new Date(failed.next_attempt_at as string).getTime() > Date.now());
});
