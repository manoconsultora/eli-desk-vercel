const BOT_IDENTITY_CHANNELS = ["telegram"] as const;
type BotIdentityChannel = (typeof BOT_IDENTITY_CHANNELS)[number];

const BOT_IDENTITY_OUTCOMES = [
  "resolved",
  "unresolved",
  "blocked",
  "inactive",
  "ambiguous_unit",
  "ambiguous_organization",
  "cross_tenant",
] as const;
type BotIdentityOutcome = (typeof BOT_IDENTITY_OUTCOMES)[number];

export type BotIdentityInput = {
  channel: string;
  externalSenderId: string;
};

export type BotContext = {
  channel: BotIdentityChannel;
  channelUserId: string;
  organizationId: string;
  residentId: string;
  unitId: string;
  consorcioId: string;
};

export type BotIdentityResolution = {
  outcome: BotIdentityOutcome;
  context: BotContext | null;
};

export type BotIdentityCandidate = {
  channelUserId: string;
  channelUserStatus: "active" | "blocked" | "inactive";
  organizationId: string;
  organizationStatus: string | null;
  residentId: string | null;
  residentOrganizationId: string | null;
  residentActive: boolean | null;
  links: Array<{
    organizationId: string;
    unitId: string;
    unitOrganizationId: string | null;
    consorcioId: string | null;
    consorcioOrganizationId: string | null;
  }>;
};

export interface BotIdentityRepository {
  findTelegramCandidates(externalSenderId: string): Promise<BotIdentityCandidate[]>;
}
