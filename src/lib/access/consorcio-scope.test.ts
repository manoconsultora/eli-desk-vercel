import { isConsorcioInScope } from "./consorcio-scope";
import assert from "node:assert/strict";
import test from "node:test";

test("all consorcios includes any consorcio", () => {
  assert.equal(isConsorcioInScope({ kind: "all_consorcios" }, "e1"), true);
});

test("an explicit scope includes only its consorcios", () => {
  const scope = { kind: "explicit", consorcioIds: ["e1", "e2"] } as const;
  assert.equal(isConsorcioInScope(scope, "e2"), true);
  assert.equal(isConsorcioInScope(scope, "e3"), false);
  assert.equal(isConsorcioInScope({ kind: "explicit", consorcioIds: [] }, "e1"), false);
});
