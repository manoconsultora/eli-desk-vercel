import { isResidentEmailCronAuthorized } from "./resident-email-cron-auth";
import assert from "node:assert/strict";
import { test } from "node:test";

test("el drenado programado exige el secreto exacto", () => {
  assert.equal(isResidentEmailCronAuthorized("Bearer s3cret", "s3cret"), true);
  assert.equal(isResidentEmailCronAuthorized("Bearer otro", "s3cret"), false);
  assert.equal(isResidentEmailCronAuthorized("s3cret", "s3cret"), false);
  assert.equal(isResidentEmailCronAuthorized(null, "s3cret"), false);
});

test("sin secreto configurado no autoriza a nadie", () => {
  assert.equal(isResidentEmailCronAuthorized("Bearer ", ""), false);
  assert.equal(isResidentEmailCronAuthorized("Bearer undefined", ""), false);
});
