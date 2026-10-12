"use server";

import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getAuthDestination } from "@/lib/auth/get-auth-destination";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

import { acceptTeamInvitation, getTeamInvitation, TeamError } from "./team-repository";

type FormState = { error?: string };

const MIN_PASSWORD = 8;

async function pendingEmail(token: string): Promise<string | null> {
  const invitation = await getTeamInvitation(supabaseAdmin, token);
  return invitation?.status === "pending" ? invitation.email : null;
}

// Accepts as the signed-in user and goes to wherever that user lands (dashboard, or picking an
// organization if they belong to more than one).
async function acceptAndEnter(token: string): Promise<FormState> {
  const supabase = await createClient();
  try {
    await acceptTeamInvitation(supabase, token);
  } catch (error) {
    return { error: error instanceof TeamError ? error.message : "No se pudo aceptar la invitación." };
  }
  redirect(getAuthDestination(await getAuthContext(supabase)));
}

// New account: the link proves access to the invited email, so it's created already confirmed.
export async function createAccountAndAcceptAction(
  token: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name) return { error: "Ingresá tu nombre y apellido." };
  if (password.length < MIN_PASSWORD) return { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` };

  const email = await pendingEmail(token);
  if (!email) return { error: "La invitación ya no está vigente." };

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createError) {
    if (createError.code === "email_exists" || /already/i.test(createError.message)) {
      return { error: "Ya tenés una cuenta con este email: entrá con tu contraseña." };
    }
    return { error: "No se pudo crear la cuenta." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "La cuenta se creó, pero no se pudo iniciar sesión. Entrá desde el login." };
  return acceptAndEnter(token);
}

export async function signInAndAcceptAction(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const email = await pendingEmail(token);
  if (!email) return { error: "La invitación ya no está vigente." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Contraseña incorrecta." };
  return acceptAndEnter(token);
}

export async function acceptAsCurrentUserAction(token: string, _prev: FormState): Promise<FormState> {
  return acceptAndEnter(token);
}

// Signed in with another account: sign out and come back to the invitation.
export async function signOutForInvitationAction(token: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/invitacion/${token}`);
}
