import { loadConfig, loadEnvFile } from "./config.js";
import { log, runCheck } from "./run.js";

loadEnvFile();

let config;
try {
  config = loadConfig();
} catch (error) {
  log(`Check failed: ${error.message}`);
  process.exit(1);
}

let running = false;

async function tick() {
  if (running) {
    log("Previous check still running; skipping this interval");
    return;
  }
  running = true;
  try {
    await runCheck();
  } catch (error) {
    log(`Check failed: ${error.message}`);
  } finally {
    running = false;
  }
}

log(`Watching Brivo panels every ${config.checkIntervalMs / 60000} minutes`);
await tick();
setInterval(tick, config.checkIntervalMs);
