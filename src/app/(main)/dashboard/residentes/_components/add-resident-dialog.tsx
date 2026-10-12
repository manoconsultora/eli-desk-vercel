"use client";

import * as React from "react";

import { Loader2, Plus } from "lucide-react";
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
import type { RelationshipOption, UnitOption } from "@/server/residents/add-resident-to-unit";
import { addResidentToUnitAction } from "@/server/residents/resident-actions";
import type { ResidentSummary } from "@/server/residents/resident-repository";

const SELECT = "h-10 rounded-md border bg-background px-3 text-sm";

// Without `resident`, adds a new person (or reuses the one with that email). With it, adds a unit to them.
export function AddResidentDialog({
  units,
  relationships,
  resident,
}: {
  units: UnitOption[];
  relationships: RelationshipOption[];
  resident?: ResidentSummary;
}) {
  const { refreshing, runAction } = useRefresh();
  const [open, setOpen] = React.useState(false);
  const [communityId, setCommunityId] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [relationship, setRelationship] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  // Busy until the updated list is on screen.
  const saving = refreshing;

  // An existing resident's current units aren't offered again.
  const takenUnitIds = new Set(resident?.units.map((unit) => unit.unitId));
  const availableUnits = units.filter((unit) => !takenUnitIds.has(unit.id));
  const communities = [...new Map(availableUnits.map((unit) => [unit.communityId, unit.communityName]))];
  const communityUnits = availableUnits.filter((unit) => unit.communityId === communityId);

  function changeOpen(next: boolean) {
    if (!next && saving) return;
    setOpen(next);
    if (next) {
      // With a single consorcio there's nothing to choose.
      setCommunityId(communities.length === 1 ? communities[0][0] : "");
      setUnitId("");
      setRelationship("");
      setName(resident?.name ?? "");
      setEmail(resident?.email ?? "");
      setPhone(resident?.phone ?? "");
      setError(null);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const unit = units.find((option) => option.id === unitId);
    runAction(
      () => addResidentToUnitAction(unitId, relationship, { name, email, phone }),
      (result) => {
        if (!result) {
          setError("No se pudo completar. Recargá la página y probá de nuevo.");
          return;
        }
        if (!result.success) {
          setError(result.error);
          return;
        }
        setOpen(false);
        const where = `la unidad ${unit?.number ?? ""} de ${unit?.communityName ?? ""}`;
        toast.success(
          resident
            ? `${resident.name} ahora también es residente de ${where}.`
            : result.created
              ? `${name.trim()} quedó como residente de ${where}.`
              : `${email.trim()} ya era residente: le sumamos ${where}.`,
        );
      },
    );
  }

  return (
    <>
      {resident ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-muted-foreground text-xs"
          onClick={() => changeOpen(true)}
        >
          Sumar unidad
        </Button>
      ) : (
        <Button type="button" onClick={() => changeOpen(true)}>
          <Plus className="size-4" />
          Agregar residente
        </Button>
      )}

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{resident ? `Sumar una unidad a ${resident.name}` : "Agregar residente"}</DialogTitle>
            <DialogDescription>
              {resident
                ? "Queda como residente también de esta unidad."
                : "Para quien no usa el QR. Si el email ya es de un residente, le sumamos la unidad. No le mandamos mail."}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="add-resident-community">Consorcio</Label>
                <select
                  id="add-resident-community"
                  required
                  className={SELECT}
                  value={communityId}
                  onChange={(event) => {
                    setCommunityId(event.target.value);
                    setUnitId("");
                  }}
                >
                  <option value="">Elegir consorcio</option>
                  {communities.map(([id, communityName]) => (
                    <option key={id} value={id}>
                      {communityName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-resident-unit">Unidad</Label>
                <select
                  id="add-resident-unit"
                  required
                  className={SELECT}
                  value={unitId}
                  disabled={!communityId}
                  onChange={(event) => setUnitId(event.target.value)}
                >
                  <option value="">Elegir unidad</option>
                  {communityUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.number}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-resident-relationship">Relación con la unidad</Label>
              <select
                id="add-resident-relationship"
                required
                className={SELECT}
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
              >
                <option value="">Elegir relación</option>
                {relationships.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-resident-name">Nombre y apellido</Label>
              <Input
                id="add-resident-name"
                value={name}
                readOnly={Boolean(resident)}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="add-resident-email">Email</Label>
                <Input
                  id="add-resident-email"
                  type="email"
                  value={email}
                  readOnly={Boolean(resident)}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-resident-phone">Teléfono</Label>
                <Input
                  id="add-resident-phone"
                  type="tel"
                  value={phone}
                  readOnly={Boolean(resident)}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </div>

            <div aria-live="polite">{error && <p className="text-destructive text-sm">{error}</p>}</div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => changeOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {resident ? "Sumar unidad" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
