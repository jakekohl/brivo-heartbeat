import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const required = {
    BRIVO_CLIENT_ID: "client",
    BRIVO_CLIENT_SECRET: "secret",
    BRIVO_API_KEY: "key",
    BRIVO_USERNAME: "ada@example.com",
    BRIVO_PASSWORD: "secret",
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "mailer@example.com",
    SMTP_PASS: "mail-secret",
    ALERT_TO: "owner@example.com",
  };

  it("fills the defaults when only the required values are set", () => {
    const config = loadConfig(required);
    assert.equal(config.authBase, "https://auth.brivo.com");
    assert.equal(config.apiBase, "https://api.brivo.com/v1/api");
    assert.equal(config.alertFrom, "mailer@example.com");
    assert.equal(config.smtpPort, 587);
    assert.equal(config.staleAfterMs, 30 * 60 * 1000);
    assert.equal(config.checkIntervalMs, 5 * 60 * 1000);
    assert.equal(config.statePath, "state.json");
    assert.deepEqual(config.panelIds, []);
  });

  it("keeps the poll interval and last-contact limit separate", () => {
    const config = loadConfig({
      ...required,
      POLL_INTERVAL_MINUTES: "2",
      LAST_CONTACT_MAX_MINUTES: "45",
    });
    assert.equal(config.checkIntervalMs, 2 * 60 * 1000);
    assert.equal(config.staleAfterMs, 45 * 60 * 1000);
  });

  it("lets an email test run without Brivo settings", () => {
    const config = loadConfig(
      {
        SMTP_HOST: "smtp.example.com",
        SMTP_USER: "mailer@example.com",
        SMTP_PASS: "mail-secret",
        ALERT_TO: "owner@example.com",
      },
      { brivo: false },
    );
    assert.equal(config.clientId, "");
    assert.equal(config.alertTo, "owner@example.com");
    assert.equal(config.alertFrom, "mailer@example.com");
  });

  it("lets a manual check run without email settings", () => {
    const config = loadConfig(
      {
        BRIVO_CLIENT_ID: "client",
        BRIVO_CLIENT_SECRET: "secret",
        BRIVO_API_KEY: "key",
        BRIVO_USERNAME: "ada@example.com",
        BRIVO_PASSWORD: "secret",
      },
      { email: false },
    );
    assert.equal(config.email, false);
    assert.equal(config.smtpHost, "");
    assert.equal(config.alertTo, "");
  });

  it("names the Brivo values that are still required", () => {
    assert.throws(
      () => loadConfig({ BRIVO_CLIENT_ID: "client", BRIVO_CLIENT_SECRET: "secret" }),
      /BRIVO_API_KEY, BRIVO_USERNAME, BRIVO_PASSWORD/,
    );
  });
});
