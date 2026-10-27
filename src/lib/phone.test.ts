import { formatPhone, normalizePhone } from "./phone";
import assert from "node:assert/strict";
import { test } from "node:test";

test("the ways of writing the same Argentine mobile give the same number", () => {
  const ways = ["011 15-5874-9895", "11 5874-9895", "+54 9 11 5874 9895", "+54 11 5874 9895", "5491158749895"];
  assert.deepEqual(new Set(ways.map(normalizePhone)), new Set(["+5491158749895"]));
  assert.equal(normalizePhone("0294 15 4123456"), "+5492944123456");
});

test("foreign numbers are kept with their country code", () => {
  assert.equal(normalizePhone("+34 612 34 56 78"), "+34612345678");
  assert.equal(normalizePhone("+1 (415) 555-2671"), "+14155552671");
});

test("invalid numbers are rejected", () => {
  assert.deepEqual(["15 5874 9895", "1234", "abc", ""].map(normalizePhone), [null, null, null, null]);
});

test("display keeps numbers saved before the rule", () => {
  assert.equal(formatPhone("+5491158749895"), "+54 9 11 5874 9895");
  assert.equal(formatPhone("011 15-5874-9895"), "011 15-5874-9895");
});
