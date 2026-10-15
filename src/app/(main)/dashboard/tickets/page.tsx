import { getDeskFeatureAccess } from "@/server/access/resolve-desk-feature-access";

import { TicketsWorkspace } from "./_components/tickets-workspace";

function NonOperationalState({ state }: { state: string }) {
  return (
    <section className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-border/60 bg-muted/20 p-8 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="font-semibold text-xl">{state === "coming_soon" ? "Próximamente" : "Sin acceso"}</h1>
        <p className="text-muted-foreground text-sm">
          {state === "coming_soon"
            ? "Este módulo todavía no está disponible."
            : "No se puede mostrar el módulo con el acceso actual."}
        </p>
      </div>
    </section>
  );
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  const access = await getDeskFeatureAccess("tickets");
  if (access?.state !== "resolved") return <NonOperationalState state={access?.state ?? "error"} />;
  const { consorcio } = await searchParams;
  return <TicketsWorkspace initialEdificioFilter={typeof consorcio === "string" ? consorcio : undefined} />;
}
