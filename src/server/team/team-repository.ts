import type { SupabaseClient } from "@supabase/supabase-js";

import type { TeamRole } from "./team-roles";

// The database rejects with these messages (eli-database-platform 20261012230000).
const TEAM_ERRORS: Record<string, string> = {
  forbidden: "Solo el dueño de la administración gestiona el equipo.",
  plan_required: "El equipo está disponible en el plan Pro.",
  invalid_email: "Ingresá un email válido.",
  invalid_role: "Elegí un rol.",
  consorcios_required: "Elegí al menos un consorcio.",
  invalid_consorcio: "Alguno de los consorcios ya no existe.",
  already_member: "Esa persona ya es parte del equipo.",
  already_invited: "Ya hay una invitación pendiente para ese email: reenviala desde la lista.",
  invitation_not_pending: "La invitación ya fue aceptada o cancelada.",
  invitation_not_found: "La invitación no existe o fue cancelada.",
  invitation_expired: "La invitación venció. Pedile al dueño que te la reenvíe.",
  email_mismatch: "La invitación es para otro email.",
  cannot_change_owner: "Al dueño no se lo cambia desde Equipo.",
  invalid_status: "Estado inválido.",
  last_owner: "La administración tiene que tener un dueño activo.",
};

export class TeamError extends Error {}

function throwTeamError(error: { message: string }): never {
  const message = TEAM_ERRORS[error.message];
  if (message) throw new TeamError(message);
  throw new Error(error.message);
}

export type TeamEntry = {
  kind: "member" | "invitation";
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: "active" | "suspended" | "invited" | "expired" | "inactive";
  communityIds: string[];
  expiresAt: string | null;
  createdAt: string;
};

type TeamRow = {
  kind: "member" | "invitation";
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: TeamEntry["status"];
  edificio_ids: string[] | null;
  expires_at: string | null;
  created_at: string;
};

export async function listTeam(supabase: SupabaseClient, organizationId: string): Promise<TeamEntry[]> {
  const { data, error } = await supabase.rpc("list_team", { p_organization_id: organizationId });
  if (error) throwTeamError(error);
  return ((data ?? []) as TeamRow[]).map((row) => ({
    kind: row.kind,
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    communityIds: row.edificio_ids ?? [],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function hasTeamPlan(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("organization_has_team_plan", { p_organization_id: organizationId });
  if (error) throw new Error(error.message);
  return data === true;
}

export type InvitationToken = { token: string; email: string };

export async function inviteTeamMember(
  supabase: SupabaseClient,
  organizationId: string,
  invitation: { email: string; role: TeamRole; communityIds: string[] },
): Promise<InvitationToken> {
  const { data, error } = await supabase
    .rpc("invite_team_member", {
      p_organization_id: organizationId,
      p_email: invitation.email,
      p_role: invitation.role,
      p_edificio_ids: invitation.communityIds,
    })
    .single<{ token: string }>();
  if (error) throwTeamError(error);
  return { token: data.token, email: invitation.email.trim().toLowerCase() };
}

export async function resendTeamInvitation(supabase: SupabaseClient, invitationId: string): Promise<InvitationToken> {
  const { data, error } = await supabase
    .rpc("resend_team_invitation", { p_invitation_id: invitationId })
    .single<{ email: string; token: string }>();
  if (error) throwTeamError(error);
  return { token: data.token, email: data.email };
}

export async function revokeTeamInvitation(supabase: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_team_invitation", { p_invitation_id: invitationId });
  if (error) throwTeamError(error);
}

export async function updateTeamMember(
  supabase: SupabaseClient,
  membershipId: string,
  access: { role: TeamRole; communityIds: string[] },
): Promise<void> {
  const { error } = await supabase.rpc("update_team_member", {
    p_membership_id: membershipId,
    p_role: access.role,
    p_edificio_ids: access.communityIds,
  });
  if (error) throwTeamError(error);
}

export async function setTeamMemberStatus(
  supabase: SupabaseClient,
  membershipId: string,
  status: "active" | "suspended",
): Promise<void> {
  const { error } = await supabase.rpc("set_team_member_status", { p_membership_id: membershipId, p_status: status });
  if (error) throwTeamError(error);
}

export type InvitationSummary = {
  organizationName: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
};

// Service role only: what the acceptance page shows before the person signs in.
export async function getTeamInvitation(admin: SupabaseClient, token: string): Promise<InvitationSummary | null> {
  const { data, error } = await admin.rpc("get_team_invitation", { p_token: token });
  if (error) throw new Error(error.message);
  const row = (
    data as { organization_name: string; email: string; role: string; status: InvitationSummary["status"] }[]
  )?.[0];
  return row ? { organizationName: row.organization_name, email: row.email, role: row.role, status: row.status } : null;
}

// As the signed-in user whose email matches the invitation.
export async function acceptTeamInvitation(supabase: SupabaseClient, token: string): Promise<void> {
  const { error } = await supabase.rpc("accept_team_invitation", { p_token: token });
  if (error) throwTeamError(error);
}
