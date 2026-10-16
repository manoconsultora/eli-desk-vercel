import type { SupabaseClient } from "@supabase/supabase-js";

import { getAuthContextForIdentity } from "./get-auth-context";
import assert from "node:assert/strict";
import { test } from "node:test";

const IDENTITY = { userId: "user-1", email: "a@b.com" };

type Result = { data: unknown; error: { message: string } | null };

/** Cliente falso: registra el orden de inicio y fin de cada consulta. */
function createFakeClient({
  platformUsers,
  membership,
  paidOrganizationIds = [],
}: {
  platformUsers: Result;
  membership: Result;
  paidOrganizationIds?: string[];
}) {
  const events: string[] = [];
  const delayed = (name: string, result: Result) => {
    events.push(`start:${name}`);
    return new Promise<Result>((resolve) =>
      setTimeout(() => {
        events.push(`end:${name}`);
        resolve(result);
      }, 5),
    );
  };
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ limit: () => delayed("platform_users", platformUsers) }) }),
    }),
    rpc: (name: string) =>
      name === "get_postpay_paid_organization_ids"
        ? delayed("paid_access", { data: paidOrganizationIds, error: null })
        : delayed("membership", membership),
  };
  return { client: client as unknown as SupabaseClient, events };
}

const NO_ROWS: Result = { data: [], error: null };

test("el contexto elegido resuelve el tenant pagado entre varias membresías", async () => {
  const { client } = createFakeClient({
    platformUsers: NO_ROWS,
    membership: {
      data: [
        {
          organization_id: "sandbox",
          membership_role: "TENANT_OWNER",
          membership_status: "active",
          organization_status: "active",
        },
        {
          organization_id: "paid-tenant",
          membership_role: "TENANT_OWNER",
          membership_status: "active",
          organization_status: "pending_payment",
        },
      ],
      error: null,
    },
    paidOrganizationIds: ["paid-tenant"],
  });
  const context = await getAuthContextForIdentity(client as never, IDENTITY, "paid-tenant");
  assert.equal(context.status, "resolved");
  assert.equal(context.organizationId, "paid-tenant");
});

test("una cookie de organización ajena no concede acceso ni evita la selección", async () => {
  const { client } = createFakeClient({
    platformUsers: NO_ROWS,
    membership: {
      data: [
        {
          organization_id: "org-a",
          membership_role: "ADMIN",
          membership_status: "active",
          organization_status: "active",
        },
        {
          organization_id: "org-b",
          membership_role: "VIEWER",
          membership_status: "active",
          organization_status: "active",
        },
      ],
      error: null,
    },
  });
  const context = await getAuthContextForIdentity(client as never, IDENTITY, "other-tenant");
  assert.equal(context.status, "organization_selection_required");
  assert.equal(context.organizationId, null);
});

test("seleccionar un tenant pendiente sin pago no habilita su acceso", async () => {
  const { client } = createFakeClient({
    platformUsers: NO_ROWS,
    membership: {
      data: [
        {
          organization_id: "unpaid",
          membership_role: "TENANT_OWNER",
          membership_status: "active",
          organization_status: "pending_payment",
        },
      ],
      error: null,
    },
  });
  const context = await getAuthContextForIdentity(client as never, IDENTITY, "unpaid");
  assert.notEqual(context.status, "resolved");
  assert.equal(context.organizationId, null);
});

test("consulta platform_users y membresías en paralelo", async () => {
  const { client, events } = createFakeClient({ platformUsers: NO_ROWS, membership: NO_ROWS });

  await getAuthContextForIdentity(client as never, IDENTITY);

  assert.deepEqual(events.slice(0, 2).sort(), ["start:membership", "start:platform_users"]);
});

test("un usuario de plataforma se resuelve aunque falle la consulta de membresías", async () => {
  const { client } = createFakeClient({
    platformUsers: { data: [{ user_id: "user-1", role: "PLATFORM_ADMIN", status: "active" }], error: null },
    membership: { data: null, error: { message: "boom" } },
  });

  const context = await getAuthContextForIdentity(client as never, IDENTITY);

  assert.equal(context.userType, "platform");
  assert.equal(context.status, "resolved");
});

test("un usuario de organización se resuelve con su membresía activa", async () => {
  const { client } = createFakeClient({
    platformUsers: NO_ROWS,
    membership: {
      data: [
        {
          organization_id: "org-1",
          membership_role: "ADMIN",
          membership_status: "active",
          organization_status: "active",
        },
      ],
      error: null,
    },
  });

  const context = await getAuthContextForIdentity(client as never, IDENTITY);

  assert.equal(context.userType, "tenant");
  assert.equal(context.organizationId, "org-1");
});

test("si falla la consulta de membresías y hace falta, el error se propaga", async () => {
  const { client } = createFakeClient({
    platformUsers: NO_ROWS,
    membership: { data: null, error: { message: "boom" } },
  });

  await assert.rejects(getAuthContextForIdentity(client as never, IDENTITY), /boom/);
});
