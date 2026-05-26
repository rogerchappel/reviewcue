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
      current.oldPath = line.slice("rename from ".length);
      current.status = "renamed";
      continue;
    }

    if (line.startsWith("rename to ")) {
      current.path = line.slice("rename to ".length);
      continue;
    }

    if (line.startsWith("copy from ")) {
      current.status = "copied";
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
  const parts = line.split(" ");
  const path = parts[3] ?? "";
  return stripPrefix(path, "b/");
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
