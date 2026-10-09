"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteUnitAction, updateUnitAction } from "@/server/communities/community-actions";
import type { CommunityUnit } from "@/server/communities/community-repository";

export function EditUnitDialog({ unit, canDelete }: { unit: CommunityUnit; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [number, setNumber] = React.useState("");
  const [floor, setFloor] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  function changeOpen(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
    if (next) {
      setNumber(unit.number ?? "");
      setFloor(unit.floor ?? "");
      setError(null);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await updateUnitAction(unit.id, { number, floor });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await deleteUnitAction(unit.id, unit.number ?? "");
    setBusy(false);
    setConfirmingDelete(false);
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
        aria-label={`Editar unidad ${unit.number ?? ""}`.trim()}
        onClick={() => changeOpen(true)}
      >
        <Pencil className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar unidad {unit.number}</DialogTitle>
            <DialogDescription>Los residentes y tickets de la unidad no cambian.</DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-2">
              <Label htmlFor="edit-unit-number">Número</Label>
              <Input
                id="edit-unit-number"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-unit-floor">Piso (opcional)</Label>
              <Input id="edit-unit-floor" value={floor} onChange={(event) => setFloor(event.target.value)} />
            </div>

            <div aria-live="polite">{error && <p className="text-destructive text-sm">{error}</p>}</div>

            <DialogFooter>
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive sm:mr-auto"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Borrar unidad
                </Button>
              )}
              <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || !number.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDelete} onOpenChange={(next) => !busy && setConfirmingDelete(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar la unidad {unit.number}</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede borrar una unidad cargada por error, sin residentes, tickets ni solicitudes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
