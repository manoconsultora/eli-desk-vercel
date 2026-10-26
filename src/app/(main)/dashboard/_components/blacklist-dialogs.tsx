"use client";

import * as React from "react";

import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRefresh } from "@/hooks/use-refresh";
import { removeFromBlacklistAction } from "@/server/resident-blacklist/resident-blacklist-actions";
import type { BlacklistEntry } from "@/server/resident-blacklist/resident-blacklist-repository";

// Used from Solicitudes (a request) and Residentes (a resident). `note` says what happens to them.
export function BlacklistDialog({
  contact,
  note,
  busy,
  onConfirm,
  onClose,
}: {
  contact: { email: string | null; phone: string | null } | null;
  note: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const blocked = [contact?.email, contact?.phone].filter(Boolean).join(" y ");

  return (
    <Dialog
      open={contact !== null}
      onOpenChange={(open) => {
        if (open) return;
        setReason("");
        onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar a blacklist</DialogTitle>
          <DialogDescription>
            {blocked} no van a poder enviar solicitudes de alta en ningún consorcio. {note}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="blacklist-reason">Motivo (opcional)</Label>
          <Textarea
            id="blacklist-reason"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => onConfirm(reason)}>
            Agregar a blacklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Confirms and removes the entry: the same from the Blacklist tab and from Residentes.
export function RemoveFromBlacklistDialog({ entry, onClose }: { entry: BlacklistEntry | null; onClose: () => void }) {
  const { refreshing, runAction } = useRefresh();
  // Busy until the updated page is on screen.
  const busy = refreshing;

  function remove(removing: BlacklistEntry) {
    runAction(
      () => removeFromBlacklistAction(removing.id),
      (result) => {
        if (!result) {
          toast.error("No se pudo completar. Recargá la página y probá de nuevo.");
          return;
        }
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(`${removing.name} ya no está en la blacklist.`);
        onClose();
      },
    );
  }

  return (
    <AlertDialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Quitar de la blacklist</AlertDialogTitle>
          <AlertDialogDescription>{entry?.name} va a poder volver a enviar solicitudes de alta.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              if (entry) remove(entry);
            }}
          >
            Quitar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
