import type { SupabaseClient } from "@supabase/supabase-js";

import { createUnit, deleteUnit, getCommunityDetail, listCommunities, updateUnit } from "./community-repository";
import assert from "node:assert/strict";
import { test } from "node:test";

const ORGANIZATION_ID = "org-1";
const COMMUNITY_ID = "edificio-a";

type RecordedCall = { table: string; method: string; args: unknown[] };

/** Cliente falso: devuelve filas por tabla y registra los filtros encadenados. */
function createFakeClient(rows: Record<string, unknown>) {
  const calls: RecordedCall[] = [];

  const client = {
    from(table: string) {
      calls.push({ table, method: "from", args: [] });
      const builder = Object.assign(Promise.resolve({ data: rows[table] ?? [], error: null }), {
        maybeSingle: () => Promise.resolve({ data: rows[table] ?? null, error: null }),
      }) as unknown as Record<string, unknown>;
      for (const method of ["select", "eq", "in", "is", "order"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

const FULL_ROWS = {
  edificios: {
    id: COMMUNITY_ID,
    nombre: "Torre A",
    direccion: "Ugarte 2200",
    estado: "activo",
    created_at: "2026-07-15",
  },
  unidades: [{ id: "u1", numero: "1A", piso: "1", tipo: "departamento", estado: "ocupada" }],
  resident_unit_links: [
    { unidad_id: "u1", residente_id: "r1", relationship_type: "inquilino", is_primary: false },
    { unidad_id: "u1", residente_id: "r2", relationship_type: "propietario", is_primary: true },
  ],
  residentes: [
    { id: "r1", nombre_completo: "Ana", telefono: null, email: null },
    { id: "r2", nombre_completo: "Beto", telefono: "11", email: "b@x.com" },
  ],
  tickets: [
    { id: "t1", ticket_code: "ELI-1", unidad_id: "u1", description: "x", status: "abierto", created_at: "2026-09-01" },
    { id: "t2", ticket_code: "ELI-2", unidad_id: null, description: "y", status: "abierto", created_at: "2026-08-01" },
  ],
};

test("getCommunityDetail no consulta si el consorcio no está en el scope explicit", async () => {
  const { client, calls } = createFakeClient(FULL_ROWS);

  const result = await getCommunityDetail(
    client,
    ORGANIZATION_ID,
    { kind: "explicit", consorcioIds: ["otro"] },
    COMMUNITY_ID,
  );

  assert.equal(result, null);
  assert.equal(calls.length, 0);
});

test("getCommunityDetail devuelve null si el consorcio no existe en la organización", async () => {
  const { client } = createFakeClient({ ...FULL_ROWS, edificios: null });

  const result = await getCommunityDetail(client, ORGANIZATION_ID, { kind: "all_consorcios" }, COMMUNITY_ID);

  assert.equal(result, null);
});

test("getCommunityDetail filtra todas las tablas por organization_id", async () => {
  const { client, calls } = createFakeClient(FULL_ROWS);

  await getCommunityDetail(client, ORGANIZATION_ID, { kind: "all_consorcios" }, COMMUNITY_ID);

  for (const table of ["edificios", "unidades", "tickets", "resident_unit_links", "residentes"]) {
    const orgFilter = calls.find(
      (call) => call.table === table && call.method === "eq" && call.args[0] === "organization_id",
    );
    assert.deepEqual(orgFilter?.args, ["organization_id", ORGANIZATION_ID], table);
  }
});

test("getCommunityDetail arma unidades con residentes, principal primero", async () => {
  const { client } = createFakeClient(FULL_ROWS);

  const result = await getCommunityDetail(client, ORGANIZATION_ID, { kind: "all_consorcios" }, COMMUNITY_ID);

  assert.equal(result?.name, "Torre A");
  assert.equal(result?.address, "Ugarte 2200");
  assert.equal(result?.status, "activo");
  assert.equal(result?.createdAt, "2026-07-15");
  assert.deepEqual(
    result?.units[0].residents.map((resident) => [resident.name, resident.isPrimary]),
    [
      ["Beto", true],
      ["Ana", false],
    ],
  );
  assert.equal(result?.activeTickets[0].code, "ELI-1");
});

test("getCommunityDetail muestra el número de unidad de cada ticket, o null si no tiene", async () => {
  const { client } = createFakeClient(FULL_ROWS);

  const result = await getCommunityDetail(client, ORGANIZATION_ID, { kind: "all_consorcios" }, COMMUNITY_ID);

  assert.deepEqual(
    result?.activeTickets.map((ticket) => [ticket.code, ticket.unitNumber]),
    [
      ["ELI-1", "1A"],
      ["ELI-2", null],
    ],
  );
});

test("listCommunities devuelve dirección y estado de cada consorcio", async () => {
  const { client } = createFakeClient({
    edificios: [{ id: COMMUNITY_ID, nombre: "Torre A", direccion: "Ugarte 2200", estado: "activo" }],
    unidades: [{ edificio_id: COMMUNITY_ID }],
    tickets: [],
  });

  const [community] = await listCommunities(client, ORGANIZATION_ID, { kind: "all_consorcios" });

  assert.deepEqual(community, {
    id: COMMUNITY_ID,
    name: "Torre A",
    address: "Ugarte 2200",
    status: "activo",
    unitCount: 1,
    activeTicketCount: 0,
  });
});

/** Cliente falso para el insert de unidades: devuelve el error dado y guarda la fila. */
function createInsertClient(error: { code: string; message: string } | null) {
  const inserted: { table: string; row: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserted.push({ table, row });
        return Promise.resolve({ error });
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, inserted };
}

test("createUnit inserta la unidad desocupada, con la organización y el consorcio", async () => {
  const { client, inserted } = createInsertClient(null);

  const result = await createUnit(client, ORGANIZATION_ID, COMMUNITY_ID, { number: "2B", floor: null });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(inserted, [
    {
      table: "unidades",
      row: {
        organization_id: ORGANIZATION_ID,
        edificio_id: COMMUNITY_ID,
        numero: "2B",
        piso: null,
        estado: "desocupado",
      },
    },
  ]);
});

test("createUnit devuelve duplicate si el número ya existe en el consorcio", async () => {
  const { client } = createInsertClient({ code: "23505", message: "duplicate key" });

  const result = await createUnit(client, ORGANIZATION_ID, COMMUNITY_ID, { number: "1A", floor: "1" });

  assert.deepEqual(result, { ok: false, reason: "duplicate" });
});

test("createUnit devuelve forbidden si RLS rechaza el insert", async () => {
  const { client } = createInsertClient({ code: "42501", message: "row-level security" });

  const result = await createUnit(client, ORGANIZATION_ID, COMMUNITY_ID, { number: "1A", floor: null });

  assert.deepEqual(result, { ok: false, reason: "forbidden" });
});

test("createUnit lanza ante otros errores de la base", async () => {
  const { client } = createInsertClient({ code: "08006", message: "connection failure" });

  await assert.rejects(createUnit(client, ORGANIZATION_ID, COMMUNITY_ID, { number: "1A", floor: null }), {
    message: "connection failure",
  });
});

/** Cliente falso para el update y el delete de unidades: devuelve las filas o el error dados y guarda los filtros. */
function createUpdateClient(result: { data: unknown[] | null; error: { code: string; message: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["update", "delete", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.select = (...args: unknown[]) => {
    calls.push({ method: "select", args });
    return Promise.resolve(result);
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("updateUnit cambia número y piso de la unidad de la organización", async () => {
  const { client, calls } = createUpdateClient({ data: [{ id: "u1" }], error: null });

  const result = await updateUnit(client, ORGANIZATION_ID, "u1", { number: "2B", floor: null });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [
    { method: "from", args: ["unidades"] },
    { method: "update", args: [{ numero: "2B", piso: null }] },
    { method: "eq", args: ["id", "u1"] },
    { method: "eq", args: ["organization_id", ORGANIZATION_ID] },
    { method: "select", args: ["id"] },
  ]);
});

test("updateUnit devuelve duplicate si el número ya existe en el consorcio", async () => {
  const { client } = createUpdateClient({ data: null, error: { code: "23505", message: "duplicate key" } });

  const result = await updateUnit(client, ORGANIZATION_ID, "u1", { number: "1A", floor: "1" });

  assert.deepEqual(result, { ok: false, reason: "duplicate" });
});

test("updateUnit devuelve forbidden si RLS no deja actualizar ninguna fila", async () => {
  const { client } = createUpdateClient({ data: [], error: null });

  const result = await updateUnit(client, ORGANIZATION_ID, "u1", { number: "1A", floor: null });

  assert.deepEqual(result, { ok: false, reason: "forbidden" });
});

test("updateUnit lanza ante otros errores de la base", async () => {
  const { client } = createUpdateClient({ data: null, error: { code: "08006", message: "connection failure" } });

  await assert.rejects(updateUnit(client, ORGANIZATION_ID, "u1", { number: "1A", floor: null }), {
    message: "connection failure",
  });
});

test("deleteUnit borra la unidad de la organización", async () => {
  const { client, calls } = createUpdateClient({ data: [{ id: "u1" }], error: null });

  const result = await deleteUnit(client, ORGANIZATION_ID, "u1");

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [
    { method: "from", args: ["unidades"] },
    { method: "delete", args: [] },
    { method: "eq", args: ["id", "u1"] },
    { method: "eq", args: ["organization_id", ORGANIZATION_ID] },
    { method: "select", args: ["id"] },
  ]);
});

test("deleteUnit devuelve forbidden si RLS no deja borrar ninguna fila", async () => {
  const { client } = createUpdateClient({ data: [], error: null });

  assert.deepEqual(await deleteUnit(client, ORGANIZATION_ID, "u1"), { ok: false, reason: "forbidden" });
});

test("deleteUnit dice qué tiene la unidad según la FK que bloqueó el borrado", async () => {
  const cases: [string, string][] = [
    ["resident_unit_links_unidad_org_fk", "residents"],
    ["tickets_unidad_edificio_org_fkey", "tickets"],
    ["resident_onboarding_requests_unidad_id_fkey", "requests"],
    ["conversation_sessions_unidad_edificio_org_fk", "in_use"],
  ];
  for (const [constraint, reason] of cases) {
    const message = `update or delete on table "unidades" violates foreign key constraint "${constraint}"`;
    const { client } = createUpdateClient({ data: null, error: { code: "23503", message } });

    assert.deepEqual(await deleteUnit(client, ORGANIZATION_ID, "u1"), { ok: false, reason }, constraint);
  }
});

test("deleteUnit lanza ante otros errores de la base", async () => {
  const { client } = createUpdateClient({ data: null, error: { code: "08006", message: "connection failure" } });

  await assert.rejects(deleteUnit(client, ORGANIZATION_ID, "u1"), { message: "connection failure" });
});
