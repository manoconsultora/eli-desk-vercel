import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const original = JSON.parse(await readFile(join(directory, ".private/v3-original.json"), "utf8"));
const baseline = structuredClone(original);
// A shareable baseline has no live credential bindings, webhook verification
// logic or execution/pinned data. The complete originals stay private, 0600.
baseline.nodes = baseline.nodes.map(function sanitize(node) {
  const clean = structuredClone(node);
  if (clean.credentials) {
    clean.credentials = Object.fromEntries(
      Object.keys(clean.credentials).map((kind) => [kind, { id: `REVIEW_BIND_${kind}`, name: `REVIEW_BIND_${kind}` }]),
    );
  }
  if (clean.name === "Code in JavaScript1") {
    clean.parameters.jsCode = 'throw new Error("review_meta_verification_requires_private_original");';
  }
  if (clean.name === "WhatsApp — Normalizar entrada") {
    clean.parameters.jsCode = clean.parameters.jsCode.replace(
      /const phoneNumberId = '[^']+';/,
      "const phoneNumberId = 'REVIEW_PHONE_NUMBER_ID';",
    );
  }
  return clean;
});
await writeFile(join(directory, "v3-baseline.sanitized.json"), `${JSON.stringify(baseline, null, 2)}\n`);
const draft = structuredClone(baseline);
draft.name = "ELI BOT V3 — WHATSAPP BLACKLIST — REVIEW ONLY";
draft.active = false;
draft.meta = {
  ...draft.meta,
  reviewOnly: true,
  pendingServerEndpoint: false,
  serverEndpointImplemented: true,
  deploymentPending: true,
};
draft.nodes = draft.nodes.map(function isolate(node) {
  if (node.type.endsWith("Trigger") || node.type === "n8n-nodes-base.webhook") node.disabled = true;
  if (node.type === "n8n-nodes-base.webhook") {
    node.parameters.path = `review-blacklist-${node.id}`;
    node.webhookId = randomUUID();
  }
  if (node.name === "WhatsApp — Normalizar entrada") {
    node.parameters.jsCode = node.parameters.jsCode
      .replace("if (incoming.type !== 'text') continue;", "// All incoming message types pass the access check first.")
      .replace(
        "const text = incoming.text?.body?.trim();",
        "const text = incoming.type === 'text' ? incoming.text?.body?.trim() : null;",
      )
      .replace(
        "if (!text || !senderId || !messageId) continue;",
        "if (!senderId || !messageId || !incoming.type) continue;",
      )
      .replace("inputValid: true,", "inputValid: Boolean(text),\n            providerMessageType: incoming.type,");
  }
  return node;
});
function nodeByName(name) {
  const node = draft.nodes.find((item) => item.name === name);
  if (!node) throw new Error(`missing_node:${name}`);
  return node;
}
function connect(from, to) {
  draft.connections[from] = { main: [[{ node: to, type: "main", index: 0 }]] };
}
function addCode(name, code, position) {
  draft.nodes.push({
    name,
    id: randomUUID(),
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: { mode: "runOnceForEachItem", jsCode: code },
  });
}
addCode("BL — Preparar consulta", await readFile(join(directory, "prepare-check.js.txt"), "utf8"), [1100, -1450]);
const signNames = [
  "SEC-01 Generate Nonce Material",
  "SEC-01 Generate Request ID",
  "SEC-01 Set Public Metadata",
  "SEC-01 Hash Raw Body",
  "SEC-01 Build Canonical Input",
  "SEC-01 HMAC SHA256",
  "SEC-01 Assemble Signed Request",
];
const clonedNames = signNames.map(function cloneSigner(name, index) {
  const clone = structuredClone(nodeByName(name));
  clone.id = randomUUID();
  clone.name = `BL — ${name}`;
  clone.position = [1300 + index * 200, -1450];
  clone.onError = "continueRegularOutput";
  draft.nodes.push(clone);
  return clone.name;
});
const config = structuredClone(nodeByName("ELI: DEV Config"));
config.id = randomUUID();
config.name = "BL — DEV Config";
config.position = [2700, -1450];
draft.nodes.push(config);
const request = structuredClone(nodeByName("API-01 tickets.create"));
request.id = randomUUID();
request.name = "BL — Consultar acceso DEV";
request.position = [2900, -1450];
request.notes =
  "LOCAL REVIEW ONLY: messages.authorize is implemented in this worktree and NOT deployed. Requires a separately reviewed DEV deployment. Never route this to tickets.create.";
request.onError = "continueRegularOutput";
request.parameters.options = { ...request.parameters.options, timeout: 10000 };
draft.nodes.push(request);
addCode("BL — Evaluar resultado", await readFile(join(directory, "evaluate-check.js.txt"), "utf8"), [3100, -1450]);
const branch = structuredClone(nodeByName("Dispatch tickets.create?"));
branch.id = randomUUID();
branch.name = "BL — Mensaje habilitado?";
branch.position = [3300, -1450];
branch.parameters.conditions.conditions = [
  {
    id: randomUUID(),
    leftValue: "={{ $json.accessAllowed }}",
    rightValue: true,
    operator: { type: "boolean", operation: "true", singleValue: true },
  },
];
draft.nodes.push(branch);
const chain = [
  "WhatsApp — Normalizar entrada",
  "BL — Preparar consulta",
  ...clonedNames,
  config.name,
  request.name,
  "BL — Evaluar resultado",
  branch.name,
];
chain.slice(0, -1).forEach((name, index) => {
  connect(name, chain[index + 1]);
});
draft.connections[branch.name] = {
  main: [
    [{ node: "ELI — Entrada común", type: "main", index: 0 }],
    [{ node: "Send Whatsapp", type: "main", index: 0 }],
  ],
};
draft.nodes.push({
  id: randomUUID(),
  name: "BL — Review warning",
  type: "n8n-nodes-base.stickyNote",
  typeVersion: 1,
  position: [1100, -1770],
  parameters: {
    width: 900,
    height: 220,
    content:
      "## REVIEW ONLY — INACTIVE\nServer precheck messages.authorize is implemented locally, NOT deployed.\nTriggers disabled; credential bindings and Meta phone ID require private DEV review.\nNo Desk/Join/DB changes, no deployment or workflow publication authorized.\nBlocked/unavailable messages never reach classification or tickets.create.",
  },
});
await writeFile(join(directory, "v3-blacklist.draft.json"), `${JSON.stringify(draft, null, 2)}\n`);
await writeFile(
  join(directory, "baseline.sha256"),
  `${createHash("sha256").update(JSON.stringify(original)).digest("hex")}  private-v3-export\n`,
);
console.log(
  JSON.stringify({
    baselineNodes: baseline.nodes.length,
    draftNodes: draft.nodes.length,
    active: draft.active,
    sourceVersion: draft.meta.sourceVersionId,
  }),
);
