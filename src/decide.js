const REQUIRED_DOWN_STREAK = 2;

export function isPanelDown(panel, nowMs, staleAfterMs) {
  const status = String(panel.status || "").toUpperCase();
  if (status !== "CONNECTED") {
    return {
      down: true,
      reason: `status is ${panel.status || "missing"}`,
    };
  }

  if (!panel.lastContact) {
    return { down: true, reason: "last contact is missing" };
  }

  const contactMs = Date.parse(panel.lastContact);
  if (Number.isNaN(contactMs)) {
    return {
      down: true,
      reason: `last contact is invalid (${panel.lastContact})`,
    };
  }

  const ageMs = nowMs - contactMs;
  if (ageMs > staleAfterMs) {
    const minutes = Math.round(ageMs / 60000);
    return {
      down: true,
      reason: `last contact is ${minutes} minutes old`,
    };
  }

  return { down: false, reason: "connected" };
}

export function nextObservation(previous, down, requiredDown = REQUIRED_DOWN_STREAK) {
  const prev = previous || { consecutiveDown: 0, alerted: false };

  if (down) {
    const consecutiveDown = prev.consecutiveDown + 1;
    const action =
      consecutiveDown >= requiredDown && !prev.alerted ? "down" : null;
    return {
      action,
      state: { consecutiveDown, alerted: prev.alerted },
    };
  }

  return {
    action: prev.alerted ? "recovery" : null,
    state: { consecutiveDown: 0, alerted: prev.alerted },
  };
}

export function applyAlertResult(state, action, sent) {
  if (!action || !sent) {
    return state;
  }
  if (action === "down") {
    return { ...state, alerted: true };
  }
  if (action === "recovery") {
    return { ...state, alerted: false };
  }
  return state;
}

export function selectPanels(panels, ids) {
  if (!ids || ids.length === 0) {
    return panels;
  }

  const byId = new Map(panels.map((panel) => [String(panel.id), panel]));
  return ids.map((id) => {
    const panel = byId.get(String(id));
    if (panel) {
      return panel;
    }
    return {
      id,
      panelName: `Panel ${id}`,
      serialNumber: null,
      status: "MISSING",
      lastContact: null,
    };
  });
}
