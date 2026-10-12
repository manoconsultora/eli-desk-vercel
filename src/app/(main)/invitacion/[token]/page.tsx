import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { signOutForInvitationAction } from "@/server/team/team-acceptance-actions";
import { getTeamInvitation } from "@/server/team/team-repository";
import { teamRoleLabel } from "@/server/team/team-roles";

import { AcceptAsCurrentUser, AcceptInvitationForms } from "./_components/accept-invitation-forms";

const CLOSED: Record<string, { title: string; body: string }> = {
  accepted: { title: "Esta invitación ya fue aceptada", body: "Entrá a Desk con tu cuenta." },
  revoked: {
    title: "Esta invitación fue cancelada",
    body: "Si necesitás acceso, pedíselo al dueño de la administración.",
  },
  expired: { title: "Esta invitación venció", body: "Pedile al dueño de la administración que te la reenvíe." },
};

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full flex-col justify-center gap-6 px-4 sm:w-[400px]">{children}</div>;
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getTeamInvitation(supabaseAdmin, token).catch(() => null);

  if (!invitation || invitation.status !== "pending") {
    const closed = (invitation && CLOSED[invitation.status]) ?? {
      title: "La invitación no existe",
      body: "Revisá el link o pedile al dueño de la administración que te la reenvíe.",
    };
    return (
      <Shell>
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-2xl">{closed.title}</h1>
          <p className="text-muted-foreground text-sm">{closed.body}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/login">Ir al login</Link>
        </Button>
      </Shell>
    );
  }

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const signedInEmail = user?.email?.toLowerCase() ?? null;

  return (
    <Shell>
      <div className="space-y-2 text-center">
        <h1 className="font-semibold text-2xl">Sumate al equipo de {invitation.organizationName}</h1>
        <p className="text-muted-foreground text-sm">
          Te invitaron a ELI Desk como {teamRoleLabel(invitation.role).toLowerCase()}, con {invitation.email}.
        </p>
      </div>

      {signedInEmail === invitation.email ? (
        <AcceptAsCurrentUser token={token} />
      ) : signedInEmail ? (
        <div className="space-y-4 text-center">
          <p className="text-sm">
            Iniciaste sesión como {signedInEmail}, pero la invitación es para {invitation.email}.
          </p>
          <form action={signOutForInvitationAction.bind(null, token)}>
            <Button type="submit" variant="outline" className="w-full">
              Cerrar sesión y seguir
            </Button>
          </form>
        </div>
      ) : (
        <AcceptInvitationForms token={token} email={invitation.email} />
      )}
    </Shell>
  );
}
