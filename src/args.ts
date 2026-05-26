import type { OutputFormat, ParsedArgs } from "./types.js";

const booleanFlags = new Set(["staged", "help", "version"]);

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
    if (booleanFlags.has(name)) {
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
