import type { SupabaseClient } from "@supabase/supabase-js";

import { recordResendEvent, verifyResendSignature } from "./resend-webhook";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

const SECRET = `whsec_${Buffer.from("test-signing-key").toString("base64")}`;
const NOW = 1_760_000_000_000;

function sign(body: string, id = "msg_1", timestamp = String(NOW / 1000)) {
  const key = Buffer.from("test-signing-key");
  const value = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return { body, id, timestamp, signature: `v1,${value}`, secret: SECRET, now: NOW };
}

test("acepta la firma de Resend sobre el cuerpo crudo", () => {
  assert.equal(verifyResendSignature(sign('{"type":"email.delivered"}')), true);
});

test("acepta si alguna de las firmas del header coincide", () => {
  const signed = sign("{}");
  assert.equal(verifyResendSignature({ ...signed, signature: `v1,b3RyYQ== ${signed.signature}` }), true);
});

test("rechaza un cuerpo cambiado, otro secreto, un aviso viejo o headers faltantes", () => {
  const signed = sign('{"type":"email.delivered"}');
  assert.equal(verifyResendSignature({ ...signed, body: '{"type":"email.bounced"}' }), false);
  assert.equal(verifyResendSignature({ ...signed, secret: `whsec_${Buffer.from("otra").toString("base64")}` }), false);
  assert.equal(verifyResendSignature({ ...signed, now: NOW + 6 * 60_000 }), false);
  assert.equal(verifyResendSignature({ ...signed, id: null }), false);
  assert.equal(verifyResendSignature({ ...signed, secret: "" }), false);
});

function fakeAdmin() {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "update", "eq", "or"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  // biome-ignore lint/suspicious/noThenProperty: fake thenable query builder
  builder.then = (resolve: (value: unknown) => void) => resolve({ error: null });
  return { admin: builder as unknown as SupabaseClient, calls };
}

test("guarda el rebote en el mail de la cola, sin pisar un aviso más nuevo", async () => {
  const { admin, calls } = fakeAdmin();

  const result = await recordResendEvent(admin, {
    type: "email.bounced",
    created_at: "2026-10-10T13:00:00.000Z",
    data: { email_id: "re_1", bounce: { message: "Mailbox does not exist" } },
  });

  assert.equal(result, "recorded");
  const args = (method: string) => calls.find((call) => call.method === method)?.args;
  assert.deepEqual(args("from"), ["resident_email_outbox"]);
  assert.deepEqual(args("update"), [
    {
      delivery_status: "bounced",
      delivery_detail: "Mailbox does not exist",
      delivery_event_at: "2026-10-10T13:00:00.000Z",
    },
  ]);
  assert.deepEqual(args("eq"), ["provider_message_id", "re_1"]);
  assert.deepEqual(args("or"), ["delivery_event_at.is.null,delivery_event_at.lt.2026-10-10T13:00:00.000Z"]);
});

test("ignora los eventos que no son de entrega", async () => {
  const { admin, calls } = fakeAdmin();

  for (const type of ["email.sent", "email.opened", "email.delivery_delayed"]) {
    const result = await recordResendEvent(admin, {
      type,
      created_at: "2026-10-10T13:00:00Z",
      data: { email_id: "re_1" },
    });
    assert.equal(result, "ignored", type);
  }
  assert.equal(calls.length, 0);
});
