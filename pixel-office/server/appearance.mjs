import { createHash } from "node:crypto";

export const APPEARANCE_VERSION = 3;
export const APPEARANCE_CATEGORIES = Object.freeze(["head", "upper", "lower"]);

export function makeAppearance(sessionId, threadId, generation) {
  const base = `appearance-v3|${sessionId}|${threadId}|${generation}`;
  return Object.fromEntries(APPEARANCE_CATEGORIES.map(category => {
    const digest = createHash("sha256").update(`${base}|${category}`).digest();
    return [category, digest.readUInt32BE(0) % 9];
  }));
}
