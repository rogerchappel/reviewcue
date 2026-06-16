#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { parseDiff } from "./diff.js";
import { parseArgs, readBooleanFlag, readFormat, readStringFlag } from "./args.js";
import { collectDiff, listTrackedFiles, resolveRepoPath } from "./git.js";
import { buildPacket, renderPacket } from "./packet.js";

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const command = args.command;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(help());
    return 0;
  }

  if (command === "diff") {
    const [file] = args.positionals;
    if (!file) {
      process.stderr.write("reviewcue: expected diff <patch.diff>\n");
      return 2;
    }
    const parsed = parseDiff(await readFile(file, "utf8"));
    process.stdout.write(`${JSON.stringify({ files: parsed }, null, 2)}\n`);
    return 0;
  }

  if (command === "pack") {
    const cwd = resolveRepoPath(readStringFlag(args, "cwd", process.cwd()) ?? process.cwd());
    const format = readFormat(args, "markdown");
    const packet = buildPacket({
      cwd,
      base: readStringFlag(args, "base", "main") ?? "main",
      staged: readBooleanFlag(args, "staged")
    });
    const output = renderPacket(packet, format);
    const outPath = readStringFlag(args, "out");
    if (outPath) await writeFile(outPath, output);
    else process.stdout.write(output);
    return 0;
  }

  if (command === "cues") {
    const cwd = resolveRepoPath(readStringFlag(args, "cwd", process.cwd()) ?? process.cwd());
    const packet = buildPacket({
      cwd,
      base: readStringFlag(args, "base", "main") ?? "main",
      staged: readBooleanFlag(args, "staged")
    });
    process.stdout.write(`${JSON.stringify({ cues: packet.cues, questions: packet.questions }, null, 2)}\n`);
    return packet.cues.some((cue) => cue.severity === "critical") ? 1 : 0;
  }

  if (command === "inspect") {
    const [target = process.cwd()] = args.positionals;
    const cwd = resolveRepoPath(target);
    const diffText = collectDiff({
      cwd,
      base: readStringFlag(args, "base", "main") ?? "main",
      staged: readBooleanFlag(args, "staged")
    });
    const files = parseDiff(diffText);
    process.stdout.write(`${JSON.stringify({ repository: cwd, files, trackedFiles: listTrackedFiles(cwd).length }, null, 2)}\n`);
    return 0;
  }

  if (command !== "diff") {
    process.stderr.write("reviewcue: expected diff <patch.diff>\n");
    return 2;
  }
}

function help(): string {
  return `reviewcue\n\nUsage:\n  reviewcue diff <patch.diff>\n  reviewcue pack [--base main] [--staged] [--format markdown|json] [--out review.md] [--cwd repo]\n  reviewcue cues [--base main] [--staged] [--cwd repo]\n  reviewcue inspect [repo] [--base main] [--staged]\n`;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  process.stderr.write(`reviewcue: ${error.message}\n`);
  process.exitCode = 1;
});
