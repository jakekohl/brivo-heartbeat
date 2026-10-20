import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTestMessage } from "../src/mail.js";

describe("buildTestMessage", () => {
  it("describes a configuration test rather than a panel outage", () => {
    const message = buildTestMessage();
    assert.equal(message.subject, "Brivo heartbeat email test");
    assert.match(message.text, /SMTP is configured/);
  });
});
