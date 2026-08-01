import type { OutputFormat, ParsedArgs } from "./types.js";

const booleanFlags = new Set(["staged", "help", "version"]);

export interface ArgumentContract {
  stringFlags?: readonly string[];
  booleanFlags?: readonly string[];
  minPositionals?: number;
  maxPositionals: number;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token) {
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    const [rawName, inlineValue] = withoutPrefix.split("=", 2);
    const name = rawName ?? "";
    if (booleanFlags.has(name) && inlineValue === undefined) {
      flags.set(name, true);
      continue;
    }

    if (inlineValue !== undefined) {
      flags.set(name, inlineValue);
      continue;
    }

    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(name, true);
      continue;
    }

    flags.set(name, next);
    index += 1;
  }

  return { command, positionals, flags };
}

export function validateArgs(args: ParsedArgs, contract: ArgumentContract): string | undefined {
  const command = args.command ?? "command";
  const stringFlags = new Set(contract.stringFlags ?? []);
  const allowedFlags = new Set([...stringFlags, ...(contract.booleanFlags ?? [])]);

  for (const [name, value] of args.flags) {
    if (!allowedFlags.has(name)) {
      return `${command}: unknown option "--${name}"`;
    }
    if (stringFlags.has(name) && (typeof value !== "string" || value.length === 0)) {
      return `${command}: option "--${name}" requires a value`;
    }
    if (!stringFlags.has(name) && value !== true) {
      return `${command}: option "--${name}" does not accept a value`;
    }
  }

  if (args.positionals.length > contract.maxPositionals) {
    return `${command}: unexpected argument "${args.positionals[contract.maxPositionals]}"`;
  }
  if (args.positionals.length < (contract.minPositionals ?? 0)) {
    return command === "diff" ? "expected diff <patch.diff>" : `${command}: missing required argument`;
  }
  return undefined;
}

export function readStringFlag(args: ParsedArgs, name: string, fallback?: string): string | undefined {
  const value = args.flags.get(name);
  if (typeof value === "string") {
    return value;
  }
  return fallback;
}

export function readBooleanFlag(args: ParsedArgs, name: string): boolean {
  return args.flags.get(name) === true;
}

export function readFormat(args: ParsedArgs, fallback: OutputFormat): OutputFormat {
  const raw = readStringFlag(args, "format", fallback);
  if (raw === "markdown" || raw === "json") {
    return raw;
  }
  throw new Error(`Unsupported format "${raw}". Use markdown or json.`);
}
