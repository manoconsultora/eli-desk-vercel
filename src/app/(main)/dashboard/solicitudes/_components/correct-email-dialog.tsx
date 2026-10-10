"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { correctResidentRequestEmailAction } from "@/server/resident-requests/resident-request-actions";
import type { ResidentRequest } from "@/server/resident-requests/resident-request-repository";

const WHAT_HAPPENS: Record<string, string> = {
  PENDING_VERIFICATION: "Si aceptás o rechazás la solicitud, el email se va a enviar a la dirección nueva.",
  APPROVED: "Se va a reenviar el email de aceptación a la dirección nueva.",
  REJECTED: "Se va a reenviar el email de rechazo a la dirección nueva.",
};

export function CorrectEmailDialog({ request }: { request: ResidentRequest }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function changeOpen(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
    if (next) {
      setEmail(request.email);
      setError(null);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await correctResidentRequestEmailAction(request.id, email);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`Corregir email de ${request.name}`}
        onClick={() => changeOpen(true)}
      >
        <Pencil className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corregir email</DialogTitle>
            <DialogDescription>{WHAT_HAPPENS[request.status]}</DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-2">
              <Label htmlFor="correct-email">Email</Label>
              <Input
                id="correct-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
              />
            </div>

            <div aria-live="polite">{error && <p className="text-destructive text-sm">{error}</p>}</div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || !email.trim()}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
