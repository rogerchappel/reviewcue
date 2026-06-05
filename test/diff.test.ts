import test from "node:test";
import assert from "node:assert/strict";
import { parseDiff } from "../src/diff.js";

test("parses added lines from a unified diff", () => {
  const [file] = parseDiff("diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1,2 @@\n one\n+two\n");
  assert.equal(file?.path, "a.txt");
  assert.equal(file?.additions, 1);
});
