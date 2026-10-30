import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isLikelySameTicket } from "./bot-ticket-duplicate";
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

class BotTicketRepositoryError extends Error {
  constructor() {
    super("Bot ticket persistence failed.");
    this.name = "BotTicketRepositoryError";
  }
}

class SupabaseBotTicketPersistence implements BotTicketPersistence {
  constructor(private readonly client: SupabaseClient) {}

  async findRecentMatchingTicket(input: BotTicketPersistenceInput) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    let query = this.client
      .from("tickets")
      .select("id, ticket_code, description")
      .eq("organization_id", input.organizationId)
      .eq("edificio_id", input.edificioId)
      .eq("created_by_channel_user_id", input.createdByChannelUserId)
      .eq("created_via", "elibot")
      .is("deleted_at", null)
      .eq("ticket_type", input.ticketType)
      .in("status", ["abierto", "en_proceso"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    query = input.unidadId ? query.eq("unidad_id", input.unidadId) : query.is("unidad_id", null);
    const { data, error } = await query;
    if (error) throw new BotTicketRepositoryError();
    const match = data?.find(
      (row) =>
        typeof row.description === "string" &&
        typeof row.id === "string" &&
        typeof row.ticket_code === "string" &&
        isLikelySameTicket(input.description, row.description),
    );
    return match ? { ticketId: match.id, ticketCode: match.ticket_code } : null;
  }

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
      p_unit_origin: input.unitOrigin,
      p_residente_id: input.residentId,
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
