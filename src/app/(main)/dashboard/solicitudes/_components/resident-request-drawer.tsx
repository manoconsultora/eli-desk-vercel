import type * as React from "react";

import { Ban, Building2, Home, Mail, Phone, User, Users } from "lucide-react";

import { Initials, Pill, type Tone } from "@/app/(main)/dashboard/_components/list-table";
import { relationshipLabel } from "@/app/(main)/dashboard/consorcios/_components/community-labels";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { ResidentRequest } from "@/server/resident-requests/resident-request-repository";

import { formatRequestDate, requestedAgo } from "./request-time";
import { ReviewButton } from "./review-buttons";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_VERIFICATION: { label: "Solicitud pendiente", tone: "amber" },
  APPROVED: { label: "Solicitud aceptada", tone: "green" },
  REJECTED: { label: "Solicitud rechazada", tone: "red" },
};

function DataRow({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1.25rem_7rem_1fr] items-center gap-2 py-1.5 text-sm">
      <Icon className="size-4 text-muted-foreground" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{children}</dd>
    </div>
  );
}

type ReviewProps = {
  busy: boolean;
  blacklisted: boolean;
  onApprove: () => void;
  onReject: () => void;
  onBlacklist: () => void;
};

function ReviewActions({ busy, blacklisted, onApprove, onReject, onBlacklist }: ReviewProps) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">Acciones</h3>
      <div className="space-y-1.5">
        <ReviewButton kind="approve" className="w-full" disabled={busy} onClick={onApprove}>
          Aceptar solicitud
        </ReviewButton>
        <p className="text-muted-foreground text-xs">
          Se enviará un email de bienvenida y pasará al listado de vecinos.
        </p>
      </div>
      <div className="space-y-1.5">
        <ReviewButton kind="reject" className="w-full" disabled={busy} onClick={onReject}>
          Rechazar solicitud
        </ReviewButton>
        <p className="text-muted-foreground text-xs">Se enviará un email notificando el rechazo.</p>
      </div>
      {blacklisted ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Ban className="size-4" />
          Este contacto ya está en la blacklist.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={onBlacklist}>
            <Ban className="size-4" />
            Agregar a blacklist
          </Button>
          <p className="text-muted-foreground text-xs">
            El contacto no podrá volver a iniciar solicitudes. Esta acción puede revertirse desde la sección Blacklist.
          </p>
        </div>
      )}
    </section>
  );
}

function RequestDetail({
  request,
  index,
  now,
  review,
}: {
  request: ResidentRequest;
  index: number;
  now: number;
  review: ReviewProps;
}) {
  const status = STATUS[request.status] ?? { label: request.status, tone: "neutral" };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Initials name={request.name} index={index} large />
        <div className="min-w-0 space-y-1.5">
          <SheetTitle className="font-semibold text-xl tracking-tight">{request.name}</SheetTitle>
          <Pill tone={status.tone}>{status.label}</Pill>
          <SheetDescription className="text-sm" suppressHydrationWarning>
            Solicitó acceso {requestedAgo(request.createdAt, now)}
            <br />
            {formatRequestDate(request.createdAt)}
          </SheetDescription>
        </div>
      </div>

      <Separator />

      <section className="space-y-2">
        <h3 className="font-semibold">Datos del vecino</h3>
        <dl>
          <DataRow icon={User} label="Nombre">
            {request.firstName}
          </DataRow>
          <DataRow icon={User} label="Apellido">
            {request.lastName}
          </DataRow>
          <DataRow icon={Mail} label="Email">
            {request.email}
          </DataRow>
          <DataRow icon={Phone} label="Teléfono">
            {request.phone ?? "Sin teléfono"}
          </DataRow>
          <DataRow icon={Home} label="Unidad">
            {request.unitNumber ?? "s/n"}
          </DataRow>
          <DataRow icon={Users} label="Relación">
            {relationshipLabel(request.relationship) ?? "Sin definir"}
          </DataRow>
        </dl>
      </section>

      <Separator />

      <section className="space-y-3">
        <h3 className="font-semibold">Consorcio</h3>
        <div className="flex items-center gap-3">
          <Building2 className="size-8 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-semibold">{request.communityName}</p>
            <p className="text-muted-foreground text-sm">
              {[request.communityAddress, `${request.communityUnitCount} UF`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </section>

      {request.status === "PENDING_VERIFICATION" && (
        <>
          <Separator />
          <ReviewActions {...review} />
        </>
      )}

      {request.status === "REJECTED" && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="font-semibold">Motivo del rechazo</h3>
            <p className="text-muted-foreground text-sm">{request.rejectionReason ?? "Sin motivo."}</p>
          </section>
        </>
      )}
    </div>
  );
}

export function ResidentRequestDrawer({
  request,
  index,
  now,
  onClose,
  ...review
}: {
  request: ResidentRequest | null;
  index: number;
  now: number;
  onClose: () => void;
} & ReviewProps) {
  return (
    <Sheet open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-md">
        {request && <RequestDetail request={request} index={index} now={now} review={review} />}
      </SheetContent>
    </Sheet>
  );
}
