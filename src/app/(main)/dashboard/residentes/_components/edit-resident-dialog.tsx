"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { useRefresh } from "@/hooks/use-refresh";
import { updateResidentAction } from "@/server/residents/resident-actions";
import type { ResidentSummary } from "@/server/residents/resident-repository";

// Opened from the row menu: open while `resident` is set. It keeps the last one so the
// closing animation doesn't go blank.
export function EditResidentDialog({ resident, onClose }: { resident: ResidentSummary | null; onClose: () => void }) {
  const { refreshing, runAction } = useRefresh();
  const [shown, setShown] = React.useState<ResidentSummary | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  // Busy until the updated list is on screen, so it never shows the old data.
  const saving = refreshing;

  // Fills the form each time it opens (React's "adjust state when a prop changes").
  if (resident && resident !== shown) {
    setShown(resident);
    setName(resident.name);
    setEmail(resident.email ?? "");
    setPhone(resident.phone ?? "");
    setError(null);
  }

  function changeOpen(next: boolean) {
    if (!next && !saving) onClose();
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    runAction(
      () => updateResidentAction(shown?.id ?? "", { name, email, phone }),
      (result) => {
        if (!result) {
          setError("No se pudo completar. Recargá la página y probá de nuevo.");
          return;
        }
        if (!result.success) {
          setError(result.error);
          return;
        }
        onClose();
        toast.success("Datos del residente guardados.");
      },
    );
  }

  return (
    <Dialog open={resident !== null} onOpenChange={changeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar residente</DialogTitle>
          <DialogDescription>No le avisamos al residente de estos cambios.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={save}>
          <div className="grid gap-2">
            <Label htmlFor="edit-resident-name">Nombre y apellido</Label>
            <Input id="edit-resident-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-resident-email">Email</Label>
            <Input
              id="edit-resident-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-resident-phone">Celular</Label>
            <Input
              id="edit-resident-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <div aria-live="polite">{error && <p className="text-destructive text-sm">{error}</p>}</div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => changeOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
