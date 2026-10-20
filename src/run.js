import { fetchAccessToken, listControlPanels } from "./brivo.js";
import { loadConfig } from "./config.js";
import {
  applyAlertResult,
  isPanelDown,
  nextObservation,
  selectPanels,
} from "./decide.js";
import { createTransport, sendAlert } from "./mail.js";
import { readState, writeState } from "./state.js";

export function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

export async function runCheck({
  env = process.env,
  fetchImpl = fetch,
  transport,
  now = () => Date.now(),
  email = true,
} = {}) {
  const config = loadConfig(env, { email });
  const mailer = config.email ? transport || createTransport(config) : null;
  const state = await readState(config.statePath);
  const accessToken = await fetchAccessToken(config, fetchImpl);
  const listed = await listControlPanels(config, accessToken, fetchImpl);
  const panels = selectPanels(listed, config.panelIds);
  const nowMs = now();

  if (panels.length === 0) {
    log("No control panels returned for this account");
  }

  for (const panel of panels) {
    const key = String(panel.id);
    const previous = state.panels[key];
    const health = isPanelDown(panel, nowMs, config.staleAfterMs);
    const observation = nextObservation(previous, health.down);
    let next = observation.state;

    const label = panel.panelName || `Panel ${panel.id}`;
    log(
      `${label} (${key}) status=${panel.status || "missing"} lastContact=${panel.lastContact || "none"} ${health.down ? "down" : "up"} streak=${observation.state.consecutiveDown} reason=${health.reason}`,
    );

    if (observation.action && !config.email) {
      log(
        `${label} is ${observation.action}; email was not sent because this is a manual check`,
      );
    } else if (observation.action) {
      try {
        const message = await sendAlert(
          mailer,
          config,
          panel,
          observation.action,
          health.reason,
        );
        next = applyAlertResult(observation.state, observation.action, true);
        log(`Emailed ${observation.action} alert: ${message.subject}`);
      } catch (error) {
        next = applyAlertResult(observation.state, observation.action, false);
        log(
          `Failed to email ${observation.action} alert for ${label}: ${error.message}`,
        );
      }
    }

    state.panels[key] = next;
  }

  await writeState(config.statePath, state);
  return 0;
}
