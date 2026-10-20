import { loadEnvFile } from "./config.js";
import { log, runCheck } from "./run.js";

loadEnvFile();

try {
  process.exitCode = await runCheck({ email: false });
} catch (error) {
  log(`Check failed: ${error.message}`);
  process.exitCode = 1;
}
