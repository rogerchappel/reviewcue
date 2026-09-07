import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

export interface GitDiffOptions {
  cwd: string;
  base: string;
  staged: boolean;
}

export function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${message}`);
  }
}

export function isGitRepository(cwd: string): boolean {
  try {
    runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

export function repositoryName(cwd: string): string {
  if (!isGitRepository(cwd)) {
    return basename(resolve(cwd));
  }

  const topLevel = runGit(cwd, ["rev-parse", "--show-toplevel"]).trim();
  return basename(topLevel);
}

export function collectDiff(options: GitDiffOptions): string {
  const args = options.staged
    ? ["diff", "--cached", "--find-renames", "--binary"]
    : ["diff", "--find-renames", "--binary", `${options.base}...HEAD`];

  return runGit(options.cwd, args);
}

export function listTrackedFiles(cwd: string): string[] {
  if (!isGitRepository(cwd)) {
    return [];
  }

  const output = runGit(cwd, ["ls-files", "-z"]);
  if (output.length === 0) return [];
  return output.slice(0, -1).split("\0");
}

export function resolveRepoPath(path: string): string {
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(`Path does not exist: ${path}`);
  }
  return resolved;
}
