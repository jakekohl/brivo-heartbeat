import nodemailer from "nodemailer";

export function createTransport(config) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

export function buildMessage(panel, action, reason) {
  const name = panel.panelName || `Panel ${panel.id}`;
  const subject =
    action === "down"
      ? `Brivo panel offline: ${name}`
      : `Brivo panel online: ${name}`;
  const summary =
    action === "down"
      ? "This panel is not connected to Brivo. Access codes created while it is offline will not sync until it reconnects."
      : "This panel is connected to Brivo again. Access codes can sync.";

  const lines = [
    summary,
    "",
    `Panel: ${name}`,
    `Id: ${panel.id}`,
    `Serial: ${panel.serialNumber || "unknown"}`,
    `Status: ${panel.status || "unknown"}`,
    `Last contact: ${panel.lastContact || "none"}`,
    `Reason: ${reason}`,
  ];

  return { subject, text: lines.join("\n") };
}

export function buildTestMessage() {
  return {
    subject: "Brivo heartbeat email test",
    text: [
      "This is a test from brivo-heartbeat.",
      "SMTP is configured, and this mailbox can receive panel alerts.",
    ].join("\n"),
  };
}

export async function sendAlert(transport, config, panel, action, reason) {
  const message = buildMessage(panel, action, reason);
  await transport.sendMail({
    from: config.alertFrom,
    to: config.alertTo,
    subject: message.subject,
    text: message.text,
  });
  return message;
}
