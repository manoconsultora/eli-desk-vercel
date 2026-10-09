"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Building2, ChevronRight, MapPin, Ticket, Users } from "lucide-react";

import {
  Initials,
  InitialsAvatar,
  ListActionButton,
  ListCell,
  ListEmpty,
  ListHead,
  ListTable,
  TONE_CLASSES,
  type Tone,
} from "@/app/(main)/dashboard/_components/list-table";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { CommunityDetail } from "@/server/communities/community-repository";

import { ActiveTicketsTable } from "./active-tickets-table";
import { CommunityStatusPill } from "./communities-list";
import { relationshipLabel } from "./community-labels";
import { CreateUnitDialog } from "./create-unit-dialog";
import { sortUnits } from "./filter-units";
import { JoinLinksTab, type JoinLinksTabData } from "./join-links-tab";
import { UnitsTable } from "./units-table";

export type CommunityDrawerResult =
  | {
      kind: "ok";
      community: CommunityDetail;
      joinLinks: JoinLinksTabData;
      canManageUnits: boolean;
      canDeleteUnits: boolean;
    }
  | { kind: "not_found" }
  | { kind: "error" };

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  tone: Tone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-semibold text-xl tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{children}</dd>
    </div>
  );
}

function CommunityDetailView({
  community,
  joinLinks,
  canManageUnits,
  canDeleteUnits,
}: {
  community: CommunityDetail;
  joinLinks: JoinLinksTabData;
  canManageUnits: boolean;
  canDeleteUnits: boolean;
}) {
  const residents = sortUnits(community.units).flatMap((unit) =>
    unit.residents.map((resident) => ({ ...resident, unitNumber: unit.number })),
  );
  const activeResidentCount = new Set(residents.map((resident) => resident.id)).size;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="flex items-center gap-1 text-muted-foreground text-xs">
          Consorcios <ChevronRight className="size-3" /> {community.name}
        </p>
        <div className="flex items-center gap-4">
          <Initials name={community.name} index={0} large />
          <div className="min-w-0 space-y-1.5">
            <SheetTitle className="font-semibold text-2xl tracking-tight">{community.name}</SheetTitle>
            <SheetDescription className="flex items-center gap-1.5 text-sm">
              <MapPin className="size-4 shrink-0" />
              {community.address}
            </SheetDescription>
            <CommunityStatusPill status={community.status} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList variant="line">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="residentes">Residentes</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="accesos">Accesos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard icon={Building2} value={community.units.length} label="Unidades" tone="blue" />
            <StatCard icon={Ticket} value={community.activeTickets.length} label="Tickets activos" tone="red" />
            <StatCard icon={Users} value={activeResidentCount} label="Residentes activos" tone="violet" />
          </div>
          <section className="rounded-xl border bg-card p-5">
            <h3 className="mb-2 font-semibold text-sm">Información general</h3>
            <dl>
              <InfoRow label="Dirección">{community.address}</InfoRow>
              <InfoRow label="Estado">
                <CommunityStatusPill status={community.status} />
              </InfoRow>
              <InfoRow label="Fecha de alta">
                {community.createdAt ? dateFormat.format(new Date(community.createdAt)) : "—"}
              </InfoRow>
            </dl>
          </section>
        </TabsContent>

        <TabsContent value="unidades" className="space-y-4 pt-4">
          {canManageUnits && (
            <div className="flex justify-end">
              <CreateUnitDialog communityId={community.id} communityName={community.name} />
            </div>
          )}
          {community.units.length === 0 ? (
            <ListEmpty>Este consorcio no tiene unidades cargadas.</ListEmpty>
          ) : (
            <UnitsTable units={community.units} canManage={canManageUnits} canDelete={canDeleteUnits} />
          )}
        </TabsContent>

        <TabsContent value="residentes" className="pt-4">
          {residents.length === 0 ? (
            <ListEmpty>Este consorcio no tiene residentes activos.</ListEmpty>
          ) : (
            <ListTable>
              <TableHeader>
                <TableRow>
                  <ListHead>Residente</ListHead>
                  <ListHead>Unidad / Relación</ListHead>
                  <ListHead>Contacto</ListHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {residents.map((resident, index) => (
                  <TableRow key={`${resident.id}-${resident.unitNumber}`}>
                    <ListCell>
                      <InitialsAvatar name={resident.name} index={index} />
                    </ListCell>
                    <ListCell muted>
                      <p className="font-medium text-foreground">Unidad {resident.unitNumber ?? "s/n"}</p>
                      <p>{relationshipLabel(resident.relationship) ?? "Sin definir"}</p>
                    </ListCell>
                    <ListCell muted>
                      <p>{resident.phone ?? "Sin teléfono"}</p>
                      <p>{resident.email ?? "Sin email"}</p>
                    </ListCell>
                  </TableRow>
                ))}
              </TableBody>
            </ListTable>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4 pt-4">
          {community.activeTickets.length === 0 ? (
            <ListEmpty>No hay tickets activos.</ListEmpty>
          ) : (
            <>
              <ActiveTicketsTable tickets={community.activeTickets} />
              <ListActionButton asChild>
                <Link href={`/dashboard/tickets?consorcio=${community.id}`}>Ver todos los tickets</Link>
              </ListActionButton>
            </>
          )}
        </TabsContent>

        <TabsContent value="accesos" className="pt-4">
          <JoinLinksTab
            communityId={community.id}
            communityName={community.name}
            address={community.address}
            data={joinLinks}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Mounted per consorcio (keyed by id), so closing only has to update the URL.
export function CommunityDrawer({ result }: { result: CommunityDrawerResult }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) router.replace("/dashboard/consorcios", { scroll: false });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-2xl">
        {result.kind === "ok" ? (
          <CommunityDetailView
            community={result.community}
            joinLinks={result.joinLinks}
            canManageUnits={result.canManageUnits}
            canDeleteUnits={result.canDeleteUnits}
          />
        ) : (
          <div className="space-y-2 pt-8 text-center">
            <SheetTitle>
              {result.kind === "not_found" ? "Consorcio no encontrado" : "No se pudo cargar el consorcio"}
            </SheetTitle>
            <SheetDescription>
              {result.kind === "not_found" ? "No existe o no lo tenés asignado." : "Probá de nuevo en unos minutos."}
            </SheetDescription>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
