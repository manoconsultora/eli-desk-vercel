"use client";

import { useState } from "react";

import { siGoogle } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleLoginButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);

    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin).toString();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        console.error("Supabase Google OAuth start error:", error.message);
        setIsPending(false);
        window.location.assign("/login?error=oauth_callback_failed");
      }
    } catch {
      setIsPending(false);
      window.location.assign("/login?error=oauth_callback_failed");
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" disabled={isPending} onClick={handleClick}>
      <SimpleIcon icon={siGoogle} className="size-4" />
      {isPending ? "Redirigiendo…" : "Continuar con Google"}
    </Button>
  );
}
