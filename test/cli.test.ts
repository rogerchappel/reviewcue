import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function rejectsWithUsage(args: string[], message: RegExp) {
  await assert.rejects(
    execFileAsync(process.execPath, ["dist/src/cli.js", ...args]),
    (error: unknown) => {
      assert.equal((error as { code?: number }).code, 2);
      assert.match((error as { stderr?: string }).stderr ?? "", message);
      return true;
    },
  );
}

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
  await rejectsWithUsage(["diff"], /expected diff/);
});

test("CLI rejects unknown options", async () => {
  await rejectsWithUsage(["diff", "fixtures/basic.diff", "--bogus"], /diff: unknown option "--bogus"/);
});

test("CLI rejects missing string option values", async () => {
  await rejectsWithUsage(["diff", "fixtures/basic.diff", "--format"], /diff: unknown option "--format"/);
  await rejectsWithUsage(["pack", "--staged", "--out"], /pack: option "--out" requires a value/);
});

test("CLI rejects extra positional arguments", async () => {
  await rejectsWithUsage(["diff", "fixtures/basic.diff", "unexpected"], /diff: unexpected argument "unexpected"/);
  await rejectsWithUsage(["pack", "unexpected"], /pack: unexpected argument "unexpected"/);
  await rejectsWithUsage(["cues", "unexpected"], /cues: unexpected argument "unexpected"/);
  await rejectsWithUsage(["inspect", ".", "unexpected"], /inspect: unexpected argument "unexpected"/);
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

test("CLI creates missing parent directories for nested output", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reviewcue-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, "nested", "review.md");

  await execFileAsync(process.execPath, [
    "dist/src/cli.js",
    "pack",
    "--staged",
    "--out",
    output,
  ]);

  assert.match(await readFile(output, "utf8"), /# Review Packet:/);
});

test("CLI writes output in an existing directory", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reviewcue-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, "review.md");

  await execFileAsync(process.execPath, ["dist/src/cli.js", "pack", "--staged", "--out", output]);

  assert.match(await readFile(output, "utf8"), /# Review Packet:/);
});

test("CLI accepts valid diff, pack, cues, and inspect invocations", async () => {
  const diff = await execFileAsync(process.execPath, ["dist/src/cli.js", "diff", "fixtures/basic.diff"]);
  const pack = await execFileAsync(process.execPath, ["dist/src/cli.js", "pack", "--staged", "--format=json"]);
  const cues = await execFileAsync(process.execPath, ["dist/src/cli.js", "cues", "--staged", "--base=main"]);
  const inspect = await execFileAsync(process.execPath, ["dist/src/cli.js", "inspect", ".", "--staged"]);

  assert.equal(JSON.parse(diff.stdout).files.length, 1);
  assert.equal(JSON.parse(pack.stdout).summary.filesChanged, 0);
  assert.ok(Array.isArray(JSON.parse(cues.stdout).cues));
  assert.equal(JSON.parse(inspect.stdout).repository, process.cwd());
});
