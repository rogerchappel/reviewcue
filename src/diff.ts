import type { ChangedFile, ChangeKind, DiffHunk, DiffLine } from "./types.js";

const hunkPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseDiff(diffText: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  let current: ChangedFile | undefined;
  let currentHunk: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;

  for (const line of diffText.split("\n")) {
    if (line.startsWith("diff --git ")) {
      current = {
        path: readDiffPath(line),
        status: "modified",
        additions: 0,
        deletions: 0,
        isBinary: false,
        hunks: []
      };
      currentHunk = undefined;
      files.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("new file mode")) {
      current.status = "added";
      continue;
    }

    if (line.startsWith("deleted file mode")) {
      current.status = "deleted";
      continue;
    }

    if (line.startsWith("rename from ")) {
      current.oldPath = readMetadataPath(line, "rename from ");
      current.status = "renamed";
      continue;
    }

    if (line.startsWith("rename to ")) {
      current.path = readMetadataPath(line, "rename to ");
      continue;
    }

    if (line.startsWith("copy from ")) {
      current.oldPath = readMetadataPath(line, "copy from ");
      current.status = "copied";
      continue;
    }

    if (line.startsWith("copy to ")) {
      current.path = readMetadataPath(line, "copy to ");
      continue;
    }

    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      current.isBinary = true;
      continue;
    }

    if (line.startsWith("@@")) {
      const match = hunkPattern.exec(line);
      if (!match) {
        continue;
      }

      currentHunk = {
        header: line,
        oldStart: Number(match[1]),
        oldLines: Number(match[2] ?? "1"),
        newStart: Number(match[3]),
        newLines: Number(match[4] ?? "1"),
        lines: []
      };
      oldLine = currentHunk.oldStart;
      newLine = currentHunk.newStart;
      current.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk || line.startsWith("\\ No newline")) {
      continue;
    }

    const parsed = parseHunkLine(line, oldLine, newLine);
    if (!parsed) {
      continue;
    }

    currentHunk.lines.push(parsed.line);
    oldLine = parsed.nextOldLine;
    newLine = parsed.nextNewLine;

    if (parsed.line.kind === "add") {
      current.additions += 1;
    }

    if (parsed.line.kind === "remove") {
      current.deletions += 1;
    }
  }

  return files;
}

function readDiffPath(line: string): string {
  const [oldPath = "", newPath = ""] = readPathTokens(
    line.slice("diff --git ".length)
  );
  const path = newPath === "/dev/null" ? oldPath : newPath;
  return stripPrefix(path, newPath === "/dev/null" ? "a/" : "b/");
}

function readMetadataPath(line: string, prefix: string): string {
  return decodeGitPath(line.slice(prefix.length));
}

function readPathTokens(value: string): string[] {
  const paths: string[] = [];
  let offset = 0;

  while (offset < value.length && paths.length < 2) {
    while (value[offset] === " ") offset += 1;
    if (offset >= value.length) break;

    if (value[offset] === '"') {
      let end = offset + 1;
      let escaped = false;
      while (end < value.length) {
        const char = value[end];
        if (char === '"' && !escaped) {
          end += 1;
          break;
        }
        escaped = char === "\\" && !escaped;
        if (char !== "\\") escaped = false;
        end += 1;
      }
      paths.push(decodeGitPath(value.slice(offset, end)));
      offset = end;
      continue;
    }

    const end = value.indexOf(" ", offset);
    paths.push(value.slice(offset, end === -1 ? value.length : end));
    offset = end === -1 ? value.length : end;
  }

  return paths;
}

function decodeGitPath(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }

  const bytes: number[] = [];
  const content = value.slice(1, -1);
  const escapes: Record<string, number> = {
    a: 7,
    b: 8,
    t: 9,
    n: 10,
    v: 11,
    f: 12,
    r: 13,
    '"': 34,
    "\\": 92
  };

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;
    if (char !== "\\") {
      const codePoint = content.codePointAt(index)!;
      bytes.push(...Buffer.from(String.fromCodePoint(codePoint)));
      if (codePoint > 0xffff) index += 1;
      continue;
    }

    const escaped = content[index + 1];
    if (escaped === undefined) {
      bytes.push(92);
      continue;
    }

    if (/[0-7]/.test(escaped)) {
      const octal = content.slice(index + 1).match(/^[0-7]{1,3}/)?.[0] ?? "";
      bytes.push(Number.parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    bytes.push(escapes[escaped] ?? escaped.charCodeAt(0));
    index += 1;
  }

  return Buffer.from(bytes).toString("utf8");
}

function parseHunkLine(
  line: string,
  oldLine: number,
  newLine: number
): { line: DiffLine; nextOldLine: number; nextNewLine: number } | undefined {
  const prefix = line[0];
  const text = line.slice(1);

  if (prefix === "+") {
    return {
      line: { kind: "add", text, newLine },
      nextOldLine: oldLine,
      nextNewLine: newLine + 1
    };
  }

  if (prefix === "-") {
    return {
      line: { kind: "remove", text, oldLine },
      nextOldLine: oldLine + 1,
      nextNewLine: newLine
    };
  }

  if (prefix === " ") {
    return {
      line: { kind: "context", text, oldLine, newLine },
      nextOldLine: oldLine + 1,
      nextNewLine: newLine + 1
    };
  }

  return undefined;
}

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

export function statusFromNameStatus(status: string): ChangeKind {
  if (status === "A") return "added";
  if (status === "D") return "deleted";
  if (status === "M") return "modified";
  if (status.startsWith("R")) return "renamed";
  if (status.startsWith("C")) return "copied";
  return "unknown";
}
