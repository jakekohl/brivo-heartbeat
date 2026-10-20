import { readFile, rename, writeFile } from "node:fs/promises";

export async function readState(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("state file must be a JSON object");
    }
    if (!parsed.panels || typeof parsed.panels !== "object") {
      parsed.panels = {};
    }
    return parsed;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { panels: {} };
    }
    throw error;
  }
}

export async function writeState(filePath, state) {
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tmpPath, filePath);
}
