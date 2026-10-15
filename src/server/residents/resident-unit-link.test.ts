import type { SupabaseClient } from "@supabase/supabase-js";

import { EndResidentUnitLinkError, endResidentUnitLink } from "./resident-unit-link";
import assert from "node:assert/strict";
import { test } from "node:test";

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

test("dar de baja llama a la RPC con el vínculo", async () => {
  const { client, calls } = fakeRpc(null);

  await endResidentUnitLink(client, "l1");
  assert.deepEqual(calls, [{ fn: "end_resident_unit_link", args: { p_link_id: "l1" } }]);
});

test("traduce los errores conocidos de la base", async () => {
  for (const [code, message] of [
    ["forbidden", "No tenés permiso para dar de baja a este residente."],
    ["link_not_active", "Ya estaba dado de baja de esa unidad."],
  ]) {
    const { client } = fakeRpc({ message: code });
    await assert.rejects(endResidentUnitLink(client, "l1"), (error: unknown) => {
      assert.ok(error instanceof EndResidentUnitLinkError);
      assert.equal(error.message, message);
      return true;
    });
  }
});

test("un error desconocido no se muestra como uno conocido", async () => {
  const { client } = fakeRpc({ message: "boom" });

  await assert.rejects(endResidentUnitLink(client, "l1"), (error: unknown) => {
    assert.ok(!(error instanceof EndResidentUnitLinkError));
    return true;
  });
});
