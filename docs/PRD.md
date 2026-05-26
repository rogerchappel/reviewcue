# ReviewCue PRD

Status: in-progress

## Summary

ReviewCue is a local-first CLI that prepares review prompts from a git diff without leaking the whole repo. It builds a compact review packet with changed files, nearby tests, risky patterns, and reviewer questions, then writes a Markdown or JSON artifact that a human or coding agent can inspect.

## Problem

AI review agents are useful, but they often receive either too much context or too little. Developers need a deterministic tool that packages the right local context around a change before handing it to Codex, Claude, Gemini, or a human reviewer.

## Goals

- Read local git diffs and changed files.
- Detect likely related tests, docs, package metadata, and config files.
- Flag review cues such as missing tests, secret-looking strings, broad dependency changes, generated files, and risky shell commands.
- Emit portable review packets in Markdown and JSON.
- Work offline and avoid model calls.

## Non-Goals

- No direct PR comments in V1.
- No hosted service.
- No attempt to judge code correctness with an LLM.

## CLI

```bash
reviewcue pack --base main --out tmp/review.md
reviewcue inspect fixtures/sample-repo --format json
reviewcue cues --staged
```

## MVP Requirements

- TypeScript Node CLI with `pack`, `inspect`, and `cues` commands.
- Fixture repos covering code-only, docs-only, dependency, and shell-script changes.
- Unit tests for diff parsing, cue detection, and output stability.
- README with workflow examples for local review and agent handoff.

## Attribution

Inspired by modern AI code-review flows and GitHub-integrated agent review, but reframed as a model-agnostic local packet builder that keeps developers in control of what context leaves the machine.
