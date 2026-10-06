import type { SupabaseClient } from "@supabase/supabase-js";

import { approveResidentRequest, ResidentRequestReviewError, rejectResidentRequest } from "./resident-request-review";
import assert from "node:assert/strict";
import { test } from "node:test";

function fakeRpc(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: result.data ?? null, error: result.error ?? null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("aceptar llama a la RPC y devuelve el residente", async () => {
  const { client, calls } = fakeRpc({ data: "r1" });

  assert.equal(await approveResidentRequest(client, "q1"), "r1");
  assert.deepEqual(calls, [{ fn: "approve_resident_onboarding_request", args: { p_request_id: "q1" } }]);
});

test("rechazar pasa el motivo", async () => {
  const { client, calls } = fakeRpc({});

  await rejectResidentRequest(client, "q1", "No vive en el edificio");
  assert.deepEqual(calls, [
    { fn: "reject_resident_onboarding_request", args: { p_request_id: "q1", p_reason: "No vive en el edificio" } },
  ]);
});

test("traduce los errores conocidos de la base", async () => {
  for (const [code, message] of [
    ["forbidden", "No tenés permiso para revisar esta solicitud."],
    ["request_not_pending", "La solicitud ya fue revisada."],
    ["unit_limit_reached", "La unidad ya tiene 5 residentes activos."],
  ]) {
    const { client } = fakeRpc({ error: { message: code } });
    await assert.rejects(approveResidentRequest(client, "q1"), (error: unknown) => {
      assert.ok(error instanceof ResidentRequestReviewError);
      assert.equal(error.message, message);
      return true;
    });
  }
});

test("un error desconocido no se muestra como error de revisión", async () => {
  const { client } = fakeRpc({ error: { message: "connection reset" } });

  await assert.rejects(rejectResidentRequest(client, "q1", null), (error: unknown) => {
    assert.ok(!(error instanceof ResidentRequestReviewError));
    return true;
  });
});
