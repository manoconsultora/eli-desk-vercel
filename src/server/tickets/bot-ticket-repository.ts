import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  BotTicketPersistence,
  BotTicketPersistenceInput,
  BotTicketPersistenceResult,
} from "./create-ticket-command";

type RpcRow = {
  outcome: "created" | "existing" | "conflict";
  ticket_id: string | null;
  ticket_code: string | null;
};

export class BotTicketRepositoryError extends Error {
  constructor() {
    super("Bot ticket persistence failed.");
    this.name = "BotTicketRepositoryError";
  }
}

export class SupabaseBotTicketPersistence implements BotTicketPersistence {
  constructor(private readonly client: SupabaseClient) {}

  async createIdempotentTicket(input: BotTicketPersistenceInput): Promise<BotTicketPersistenceResult> {
    const { data, error } = await this.client.rpc("create_n8n_idempotent_ticket", {
      p_environment: input.environment,
      p_principal_id: input.principalId,
      p_capability: input.capability,
      p_idempotency_key: input.idempotencyKey,
      p_payload_fingerprint: input.payloadFingerprint,
      p_organization_id: input.organizationId,
      p_edificio_id: input.edificioId,
      p_unidad_id: input.unidadId,
      p_channel_user_id: input.channelUserId,
      p_created_by_channel_user_id: input.createdByChannelUserId,
      p_chat_id: input.chatId,
      p_ticket_type: input.ticketType,
      p_priority: input.priority,
      p_category: input.category,
      p_description: input.description,
    });

    if (error) throw new BotTicketRepositoryError();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") throw new BotTicketRepositoryError();
    const result = row as Partial<RpcRow>;
    if (result.outcome === "conflict") return { outcome: "conflict" };
    if (
      (result.outcome === "created" || result.outcome === "existing") &&
      typeof result.ticket_id === "string" &&
      typeof result.ticket_code === "string"
    ) {
      return {
        outcome: result.outcome,
        ticketId: result.ticket_id,
        ticketCode: result.ticket_code,
      };
    }
    throw new BotTicketRepositoryError();
  }
}

export function createServerBotTicketPersistence(): BotTicketPersistence {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) throw new BotTicketRepositoryError();
  return new SupabaseBotTicketPersistence(createClient(url, secretKey));
}
