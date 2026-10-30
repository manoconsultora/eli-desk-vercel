import { isLikelySameTicket } from "./bot-ticket-duplicate";
import assert from "node:assert/strict";
import test from "node:test";

test("repeated resident complaint matches despite model paraphrases", () => {
  const first = "La losa radiante calienta demasiado en temporada de verano y solicita que la apaguen.";
  assert.equal(
    isLikelySameTicket(first, "La loza radiante calienta demasiado en temporada de verano y se solicita su apagado."),
    true,
  );
  assert.equal(
    isLikelySameTicket(first, "La loza radiante calienta demasiado y piden apagarla por temporada de verano."),
    true,
  );
  assert.equal(
    isLikelySameTicket(first, "La loza radiante calienta demasiado y piden apagarla ya que es verano."),
    true,
  );
  assert.equal(isLikelySameTicket("Ruidos molestos", "RUIDOS MOLESTOS!"), true);
});

test("different issue in the same building is not a duplicate", () => {
  assert.equal(isLikelySameTicket("Pérdida de agua en el baño", "Pérdida de agua en la cocina"), false);
  assert.equal(isLikelySameTicket("Ruidos molestos en la madrugada", "El ascensor está detenido"), false);
});
