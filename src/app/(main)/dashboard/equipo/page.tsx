import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { listCommunities } from "@/server/communities/community-repository";
import { hasTeamPlan, listTeam } from "@/server/team/team-repository";

import { TeamList } from "./_components/team-list";

function MessageState({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-border/60 bg-muted/20 p-8 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="font-semibold text-xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
    </section>
  );
}

export default async function EquipoPage() {
  const context = await getRequestAuthContext();
  if (!context.authenticated || context.userType !== "tenant" || !context.organizationId) {
    return <MessageState title="Sin acceso" body="No se puede mostrar el módulo con el acceso actual." />;
  }
  if (context.role !== "TENANT_OWNER") {
    return (
      <MessageState
        title="Equipo"
        body="Solo el dueño de la administración invita y gestiona a las personas del equipo."
      />
    );
  }

  const organizationId = context.organizationId;
  const supabase = await createClient();
  const loaded = await Promise.all([
    hasTeamPlan(supabase, organizationId),
    listTeam(supabase, organizationId),
    listCommunities(supabase, organizationId, { kind: "all_consorcios" }),
  ]).then(
    ([teamPlan, team, communities]) => ({
      teamPlan,
      team,
      communities: communities.map((community) => ({ id: community.id, name: community.name })),
    }),
    () => null,
  );
  if (loaded === null) {
    return <MessageState title="No se pudo cargar el equipo" body="Probá de nuevo en unos minutos." />;
  }
  if (!loaded.teamPlan) {
    return (
      <MessageState
        title="El equipo está disponible en el plan Pro"
        body="Con Pro invitás a tu equipo con su rol y los consorcios que atiende cada uno. Escribinos para cambiar de plan."
      />
    );
  }

  return (
    <div className="space-y-6">
      <TeamList team={loaded.team} communities={loaded.communities} />
    </div>
  );
}
