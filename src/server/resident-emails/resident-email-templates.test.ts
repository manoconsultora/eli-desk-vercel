import { renderResidentEmail } from "./resident-email-templates";
import assert from "node:assert/strict";
import { test } from "node:test";

test("el mail del código muestra el código y el edificio", () => {
  const email = renderResidentEmail("resident_email_verification", { code: "042317", edificio_nombre: "Ugarte 2200" });

  assert.equal(email.subject, "Tu código de verificación de ELI: 042317");
  assert.match(email.html, />042317</);
  assert.match(email.html, /Ugarte 2200/);
  assert.match(email.html, /Vence en 30 minutos/);
});

test("el mail del código escapa el HTML del payload", () => {
  const email = renderResidentEmail("resident_email_verification", { code: "<b>1</b>", edificio_nombre: "<i>x</i>" });

  assert.doesNotMatch(email.html, /<b>|<i>/);
});
