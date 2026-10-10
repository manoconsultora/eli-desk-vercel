"use client";

import * as React from "react";

import { Eye } from "lucide-react";

import {
  ListActionButton,
  ListCell,
  ListEmpty,
  ListHead,
  ListTable,
  Pill,
} from "@/app/(main)/dashboard/_components/list-table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useRefresh } from "@/hooks/use-refresh";
import { revokeJoinLinkAction } from "@/server/join-links/join-link-actions";
import type { JoinLinkSummary } from "@/server/join-links/join-link-repository";

import { CreateJoinLinkDialog } from "./create-join-link-dialog";
import { JoinLinkQr } from "./join-link-qr";

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type JoinLinksTabData = { links: JoinLinkSummary[] | null; canManage: boolean };

export function JoinLinksTab({
  communityId,
  communityName,
  address,
  data,
}: {
  communityId: string;
  communityName: string;
  address: string;
  data: JoinLinksTabData;
}) {
  const { refresh, refreshing } = useRefresh();
  const [viewing, setViewing] = React.useState<JoinLinkSummary | null>(null);
  const [revoking, setRevoking] = React.useState<JoinLinkSummary | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Also busy until the refreshed data is on screen.
  const busy = saving || refreshing;
  const [error, setError] = React.useState<string | null>(null);

  if (data.links === null) return <ListEmpty>No se pudieron cargar los links de acceso.</ListEmpty>;

  // Links come newest first, so this is the most recent active one.
  const current = data.links.find((link) => link.status === "active");

  async function confirmRevoke(link: JoinLinkSummary) {
    setSaving(true);
    setError(null);
    const result = await revokeJoinLinkAction(link.id);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    refresh(() => setRevoking(null));
  }

  const createButton = data.canManage && (
    <CreateJoinLinkDialog communityId={communityId} communityName={communityName} address={address} />
  );

  return (
    <div className="space-y-6">
      {!current ? (
        <div className="space-y-4 rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Este consorcio no tiene un link de acceso activo. Los vecinos se dan de alta con el link o el QR, y su
            pedido llega a Solicitudes.
          </p>
          {createButton}
        </div>
      ) : current.url ? (
        <section className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Con este link o QR los vecinos de {communityName} se dan de alta en ELI. Activo desde el{" "}
            {dateFormat.format(new Date(current.createdAt))}
          </p>
          <JoinLinkQr
            url={current.url}
            communityName={communityName}
            revokeLabel="Revocar"
            busy={busy}
            error={null}
            onRevoke={data.canManage ? () => setRevoking(current) : undefined}
          />
        </section>
      ) : (
        <div className="space-y-4 rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Este link funciona, pero se creó antes de que ELI guardara los QR, así que no se puede mostrar. Si necesitás
            el QR, creá un link nuevo. Cuando reemplaces el QR pegado en el edificio, revocá este.
          </p>
          {createButton}
        </div>
      )}

      {data.links.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-sm">Todos los links</h3>
            {current?.url && createButton}
          </div>
          <ListTable>
            <TableHeader>
              <TableRow>
                <ListHead>Creado</ListHead>
                <ListHead>Estado</ListHead>
                <ListHead>Acciones</ListHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.links.map((link) => (
                <TableRow key={link.id}>
                  <ListCell muted>{dateFormat.format(new Date(link.createdAt))}</ListCell>
                  <ListCell>
                    <Pill tone={link.status === "active" ? "green" : "neutral"}>
                      {link.status === "active" ? "Activo" : "Revocado"}
                    </Pill>
                    {link.revokedAt && (
                      <p className="mt-1 text-muted-foreground text-xs">
                        {dateFormat.format(new Date(link.revokedAt))}
                      </p>
                    )}
                  </ListCell>
                  <ListCell>
                    {link.status === "active" && (
                      <div className="flex items-center gap-2">
                        <ListActionButton onClick={() => setViewing(link)}>
                          <Eye className="size-4" />
                          Ver
                        </ListActionButton>
                        {data.canManage && (
                          <ListActionButton onClick={() => setRevoking(link)}>Revocar</ListActionButton>
                        )}
                      </div>
                    )}
                  </ListCell>
                </TableRow>
              ))}
            </TableBody>
          </ListTable>
        </section>
      )}

      <Dialog open={viewing !== null} onOpenChange={(next) => !next && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de acceso</DialogTitle>
            <DialogDescription>
              {viewing &&
                `Con este link o QR los vecinos de ${communityName} se dan de alta en ELI. Activo desde el ${dateFormat.format(new Date(viewing.createdAt))}`}
            </DialogDescription>
          </DialogHeader>
          {viewing && !viewing.url && (
            <div className="space-y-4">
              <p className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
                Este link funciona, pero se creó antes de que ELI guardara los QR, así que no se puede mostrar. Si
                necesitás el QR, creá un link nuevo. Cuando reemplaces el QR pegado en el edificio, revocá este.
              </p>
              {data.canManage && (
                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setRevoking(viewing);
                      setViewing(null);
                    }}
                  >
                    Revocar
                  </Button>
                  {createButton}
                </div>
              )}
            </div>
          )}
          {viewing?.url && (
            <JoinLinkQr
              url={viewing.url}
              communityName={communityName}
              revokeLabel="Revocar"
              busy={busy}
              error={null}
              onRevoke={
                data.canManage
                  ? () => {
                      setRevoking(viewing);
                      setViewing(null);
                    }
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(next) => {
          if (!next && !busy) {
            setRevoking(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar este link?</AlertDialogTitle>
            <AlertDialogDescription>
              El link y su QR dejan de funcionar para {communityName}. No se puede deshacer: si hace falta, creá uno
              nuevo. Los otros links del consorcio siguen activos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => revoking && confirmRevoke(revoking)}>
              Revocar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
