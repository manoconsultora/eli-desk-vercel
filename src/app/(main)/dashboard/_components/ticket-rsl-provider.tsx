"use client";

import * as React from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { emitTicketRslEvent, type TicketRslEventType } from "@/lib/realtime/ticket-rsl-events";
import { createClient } from "@/lib/supabase/client";

type TicketRslProviderProps = {
  organizationId: string | null;
  consorcioIds: readonly string[];
  children: React.ReactNode;
};

const TICKET_EVENTS: readonly TicketRslEventType[] = ["ticket.created", "ticket.updated", "ticket.closed"];

export function TicketRslProvider({ organizationId, consorcioIds, children }: TicketRslProviderProps) {
  const consorcioScopeKey = [...new Set(consorcioIds)].sort().join(":");

  React.useEffect(() => {
    if (!organizationId || !consorcioScopeKey) {
      console.info("[RSL] Subscription skipped: empty tenant scope", {
        organizationId,
        consorcioScopeKey,
      });

      return;
    }

    const scopedConsorcioIds = consorcioScopeKey.split(":").filter(Boolean);
    const supabase = createClient();

    let cancelled = false;
    let channels: RealtimeChannel[] = [];
    let activeAccessToken: string | null = null;

    async function removeChannels() {
      const currentChannels = channels;
      channels = [];

      await Promise.all(currentChannels.map((channel) => supabase.removeChannel(channel)));
    }

    async function subscribe(accessToken: string) {
      if (cancelled || activeAccessToken === accessToken) {
        return;
      }

      activeAccessToken = accessToken;

      await removeChannels();

      if (cancelled) {
        return;
      }

      try {
        /*
         * createBrowserClient owns the browser auth/session lifecycle.
         * Let Supabase Realtime obtain the current authenticated token
         * from that client instead of forcing a permanent manual token.
         */
        await supabase.realtime.setAuth();
      } catch (error) {
        activeAccessToken = null;
        console.error("[RSL] setAuth failed", error);
        return;
      }

      channels = scopedConsorcioIds.map((edificioId) => {
        const topic = `organization:${organizationId}:consorcio:${edificioId}:tickets`;

        let channel = supabase.channel(topic, {
          config: {
            private: true,
          },
        });

        for (const eventType of TICKET_EVENTS) {
          channel = channel.on("broadcast", { event: eventType }, (message) => {
            const ticketId = typeof message.payload?.ticketId === "string" ? message.payload.ticketId : null;

            if (!ticketId) {
              console.warn("[RSL] Broadcast without ticketId", {
                topic,
                eventType,
                payload: message.payload,
              });

              return;
            }

            console.info("[RSL] EVENT", {
              topic,
              eventType,
              ticketId,
              edificioId,
            });

            emitTicketRslEvent({
              type: eventType,
              ticketId,
              edificioId,
            });
          });
        }

        channel.subscribe((status, error) => {
          const context = {
            topic,
            organizationId,
            edificioId,
            status,
          };

          switch (status) {
            case "SUBSCRIBED":
              console.info("[RSL] SUBSCRIBED", context);
              break;

            case "CHANNEL_ERROR":
              console.error("[RSL] CHANNEL_ERROR", context, error);
              break;

            case "TIMED_OUT":
              console.error("[RSL] TIMED_OUT", context, error);
              break;

            case "CLOSED":
              console.warn("[RSL] CLOSED", context);
              break;

            default:
              console.info("[RSL] STATUS", context);
          }
        });

        return channel;
      });
    }

    async function start() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (error || !session?.access_token) {
        console.error("[RSL] No authenticated browser session", error);
        return;
      }

      await subscribe(session.access_token);
    }

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) {
        return;
      }

      if (event === "SIGNED_OUT") {
        activeAccessToken = null;
        void removeChannels();
        return;
      }

      if (!session?.access_token) {
        return;
      }

      queueMicrotask(() => {
        void subscribe(session.access_token);
      });
    });

    void start();

    return () => {
      cancelled = true;
      activeAccessToken = null;
      authSubscription.unsubscribe();
      void removeChannels();
    };
  }, [organizationId, consorcioScopeKey]);

  return children;
}
