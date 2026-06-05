#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseDiff } from "./diff.js";

async function main(argv = process.argv.slice(2)) {
  const [command, file] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write("reviewcue\n\nUsage:\n  reviewcue diff <patch.diff>\n");
    return 0;
  }
  if (command !== "diff" || !file) {
    process.stderr.write("reviewcue: expected diff <patch.diff>\n");
    return 2;
  }
  const parsed = parseDiff(await readFile(file, "utf8"));
  process.stdout.write(`${JSON.stringify({ files: parsed }, null, 2)}\n`);
  return 0;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  process.stderr.write(`reviewcue: ${error.message}\n`);
  process.exitCode = 1;
});
