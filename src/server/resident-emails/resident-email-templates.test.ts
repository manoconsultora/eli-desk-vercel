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

test("un tipo de mail desconocido falla en vez de mandarse como rechazo", () => {
  // The outbox can hold a template a newer database added before this Desk knows it.
  const unknown = "resident_something_new" as Parameters<typeof renderResidentEmail>[0];

  assert.throws(() => renderResidentEmail(unknown, {}), /unknown_template:resident_something_new/);
});
