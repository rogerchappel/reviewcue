import { collectRelatedContext, buildQuestions, detectCues } from "./cues.js";
import { parseDiff } from "./diff.js";
import { collectDiff, listTrackedFiles, repositoryName } from "./git.js";
import type { ChangedFile, OutputFormat, ReviewPacket } from "./types.js";

export interface BuildPacketOptions {
  cwd: string;
  base: string;
  staged: boolean;
  diffText?: string;
  trackedFiles?: string[];
  generatedAt?: string;
}

export function buildPacket(options: BuildPacketOptions): ReviewPacket {
  const diffText = options.diffText ?? collectDiff(options);
  const files = parseDiff(diffText);
  const related = collectRelatedContext(files, options.trackedFiles ?? listTrackedFiles(options.cwd));
  const cues = detectCues(files, related);

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repository: repositoryName(options.cwd),
    base: options.base,
    staged: options.staged,
    summary: summarize(files),
    files,
    related,
    cues,
    questions: buildQuestions(files, cues)
  };
}

export function renderPacket(packet: ReviewPacket, format: OutputFormat): string {
  if (format === "json") {
    return `${JSON.stringify(packet, null, 2)}\n`;
  }

  const lines = [
    `# Review Packet: ${markdownCode(packet.repository)}`,
    "",
    `- Generated: ${packet.generatedAt}`,
    `- Base: ${markdownCode(packet.base)}`,
    `- Mode: ${packet.staged ? "staged changes" : "base comparison"}`,
    `- Files: ${packet.summary.filesChanged}`,
    `- Lines: +${packet.summary.additions} / -${packet.summary.deletions}`,
    "",
    "## Changed Files",
    ...packet.files.flatMap((file) => [
      `- ${markdownCode(file.path)}${file.oldPath ? ` (renamed from ${markdownCode(file.oldPath)})` : ""}: ${file.status}, +${file.additions}/-${file.deletions}${file.isBinary ? ", binary" : ""}`
    ]),
    "",
    "## Review Cues",
    ...(packet.cues.length
      ? packet.cues.map((cue) => `- [${cue.severity}] ${markdownText(cue.title)}${cue.file ? ` (${markdownCode(cue.file)})` : ""}: ${markdownText(cue.detail)}`)
      : ["- No cues detected."]),
    "",
    "## Related Context",
    `- Tests: ${markdownPaths(packet.related.tests)}`,
    `- Docs: ${markdownPaths(packet.related.docs.slice(0, 12))}`,
    `- Config: ${markdownPaths(packet.related.configs)}`,
    `- Packages: ${markdownPaths(packet.related.packageFiles)}`,
    "",
    "## Reviewer Questions",
    ...packet.questions.map((question) => `- ${markdownText(question)}`),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function markdownCode(value: string): string {
  const normalized = value.replace(/\r?\n|\r/g, " ");
  const longestRun = Math.max(0, ...Array.from(normalized.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  const padding = normalized.startsWith("`") || normalized.endsWith("`") ? " " : "";
  return `${fence}${padding}${normalized}${padding}${fence}`;
}

function markdownText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([`*_[\]{}()<>#+|])/g, "\\$1")
    .replace(/\r?\n|\r/g, "<br>");
}

function markdownPaths(paths: string[]): string {
  return paths.length ? paths.map(markdownCode).join(", ") : "none detected";
}

function summarize(files: ChangedFile[]): ReviewPacket["summary"] {
  return {
    filesChanged: files.length,
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0)
  };
}
