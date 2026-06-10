import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("CLI help describes the diff command", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["dist/src/cli.js", "--help"]);

  assert.match(stdout, /reviewcue diff <patch\.diff>/);
});

test("CLI parses the maintained diff fixture", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["dist/src/cli.js", "diff", "fixtures/basic.diff"]);
  const parsed = JSON.parse(stdout) as { files: Array<{ path: string; additions: number; deletions: number }> };

  assert.equal(parsed.files.length, 1);
  assert.equal(parsed.files[0].path, "README.md");
  assert.equal(parsed.files[0].additions, 1);
  assert.equal(parsed.files[0].deletions, 0);
});

test("CLI rejects incomplete diff commands", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ["dist/src/cli.js", "diff"]),
    (error: unknown) => {
      assert.equal((error as { code?: number }).code, 2);
      assert.match((error as { stderr?: string }).stderr ?? "", /expected diff/);
      return true;
    },
  );
});
