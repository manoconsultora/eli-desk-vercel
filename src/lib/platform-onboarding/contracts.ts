export const onboardingStatuses = [
  "received",
  "in_review",
  "commercial_review",
  "approved_to_provision",
  "provisioning",
  "awaiting_owner_acceptance",
  "needs_initial_data",
  "ready_to_activate",
  "active",
  "duplicate_linked",
  "rejected",
  "cancelled",
  "provisioning_failed",
  "activation_failed",
] as const;

export type OnboardingStatus = (typeof onboardingStatuses)[number];

export type OnboardingCase = {
  id: string;
  source: "landing";
  status: OnboardingStatus;
  source_user_id: string | null;
  onboarding_progress: "unknown" | "initial_data_saved" | "setup_in_progress" | "checkout_started" | "completed";
  payment_status: "unknown" | "not_started" | "pending" | "approved" | "rejected" | "failed";
  desk_access_status: "unknown" | "not_enabled" | "enabled" | "suspended";
  fiscal_data_status: "unknown" | "pending" | "available" | "missing";
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  organization_name: string;
  request_summary: string;
  requested_plan_code: string | null;
  selected_plan_id: string | null;
  commercial_mode: "paid" | "trial" | "internal_free" | null;
  commercial_reason: string | null;
  organization_id: string | null;
  subscription_id: string | null;
  owner_email: string | null;
  owner_user_id: string | null;
  owner_acceptance_verified_at: string | null;
  owner_acceptance_reason: string | null;
  initial_edificio_id: string | null;
  initial_unidad_ids: string[];
  duplicate_of: string | null;
  safe_failure_code: string | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
};

export type OnboardingEvent = {
  id: string;
  case_id: string;
  platform_user_id: string | null;
  actor_source: "platform" | "landing" | "system";
  action: string;
  outcome: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type OnboardingPlan = {
  id: string;
  code: string;
  name: string;
  trial_days: number;
  max_consorcios: number | null;
  max_units: number | null;
};

export const onboardingStatusLabels: Record<OnboardingStatus, string> = {
  received: "Solicitud recibida",
  in_review: "En revisión",
  commercial_review: "Revisión comercial",
  approved_to_provision: "Aprobado para provisionar",
  provisioning: "Provisionamiento",
  awaiting_owner_acceptance: "Esperando confirmación del titular",
  needs_initial_data: "Preparación operativa pendiente",
  ready_to_activate: "Listo para activar",
  active: "Activo y entregado",
  duplicate_linked: "Duplicado vinculado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  provisioning_failed: "Provisionamiento fallido",
  activation_failed: "Activación fallida",
};

export const onboardingStages = [
  "Solicitud",
  "Revisión comercial",
  "Provisionamiento",
  "Preparación operativa",
  "Activación y entrega",
] as const;
