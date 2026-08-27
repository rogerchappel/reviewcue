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

test("keeps Markdown-significant packet values inside their documented structure", () => {
  const packet = buildPacket({
    cwd: process.cwd(),
    base: "main\n## forged base",
    staged: false,
    diffText: diff,
    trackedFiles: ["docs/guide.md\n## forged context"],
    generatedAt: "2026-06-16T02:05:00.000Z"
  });
  packet.repository = "repo `name`\n## forged repository";
  packet.files[0]!.path = "src/`tool`.ts\n## forged changed file";
  packet.files[0]!.oldPath = "src/old *tool*.ts\n- forged old path";
  packet.cues = [{
    id: "fixture",
    severity: "critical",
    title: "Cue *title*\n## forged cue",
    detail: "Review [this](https://example.com)\n- forged detail",
    file: "src/`tool`.ts\n## forged cue path"
  }];
  packet.related.docs = ["docs/guide.md\n## forged related path"];
  packet.questions = ["Check `this`?\n## forged question"];

  const markdown = renderPacket(packet, "markdown");
  assert.equal((markdown.match(/^## /gm) ?? []).length, 4);
  assert.match(markdown, /^# Review Packet: ``repo `name` ## forged repository``$/m);
  assert.match(markdown, /``src\/`tool`\.ts ## forged changed file``/);
  assert.ok(markdown.includes("Cue \\*title\\*<br>\\#\\# forged cue"));
  assert.ok(markdown.includes("Review \\[this\\]\\(https://example.com\\)<br>- forged detail"));
  assert.ok(markdown.includes("Check \\`this\\`?<br>\\#\\# forged question"));

  const json = JSON.parse(renderPacket(packet, "json"));
  assert.equal(json.repository, packet.repository);
  assert.equal(json.files[0].path, packet.files[0]!.path);
  assert.equal(json.questions[0], packet.questions[0]);
});

test("includes a changed matching test and suppresses the missing-tests cue", () => {
  const sourceAndTestDiff = [
    "diff --git a/src/widget.ts b/src/widget.ts",
    "--- a/src/widget.ts",
    "+++ b/src/widget.ts",
    "@@ -1 +1 @@",
    "-export const widget = false;",
    "+export const widget = true;",
    "diff --git a/test/widget.test.ts b/test/widget.test.ts",
    "--- a/test/widget.test.ts",
    "+++ b/test/widget.test.ts",
    "@@ -1 +1 @@",
    "-assert.equal(widget, false);",
    "+assert.equal(widget, true);",
    ""
  ].join("\n");

  const packet = buildPacket({
    cwd: process.cwd(),
    base: "main",
    staged: false,
    diffText: sourceAndTestDiff,
    trackedFiles: ["src/widget.ts", "test/widget.test.ts"]
  });

  assert.deepEqual(packet.related.tests, ["test/widget.test.ts"]);
  assert.equal(packet.cues.some((cue) => cue.id === "missing-tests"), false);
});

test("keeps the missing-tests cue for source-only changes", () => {
  const sourceOnlyDiff = [
    "diff --git a/src/widget.ts b/src/widget.ts",
    "--- a/src/widget.ts",
    "+++ b/src/widget.ts",
    "@@ -1 +1 @@",
    "-export const widget = false;",
    "+export const widget = true;",
    ""
  ].join("\n");

  const packet = buildPacket({
    cwd: process.cwd(),
    base: "main",
    staged: false,
    diffText: sourceOnlyDiff,
    trackedFiles: ["src/widget.ts", "test/other.test.ts"]
  });

  assert.deepEqual(packet.related.tests, []);
  assert.equal(packet.cues.some((cue) => cue.id === "missing-tests"), true);
});
