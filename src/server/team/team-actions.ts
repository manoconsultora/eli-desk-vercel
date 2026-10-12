"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { resendConfigFromEnv } from "@/server/resident-emails/resident-email-outbox";

import { sendTeamInvitationEmail } from "./team-invitation-email";
import {
  type InvitationToken,
  inviteTeamMember,
  resendTeamInvitation,
  revokeTeamInvitation,
  setTeamMemberStatus,
  TeamError,
  updateTeamMember,
} from "./team-repository";
import { TEAM_ROLES, type TeamRole } from "./team-roles";

type ActionResult = { success: true } | { success: false; error: string };
// The link goes back to the owner too, so they can copy it if the email didn't go out.
type InvitationResult = { success: true; link: string; emailSent: boolean } | { success: false; error: string };

// The RPCs check that the caller is the active owner (and the plan); this only keeps others out early.
async function ownerContext() {
  const context = await getRequestAuthContext();
  if (
    !context.authenticated ||
    context.userType !== "tenant" ||
    !context.organizationId ||
    context.role !== "TENANT_OWNER"
  ) {
    return null;
  }
  return context;
}

async function invitationLink(token: string) {
  const headerList = await headers();
  const origin =
    headerList.get("origin") ?? `${headerList.get("x-forwarded-proto") ?? "https"}://${headerList.get("host")}`;
  return `${origin}/invitacion/${token}`;
}

async function deliver(
  supabase: SupabaseClient,
  organizationId: string,
  { token, email }: InvitationToken,
  role: TeamRole,
): Promise<InvitationResult> {
  const link = await invitationLink(token);
  const { data } = await supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  const organizationName = (data?.name as string | undefined) ?? "Tu administración";
  const emailSent = await sendTeamInvitationEmail(resendConfigFromEnv(), email, { organizationName, role, url: link });
  revalidatePath("/dashboard/equipo");
  return { success: true, link, emailSent };
}

function isTeamRole(role: string): role is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(role);
}

function failure(error: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: error instanceof TeamError ? error.message : fallback };
}

export async function inviteTeamMemberAction(invitation: {
  email: string;
  role: string;
  communityIds: string[];
}): Promise<InvitationResult> {
  if (!isTeamRole(invitation.role)) return { success: false, error: "Elegí un rol." };
  const role = invitation.role;
  try {
    const context = await ownerContext();
    if (!context?.organizationId) return { success: false, error: "Solo el dueño de la administración invita." };
    const supabase = await createClient();
    const token = await inviteTeamMember(supabase, context.organizationId, {
      email: invitation.email,
      role,
      communityIds: invitation.communityIds,
    });
    return await deliver(supabase, context.organizationId, token, role);
  } catch (error) {
    return failure(error, "No se pudo invitar.");
  }
}

export async function resendTeamInvitationAction(invitation: { id: string; role: string }): Promise<InvitationResult> {
  const role = isTeamRole(invitation.role) ? invitation.role : "VIEWER";
  try {
    const context = await ownerContext();
    if (!context?.organizationId) return { success: false, error: "Solo el dueño de la administración invita." };
    const supabase = await createClient();
    const token = await resendTeamInvitation(supabase, invitation.id);
    return await deliver(supabase, context.organizationId, token, role);
  } catch (error) {
    return failure(error, "No se pudo reenviar la invitación.");
  }
}

export async function revokeTeamInvitationAction(invitationId: string): Promise<ActionResult> {
  try {
    if (!(await ownerContext()))
      return { success: false, error: "Solo el dueño de la administración gestiona el equipo." };
    await revokeTeamInvitation(await createClient(), invitationId);
  } catch (error) {
    return failure(error, "No se pudo cancelar la invitación.");
  }
  revalidatePath("/dashboard/equipo");
  return { success: true };
}

export async function updateTeamMemberAction(
  membershipId: string,
  access: { role: string; communityIds: string[] },
): Promise<ActionResult> {
  if (!isTeamRole(access.role)) return { success: false, error: "Elegí un rol." };
  const role = access.role;
  try {
    if (!(await ownerContext()))
      return { success: false, error: "Solo el dueño de la administración gestiona el equipo." };
    await updateTeamMember(await createClient(), membershipId, { role, communityIds: access.communityIds });
  } catch (error) {
    return failure(error, "No se pudieron guardar los cambios.");
  }
  revalidatePath("/dashboard/equipo");
  return { success: true };
}

export async function setTeamMemberStatusAction(
  membershipId: string,
  status: "active" | "suspended",
): Promise<ActionResult> {
  try {
    if (!(await ownerContext()))
      return { success: false, error: "Solo el dueño de la administración gestiona el equipo." };
    await setTeamMemberStatus(await createClient(), membershipId, status);
  } catch (error) {
    return failure(error, status === "suspended" ? "No se pudo suspender." : "No se pudo reactivar.");
  }
  revalidatePath("/dashboard/equipo");
  return { success: true };
}
