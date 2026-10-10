import { MAX_ATTEMPTS } from "./resident-email-outbox";

export type OutboxDeliveryRow = {
  request_id: string;
  recipient_email: string;
  status: string;
  attempts: number;
  sent_at: string | null;
  created_at: string;
  delivery_status: string | null;
  delivery_event_at: string | null;
};

export type EmailDelivery = {
  state: "sending" | "sent" | "delivered" | "not_delivered";
  recipient: string;
  at: string | null;
  reason: string | null;
};

const NOT_DELIVERED_REASON: Record<string, string> = {
  bounced: "El servidor del destinatario rechazó el mail. Puede que la dirección no exista.",
  suppressed: "La dirección ya había rebotado antes, así que no se volvió a intentar.",
  failed: "El proveedor de mails no pudo enviarlo.",
};

// "sent" only means Resend accepted the email; whether it arrived comes later through its webhook.
export function emailDeliveryOf(row: OutboxDeliveryRow): EmailDelivery {
  const base = { recipient: row.recipient_email };
  if (row.delivery_status === "delivered") {
    return { ...base, state: "delivered", at: row.delivery_event_at, reason: null };
  }
  if (row.delivery_status && row.delivery_status in NOT_DELIVERED_REASON) {
    return {
      ...base,
      state: "not_delivered",
      at: row.delivery_event_at,
      reason: NOT_DELIVERED_REASON[row.delivery_status],
    };
  }
  if (row.status === "failed" && row.attempts >= MAX_ATTEMPTS) {
    return {
      ...base,
      state: "not_delivered",
      at: null,
      reason: `No se pudo enviar después de ${MAX_ATTEMPTS} intentos.`,
    };
  }
  if (row.status === "sent") return { ...base, state: "sent", at: row.sent_at, reason: null };
  return { ...base, state: "sending", at: null, reason: null };
}
