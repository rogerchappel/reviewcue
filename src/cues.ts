import type { ChangedFile, RelatedContext, ReviewCue } from "./types.js";

const secretPattern = /\b(AWS_SECRET_ACCESS_KEY|API_KEY|TOKEN|SECRET|PRIVATE_KEY)\b/i;
const shellRiskPattern = /\b(rm\s+-rf|curl\s+[^|]*\|\s*(?:sh|bash)|sudo\s+|chmod\s+777|git\s+push\s+--force)\b/;
const generatedPattern = /(^|\/)(dist|build|coverage|vendor|generated)\//;

export function detectCues(files: ChangedFile[], related: RelatedContext): ReviewCue[] {
  const cues: ReviewCue[] = [];
  const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);

  if (files.some((file) => file.path === "package-lock.json" || file.path.endsWith("/package-lock.json"))) {
    cues.push({
      id: "dependency-lockfile",
      severity: "warning",
      title: "Dependency lockfile changed",
      detail: "Review dependency intent, install reproducibility, and whether package metadata changed with the lockfile."
    });
  }

  if (related.tests.length === 0 && files.some((file) => isSourcePath(file.path))) {
    cues.push({
      id: "missing-tests",
      severity: "warning",
      title: "Source changed without nearby tests",
      detail: "No tracked test files were detected near the changed source paths."
    });
  }

  for (const file of files) {
    if (file.isBinary) {
      cues.push({
        id: "binary-change",
        severity: "info",
        title: "Binary file changed",
        detail: "Binary changes cannot be inspected from the text diff.",
        file: file.path
      });
    }

    if (generatedPattern.test(file.path)) {
      cues.push({
        id: "generated-output",
        severity: "info",
        title: "Generated-looking output changed",
        detail: "Confirm this artifact is intended to be committed and can be regenerated.",
        file: file.path
      });
    }

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.kind !== "add") continue;
        if (secretPattern.test(line.text)) {
          cues.push({
            id: "secret-looking-addition",
            severity: "critical",
            title: "Secret-looking token added",
            detail: "A newly added line contains a credential-shaped keyword.",
            file: file.path
          });
        }
        if (shellRiskPattern.test(line.text)) {
          cues.push({
            id: "risky-shell-command",
            severity: "warning",
            title: "Risky shell command added",
            detail: "A newly added command may be destructive or require explicit operator approval.",
            file: file.path
          });
        }
      }
    }
  }

  if (totalAdditions + totalDeletions > 500) {
    cues.push({
      id: "large-diff",
      severity: "warning",
      title: "Large diff",
      detail: `This packet includes ${totalAdditions + totalDeletions} changed lines; consider splitting the review.`
    });
  }

  return dedupe(cues);
}

export function buildQuestions(files: ChangedFile[], cues: ReviewCue[]): string[] {
  const questions = [
    "What behavior changed, and is that behavior covered by a test or fixture?",
    "Are any changed files generated, vendored, or otherwise better excluded from review context?"
  ];

  if (cues.some((cue) => cue.id === "dependency-lockfile")) {
    questions.push("Do dependency changes match the intended package metadata changes?");
  }
  if (cues.some((cue) => cue.severity === "critical")) {
    questions.push("Has every critical cue been resolved before sharing this packet outside the local machine?");
  }
  if (files.some((file) => file.status === "renamed")) {
    questions.push("Do renamed files preserve imports, docs links, and ownership expectations?");
  }

  return questions;
}

export function collectRelatedContext(changedFiles: ChangedFile[], trackedFiles: string[]): RelatedContext {
  const changed = new Set(changedFiles.map((file) => file.path));
  const sourceStems = changedFiles.map((file) => stripExtension(file.path).split("/").pop()).filter(Boolean) as string[];
  const related = trackedFiles.filter((file) => !changed.has(file));
  const tests = trackedFiles.filter((file) => isTestPath(file) && sourceStems.some((stem) => file.includes(stem)));

  return {
    tests,
    docs: related.filter((file) => /\.(md|mdx|rst)$/i.test(file)),
    configs: related.filter((file) => /(^|\/)(tsconfig|eslint|prettier|vitest|jest|playwright|rollup|vite|webpack|releasebox)\b/.test(file)),
    packageFiles: related.filter((file) => /(^|\/)(package.json|package-lock.json|pnpm-lock.yaml|yarn.lock)$/.test(file))
  };
}

function isSourcePath(path: string): boolean {
  return /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx|py|rb|go|rs|java|kt|php|cs)$/i.test(path) && !isTestPath(path);
}

function isTestPath(path: string): boolean {
  return /(^|\/)(__tests__|test|tests|spec)\//.test(path) || /\.(test|spec)\.[^.]+$/i.test(path);
}

function stripExtension(path: string): string {
  return path.replace(/\.[^.]+$/, "");
}

function dedupe(cues: ReviewCue[]): ReviewCue[] {
  const seen = new Set<string>();
  return cues.filter((cue) => {
    const key = `${cue.id}:${cue.file ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
