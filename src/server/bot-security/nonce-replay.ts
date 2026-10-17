import type { BotSecurityEnvironment, NonceReservation } from "../../lib/bot-security/security-types";

const NONCE_RETENTION_SECONDS = 10 * 60;

export type ReserveNonceInput = {
  environment: BotSecurityEnvironment;
  keyId: string;
  nonce: string;
  requestId: string;
  now: number;
};

export function createNonceReservation(input: ReserveNonceInput): NonceReservation {
  return {
    environment: input.environment,
    keyId: input.keyId,
    nonce: input.nonce,
    requestId: input.requestId,
    reservedAt: input.now,
    retentionSeconds: NONCE_RETENTION_SECONDS,
  };
}
