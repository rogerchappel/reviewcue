export type OutputFormat = "markdown" | "json";

export type ChangeKind = "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown";

export interface CliOptions {
  cwd: string;
  argv: string[];
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
}

export interface CommandResult {
  exitCode: number;
}

export interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string | boolean>;
}

export interface DiffLine {
  kind: "add" | "remove" | "context";
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: ChangeKind;
  additions: number;
  deletions: number;
  isBinary: boolean;
  hunks: DiffHunk[];
}

export type CueSeverity = "info" | "warning" | "critical";

export interface ReviewCue {
  id: string;
  severity: CueSeverity;
  title: string;
  detail: string;
  file?: string;
}

export interface RelatedContext {
  tests: string[];
  docs: string[];
  configs: string[];
  packageFiles: string[];
}

export interface ReviewPacket {
  generatedAt: string;
  repository: string;
  base: string;
  staged: boolean;
  summary: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
  files: ChangedFile[];
  related: RelatedContext;
  cues: ReviewCue[];
  questions: string[];
}
