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
    `# Review Packet: ${packet.repository}`,
    "",
    `- Generated: ${packet.generatedAt}`,
    `- Base: ${packet.base}`,
    `- Mode: ${packet.staged ? "staged changes" : "base comparison"}`,
    `- Files: ${packet.summary.filesChanged}`,
    `- Lines: +${packet.summary.additions} / -${packet.summary.deletions}`,
    "",
    "## Changed Files",
    ...packet.files.flatMap((file) => [
      `- ${file.path}${file.oldPath ? ` (renamed from ${file.oldPath})` : ""}: ${file.status}, +${file.additions}/-${file.deletions}${file.isBinary ? ", binary" : ""}`
    ]),
    "",
    "## Review Cues",
    ...(packet.cues.length
      ? packet.cues.map((cue) => `- [${cue.severity}] ${cue.title}${cue.file ? ` (${cue.file})` : ""}: ${cue.detail}`)
      : ["- No cues detected."]),
    "",
    "## Related Context",
    `- Tests: ${packet.related.tests.join(", ") || "none detected"}`,
    `- Docs: ${packet.related.docs.slice(0, 12).join(", ") || "none detected"}`,
    `- Config: ${packet.related.configs.join(", ") || "none detected"}`,
    `- Packages: ${packet.related.packageFiles.join(", ") || "none detected"}`,
    "",
    "## Reviewer Questions",
    ...packet.questions.map((question) => `- ${question}`),
    ""
  ];

  return `${lines.join("\n")}\n`;
}

function summarize(files: ChangedFile[]): ReviewPacket["summary"] {
  return {
    filesChanged: files.length,
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0)
  };
}
