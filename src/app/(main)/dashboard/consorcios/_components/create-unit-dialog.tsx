"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Loader2, Plus } from "lucide-react";

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
import { createUnitAction } from "@/server/communities/community-actions";

// Stays open after each unit so several can be loaded in a row; the floor is kept for the next one.
export function CreateUnitDialog({ communityId, communityName }: { communityId: string; communityName: string }) {
  const router = useRouter();
  const numberRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [number, setNumber] = React.useState("");
  const [floor, setFloor] = React.useState("");
  const [created, setCreated] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function changeOpen(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
    if (!next) {
      setNumber("");
      setFloor("");
      setCreated(null);
      setError(null);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCreated(null);
    const result = await createUnitAction(communityId, { number, floor });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setCreated(number.trim());
    setNumber("");
    numberRef.current?.focus();
    router.refresh();
  }

  return (
    <>
      <Button className="h-11 rounded-lg px-4" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Agregar unidad
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar unidad</DialogTitle>
            <DialogDescription>
              La unidad queda disponible en {communityName} y los vecinos la pueden elegir al darse de alta.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={create}>
            <div className="grid gap-2">
              <Label htmlFor="unit-number">Número</Label>
              <Input
                id="unit-number"
                ref={numberRef}
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                placeholder="1A"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit-floor">Piso (opcional)</Label>
              <Input id="unit-floor" value={floor} onChange={(event) => setFloor(event.target.value)} placeholder="1" />
            </div>

            <div aria-live="polite">
              {error && <p className="text-destructive text-sm">{error}</p>}
              {created && <p className="text-muted-foreground text-sm">Unidad {created} agregada.</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>
                {created ? "Listo" : "Cancelar"}
              </Button>
              <Button type="submit" disabled={busy || !number.trim()}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Agregar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
