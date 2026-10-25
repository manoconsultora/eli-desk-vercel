import { POST } from "../../app/api/integrations/n8n/v1/messages.authorize/route";
import assert from "node:assert/strict";
import { test } from "node:test";

test("route cannot enable message access in Production or with unknown environment", async () => {
  const original = process.env.ELI_N8N_BOT_ENVIRONMENT;
  try {
    for (const value of ["prod", "production", "", "unknown"]) {
      process.env.ELI_N8N_BOT_ENVIRONMENT = value;
      const response = await POST(
        new Request("https://eli.test/api/integrations/n8n/v1/messages.authorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      );
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        apiVersion: "v1",
        capability: "messages.authorize",
        correlationId: null,
        decision: "unavailable",
      });
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    }
  } finally {
    if (original === undefined) delete process.env.ELI_N8N_BOT_ENVIRONMENT;
    else process.env.ELI_N8N_BOT_ENVIRONMENT = original;
  }
});
