import { emailDeliveryOf, type OutboxDeliveryRow } from "./resident-email-delivery";
import { MAX_ATTEMPTS } from "./resident-email-outbox";
import assert from "node:assert/strict";
import { test } from "node:test";

const ROW: OutboxDeliveryRow = {
  request_id: "q1",
  recipient_email: "laura@x.com",
  status: "sent",
  attempts: 1,
  sent_at: "2026-10-10T12:00:00Z",
  created_at: "2026-10-10T11:59:00Z",
  delivery_status: null,
  delivery_event_at: null,
};

test("aceptado por Resend sin confirmación es enviado, no entregado", () => {
  assert.deepEqual(emailDeliveryOf(ROW), {
    state: "sent",
    recipient: "laura@x.com",
    at: "2026-10-10T12:00:00Z",
    reason: null,
  });
});

test("el webhook de entrega lo marca entregado", () => {
  const delivery = emailDeliveryOf({ ...ROW, delivery_status: "delivered", delivery_event_at: "2026-10-10T12:00:05Z" });
  assert.equal(delivery.state, "delivered");
  assert.equal(delivery.at, "2026-10-10T12:00:05Z");
});

test("rebote, error de envío y dirección suprimida no llegan, cada uno con su motivo", () => {
  const reasons = ["bounced", "failed", "suppressed"].map((status) => {
    const delivery = emailDeliveryOf({ ...ROW, delivery_status: status });
    assert.equal(delivery.state, "not_delivered", status);
    return delivery.reason;
  });
  assert.equal(new Set(reasons).size, 3);
});

test("agotar los intentos sin que Resend lo acepte tampoco llega", () => {
  const exhausted = emailDeliveryOf({ ...ROW, status: "failed", attempts: MAX_ATTEMPTS, sent_at: null });
  assert.equal(exhausted.state, "not_delivered");
  assert.match(exhausted.reason ?? "", /5 intentos/);
  assert.equal(emailDeliveryOf({ ...ROW, status: "failed", attempts: 2, sent_at: null }).state, "sending");
  assert.equal(emailDeliveryOf({ ...ROW, status: "pending", attempts: 0, sent_at: null }).state, "sending");
});
