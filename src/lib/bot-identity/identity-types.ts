const BOT_IDENTITY_CHANNELS = ["telegram", "whatsapp"] as const;
export type BotIdentityChannel = (typeof BOT_IDENTITY_CHANNELS)[number];

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
  unitNumber?: string;
};

export type BotUnitOrigin = "provided" | "inferred_single_link";

type BotUnitOption = { unitNumber: string; consorcioLabel: string };

export type BotUnitClarification = { kind: "unit"; unitOptions: BotUnitOption[] };

export type BotContext = {
  channel: BotIdentityChannel;
  channelUserId: string;
  organizationId: string;
  residentId: string;
  unitId: string;
  unitNumber?: string;
  consorcioId: string;
  consorcioLabel?: string;
  unitOrigin: BotUnitOrigin;
};

export type BotIdentityResolution = {
  outcome: BotIdentityOutcome | "invalid_unit_selection";
  context: BotContext | null;
  clarification?: BotUnitClarification;
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
    unitNumber: string | null;
    unitOrganizationId: string | null;
    consorcioId: string | null;
    consorcioOrganizationId: string | null;
    consorcioLabel?: string | null;
  }>;
};

export type BotIdentityRepository = {
  findChannelCandidates(channel: BotIdentityChannel, externalSenderId: string): Promise<BotIdentityCandidate[]>;
};
