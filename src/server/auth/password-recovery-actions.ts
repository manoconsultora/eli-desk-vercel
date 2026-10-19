"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getAuthDestination } from "@/lib/auth/get-auth-destination";
import { createClient } from "@/lib/supabase/server";

type FormState = { error?: string; sent?: boolean };

const MIN_PASSWORD = 8;

async function requestOrigin() {
  const headerList = await headers();
  return headerList.get("origin") ?? `${headerList.get("x-forwarded-proto") ?? "https"}://${headerList.get("host")}`;
}

// Always answers the same, whether or not the account exists, so the form can't be used to find
// out which emails are registered.
export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Ingresá tu correo electrónico." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // The exact callback URL Google sign-in uses, already in the Supabase redirect allow list. A query
    // string would not match an exact entry and Supabase would fall back to the site URL.
    redirectTo: `${await requestOrigin()}/auth/callback`,
  });
  if (error) console.error("Supabase password reset error:", error.message);

  return { sent: true };
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "El link venció o ya se usó. Pedí uno nuevo." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "La contraseña nueva tiene que ser distinta de la anterior." };
    return { error: "No se pudo cambiar la contraseña." };
  }

  redirect(getAuthDestination(await getAuthContext(supabase)));
}
