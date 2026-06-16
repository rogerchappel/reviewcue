import test from "node:test";
import assert from "node:assert/strict";
import { buildPacket, renderPacket } from "../src/packet.js";

const diff = [
  "diff --git a/src/tool.ts b/src/tool.ts",
  "--- a/src/tool.ts",
  "+++ b/src/tool.ts",
  "@@ -1 +1,3 @@",
  " export function run() {}",
  "+const API_KEY = 'example';",
  "+exec('rm -rf /tmp/demo');",
  "diff --git a/package-lock.json b/package-lock.json",
  "--- a/package-lock.json",
  "+++ b/package-lock.json",
  "@@ -1 +1 @@",
  "-{}",
  "+{\"lockfileVersion\":3}",
  ""
].join("\n");

test("builds review packets with deterministic cues", () => {
  const packet = buildPacket({
    cwd: process.cwd(),
    base: "main",
    staged: false,
    diffText: diff,
    trackedFiles: ["src/tool.test.ts", "README.md", "package.json"],
    generatedAt: "2026-06-16T02:05:00.000Z"
  });

  assert.equal(packet.summary.filesChanged, 2);
  assert.equal(packet.related.tests[0], "src/tool.test.ts");
  assert.ok(packet.cues.some((cue) => cue.id === "secret-looking-addition"));
  assert.ok(packet.cues.some((cue) => cue.id === "risky-shell-command"));
  assert.ok(packet.cues.some((cue) => cue.id === "dependency-lockfile"));
});

test("renders markdown packets for agent handoff", () => {
  const packet = buildPacket({
    cwd: process.cwd(),
    base: "main",
    staged: true,
    diffText: diff,
    trackedFiles: [],
    generatedAt: "2026-06-16T02:05:00.000Z"
  });

  const markdown = renderPacket(packet, "markdown");
  assert.match(markdown, /# Review Packet:/);
  assert.match(markdown, /Secret-looking token added/);
  assert.match(markdown, /Reviewer Questions/);
});
