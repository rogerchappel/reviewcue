import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDiff } from "../src/diff.js";

test("parses added lines from a unified diff", () => {
  const [file] = parseDiff("diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1,2 @@\n one\n+two\n");
  assert.equal(file?.path, "a.txt");
  assert.equal(file?.additions, 1);
});


test("parses renamed files and tracks the old path", () => {
  const [file] = parseDiff([
    "diff --git a/old.txt b/new.txt",
    "similarity index 100%",
    "rename from old.txt",
    "rename to new.txt",
    ""
  ].join("\n"));

  assert.equal(file?.status, "renamed");
  assert.equal(file?.oldPath, "old.txt");
  assert.equal(file?.path, "new.txt");
});

test("marks binary patches without counting text additions", () => {
  const [file] = parseDiff([
    "diff --git a/logo.png b/logo.png",
    "Binary files a/logo.png and b/logo.png differ",
    ""
  ].join("\n"));

  assert.equal(file?.isBinary, true);
  assert.equal(file?.additions, 0);
  assert.equal(file?.deletions, 0);
});

test("decodes quoted paths for every supported change status", async () => {
  const diff = await readFile("fixtures/quoted-paths.diff", "utf8");
  const files = parseDiff(diff);

  assert.deepEqual(
    files.map(({ path, oldPath, status, additions, deletions }) => ({
      path,
      oldPath,
      status,
      additions,
      deletions
    })),
    [
      {
        path: "docs/my file.md",
        oldPath: undefined,
        status: "modified",
        additions: 1,
        deletions: 1
      },
      {
        path: "docs/new name.txt",
        oldPath: "docs/old name.txt",
        status: "renamed",
        additions: 0,
        deletions: 0
      },
      {
        path: "data/copy\tname.txt",
        oldPath: "data/source\tname.txt",
        status: "copied",
        additions: 0,
        deletions: 0
      },
      {
        path: "notes/new file.txt",
        oldPath: undefined,
        status: "added",
        additions: 1,
        deletions: 0
      },
      {
        path: "old/deleted file.txt",
        oldPath: undefined,
        status: "deleted",
        additions: 0,
        deletions: 1
      }
    ]
  );
});
