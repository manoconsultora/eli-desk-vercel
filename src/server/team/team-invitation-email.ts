import type { ResendConfig } from "@/server/resident-emails/resident-email-outbox";
import { escapeHtml, layout } from "@/server/resident-emails/resident-email-templates";

import { type TeamRole, teamRoleLabel } from "./team-roles";

export type TeamInvitationEmail = {
  organizationName: string;
  role: TeamRole;
  url: string;
};

// Same design and voice as the residents' emails (ELI signup email).
export function renderTeamInvitationEmail({ organizationName, role, url }: TeamInvitationEmail) {
  const organization = escapeHtml(organizationName);
  const roleLabel = teamRoleLabel(role).toLowerCase();
  const subject = `Te invitaron al equipo de ${organizationName} en ELI`;
  return {
    subject,
    html: layout({
      subject,
      title: "Te invitaron a ELI",
      paragraphs: [
        "¡Hola!",
        `${organization} te invitó a su equipo en ELI Desk, con el rol de ${escapeHtml(roleLabel)}.`,
        "Aceptá la invitación para crear tu cuenta o entrar con la que ya tenés.",
      ],
      button: { label: "Aceptar invitación", url: escapeHtml(url) },
      note: "La invitación vence en 7 días. Si no la esperabas, ignorá este email.",
      footer: `Recibís este email porque ${organization} te invitó a su equipo en ELI.`,
      text: "",
    }),
    text: `¡Hola!\n\n${organizationName} te invitó a su equipo en ELI Desk, con el rol de ${roleLabel}.\n\nAceptá la invitación: ${url}\n\nLa invitación vence en 7 días. Si no la esperabas, ignorá este email.`,
  };
}

// Sent right away (not through the residents' outbox): the owner sees whether it went out and
// can copy the link instead. Nothing is sent unless Resend is enabled.
export async function sendTeamInvitationEmail(
  config: ResendConfig | null,
  to: string,
  email: TeamInvitationEmail,
  send: typeof fetch = fetch,
): Promise<boolean> {
  if (!config) return false;
  const { subject, html, text } = renderTeamInvitationEmail(email);
  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to, subject, html, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
