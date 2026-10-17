import type { BotSecurityEvent, SecurityObserver } from "../../lib/bot-security/security-types";
import { createHash } from "node:crypto";

export function digestForLog(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

function createRedactedSecurityEvent(event: BotSecurityEvent): BotSecurityEvent {
  return {
    event: event.event,
    code: event.code,
    environment: event.environment,
    keyId: event.keyId,
    requestId: event.requestId,
    nonceDigest: event.nonceDigest,
    bodyDigest: event.bodyDigest,
  };
}

export function createSecurityObserver(record: (event: BotSecurityEvent) => void | Promise<void>): SecurityObserver {
  return {
    record(event) {
      return record(createRedactedSecurityEvent(event));
    },
  };
}

export const noopSecurityObserver: SecurityObserver = {
  record() {
    // Intentionally discard events when observability is not configured.
  },
};
