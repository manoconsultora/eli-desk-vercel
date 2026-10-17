const BOT_SECURITY_ENVIRONMENTS = ["dev", "prod"] as const;
export type BotSecurityEnvironment = (typeof BOT_SECURITY_ENVIRONMENTS)[number];

const BOT_KEY_STATES = ["active", "retiring", "revoked"] as const;
type BotKeyState = (typeof BOT_KEY_STATES)[number];

export type SignedHeaders = {
  keyId: string;
  timestamp: number;
  nonce: string;
  requestId: string;
  bodySha256: string;
  signature: string;
};

export type BotHmacKey = {
  environment: BotSecurityEnvironment;
  keyId: string;
  state: BotKeyState;
  secret: string | Uint8Array;
  principalId: string;
  validUntil?: number;
};

export type AuthenticatedTechnicalPrincipal = {
  kind: "technical_integration";
  name: "integration:n8n";
  principalId: string;
  environment: BotSecurityEnvironment;
  requestId: string;
  keyId: string;
  tenantAuthority: null;
  businessAuthority: false;
};

export type NonceReservationResult = "reserved" | "replay" | "unknown";

export type NonceReservation = {
  environment: BotSecurityEnvironment;
  keyId: string;
  nonce: string;
  requestId: string;
  reservedAt: number;
  retentionSeconds: number;
};

export type BotSecurityErrorCode =
  | "invalid_header"
  | "missing_header"
  | "duplicate_header"
  | "invalid_body_hash"
  | "body_hash_mismatch"
  | "unsupported_method"
  | "invalid_path"
  | "unknown_key"
  | "key_identity_mismatch"
  | "key_environment_mismatch"
  | "key_revoked"
  | "key_expired"
  | "invalid_signature"
  | "invalid_timestamp"
  | "timestamp_outside_window"
  | "nonce_replay"
  | "nonce_store_unavailable";

export type BotSecurityEvent = {
  event: "authentication_rejected" | "authentication_succeeded";
  code?: BotSecurityErrorCode;
  environment: BotSecurityEnvironment;
  keyId?: string;
  requestId?: string;
  nonceDigest?: string;
  bodyDigest?: string;
};

export type HeaderSource = {
  get(name: string): string | null;
  getAll?(name: string): readonly string[];
};

export type BotKeyRegistry = {
  resolve(keyId: string, environment: BotSecurityEnvironment): Promise<BotHmacKey | null>;
};

export type NonceReplayStore = {
  reserve(nonce: NonceReservation): Promise<NonceReservationResult>;
};

export type SecurityObserver = {
  record(event: BotSecurityEvent): void | Promise<void>;
};
