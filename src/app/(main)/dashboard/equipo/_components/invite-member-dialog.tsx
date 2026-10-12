"use client";

import * as React from "react";

import { Loader2, UserPlus } from "lucide-react";

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
import { inviteTeamMemberAction } from "@/server/team/team-actions";

import { InvitationLink } from "./invitation-link";
import { type CommunityOption, TeamAccessFields } from "./team-access-fields";

export function InviteMemberDialog({ communities }: { communities: CommunityOption[] }) {
  const { refreshing, runAction } = useRefresh();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("OPERATOR");
  const [communityIds, setCommunityIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  // Busy until the updated team is on screen.
  const saving = refreshing;

  function changeOpen(next: boolean) {
    if (!next && saving) return;
    setOpen(next);
    if (next) {
      setEmail("");
      setRole("OPERATOR");
      // With a single consorcio there's nothing to choose.
      setCommunityIds(communities.length === 1 ? [communities[0].id] : []);
      setError(null);
      setSent(null);
    }
  }

  function invite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const invited = email.trim().toLowerCase();
    runAction(
      () => inviteTeamMemberAction({ email, role, communityIds }),
      (result) => {
        if (!result) {
          setError("No se pudo completar. Recargá la página y probá de nuevo.");
          return;
        }
        if (!result.success) {
          setError(result.error);
          return;
        }
        setSent({ email: invited, link: result.link, emailSent: result.emailSent });
      },
    );
  }

  return (
    <>
      <Button onClick={() => changeOpen(true)}>
        <UserPlus className="size-4" />
        Invitar
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sent ? "Invitación lista" : "Invitar al equipo"}</DialogTitle>
            {!sent && (
              <DialogDescription>Le llega un mail para crear su cuenta o entrar con la que ya tiene.</DialogDescription>
            )}
          </DialogHeader>

          {sent ? (
            <>
              <InvitationLink {...sent} />
              <DialogFooter>
                <Button type="button" onClick={() => changeOpen(false)}>
                  Listo
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form className="grid gap-5" onSubmit={invite}>
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                />
              </div>
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
                  Invitar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
