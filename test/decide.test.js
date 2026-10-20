import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAlertResult,
  isPanelDown,
  nextObservation,
  selectPanels,
} from "../src/decide.js";

const NOW = Date.parse("2026-10-20T00:00:00Z");
const FIVE_MINUTES = 5 * 60 * 1000;

function panel(overrides) {
  return {
    id: 271622,
    panelName: "Front door",
    serialNumber: "CP7946804",
    status: "CONNECTED",
    lastContact: "2026-10-19T23:58:00Z",
    ...overrides,
  };
}

describe("isPanelDown", () => {
  it("treats a fresh CONNECTED panel as up", () => {
    const result = isPanelDown(panel(), NOW, FIVE_MINUTES);
    assert.equal(result.down, false);
  });

  it("accepts a lowercase connected status", () => {
    const result = isPanelDown(panel({ status: "connected" }), NOW, FIVE_MINUTES);
    assert.equal(result.down, false);
  });

  it("treats any non-connected status as down", () => {
    const result = isPanelDown(panel({ status: "DISCONNECTED" }), NOW, FIVE_MINUTES);
    assert.equal(result.down, true);
    assert.match(result.reason, /DISCONNECTED/);
  });

  it("treats a missing status as down", () => {
    const result = isPanelDown(panel({ status: undefined }), NOW, FIVE_MINUTES);
    assert.equal(result.down, true);
  });

  it("treats a missing last contact as down even when connected", () => {
    const result = isPanelDown(panel({ lastContact: undefined }), NOW, FIVE_MINUTES);
    assert.equal(result.down, true);
    assert.match(result.reason, /missing/);
  });

  it("treats an invalid last contact as down", () => {
    const result = isPanelDown(panel({ lastContact: "not-a-date" }), NOW, FIVE_MINUTES);
    assert.equal(result.down, true);
  });

  it("keeps a connected panel up when last contact is only a few minutes old", () => {
    const result = isPanelDown(
      panel({ lastContact: "2026-10-19T23:54:00Z" }),
      NOW,
      30 * 60 * 1000,
    );
    assert.equal(result.down, false);
  });

  it("treats last contact older than the threshold as down", () => {
    const result = isPanelDown(
      panel({ lastContact: "2026-10-19T23:50:00Z" }),
      NOW,
      FIVE_MINUTES,
    );
    assert.equal(result.down, true);
    assert.match(result.reason, /10 minutes old/);
  });

  it("keeps a panel up when last contact is exactly the threshold", () => {
    const result = isPanelDown(
      panel({ lastContact: new Date(NOW - FIVE_MINUTES).toISOString() }),
      NOW,
      FIVE_MINUTES,
    );
    assert.equal(result.down, false);
  });
});

describe("nextObservation", () => {
  it("does not alert on the first down check", () => {
    const result = nextObservation(undefined, true);
    assert.equal(result.action, null);
    assert.deepEqual(result.state, { consecutiveDown: 1, alerted: false });
  });

  it("alerts on the second consecutive down check", () => {
    const result = nextObservation({ consecutiveDown: 1, alerted: false }, true);
    assert.equal(result.action, "down");
    assert.equal(result.state.consecutiveDown, 2);
    assert.equal(result.state.alerted, false);
  });

  it("does not alert again while the panel stays down", () => {
    const result = nextObservation({ consecutiveDown: 2, alerted: true }, true);
    assert.equal(result.action, null);
    assert.equal(result.state.alerted, true);
    assert.equal(result.state.consecutiveDown, 3);
  });

  it("asks for a recovery email on the first healthy check after an alert", () => {
    const result = nextObservation({ consecutiveDown: 3, alerted: true }, false);
    assert.equal(result.action, "recovery");
    assert.deepEqual(result.state, { consecutiveDown: 0, alerted: true });
  });

  it("stays quiet when a single down check recovers before the streak", () => {
    const first = nextObservation(undefined, true);
    const second = nextObservation(first.state, false);
    assert.equal(second.action, null);
    assert.deepEqual(second.state, { consecutiveDown: 0, alerted: false });
  });

  it("stays quiet across healthy checks", () => {
    const result = nextObservation({ consecutiveDown: 0, alerted: false }, false);
    assert.equal(result.action, null);
  });
});

describe("applyAlertResult", () => {
  const pending = { consecutiveDown: 2, alerted: false };

  it("marks the panel alerted only after the down email is sent", () => {
    assert.equal(applyAlertResult(pending, "down", false).alerted, false);
    assert.equal(applyAlertResult(pending, "down", true).alerted, true);
  });

  it("clears the alert only after the recovery email is sent", () => {
    const alerted = { consecutiveDown: 0, alerted: true };
    assert.equal(applyAlertResult(alerted, "recovery", false).alerted, true);
    assert.equal(applyAlertResult(alerted, "recovery", true).alerted, false);
  });
});

describe("selectPanels", () => {
  const panels = [panel(), panel({ id: 9, panelName: "Back door" })];

  it("returns every panel when no ids are configured", () => {
    assert.equal(selectPanels(panels, []).length, 2);
  });

  it("limits the watch list to the requested ids", () => {
    const selected = selectPanels(panels, ["9"]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].panelName, "Back door");
  });

  it("substitutes a missing panel so the streak can go down", () => {
    const selected = selectPanels(panels, ["404"]);
    assert.equal(selected[0].status, "MISSING");
    assert.equal(isPanelDown(selected[0], NOW, FIVE_MINUTES).down, true);
  });
});
