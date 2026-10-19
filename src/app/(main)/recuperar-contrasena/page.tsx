import Link from "next/link";

import { RequestResetForm } from "./_components/request-reset-form";

export default function RecoverPasswordPage() {
  return (
    <div className="mx-auto flex w-full flex-col justify-center gap-6 px-4 sm:w-[380px]">
      <div className="space-y-1 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">Recuperar contraseña</h1>
        <p className="text-muted-foreground text-sm">Te mandamos un link para que elijas una contraseña nueva.</p>
      </div>
      <RequestResetForm />
      <Link
        href="/login"
        className="text-center text-muted-foreground text-sm underline underline-offset-4 hover:no-underline"
      >
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
