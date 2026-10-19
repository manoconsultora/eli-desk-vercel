"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/server/auth/password-recovery-actions";

const initialState: { error?: string; sent?: boolean } = {};

export function RequestResetForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  if (state.sent) {
    return (
      <p className="rounded-md border px-3 py-2 text-center text-sm">
        Si el correo tiene una cuenta en ELI Desk, te llega un link para elegir una contraseña nueva. Revisá también el
        correo no deseado.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {state.error}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@ejemplo.com"
          autoComplete="email"
          required
          disabled={isPending}
        />
      </div>
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar link"}
      </Button>
    </form>
  );
}
