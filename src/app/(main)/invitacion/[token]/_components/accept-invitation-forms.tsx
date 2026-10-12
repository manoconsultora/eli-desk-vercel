"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  acceptAsCurrentUserAction,
  createAccountAndAcceptAction,
  signInAndAcceptAction,
} from "@/server/team/team-acceptance-actions";

const initialState: { error?: string } = {};

function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm">
      {error}
    </div>
  );
}

export function AcceptAsCurrentUser({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(acceptAsCurrentUserAction.bind(null, token), initialState);
  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state.error} />
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "Aceptando…" : "Aceptar invitación"}
      </Button>
    </form>
  );
}

// Without a session: create the account for the invited email, or sign in with the one they have.
export function AcceptInvitationForms({ token, email }: { token: string; email: string }) {
  const [createState, createAction, creating] = useActionState(
    createAccountAndAcceptAction.bind(null, token),
    initialState,
  );
  const [signInState, signInAction, signingIn] = useActionState(signInAndAcceptAction.bind(null, token), initialState);

  return (
    <Tabs defaultValue="new">
      <TabsList className="w-full">
        <TabsTrigger value="new">Crear mi cuenta</TabsTrigger>
        <TabsTrigger value="existing">Ya tengo cuenta</TabsTrigger>
      </TabsList>

      <TabsContent value="new">
        <form action={createAction} className="space-y-4 pt-4">
          <FormError error={createState.error} />
          <div className="space-y-2">
            <Label htmlFor="invite-account-email">Correo electrónico</Label>
            <Input id="invite-account-email" value={email} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-account-name">Nombre y apellido</Label>
            <Input id="invite-account-name" name="name" autoComplete="name" required disabled={creating} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-account-password">Contraseña</Label>
            <Input
              id="invite-account-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              disabled={creating}
            />
            <p className="text-muted-foreground text-xs">Al menos 8 caracteres.</p>
          </div>
          <Button className="w-full" type="submit" disabled={creating}>
            {creating ? "Creando cuenta…" : "Crear cuenta y aceptar"}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="existing">
        <form action={signInAction} className="space-y-4 pt-4">
          <FormError error={signInState.error} />
          <div className="space-y-2">
            <Label htmlFor="invite-signin-email">Correo electrónico</Label>
            <Input id="invite-signin-email" value={email} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-signin-password">Contraseña</Label>
            <Input
              id="invite-signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={signingIn}
            />
          </div>
          <Button className="w-full" type="submit" disabled={signingIn}>
            {signingIn ? "Entrando…" : "Entrar y aceptar"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Si entrás con Google, iniciá sesión desde el login y volvé a abrir este link.
          </p>
        </form>
      </TabsContent>
    </Tabs>
  );
}
