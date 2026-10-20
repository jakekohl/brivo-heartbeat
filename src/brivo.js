export async function fetchAccessToken(config, fetchImpl = fetch) {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");
  const body = new URLSearchParams({
    grant_type: "password",
    username: config.username,
    password: config.password,
  });

  const response = await fetchImpl(`${config.authBase}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "api-key": config.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(
      `Brivo auth failed (${response.status}): ${errorMessage(payload)}`,
    );
  }
  if (!payload.access_token) {
    throw new Error("Brivo auth response did not include an access token");
  }
  return payload.access_token;
}

export async function listControlPanels(config, accessToken, fetchImpl = fetch) {
  const panels = [];
  const pageSize = 100;
  let offset = 0;

  for (let page = 0; page < 50; page += 1) {
    const url = new URL(`${config.apiBase}/control-panels`);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("pageSize", String(pageSize));

    const response = await fetchImpl(url, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        "api-key": config.apiKey,
        "Content-Type": "application/json",
      },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(
        `Brivo control panel list failed (${response.status}): ${errorMessage(payload)}`,
      );
    }

    const data = Array.isArray(payload.data) ? payload.data : [];
    panels.push(...data);
    offset += data.length;

    const reachedCount =
      typeof payload.count === "number" && offset >= payload.count;
    if (data.length < pageSize || reachedCount) {
      break;
    }
  }

  return panels;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function errorMessage(payload) {
  if (payload && typeof payload.message === "string") {
    return payload.message;
  }
  if (payload && typeof payload.error_description === "string") {
    return payload.error_description;
  }
  if (payload && typeof payload.error === "string") {
    return payload.error;
  }
  return "unknown error";
}
