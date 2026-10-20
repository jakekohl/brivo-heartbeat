import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { runCheck } from "../src/run.js";

const NOW = Date.parse("2026-10-20T00:00:00Z");

function env(statePath) {
  return {
    BRIVO_REGION: "us",
    BRIVO_API_KEY: "key",
    BRIVO_CLIENT_ID: "client",
    BRIVO_CLIENT_SECRET: "secret",
    BRIVO_USERNAME: "ada@example.com",
    BRIVO_PASSWORD: "secret",
    BRIVO_PANEL_IDS: "7",
    LAST_CONTACT_MAX_MINUTES: "5",
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "mailer@example.com",
    SMTP_PASS: "mail-secret",
    ALERT_TO: "owner@example.com",
    STATE_PATH: statePath,
  };
}

function fetchImpl(panel) {
  return async (url) => {
    const href = String(url);
    if (href.endsWith("/oauth/token")) {
      return Response.json({ access_token: "token-1" });
    }
    return Response.json({
      offset: 0,
      pageSize: 100,
      count: 1,
      data: [panel],
    });
  };
}

describe("runCheck", () => {
  let directory;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), "brivo-heartbeat-"));
  });

  after(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("emails once when a panel stays down, then once when it recovers", async () => {
    const statePath = join(directory, "state.json");
    const sent = [];
    const transport = {
      async sendMail(message) {
        sent.push(message.subject);
      },
    };
    const down = {
      id: 7,
      panelName: "Front door",
      serialNumber: "CP1",
      status: "DISCONNECTED",
      lastContact: "2026-10-19T23:00:00Z",
    };
    const up = { ...down, status: "CONNECTED", lastContact: "2026-10-19T23:59:00Z" };

    await runCheck({
      env: env(statePath),
      fetchImpl: fetchImpl(down),
      transport,
      now: () => NOW,
    });
    assert.deepEqual(sent, []);

    await runCheck({
      env: env(statePath),
      fetchImpl: fetchImpl(down),
      transport,
      now: () => NOW,
    });
    assert.deepEqual(sent, ["Brivo panel offline: Front door"]);

    await runCheck({
      env: env(statePath),
      fetchImpl: fetchImpl(down),
      transport,
      now: () => NOW,
    });
    assert.equal(sent.length, 1);

    await runCheck({
      env: env(statePath),
      fetchImpl: fetchImpl(up),
      transport,
      now: () => NOW,
    });
    assert.deepEqual(sent, [
      "Brivo panel offline: Front door",
      "Brivo panel online: Front door",
    ]);

    const saved = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(saved.panels["7"].alerted, false);
    assert.equal(saved.panels["7"].consecutiveDown, 0);
  });

  it("keeps the panel unalerted when the down email fails", async () => {
    const statePath = join(directory, "failed.json");
    const transport = {
      async sendMail() {
        throw new Error("smtp down");
      },
    };
    const down = {
      id: 7,
      panelName: "Front door",
      status: "DISCONNECTED",
      lastContact: null,
    };
    const options = {
      env: env(statePath),
      fetchImpl: fetchImpl(down),
      transport,
      now: () => NOW,
    };

    await runCheck(options);
    await runCheck(options);

    const saved = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(saved.panels["7"].alerted, false);
    assert.equal(saved.panels["7"].consecutiveDown, 2);
  });

  it("reports a down panel without email settings", async () => {
    const statePath = join(directory, "manual.json");
    const brivoOnly = env(statePath);
    delete brivoOnly.SMTP_HOST;
    delete brivoOnly.SMTP_USER;
    delete brivoOnly.SMTP_PASS;
    delete brivoOnly.ALERT_TO;
    let mailed = false;
    await runCheck({
      env: brivoOnly,
      email: false,
      fetchImpl: fetchImpl({
        id: 7,
        panelName: "Front door",
        status: "DISCONNECTED",
        lastContact: null,
      }),
      transport: {
        async sendMail() {
          mailed = true;
        },
      },
      now: () => NOW,
    });
    await runCheck({
      env: brivoOnly,
      email: false,
      fetchImpl: fetchImpl({
        id: 7,
        panelName: "Front door",
        status: "DISCONNECTED",
        lastContact: null,
      }),
      transport: {
        async sendMail() {
          mailed = true;
        },
      },
      now: () => NOW,
    });

    assert.equal(mailed, false);
    const saved = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(saved.panels["7"].alerted, false);
    assert.equal(saved.panels["7"].consecutiveDown, 2);
  });
});
