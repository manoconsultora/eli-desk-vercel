export type TicketRslEventType = "ticket.created" | "ticket.updated" | "ticket.closed";

export type TicketRslEvent = {
  type: TicketRslEventType;
  ticketId: string;
  edificioId: string;
};

type TicketRslListener = (event: TicketRslEvent) => void;

const BROWSER_EVENT = "eli:ticket-rsl";

export function emitTicketRslEvent(event: TicketRslEvent) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<TicketRslEvent>(BROWSER_EVENT, {
      detail: event,
    }),
  );
}

export function subscribeTicketRslEvent(listener: TicketRslListener) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<TicketRslEvent>;

    if (!customEvent.detail) return;

    listener(customEvent.detail);
  };

  window.addEventListener(BROWSER_EVENT, handler);

  return () => {
    window.removeEventListener(BROWSER_EVENT, handler);
  };
}
