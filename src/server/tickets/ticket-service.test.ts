import { validateTicketInput } from "./ticket-service";
import assert from "node:assert/strict";
import { test } from "node:test";

const INPUT = { edificio_id: "e1", ticket_type: "reclamo", description: "Olor a gas" };

test("la prioridad urgente es válida y se guarda tal cual", () => {
  assert.equal(validateTicketInput({ ...INPUT, priority: "urgente" }).priority, "urgente");
});

test("una prioridad desconocida se rechaza", () => {
  assert.throws(() => validateTicketInput({ ...INPUT, priority: "critica" }), /La prioridad no es válid/);
});
