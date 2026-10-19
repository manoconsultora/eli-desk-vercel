"use client";

import { Suspense, useActionState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/server/server-actions";

import { GoogleLoginButton } from "./google-login-button";

const initialState = { error: undefined as string | undefined };
const OAUTH_CALLBACK_ERROR = "oauth_callback_failed";
// The callback also receives expired or used password reset links, so the message covers both.
const OAUTH_CALLBACK_ERROR_MESSAGE =
  "No pudimos iniciar sesión. Si usaste un link del correo, venció o ya se usó: pedí uno nuevo.";

function OAuthErrorMessage() {
  const searchParams = useSearchParams();

  if (searchParams.get("error") !== OAUTH_CALLBACK_ERROR) {
    return null;
  }

  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm">
      {OAUTH_CALLBACK_ERROR_MESSAGE}
    </div>
  );
}

export function LoginFormDashboard() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {state.error}
        </div>
      ) : (
        <Suspense fallback={null}>
          <OAuthErrorMessage />
        </Suspense>
      )}
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Link
            href="/recuperar-contrasena"
            className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          minLength={6}
          disabled={isPending}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="remember" name="remember" value="on" disabled={isPending} />
        <Label htmlFor="remember" className="font-normal text-muted-foreground text-sm">
          Recordarme 30 días
        </Label>
      </div>
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? "Entrando…" : "Entrar"}
      </Button>
      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t">
        <span className="relative z-10 bg-background px-2 text-muted-foreground">O continuar con</span>
      </div>
      <GoogleLoginButton />
    </form>
  );
}
