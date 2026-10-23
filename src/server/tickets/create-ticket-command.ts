import type { BotContext } from "../../lib/bot-identity/identity-types";
import type { AuthenticatedTechnicalPrincipal } from "../../lib/bot-security/security-types";
import type { CreateTicketInput, TicketRecord } from "./ticket-repository";
import { validateTicketInput } from "./ticket-service";
import { createHash } from "node:crypto";

export type BotTicketProposal = {
  ticketType: unknown;
  priority?: unknown;
  category?: unknown;
  description: unknown;
};

export type BotTicketPersistenceInput = {
  environment: string;
  principalId: string;
  capability: "tickets.create";
  idempotencyKey: string;
  payloadFingerprint: string;
  organizationId: string;
  edificioId: string;
  unidadId: string;
  channelUserId: string;
  createdByChannelUserId: string;
  chatId: string;
  ticketType: string;
  priority: string;
  category: string | null;
  description: string;
};

export type BotTicketPersistenceResult =
  | { outcome: "created" | "existing"; ticketId: string; ticketCode: string }
  | { outcome: "conflict" };

export type BotTicketPersistence = {
  createIdempotentTicket(input: BotTicketPersistenceInput): Promise<BotTicketPersistenceResult>;
};

export type CreateTicketCommand =
  | {
      actor: { kind: "desk"; organizationId: string; userId: string };
      input: CreateTicketInput;
    }
  | {
      actor: {
        kind: "bot";
        principal: AuthenticatedTechnicalPrincipal;
        context: BotContext;
        idempotencyKey: string;
        proposal: BotTicketProposal;
        chatId: string;
      };
    };

export type CreateTicketCommandResult =
  | { actor: "desk"; outcome: "created"; ticket: TicketRecord }
  | { actor: "bot"; outcome: "created" | "existing"; ticketId: string; ticketCode: string }
  | { actor: "bot"; outcome: "conflict" };

export async function executeCreateTicketCommand(
  command: CreateTicketCommand,
  dependencies: {
    createDeskTicket?: (input: CreateTicketInput, organizationId: string, userId: string) => Promise<TicketRecord>;
    botPersistence?: BotTicketPersistence;
  },
): Promise<CreateTicketCommandResult> {
  if ("input" in command) {
    if (!dependencies.createDeskTicket) throw new Error("Desk ticket persistence is unavailable.");
    const ticket = await dependencies.createDeskTicket(
      command.input,
      command.actor.organizationId,
      command.actor.userId,
    );
    return { actor: "desk", outcome: "created", ticket };
  }

  if (!dependencies.botPersistence) throw new Error("Bot ticket persistence is unavailable.");
  const normalized = normalizeBotProposal(command.actor.proposal);
  const persisted = await dependencies.botPersistence.createIdempotentTicket({
    environment: command.actor.principal.environment,
    principalId: command.actor.principal.principalId,
    capability: "tickets.create",
    idempotencyKey: command.actor.idempotencyKey,
    payloadFingerprint: fingerprintBotTicketInput(normalized),
    organizationId: command.actor.context.organizationId,
    edificioId: command.actor.context.consorcioId,
    unidadId: command.actor.context.unitId,
    channelUserId: command.actor.context.channelUserId,
    createdByChannelUserId: command.actor.context.channelUserId,
    chatId: command.actor.chatId,
    ticketType: normalized.ticket_type,
    priority: normalized.priority,
    category: normalized.category,
    description: normalized.description,
  });

  if (persisted.outcome === "conflict") return { actor: "bot", outcome: "conflict" };
  return {
    actor: "bot",
    outcome: persisted.outcome,
    ticketId: persisted.ticketId,
    ticketCode: persisted.ticketCode,
  };
}

export function normalizeBotProposal(proposal: BotTicketProposal): CreateTicketInput {
  return validateTicketInput({
    edificio_id: "server-resolved",
    ticket_type: proposal.ticketType,
    priority: proposal.priority ?? "normal",
    category: proposal.category ?? null,
    description: proposal.description,
  });
}

export function fingerprintBotTicketInput(
  input: Pick<CreateTicketInput, "ticket_type" | "priority" | "category" | "description">,
): string {
  const canonical = JSON.stringify([
    ["ticket_type", input.ticket_type],
    ["priority", input.priority],
    ["category", input.category],
    ["description", input.description],
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
