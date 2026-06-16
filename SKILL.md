# reviewcue

Use this skill when a coding agent needs a compact, local-first review packet
from a git diff before doing code review, handoff, or release-readiness checks.

## Inputs

- A local git repository, or a unified diff file for `reviewcue diff`.
- Optional base branch with `--base`.
- Optional staged-only mode with `--staged`.

## Side Effects

- Reads git metadata, tracked file names, and the selected diff.
- Writes only the file named by `--out`; otherwise output goes to stdout.
- Does not call models, contact remote services, post comments, push branches,
  or read credentials.

## Approval Boundaries

Ask before sharing generated packets outside the local machine when cues include
secret-looking additions, binary changes, or large diffs. Ask before taking any
remote action based on the packet.

## Examples

```sh
reviewcue pack --base main --out tmp/review.md
reviewcue pack --staged --format json
reviewcue cues --staged
reviewcue diff fixtures/basic.diff
```

## Verification

```sh
npm test
npm run check
npm run build
npm run smoke
```
