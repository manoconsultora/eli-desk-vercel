"use client";

import * as React from "react";

import { CalendarDays, Mail, MessageSquareText, Phone } from "lucide-react";
import { toast } from "sonner";

import { Initials, ListEmpty } from "@/app/(main)/dashboard/_components/list-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRefresh } from "@/hooks/use-refresh";
import { removeFromBlacklistAction } from "@/server/resident-blacklist/resident-blacklist-actions";
import type { BlacklistEntry } from "@/server/resident-blacklist/resident-blacklist-repository";

import { formatRequestDate } from "./request-time";

export function BlacklistList({
  entries,
  canRemove,
  isFiltered,
}: {
  entries: BlacklistEntry[] | null;
  canRemove: boolean;
  isFiltered: boolean;
}) {
  const { refreshing, runAction } = useRefresh();
  const [removing, setRemoving] = React.useState<BlacklistEntry | null>(null);
  // Busy until the updated blacklist is on screen.
  const busy = refreshing;

  if (entries === null) return <ListEmpty>No se pudo cargar la blacklist. Probá de nuevo en unos minutos.</ListEmpty>;
  if (entries.length === 0) {
    return (
      <ListEmpty>
        {isFiltered ? "No hay contactos que coincidan con la búsqueda." : "No hay contactos en la blacklist."}
      </ListEmpty>
    );
  }

  function remove(entry: BlacklistEntry) {
    runAction(
      () => removeFromBlacklistAction(entry.id),
      (result) => {
        if (!result) {
          toast.error("No se pudo completar. Recargá la página y probá de nuevo.");
          return;
        }
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(`${entry.name} ya no está en la blacklist.`);
        setRemoving(null);
      },
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry, index) => (
          <Card key={entry.id} className="gap-4 p-5">
            <div className="flex items-center gap-3">
              <Initials name={entry.name} index={index} />
              <p className="truncate font-semibold">{entry.name}</p>
            </div>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0" />
                <span className="truncate">{entry.email ?? "Sin email"}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0" />
                <span>{entry.phone ?? "Sin teléfono"}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CalendarDays className="size-4 shrink-0" />
                <span>Agregado el {formatRequestDate(entry.createdAt)}</span>
              </li>
              {entry.reason && (
                <li className="flex items-start gap-2.5">
                  <MessageSquareText className="mt-0.5 size-4 shrink-0" />
                  <span>{entry.reason}</span>
                </li>
              )}
            </ul>
            {canRemove && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => setRemoving(entry)}>
                Quitar de la blacklist
              </Button>
            )}
          </Card>
        ))}
      </div>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar de la blacklist</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} va a poder volver a enviar solicitudes de alta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (removing) remove(removing);
              }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
