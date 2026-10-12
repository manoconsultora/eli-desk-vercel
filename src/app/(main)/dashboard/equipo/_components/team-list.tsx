"use client";

import * as React from "react";

import { toast } from "sonner";

import {
  InitialsAvatar,
  ListCell,
  ListHead,
  ListTable,
  Pill,
  type Tone,
} from "@/app/(main)/dashboard/_components/list-table";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useRefresh } from "@/hooks/use-refresh";
import {
  resendTeamInvitationAction,
  revokeTeamInvitationAction,
  setTeamMemberStatusAction,
} from "@/server/team/team-actions";
import type { TeamEntry } from "@/server/team/team-repository";
import { teamRoleLabel } from "@/server/team/team-roles";

import { EditMemberDialog } from "./edit-member-dialog";
import { InvitationLink } from "./invitation-link";
import { InviteMemberDialog } from "./invite-member-dialog";
import type { CommunityOption } from "./team-access-fields";

const STATUS: Record<TeamEntry["status"], { label: string; tone: Tone }> = {
  active: { label: "Activo", tone: "green" },
  suspended: { label: "Suspendido", tone: "neutral" },
  inactive: { label: "Inactivo", tone: "neutral" },
  invited: { label: "Invitación pendiente", tone: "amber" },
  expired: { label: "Invitación vencida", tone: "red" },
};

type Confirming = { entry: TeamEntry; action: "suspend" | "revoke" };

// Owner first, then members, then pending invitations.
function order(entry: TeamEntry) {
  if (entry.role === "TENANT_OWNER") return 0;
  return entry.kind === "member" ? 1 : 2;
}

export function TeamList({ team, communities }: { team: TeamEntry[]; communities: CommunityOption[] }) {
  const { refreshing, runAction } = useRefresh();
  const [confirming, setConfirming] = React.useState<Confirming | null>(null);
  const [resent, setResent] = React.useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  // Busy until the updated team is on screen.
  const busy = refreshing;
  const communityName = new Map(communities.map((community) => [community.id, community.name]));
  const rows = [...team].sort((a, b) => order(a) - order(b) || a.email.localeCompare(b.email));

  function done(result: { success: boolean; error?: string } | null, message: string) {
    if (!result) {
      toast.error("No se pudo completar. Recargá la página y probá de nuevo.");
      return false;
    }
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(message);
    return true;
  }

  function resend(entry: TeamEntry) {
    runAction(
      () => resendTeamInvitationAction({ id: entry.id, role: entry.role }),
      (result) => {
        if (!result) {
          toast.error("No se pudo completar. Recargá la página y probá de nuevo.");
          return;
        }
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setResent({ email: entry.email, link: result.link, emailSent: result.emailSent });
      },
    );
  }

  function reactivate(entry: TeamEntry) {
    runAction(
      () => setTeamMemberStatusAction(entry.id, "active"),
      (result) => done(result, `${entry.name ?? entry.email} volvió a tener acceso.`),
    );
  }

  function confirm({ entry, action }: Confirming) {
    runAction(
      () =>
        action === "suspend" ? setTeamMemberStatusAction(entry.id, "suspended") : revokeTeamInvitationAction(entry.id),
      (result) => {
        if (
          done(
            result,
            action === "suspend" ? `${entry.name ?? entry.email} quedó suspendido.` : "Invitación cancelada.",
          )
        ) {
          setConfirming(null);
        }
      },
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-muted-foreground text-sm">Administración</p>
          <h1 className="font-semibold text-3xl tracking-tight">Equipo</h1>
          <p className="mt-1 text-muted-foreground">
            Las personas de tu administración que usan Desk, con su rol y sus consorcios.
          </p>
        </div>
        <InviteMemberDialog communities={communities} />
      </header>

      <ListTable>
        <TableHeader>
          <TableRow>
            <ListHead>Persona</ListHead>
            <ListHead>Rol</ListHead>
            <ListHead>Consorcios</ListHead>
            <ListHead>Estado</ListHead>
            <ListHead>
              <span className="sr-only">Acciones</span>
            </ListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((entry, index) => {
            const isOwner = entry.role === "TENANT_OWNER";
            const status = STATUS[entry.status] ?? { label: entry.status, tone: "neutral" as Tone };
            return (
              <TableRow key={`${entry.kind}-${entry.id}`}>
                <ListCell>
                  <div className="flex flex-col">
                    <InitialsAvatar name={entry.name ?? entry.email} index={index} />
                    {entry.name && <span className="pl-12 text-muted-foreground text-xs">{entry.email}</span>}
                  </div>
                </ListCell>
                <ListCell>{teamRoleLabel(entry.role)}</ListCell>
                <ListCell muted wrap>
                  {isOwner
                    ? "Todos"
                    : entry.communityIds
                        .map((id) => communityName.get(id))
                        .filter(Boolean)
                        .join(", ") || "Ninguno"}
                </ListCell>
                <ListCell>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </ListCell>
                <ListCell>
                  {!isOwner && (
                    <div className="flex items-center justify-end gap-1">
                      {entry.kind === "member" ? (
                        <>
                          <EditMemberDialog member={entry} communities={communities} />
                          {entry.status === "suspended" ? (
                            <Button variant="ghost" size="sm" disabled={busy} onClick={() => reactivate(entry)}>
                              Reactivar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => setConfirming({ entry, action: "suspend" })}
                            >
                              Suspender
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => resend(entry)}>
                            Reenviar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirming({ entry, action: "revoke" })}
                          >
                            Cancelar
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </ListCell>
              </TableRow>
            );
          })}
        </TableBody>
      </ListTable>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && !busy && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.action === "suspend" ? "Suspender acceso" : "Cancelar invitación"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.action === "suspend"
                ? `${confirming.entry.name ?? confirming.entry.email} no va a poder entrar a Desk. Su historial queda y lo podés reactivar cuando quieras.`
                : `El link que le llegó a ${confirming?.entry.email} deja de servir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (confirming) confirm(confirming);
              }}
            >
              {confirming?.action === "suspend" ? "Suspender" : "Cancelar invitación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resent !== null} onOpenChange={(open) => !open && setResent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitación reenviada</DialogTitle>
          </DialogHeader>
          {resent && <InvitationLink {...resent} />}
          <DialogFooter>
            <Button type="button" onClick={() => setResent(null)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
