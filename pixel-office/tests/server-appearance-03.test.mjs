import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPEARANCE_CATEGORIES,
  APPEARANCE_VERSION,
  makeAppearance,
} from "../server/appearance.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

test("v3 appearance has exactly three stable 0..8 module indices", () => {
  assert.equal(APPEARANCE_VERSION, 3);
  assert.deepEqual([...APPEARANCE_CATEGORIES], ["head", "upper", "lower"]);
  const first = makeAppearance("session-a", "thread-a", 4);
  const refreshed = makeAppearance("session-a", "thread-a", 4);
  assert.deepEqual(first, refreshed);
  assert.deepEqual(Object.keys(first), ["head", "upper", "lower"]);
  assert.ok(Object.values(first).every(value => Number.isInteger(value) && value >= 0 && value <= 8));
});

test("v3 seed namespace and generation are part of every module hash", () => {
  const actual = makeAppearance("session-a", "thread-a", 4);
  const expected = Object.fromEntries(APPEARANCE_CATEGORIES.map(category => {
    const digest = createHash("sha256")
      .update(`appearance-v3|session-a|thread-a|4|${category}`).digest();
    return [category, digest.readUInt32BE(0) % 9];
  }));
  assert.deepEqual(actual, expected);
  assert.notDeepEqual(makeAppearance("session-a", "thread-a", 5), actual);
  assert.notDeepEqual(makeAppearance("session-a", "thread-b", 4), actual);
});

test("server terminal facts stay sticky until a newer work round begins", () => {
  const source = fs.readFileSync(path.join(HERE, "..", "server", "server.mjs"), "utf8");
  assert.match(source, /function onAgentComplete[\s\S]*?if \(!a \|\| isTerminalAgent\(a\)\) return;/);
  assert.match(source, /function onAgentFailed[\s\S]*?if \(!a \|\| isTerminalAgent\(a\)\) return;/);
  assert.match(source, /function beginWork[\s\S]*?a\.terminalAt = null;[\s\S]*?a\.leaveAt = null;/);
});
