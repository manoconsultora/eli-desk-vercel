import type { SupabaseClient } from "@supabase/supabase-js";

import { AddResidentToUnitError, addResidentToUnit, listUnitOptions } from "./add-resident-to-unit";
import assert from "node:assert/strict";
import { test } from "node:test";

const DETAILS = { name: "Ana Gil", email: "ana@x.com", phone: "+54 11 2233 4455" };

function fakeRpc(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { single: async () => ({ data: result.data ?? null, error: result.error ?? null }) };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("dar de alta llama a la RPC y devuelve si creó al residente", async () => {
  const { client, calls } = fakeRpc({ data: { resident_id: "r1", created: false } });

  assert.deepEqual(await addResidentToUnit(client, { unitId: "u1", relationship: "inquilino" }, DETAILS), {
    created: false,
  });
  assert.deepEqual(calls, [
    {
      fn: "add_resident_to_unit",
      args: {
        p_unidad_id: "u1",
        p_name: "Ana Gil",
        p_email: "ana@x.com",
        p_phone: "+54 11 2233 4455",
        p_relationship_type: "inquilino",
      },
    },
  ]);
});

test("traduce los errores conocidos de la base", async () => {
  for (const [code, message] of [
    ["forbidden", "No tenés permiso para dar de alta residentes en esa unidad."],
    ["invalid_relationship", "Elegí la relación con la unidad."],
    ["contact_blocked", "Ese email o teléfono está en la blacklist."],
    ["unit_limit_reached", "La unidad ya tiene 5 residentes activos."],
    ["already_in_unit", "Ya es residente de esa unidad."],
  ]) {
    const { client } = fakeRpc({ error: { message: code } });
    await assert.rejects(
      addResidentToUnit(client, { unitId: "u1", relationship: "inquilino" }, DETAILS),
      (error: unknown) => {
        assert.ok(error instanceof AddResidentToUnitError);
        assert.equal(error.message, message);
        return true;
      },
    );
  }
});

test("un error desconocido no se muestra como uno conocido", async () => {
  const { client } = fakeRpc({ error: { message: "boom" } });

  await assert.rejects(
    addResidentToUnit(client, { unitId: "u1", relationship: "inquilino" }, DETAILS),
    (error: unknown) => {
      assert.ok(!(error instanceof AddResidentToUnitError));
      return true;
    },
  );
});

function fakeTables(rows: Record<string, Record<string, unknown>[]>) {
  const client = {
    from(table: string) {
      let data = rows[table] ?? [];
      const builder = {} as Record<string, unknown>;
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = (column: string, values: unknown[]) => {
        data = data.filter((row) => values.includes(row[column]));
        return builder;
      };
      // biome-ignore lint/suspicious/noThenProperty: fake thenable query builder
      builder.then = (resolve: (value: unknown) => void) => resolve({ data, error: null });
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

test("las unidades salen ordenadas por consorcio y número, solo las del scope", async () => {
  const client = fakeTables({
    unidades: [
      { id: "u10", numero: "10A", edificio_id: "e1" },
      { id: "u2", numero: "2A", edificio_id: "e1" },
      { id: "u3", numero: "1A", edificio_id: "e2" },
    ],
    edificios: [
      { id: "e1", nombre: "Ugarte 2200" },
      { id: "e2", nombre: "Arenales 100" },
    ],
  });

  const all = await listUnitOptions(client, "org", { kind: "all_consorcios" });
  assert.deepEqual(
    all.map((unit) => `${unit.communityName} ${unit.number}`),
    ["Arenales 100 1A", "Ugarte 2200 2A", "Ugarte 2200 10A"],
  );

  const scoped = await listUnitOptions(client, "org", { kind: "explicit", consorcioIds: ["e1"] });
  assert.deepEqual(
    scoped.map((unit) => unit.id),
    ["u2", "u10"],
  );
});
