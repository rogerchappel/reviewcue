import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("CLI help describes the diff command", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["dist/src/cli.js", "--help"]);

  assert.match(stdout, /reviewcue diff <patch\.diff>/);
  assert.match(stdout, /reviewcue pack/);
});

test("CLI prints the package version", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["dist/src/cli.js", "--version"]);

  assert.equal(stdout.trim(), "0.1.0");
});

test("CLI parses the maintained diff fixture", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["dist/src/cli.js", "diff", "fixtures/basic.diff"]);
  const parsed = JSON.parse(stdout) as { files: Array<{ path: string; additions: number; deletions: number }> };

  assert.equal(parsed.files.length, 1);
  const [file] = parsed.files;
  assert.ok(file);
  assert.equal(file.path, "README.md");
  assert.equal(file.additions, 1);
  assert.equal(file.deletions, 0);
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

test("CLI reports unknown commands with help", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ["dist/src/cli.js", "unknown"]),
    (error: unknown) => {
      assert.equal((error as { code?: number }).code, 2);
      assert.match((error as { stderr?: string }).stderr ?? "", /unknown command "unknown"/);
      assert.match((error as { stderr?: string }).stderr ?? "", /reviewcue diff <patch\.diff>/);
      return true;
    },
  );
});

test("CLI renders a packet from staged fixture repo changes", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "dist/src/cli.js",
    "pack",
    "--format",
    "json",
    "--staged"
  ]);
  const parsed = JSON.parse(stdout) as { summary: { filesChanged: number }; questions: string[] };

  assert.equal(parsed.summary.filesChanged, 0);
  assert.ok(parsed.questions.length > 0);
});
