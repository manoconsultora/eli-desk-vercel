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

test("la aceptación usa el diseño del mail de alta y dice que la cuenta está activa", () => {
  const email = renderResidentEmail("resident_request_approved", {
    first_name: "Pedro",
    edificio_nombre: "Sandbox Belgrano",
    unidad_numero: "1B",
  });

  assert.equal(email.subject, "Tu cuenta de ELI está activa");
  assert.match(email.html, /isologo_eli\.svg/);
  assert.match(email.html, /isologo_mano_gy\.png/);
  assert.match(email.html, /¡Hola, Pedro!/);
  assert.match(email.html, /Sandbox Belgrano \(unidad 1B\)\. Ya podés empezar a utilizar ELI\./);
});

test("cada mail tiene versión en texto plano, sin HTML", () => {
  for (const key of [
    "resident_request_approved",
    "resident_request_rejected",
    "resident_email_verification",
  ] as const) {
    const email = renderResidentEmail(key, { first_name: "Pedro", edificio_nombre: "Ugarte 2200", code: "042317" });
    assert.ok(email.text.length > 0, key);
    assert.doesNotMatch(email.text, /<[a-z]/, key);
  }
});
