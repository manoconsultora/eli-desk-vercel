"use client";

import * as React from "react";

import { Loader2, Pencil } from "lucide-react";
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
import { useRefresh } from "@/hooks/use-refresh";
import { updateTeamMemberAction } from "@/server/team/team-actions";
import type { TeamEntry } from "@/server/team/team-repository";

import { type CommunityOption, TeamAccessFields } from "./team-access-fields";

export function EditMemberDialog({ member, communities }: { member: TeamEntry; communities: CommunityOption[] }) {
  const { refreshing, runAction } = useRefresh();
  const [open, setOpen] = React.useState(false);
  const [role, setRole] = React.useState(member.role);
  const [communityIds, setCommunityIds] = React.useState<string[]>(member.communityIds);
  const [error, setError] = React.useState<string | null>(null);
  // Busy until the updated team is on screen.
  const saving = refreshing;
  const label = member.name ?? member.email;

  function changeOpen(next: boolean) {
    if (!next && saving) return;
    setOpen(next);
    if (next) {
      setRole(member.role);
      setCommunityIds(member.communityIds);
      setError(null);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    runAction(
      () => updateTeamMemberAction(member.id, { role, communityIds }),
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
        toast.success(`Cambios de ${label} guardados.`);
      },
    );
  }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label={`Editar a ${label}`} onClick={() => changeOpen(true)}>
        <Pencil className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar a {label}</DialogTitle>
            <DialogDescription>Los cambios valen desde su próxima acción en Desk.</DialogDescription>
          </DialogHeader>

          <form className="grid gap-5" onSubmit={save}>
            <TeamAccessFields
              communities={communities}
              role={role}
              onRoleChange={setRole}
              communityIds={communityIds}
              onCommunityIdsChange={setCommunityIds}
            />

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
    </>
  );
}
