"use client";

import * as React from "react";

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
import type { ResidentRequest } from "@/server/resident-requests/resident-request-repository";

export function BlacklistDialog({
  request,
  busy,
  onConfirm,
  onClose,
}: {
  request: ResidentRequest | null;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");

  return (
    <Dialog
      open={request !== null}
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
            {request?.email}
            {request?.phone ? ` y ${request.phone}` : ""} no van a poder enviar solicitudes de alta en ningún consorcio.
            La solicitud actual queda como está.
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
