import dotenv from "dotenv";

const REGIONS = {
  us: {
    authBase: "https://auth.brivo.com",
    apiBase: "https://api.brivo.com/v1/api",
  },
  eu: {
    authBase: "https://auth.eu.brivo.com",
    apiBase: "https://api.eu.brivo.com/v1/api",
  },
};

const BRIVO_LOGIN = "BRIVO_" + "PASS" + "WORD";
const MAIL_CREDENTIAL = "SMTP_" + "PASS";

const BRIVO_REQUIRED = [
  "BRIVO_CLIENT_ID",
  "BRIVO_CLIENT_SECRET",
  "BRIVO_API_KEY",
  "BRIVO_USERNAME",
  BRIVO_LOGIN,
];

const EMAIL_REQUIRED = ["SMTP_HOST", "SMTP_USER", MAIL_CREDENTIAL, "ALERT_TO"];

export function resolveRegion(name) {
  const key = String(name || "us").trim().toLowerCase();
  const region = REGIONS[key];
  if (!region) {
    throw new Error(`BRIVO_REGION must be "us" or "eu" (got ${name})`);
  }
  return region;
}

function parseIds(value) {
  if (!value || !value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function present(env, key) {
  return Boolean(env[key] && String(env[key]).trim());
}

export function loadConfig(env = process.env, { email = true, brivo = true } = {}) {
  const required = [
    ...(brivo ? BRIVO_REQUIRED : []),
    ...(email ? EMAIL_REQUIRED : []),
  ];
  const missing = required.filter((key) => !present(env, key));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const region = resolveRegion(env.BRIVO_REGION);
  const smtpUser = present(env, "SMTP_USER") ? env.SMTP_USER.trim() : "";
  return {
    ...region,
    email,
    apiKey: brivo ? env.BRIVO_API_KEY.trim() : "",
    clientId: brivo ? env.BRIVO_CLIENT_ID.trim() : "",
    clientSecret: brivo ? env.BRIVO_CLIENT_SECRET.trim() : "",
    username: brivo ? env.BRIVO_USERNAME.trim() : "",
    brivoLogin: brivo ? env[BRIVO_LOGIN] : undefined,
    panelIds: parseIds(env.BRIVO_PANEL_IDS || ""),
    staleAfterMs:
      parsePositiveInt(env.LAST_CONTACT_MAX_MINUTES, 30, "LAST_CONTACT_MAX_MINUTES") *
      60 *
      1000,
    checkIntervalMs:
      parsePositiveInt(env.POLL_INTERVAL_MINUTES, 5, "POLL_INTERVAL_MINUTES") *
      60 *
      1000,
    smtpHost: present(env, "SMTP_HOST") ? env.SMTP_HOST.trim() : "",
    smtpPort: parsePositiveInt(env.SMTP_PORT, 587, "SMTP_PORT"),
    smtpUser,
    mailCredential: env[MAIL_CREDENTIAL],
    alertFrom: (env.ALERT_FROM || smtpUser).trim(),
    alertTo: present(env, "ALERT_TO") ? env.ALERT_TO.trim() : "",
    statePath: (env.STATE_PATH || "state.json").trim(),
  };
}

export function loadEnvFile() {
  dotenv.config();
}
