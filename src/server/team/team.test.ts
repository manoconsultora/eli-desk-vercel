import type { SupabaseClient } from "@supabase/supabase-js";

import { renderTeamInvitationEmail, sendTeamInvitationEmail } from "./team-invitation-email";
import { acceptTeamInvitation, inviteTeamMember, listTeam, TeamError } from "./team-repository";
import assert from "node:assert/strict";
import { test } from "node:test";

const EMAIL = {
  organizationName: "Kleiner & <Buzzi>",
  role: "OPERATOR" as const,
  url: "https://desk.test/invitacion/abc",
};

test("el mail de invitación lleva la administración escapada, el rol y el botón al link", () => {
  const email = renderTeamInvitationEmail(EMAIL);
  assert.equal(email.subject, "Te invitaron al equipo de Kleiner & <Buzzi> en ELI");
  assert.match(email.html, /Kleiner &#38; &#60;Buzzi&#62; te invitó/);
  assert.doesNotMatch(email.html, /<Buzzi>/);
  assert.match(email.html, /href="https:\/\/desk\.test\/invitacion\/abc"/);
  assert.match(email.html, /rol de operador/);
  assert.match(email.text, /Aceptá la invitación: https:\/\/desk\.test\/invitacion\/abc/);
  assert.doesNotMatch(email.text, /<(p|a|table|h1)\b/);
});

test("sin Resend habilitado no se manda y lo informa", async () => {
  let called = false;
  const send = (async () => {
    called = true;
    return new Response(null);
  }) as typeof fetch;
  assert.equal(await sendTeamInvitationEmail(null, "x@y.com", EMAIL, send), false);
  assert.equal(called, false);
});

test("con Resend manda a quien se invitó y devuelve si salió", async () => {
  const bodies: { to: string; subject: string }[] = [];
  const send = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  assert.equal(await sendTeamInvitationEmail({ apiKey: "k", from: "ELI <a@b.c>" }, "x@y.com", EMAIL, send), true);
  assert.equal(bodies[0].to, "x@y.com");

  const failing = (async () => new Response(null, { status: 422 })) as typeof fetch;
  assert.equal(await sendTeamInvitationEmail({ apiKey: "k", from: "ELI <a@b.c>" }, "x@y.com", EMAIL, failing), false);
});

function fakeRpc(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: { fn: string; args: unknown }[] = [];
  const response = { data: result.data ?? null, error: result.error ?? null };
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return Object.assign(Promise.resolve(response), { single: async () => response });
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("invitar llama a la RPC y devuelve el token con el email normalizado", async () => {
  const { client, calls } = fakeRpc({ data: { token: "t1" } });
  const result = await inviteTeamMember(client, "org", { email: " Ana@X.com ", role: "VIEWER", communityIds: ["e1"] });
  assert.deepEqual(result, { token: "t1", email: "ana@x.com" });
  assert.deepEqual(calls[0], {
    fn: "invite_team_member",
    args: { p_organization_id: "org", p_email: " Ana@X.com ", p_role: "VIEWER", p_edificio_ids: ["e1"] },
  });
});

test("traduce los errores de la base y no confunde uno desconocido", async () => {
  for (const [code, message] of [
    ["plan_required", "El equipo está disponible en el plan Pro."],
    ["email_mismatch", "La invitación es para otro email."],
    ["invitation_expired", "La invitación venció. Pedile al dueño que te la reenvíe."],
    ["last_owner", "La administración tiene que tener un dueño activo."],
  ]) {
    const { client } = fakeRpc({ error: { message: code } });
    await assert.rejects(acceptTeamInvitation(client, "t"), (error: unknown) => {
      assert.ok(error instanceof TeamError);
      assert.equal(error.message, message);
      return true;
    });
  }
  const { client } = fakeRpc({ error: { message: "boom" } });
  await assert.rejects(acceptTeamInvitation(client, "t"), (error: unknown) => !(error instanceof TeamError));
});

test("el equipo se arma con los consorcios de cada fila", async () => {
  const { client } = fakeRpc({
    data: [
      {
        kind: "member",
        id: "m1",
        email: "op@x.com",
        name: "Olga",
        role: "OPERATOR",
        status: "active",
        edificio_ids: ["e1"],
        expires_at: null,
        created_at: "2026-10-12T00:00:00Z",
      },
      {
        kind: "invitation",
        id: "i1",
        email: "n@x.com",
        name: null,
        role: "VIEWER",
        status: "invited",
        edificio_ids: null,
        expires_at: "2026-10-19T00:00:00Z",
        created_at: "2026-10-12T00:00:00Z",
      },
    ],
  });
  const team = await listTeam(client, "org");
  assert.deepEqual(
    team.map((entry) => [entry.kind, entry.email, entry.communityIds]),
    [
      ["member", "op@x.com", ["e1"]],
      ["invitation", "n@x.com", []],
    ],
  );
});
