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

export function RejectRequestDialog({
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
          <DialogTitle>Rechazar solicitud</DialogTitle>
          <DialogDescription>
            {request?.name} no se va a sumar a {request?.communityName}. Se le enviará un email avisando el rechazo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rejection-reason">Motivo (opcional)</Label>
          <Textarea
            id="rejection-reason"
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
            Rechazar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
