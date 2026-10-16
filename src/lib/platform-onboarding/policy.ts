import type { OnboardingStatus } from "./contracts";

export type CaseAction =
  | "start_review"
  | "commercial_review"
  | "cancel"
  | "reject"
  | "reopen"
  | "retry"
  | "mark_duplicate";

export function isCaseActionAllowed(status: OnboardingStatus, action: CaseAction, hasOrganization: boolean): boolean {
  if (action === "start_review") return status === "received";
  if (action === "commercial_review") return ["in_review", "commercial_review"].includes(status);
  if (action === "cancel" || action === "reject") {
    return !["active", "cancelled", "rejected", "duplicate_linked"].includes(status);
  }
  if (action === "reopen") {
    if (hasOrganization) return false;
    return ["cancelled", "rejected", "provisioning_failed", "activation_failed"].includes(status);
  }
  if (action === "retry") return ["provisioning_failed", "activation_failed"].includes(status);
  if (action === "mark_duplicate")
    return !hasOrganization && !["active", "cancelled", "duplicate_linked"].includes(status);
  return false;
}

export type ActivationReadiness = {
  actorIsActivePlatformOwner: boolean;
  organizationValid: boolean;
  intendedOwnerAccepted: boolean;
  ownerMembershipActiveAfterCommit: boolean;
  subscriptionStatus: string;
  commercialMode: string | null;
  freeGrantAudited: boolean;
  freeGrantExpired: boolean;
  planActive: boolean;
  sameOrganizationBuildingAndUnit: boolean;
  withinCapacity: boolean;
};

export function activationBlocker(readiness: ActivationReadiness): string | null {
  if (!readiness.actorIsActivePlatformOwner) return "platform_owner_required";
  if (!readiness.organizationValid) return "organization_invalid";
  if (!readiness.intendedOwnerAccepted || !readiness.ownerMembershipActiveAfterCommit) return "owner_not_ready";
  if (!readiness.planActive) return "active_plan_required";
  const eligibleStatus =
    readiness.subscriptionStatus === "active" ||
    readiness.subscriptionStatus === "trialing" ||
    (readiness.subscriptionStatus === "free" &&
      readiness.commercialMode === "internal_free" &&
      readiness.freeGrantAudited &&
      !readiness.freeGrantExpired);
  if (!eligibleStatus) return "subscription_not_eligible";
  if (!readiness.sameOrganizationBuildingAndUnit) return "same_organization_building_and_unit_required";
  if (!readiness.withinCapacity) return "plan_capacity_exceeded";
  return null;
}
