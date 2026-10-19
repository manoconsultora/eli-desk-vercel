import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { NewPasswordForm } from "./_components/new-password-form";

export default async function NewPasswordPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto flex w-full flex-col justify-center gap-6 px-4 sm:w-[380px]">
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">El link venció o ya se usó</h1>
          <p className="text-muted-foreground text-sm">Pedí uno nuevo para elegir tu contraseña.</p>
        </div>
        <Button asChild>
          <Link href="/recuperar-contrasena">Pedir un link nuevo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center gap-6 px-4 sm:w-[380px]">
      <div className="space-y-1 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">Elegí una contraseña nueva</h1>
        <p className="text-muted-foreground text-sm">Para {user.email}.</p>
      </div>
      <NewPasswordForm />
    </div>
  );
}
