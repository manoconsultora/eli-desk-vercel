import type { SupabaseClient } from "@supabase/supabase-js";

import { UpdateResidentError, updateResident } from "./update-resident";
import assert from "node:assert/strict";
import { test } from "node:test";

const DETAILS = { name: "Laura Conti", email: "laura@x.com", phone: "+54 11 2345 6789" };

function fakeRpc(error: { message: string } | null) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: null, error };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("editar llama a la RPC con los datos", async () => {
  const { client, calls } = fakeRpc(null);

  await updateResident(client, "r1", DETAILS);
  assert.deepEqual(calls, [
    {
      fn: "update_resident",
      args: { p_resident_id: "r1", p_name: "Laura Conti", p_email: "laura@x.com", p_phone: "+54 11 2345 6789" },
    },
  ]);
});

test("traduce los errores conocidos de la base", async () => {
  for (const [code, message] of [
    ["forbidden", "No tenés permiso para editar a este residente."],
    ["invalid_name", "Ingresá el nombre."],
    ["invalid_email", "Ingresá un email válido."],
    ["invalid_phone", "Ingresá un teléfono válido, con código de área."],
    ["email_in_use", "Ese email ya lo usa otro residente de la administración."],
  ]) {
    const { client } = fakeRpc({ message: code });
    await assert.rejects(updateResident(client, "r1", DETAILS), (error: unknown) => {
      assert.ok(error instanceof UpdateResidentError);
      assert.equal(error.message, message);
      return true;
    });
  }
});

test("un error desconocido no se muestra como uno conocido", async () => {
  const { client } = fakeRpc({ message: "boom" });

  await assert.rejects(updateResident(client, "r1", DETAILS), (error: unknown) => {
    assert.ok(!(error instanceof UpdateResidentError));
    return true;
  });
});
