import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const prepare = new Function("$json", await readFile(new URL("prepare-check.js.txt", import.meta.url), "utf8"));
const evaluate = new Function("$json", "$", await readFile(new URL("evaluate-check.js.txt", import.meta.url), "utf8"));
function context(index = 1) {
  return {
    channel: "whatsapp",
    chatId: `549110000000${index}`,
    externalSenderId: `549110000000${index}`,
    phoneNumberId: "review-phone",
    correlationId: `wa-test-${index}`,
    idempotencyKey: `idem-${index}`,
    message: "Reclamo para la unidad 4B",
    inputValid: true,
    providerMessageType: "text",
  };
}
function output(decision, source = context(), overrides = {}) {
  return evaluate(
    {
      statusCode: 200,
      body: { apiVersion: "v1", capability: "messages.authorize", correlationId: source.correlationId, decision },
      ...overrides,
    },
    function linked(name) {
      assert.equal(name, "BL — Preparar consulta");
      return { item: { json: { context: source } } };
    },
  ).json;
}
test("precheck sends no text, tenant, unit or recipient metadata", () => {
  const source = context();
  assert.deepEqual(JSON.parse(prepare(source).json.rawBody), {
    apiVersion: "v1",
    capability: "messages.authorize",
    correlationId: source.correlationId,
    source: { channel: "whatsapp", externalSenderId: source.externalSenderId },
  });
  assert.deepEqual(prepare(source).json.context, source);
});
test("blocked reply is exact and cannot reach classifier", () => {
  const result = output("blocked");
  assert.equal(result.accessAllowed, false);
  assert.equal(result.responseText, "[BL] Acceso Denegado. Recomendamos contactar al Administrador de tu Edificio.");
});
test("allowed preserves all context; batch results use item linking in any order", () => {
  [context(2), context(1)].forEach((source) => {
    const result = output("allowed", source);
    assert.equal(result.accessAllowed, true);
    Object.keys(source).forEach((key) => {
      assert.equal(result[key], source[key]);
    });
    assert.equal(result.responseText, undefined);
  });
});
test("unknown, HTTP failure, malformed JSON, bad correlation and transport errors deny processing", () => {
  [
    output("other"),
    output("allowed", context(), { statusCode: 500 }),
    output("allowed", context(), { body: "not JSON" }),
    output("allowed", context(), {
      body: { apiVersion: "v1", capability: "messages.authorize", correlationId: "other", decision: "allowed" },
    }),
    output("allowed", context(), { error: "ECONNRESET" }),
    output("allowed", context(), { statusCode: 404 }),
  ].forEach((result) => {
    assert.equal(result.accessAllowed, false);
    assert.equal(result.outcome, "service_unavailable");
    assert.match(result.responseText, /servicio no está disponible/);
  });
});
test("nontext messages are checked before unsupported-type reply", () => {
  const media = { ...context(), providerMessageType: "image", message: null, inputValid: false };
  assert.equal(output("blocked", media).outcome, "contact_blocked");
  assert.equal(output("unavailable", media).outcome, "service_unavailable");
  assert.equal(output("allowed", media).outcome, "unsupported_message_type");
  assert.equal(output("allowed", media).accessAllowed, false);
});
test("missing response context stops instead of using another recipient", () => {
  assert.throws(() => output("blocked", { ...context(), chatId: "other" }), /missing_verified/);
});

const workflow = JSON.parse(await readFile(new URL("v3-blacklist.draft.json", import.meta.url), "utf8"));
test("draft uses the locally implemented read-only messages.authorize contract", () => {
  assert.equal(workflow.meta.pendingServerEndpoint, false);
  assert.equal(workflow.meta.serverEndpointImplemented, true);
  assert.equal(workflow.meta.deploymentPending, true);
  assert.equal(prepare(context()).json.requestPath, "/api/integrations/n8n/v1/messages.authorize");
  assert.equal(node("BL — Consultar acceso DEV").parameters.method, "POST");
  assert.equal(node("BL — Consultar acceso DEV").parameters.url, "={{ $json.apiBaseUrl + $json.requestPath }}");
});
function node(name) {
  return workflow.nodes.find((item) => item.name === name);
}
function successors(name) {
  return (workflow.connections[name]?.main ?? []).flat().map((edge) => edge.node);
}
test("review copy is inactive, no live triggers, bindings or original webhook routes", () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.id, undefined);
  workflow.nodes
    .filter((item) => item.type.endsWith("Trigger") || item.type.endsWith(".webhook"))
    .forEach((item) => {
      assert.equal(item.disabled, true);
    });
  workflow.nodes
    .filter((item) => item.credentials)
    .forEach((item) => {
      Object.values(item.credentials).forEach((credential) => {
        assert.match(credential.id, /^REVIEW_BIND_/);
      });
    });
  workflow.nodes
    .filter((item) => item.type.endsWith(".webhook"))
    .forEach((item) => {
      assert.match(item.parameters.path, /^review-blacklist-/);
    });
});
test("WhatsApp has no path to AI or business response without the access gate", () => {
  const pending = ["WhatsApp — Normalizar entrada"];
  const seen = new Set();
  function visit(name) {
    if (seen.has(name) || name === "BL — Mensaje habilitado?") return;
    seen.add(name);
    successors(name).forEach(visit);
  }
  pending.forEach(visit);
  ["Interpret Resident Message", "API-01 tickets.create", "Send Whatsapp", "ELI — Preparar respuesta"].forEach(
    (name) => {
      assert.equal(seen.has(name), false);
    },
  );
  assert.equal(seen.has("BL — Consultar acceso DEV"), true);
  assert.deepEqual(workflow.connections["BL — Mensaje habilitado?"].main, [
    [{ node: "ELI — Entrada común", type: "main", index: 0 }],
    [{ node: "Send Whatsapp", type: "main", index: 0 }],
  ]);
  assert.equal(node("BL — Consultar acceso DEV").onError, "continueRegularOutput");
  assert.equal(node("BL — Consultar acceso DEV").parameters.options.timeout, 10000);
});
test("normalizer ignores statuses and checks text and media, preserving pairing", () => {
  const normalize = new Function("$input", node("WhatsApp — Normalizar entrada").parameters.jsCode);
  function event(value) {
    return {
      json: {
        signatureValid: true,
        body: {
          object: "whatsapp_business_account",
          entry: [
            {
              changes: [
                { field: "messages", value: { metadata: { phone_number_id: "REVIEW_PHONE_NUMBER_ID" }, ...value } },
              ],
            },
          ],
        },
      },
    };
  }
  const items = normalize({
    all: () => [
      event({ statuses: [{ status: "delivered" }] }),
      event({
        messages: [
          { id: "m-1", from: "5491100000001", type: "text", text: { body: "hola" } },
          { id: "m-2", from: "5491100000002", type: "image" },
        ],
      }),
    ],
  });
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => item.json.providerMessageType),
    ["text", "image"],
  );
  items.forEach((item) => {
    assert.deepEqual(item.pairedItem, { item: 1 });
  });
});
test("all code nodes compile; connections and paired names resolve", () => {
  workflow.nodes
    .filter((item) => item.type === "n8n-nodes-base.code")
    .forEach((item) => {
      assert.doesNotThrow(() => new Function(item.parameters.jsCode), item.name);
    });
  Object.entries(workflow.connections).forEach(([name, outputs]) => {
    assert.ok(node(name));
    Object.values(outputs)
      .flat(2)
      .forEach((edge) => {
        assert.ok(node(edge.node), edge.node);
      });
  });
});
