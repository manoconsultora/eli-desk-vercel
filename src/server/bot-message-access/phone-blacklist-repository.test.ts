import type { SupabaseClient } from "@supabase/supabase-js";

import { createPhoneBlacklistRepository } from "./phone-blacklist-repository";
import assert from "node:assert/strict";
import { test } from "node:test";

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = [];
  const builder = {
    select(fields: string) {
      calls.push(["select", fields]);
      return this;
    },
    eq(key: string, value: string) {
      calls.push(["eq", key, value]);
      return this;
    },
    is(key: string, value: null) {
      calls.push(["is", key, value]);
      return this;
    },
    async limit(count: number) {
      calls.push(["limit", count]);
      return result;
    },
  };
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      return builder;
    },
  };
  return { calls, client: client as unknown as SupabaseClient };
}

test("uses existing blacklist model, exact phone and active administration scope, with no write API", async () => {
  const { client, calls } = fakeClient({ data: [], error: null });
  assert.equal(
    await createPhoneBlacklistRepository(client).isPhoneBlocked({
      organizationId: "org-1",
      phoneDigits: "5491100000001",
    }),
    false,
  );
  assert.deepEqual(calls, [
    ["from", "resident_blacklist"],
    ["select", "id, phone_digits"],
    ["eq", "organization_id", "org-1"],
    ["is", "removed_at", null],
    ["eq", "phone_digits", "5491100000001"],
    ["limit", 1],
  ]);
});

test("active phone match blocks", async () => {
  const { client } = fakeClient({ data: [{ id: "bl-1", phone_digits: "5491100000001" }], error: null });
  assert.equal(
    await createPhoneBlacklistRepository(client).isPhoneBlocked({
      organizationId: "org-1",
      phoneDigits: "5491100000001",
    }),
    true,
  );
});

[
  { data: null, error: null },
  { data: {}, error: null },
  { data: [], error: { message: "unavailable" } },
  { data: [{ id: "bl-1", phone_digits: "other" }], error: null },
  { data: [null], error: null },
].forEach((result, index) => {
  test(`unknown lookup result ${index} is an error, not permission`, async () => {
    const { client } = fakeClient(result);
    await assert.rejects(
      createPhoneBlacklistRepository(client).isPhoneBlocked({
        organizationId: "org-1",
        phoneDigits: "5491100000001",
      }),
      /unavailable/,
    );
  });
});

test("invalid phone or missing organization never issues a query", async () => {
  const { client, calls } = fakeClient({ data: [], error: null });
  const repo = createPhoneBlacklistRepository(client);
  await assert.rejects(repo.isPhoneBlocked({ organizationId: "", phoneDigits: "5491100000001" }));
  await assert.rejects(repo.isPhoneBlocked({ organizationId: "org-1", phoneDigits: "+54 11" }));
  assert.deepEqual(calls, []);
});

test("same phone in another administration and removed entries do not block this administration", async () => {
  const rows = [
    { id: "other-org", organization_id: "org-2", phone_digits: "5491100000001", removed_at: null },
    { id: "removed", organization_id: "org-1", phone_digits: "5491100000001", removed_at: "removed" },
    { id: "email-only", organization_id: "org-1", phone_digits: null, removed_at: null },
  ];
  const filters: [string, unknown][] = [];
  const builder = {
    select() {
      return this;
    },
    eq(key: string, value: unknown) {
      filters.push([key, value]);
      return this;
    },
    is(key: string, value: unknown) {
      filters.push([key, value]);
      return this;
    },
    async limit() {
      return {
        data: rows.filter((row) => filters.every(([key, value]) => row[key as keyof typeof row] === value)),
        error: null,
      };
    },
  };
  const client = {
    from() {
      return builder;
    },
  } as unknown as SupabaseClient;
  assert.equal(
    await createPhoneBlacklistRepository(client).isPhoneBlocked({
      organizationId: "org-1",
      phoneDigits: "5491100000001",
    }),
    false,
  );
});
