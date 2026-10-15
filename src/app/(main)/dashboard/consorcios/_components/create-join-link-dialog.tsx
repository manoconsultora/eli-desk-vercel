"use client";

import * as React from "react";

import { Link2, Loader2 } from "lucide-react";

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
import { createJoinLinkAction, revokeJoinLinkAction } from "@/server/join-links/join-link-actions";
import type { CreatedJoinLink } from "@/server/join-links/join-link-repository";

import { JoinLinkQr } from "./join-link-qr";

// confirm (nothing created yet) → created → revoked (undone by the user).
type Step = "confirm" | "created" | "revoked";

export function CreateJoinLinkDialog({
  communityId,
  communityName,
  address,
}: {
  communityId: string;
  communityName: string;
  address: string;
}) {
  const { refresh, refreshing } = useRefresh();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("confirm");
  const [created, setCreated] = React.useState<CreatedJoinLink | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Also busy until the refreshed data is on screen.
  const busy = saving || refreshing;

  // While a request runs the dialog stays open, because the request can't be cancelled
  // and its result has to be seen.
  function changeOpen(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
    if (!next) {
      setStep("confirm");
      setCreated(null);
      setError(null);
    }
  }

  async function create() {
    setSaving(true);
    setError(null);
    const result = await createJoinLinkAction(communityId);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    refresh(() => {
      setCreated(result.data);
      setStep("created");
    });
  }

  async function revoke(linkId: string) {
    setSaving(true);
    setError(null);
    const result = await revokeJoinLinkAction(linkId);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    refresh(() => {
      setCreated(null);
      setStep("revoked");
    });
  }

  const descriptions: Record<Step, string> = {
    confirm: `Vas a crear un link de acceso para ${communityName} (${address}). Cualquiera que tenga el link o el QR puede pedir el alta en este consorcio.`,
    created: `Con este link o QR los vecinos de ${communityName} se dan de alta en ELI. También lo vas a ver en la pestaña Accesos.`,
    revoked: `El link de ${communityName} quedó anulado: el link y el QR ya no funcionan.`,
  };

  return (
    <>
      <Button className="h-11 rounded-lg px-4" onClick={() => setOpen(true)}>
        <Link2 className="size-4" />
        Crear link de acceso
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{step === "revoked" ? "Link anulado" : "Link de acceso"}</DialogTitle>
            <DialogDescription>{descriptions[step]}</DialogDescription>
          </DialogHeader>

          {step === "confirm" && (
            <div className="grid gap-4">
              {error && <p className="text-destructive text-sm">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={busy} onClick={create}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Crear link
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === "created" && created && (
            <JoinLinkQr
              url={created.url}
              communityName={communityName}
              revokeLabel="Anular este link"
              busy={busy}
              error={error}
              onRevoke={() => revoke(created.id)}
            />
          )}

          {step === "revoked" && (
            <DialogFooter>
              <Button type="button" onClick={() => changeOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
