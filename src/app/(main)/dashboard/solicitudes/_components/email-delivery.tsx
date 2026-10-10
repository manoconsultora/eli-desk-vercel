import { Pill, type Tone } from "@/app/(main)/dashboard/_components/list-table";
import { cn } from "@/lib/utils";
import type { EmailDelivery } from "@/server/resident-emails/resident-email-delivery";

import { formatRequestDate } from "./request-time";

const DELIVERY: Record<EmailDelivery["state"], { label: string; tone: Tone; text: string }> = {
  sending: { label: "Enviando mail", tone: "neutral", text: "text-muted-foreground" },
  sent: { label: "Mail enviado", tone: "blue", text: "text-blue-700 dark:text-blue-400" },
  delivered: { label: "Mail entregado", tone: "green", text: "text-green-700 dark:text-green-400" },
  not_delivered: { label: "Mail no entregado", tone: "red", text: "text-red-700 dark:text-red-400" },
};

// Short status under the email address in the card.
export function EmailDeliveryNote({ delivery }: { delivery: EmailDelivery | null }) {
  if (!delivery) return null;
  return (
    <span className={cn("block font-medium text-xs", DELIVERY[delivery.state].text)}>
      {DELIVERY[delivery.state].label}
    </span>
  );
}

// Detail in the drawer: where it went, when, and why it didn't arrive.
export function EmailDeliveryDetail({ delivery }: { delivery: EmailDelivery }) {
  const { label, tone } = DELIVERY[delivery.state];
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Email al vecino</h3>
      <Pill tone={tone}>{label}</Pill>
      <p className="text-muted-foreground text-sm">
        A {delivery.recipient}
        {delivery.at && ` · ${formatRequestDate(delivery.at)}`}
      </p>
      {delivery.state === "sent" && (
        <p className="text-muted-foreground text-sm">Todavía no hay confirmación de entrega.</p>
      )}
      {delivery.reason && <p className="text-sm">{delivery.reason} Confirmá la dirección con el vecino.</p>}
    </section>
  );
}
