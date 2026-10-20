import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchAccessToken, listControlPanels } from "../src/brivo.js";

const config = {
  authBase: "https://auth.brivo.com",
  apiBase: "https://api.brivo.com/v1/api",
  apiKey: "key",
  clientId: "client",
  clientSecret: "secret",
  username: "ada@example.com",
  password: "p@ss word",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchAccessToken", () => {
  it("posts a password grant and returns the access token", async () => {
    let seen;
    const token = await fetchAccessToken(config, async (url, options) => {
      seen = { url, options };
      return jsonResponse({ access_token: "token-1", expires_in: 300 });
    });

    assert.equal(token, "token-1");
    assert.equal(seen.url, "https://auth.brivo.com/oauth/token");
    assert.equal(seen.options.headers["api-key"], "key");
    assert.equal(
      seen.options.headers.Authorization,
      `Basic ${Buffer.from("client:secret").toString("base64")}`,
    );
    const body = seen.options.body;
    assert.equal(body.get("grant_type"), "password");
    assert.equal(body.get("username"), "ada@example.com");
    assert.equal(body.get("password"), "p@ss word");
  });

  it("raises the Brivo error message on failure", async () => {
    await assert.rejects(
      () =>
        fetchAccessToken(config, async () =>
          jsonResponse({ error_description: "bad credentials" }, 400),
        ),
      /Brivo auth failed \(400\): bad credentials/,
    );
  });
});

describe("listControlPanels", () => {
  it("pages until the panel list is complete", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
    const pages = [
      { data: firstPage, count: 101 },
      { data: [{ id: 101 }], count: 101 },
    ];
    const offsets = [];
    const panels = await listControlPanels(config, "token-1", async (url, options) => {
      offsets.push(url.searchParams.get("offset"));
      assert.equal(options.headers.Authorization, "bearer token-1");
      assert.equal(options.headers["api-key"], "key");
      return jsonResponse(pages.shift());
    });

    assert.deepEqual(offsets, ["0", "100"]);
    assert.equal(panels.length, 101);
    assert.equal(panels.at(-1).id, 101);
  });
});
