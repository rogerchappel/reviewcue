import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { listTrackedFiles } from "../src/git.js";

const execFileAsync = promisify(execFile);

test("lists tracked filenames without rewriting legal path characters", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reviewcue-git-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await execFileAsync("git", ["init", "-q"], { cwd: directory });

  const names = [
    " leading-and-trailing-space ",
    "line\nbreak.ts",
    'double"quote.ts',
    "back\\slash.ts",
  ];
  for (const name of names) await writeFile(join(directory, name), "fixture\n");
  await execFileAsync("git", ["add", "--", ...names], { cwd: directory });

  assert.deepEqual(listTrackedFiles(directory).sort(), names.sort());
});
