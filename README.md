# reviewcue

Local-first review packet builder for git diffs. `reviewcue` prepares compact,
deterministic packets that humans or coding agents can inspect before a change
leaves the machine.

## Status

This repository is early-stage. Confirm the current support, release, and
security posture before using it in production.

## Install From A Checkout

```sh
git clone https://github.com/rogerchappel/reviewcue.git
cd reviewcue
npm install
npm run build
```

## Use

Parse a unified diff into review-ready JSON:

```sh
node dist/src/cli.js diff fixtures/basic.diff
```

Git-quoted paths are decoded in the JSON output, including spaces, escape
sequences, and the old/new paths recorded for renames and copies.

Check the installed command surface:

```sh
node dist/src/cli.js --help
node dist/src/cli.js --version
```

Build a Markdown handoff packet from a branch diff:

```sh
node dist/src/cli.js pack --base main --out tmp/review.md
```

Inspect staged changes and emit JSON for an agent run:

```sh
node dist/src/cli.js pack --staged --format json
node dist/src/cli.js cues --staged
```

`reviewcue` detects changed files, related tests/docs/config/package files,
secret-looking additions, risky shell commands, lockfile changes, generated
output, large diffs, and binary patches. It does not call a model, post PR
comments, contact hosted services, or read untracked files unless git reports
them in the active diff.

## Agent Skill Notes

Use this skill when preparing a bounded code-review context for Codex, Claude,
Gemini, or a human reviewer. Required input is a local git repository or a
unified diff file. External writes are limited to the optional `--out` file; PR
comments, remote pushes, issue updates, and account actions are out of scope
unless a separate operator explicitly approves them.

Validation workflow:

```sh
npm test
npm run smoke
node dist/src/cli.js pack --staged --format json
```

## Verify

Run the release-readiness checks before opening a pull request or publishing a
package:

```sh
npm test
npm run check
npm run build
npm run smoke
npm run package:smoke
npm run release:check
```

`npm run smoke` parses the maintained `fixtures/basic.diff` fixture through the
built CLI. You can also run `bash scripts/validate.sh` for the repository
validation helper.

## Limitations

- `reviewcue` reads local git state only; it does not fetch remotes or inspect
  GitHub checks.
- Review packets are deterministic summaries, not automated approvals.
- Secret and risky-command cues are heuristic. Keep human review in the loop
  for high-risk changes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution expectations. Changes
should be small, reviewable, and verified before review.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance. Replace
the default security policy before publishing a package or promoting the tool
for external contributors.

## License

MIT
