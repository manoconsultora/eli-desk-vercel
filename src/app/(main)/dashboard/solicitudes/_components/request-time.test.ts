import { isNewRequest, requestedAgo } from "./request-time";
import assert from "node:assert/strict";
import { test } from "node:test";

const NOW = new Date("2026-10-05T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

test("requestedAgo usa la unidad más grande que entra", () => {
  assert.equal(requestedAgo(ago(30_000), NOW), "hace instantes");
  assert.equal(requestedAgo(ago(2 * MIN), NOW), "hace 2 min");
  assert.equal(requestedAgo(ago(59 * MIN), NOW), "hace 59 min");
  assert.equal(requestedAgo(ago(60 * MIN), NOW), "hace 1 hora");
  assert.equal(requestedAgo(ago(7 * 60 * MIN), NOW), "hace 7 horas");
  assert.equal(requestedAgo(ago(24 * 60 * MIN), NOW), "hace 1 día");
  assert.equal(requestedAgo(ago(3 * 24 * 60 * MIN), NOW), "hace 3 días");
});

test("requestedAgo no da tiempos negativos si el reloj está atrasado", () => {
  assert.equal(requestedAgo(ago(-5 * MIN), NOW), "hace instantes");
});

test("isNewRequest marca las solicitudes de las últimas 24 horas", () => {
  assert.equal(isNewRequest(ago(23 * 60 * MIN), NOW), true);
  assert.equal(isNewRequest(ago(24 * 60 * MIN), NOW), false);
});
