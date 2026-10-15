import { paginate } from "./paginate";
import assert from "node:assert/strict";
import { test } from "node:test";

const ITEMS = Array.from({ length: 23 }, (_, index) => index + 1);

test("corta la página pedida", () => {
  assert.deepEqual(paginate(ITEMS, 1, 10), { items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], page: 1, pageCount: 3 });
  assert.deepEqual(paginate(ITEMS, 3, 10), { items: [21, 22, 23], page: 3, pageCount: 3 });
});

test("una página fuera de rango se ajusta a la primera o la última", () => {
  assert.equal(paginate(ITEMS, 9, 10).page, 3);
  assert.equal(paginate(ITEMS, 0, 10).page, 1);
});

test("sin elementos hay una sola página vacía", () => {
  assert.deepEqual(paginate([], 1, 10), { items: [], page: 1, pageCount: 1 });
});
