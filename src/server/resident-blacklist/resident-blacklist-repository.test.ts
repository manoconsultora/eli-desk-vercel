import type { SupabaseClient } from "@supabase/supabase-js";

import {
  addToBlacklist,
  type BlacklistEntry,
  BlacklistError,
  isBlacklisted,
  listBlacklist,
  removeFromBlacklist,
} from "./resident-blacklist-repository";
import assert from "node:assert/strict";
import { test } from "node:test";

type Call = { method: string; args: unknown[] };

function fakeClient(rows: unknown[], rpcError: { message: string } | null = null) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  // biome-ignore lint/suspicious/noThenProperty: fake thenable query builder
  builder.then = (resolve: (value: unknown) => void) => resolve({ data: rows, error: null });
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
    rpc: async (fn: string, args: unknown) => {
      calls.push({ method: "rpc", args: [fn, args] });
      return { data: null, error: rpcError };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("lista solo las entradas activas de la organización", async () => {
  const { client, calls } = fakeClient([
    {
      id: "b1",
      name: "Juan Martín",
      email: "juan@x.com",
      phone: "+54 11 3388 9900",
      phone_digits: "541133889900",
      reason: null,
      created_at: "2026-10-05T10:00:00Z",
    },
  ]);

  const entries = await listBlacklist(client, "org-1");

  assert.deepEqual(entries, [
    {
      id: "b1",
      name: "Juan Martín",
      email: "juan@x.com",
      phone: "+54 11 3388 9900",
      phoneDigits: "541133889900",
      reason: null,
      createdAt: "2026-10-05T10:00:00Z",
    },
  ]);
  assert.deepEqual(
    calls.filter((call) => call.method === "eq" || call.method === "is").map((call) => call.args),
    [
      ["organization_id", "org-1"],
      ["removed_at", null],
    ],
  );
});

test("agregar y quitar llaman a las RPCs", async () => {
  const { client, calls } = fakeClient([]);

  await addToBlacklist(client, "q1", "insultos");
  await removeFromBlacklist(client, "b1");

  assert.deepEqual(
    calls.map((call) => call.args),
    [
      ["add_resident_to_blacklist", { p_request_id: "q1", p_reason: "insultos" }],
      ["remove_resident_from_blacklist", { p_entry_id: "b1" }],
    ],
  );
});

test("forbidden se muestra como error de permiso; otro error no", async () => {
  await assert.rejects(addToBlacklist(fakeClient([], { message: "forbidden" }).client, "q1", null), BlacklistError);
  await assert.rejects(removeFromBlacklist(fakeClient([], { message: "boom" }).client, "b1"), (error: unknown) => {
    assert.ok(!(error instanceof BlacklistError));
    return true;
  });
});

test("isBlacklisted compara el email sin mayúsculas y el teléfono por dígitos", () => {
  const entries = [{ email: "juan@x.com", phoneDigits: "541133889900" }] as BlacklistEntry[];

  assert.equal(isBlacklisted({ email: "Juan@X.com ", phone: null }, entries), true);
  assert.equal(isBlacklisted({ email: "otro@x.com", phone: "54 11 3388-9900" }, entries), true);
  assert.equal(isBlacklisted({ email: "otro@x.com", phone: "11 3388 9900" }, entries), false);
  assert.equal(isBlacklisted({ email: "otro@x.com", phone: "" }, entries), false);
});
