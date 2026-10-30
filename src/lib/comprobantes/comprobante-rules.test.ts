import {
  comprobanteFileProblem,
  formatFileSize,
  isCarpeta,
  periodFromMonthInput,
  recentMonthInputs,
} from "./comprobante-rules";
import assert from "node:assert/strict";
import test from "node:test";

test("turns the month input into the first day of the month", () => {
  assert.equal(periodFromMonthInput("2026-10"), "2026-10-01");
  assert.equal(periodFromMonthInput("2026-01"), "2026-01-01");
});

test("rejects anything that is not a month", () => {
  assert.equal(periodFromMonthInput(""), null);
  assert.equal(periodFromMonthInput("2026-13"), null);
  assert.equal(periodFromMonthInput("0000-10"), null);
  assert.equal(periodFromMonthInput("2026-10-01"), null);
  assert.equal(periodFromMonthInput("10/2026"), null);
});

test("accepts a PDF up to 10 MB", () => {
  assert.equal(comprobanteFileProblem({ name: "Edesur.PDF", size: 1024 }), null);
  assert.equal(comprobanteFileProblem({ name: "a.pdf", size: 10 * 1024 * 1024 }), null);
});

test("names what is wrong with the file", () => {
  assert.equal(comprobanteFileProblem({ name: "foto.jpg", size: 1024 }), "Solo se aceptan PDF.");
  assert.equal(
    comprobanteFileProblem({ name: `${"a".repeat(197)}.pdf`, size: 1 }),
    "El nombre del archivo es demasiado largo.",
  );
  assert.equal(comprobanteFileProblem({ name: "vacio.pdf", size: 0 }), "El archivo está vacío.");
  assert.equal(comprobanteFileProblem({ name: "grande.pdf", size: 10 * 1024 * 1024 + 1 }), "Pesa más de 10 MB.");
});

test("lists this month and the ones before it, across the year", () => {
  assert.deepEqual(recentMonthInputs(new Date(2026, 1, 15), 3), ["2026-02", "2026-01", "2025-12"]);
});

test("formats the size in B, KB or MB", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(1536), "1,5 KB");
  assert.equal(formatFileSize(10 * 1024 * 1024), "10 MB");
});

test("knows the Documentos folders and nothing else", () => {
  assert.equal(isCarpeta("liquidaciones"), true);
  assert.equal(isCarpeta("comprobantes"), true);
  assert.equal(isCarpeta("reglamentos"), false);
  assert.equal(isCarpeta("Liquidaciones"), false);
  assert.equal(isCarpeta(""), false);
  assert.equal(isCarpeta(undefined), false);
});
