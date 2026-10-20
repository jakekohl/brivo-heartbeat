import { loadConfig, loadEnvFile } from "./config.js";
import { buildTestMessage, createTransport } from "./mail.js";
import { log } from "./run.js";

loadEnvFile();

try {
  const config = loadConfig(process.env, { brivo: false });
  const transport = createTransport(config);
  await transport.verify();
  const message = buildTestMessage();
  await transport.sendMail({
    from: config.alertFrom,
    to: config.alertTo,
    subject: message.subject,
    text: message.text,
  });
  log(`Sent a test email to ${config.alertTo}`);
} catch (error) {
  log(`Email test failed: ${error.message}`);
  process.exitCode = 1;
}
