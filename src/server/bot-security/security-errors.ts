import type { BotSecurityErrorCode } from "../../lib/bot-security/security-types";

const SAFE_MESSAGES: Record<BotSecurityErrorCode, string> = {
  invalid_header: "Invalid authentication request.",
  missing_header: "Invalid authentication request.",
  duplicate_header: "Invalid authentication request.",
  invalid_body_hash: "Invalid authentication request.",
  body_hash_mismatch: "Invalid authentication request.",
  unsupported_method: "Invalid authentication request.",
  invalid_path: "Invalid authentication request.",
  invalid_domain: "Invalid authentication request.",
  unknown_key: "Authentication failed.",
  key_identity_mismatch: "Authentication failed.",
  key_environment_mismatch: "Authentication failed.",
  key_revoked: "Authentication failed.",
  key_expired: "Authentication failed.",
  invalid_signature: "Authentication failed.",
  invalid_timestamp: "Invalid authentication request.",
  timestamp_outside_window: "Authentication request expired.",
  nonce_replay: "Authentication request already processed.",
  nonce_store_unavailable: "Authentication temporarily unavailable.",
};

export class BotSecurityError extends Error {
  readonly code: BotSecurityErrorCode;
  readonly safeMessage: string;

  constructor(code: BotSecurityErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "BotSecurityError";
    this.code = code;
    this.safeMessage = SAFE_MESSAGES[code];
  }
}
