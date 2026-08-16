#!/usr/bin/env bash
set -euo pipefail

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/reviewcue-package-smoke.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT

artifact_dir="$tmp_dir/artifact"
consumer_dir="$tmp_dir/consumer"
mkdir -p "$artifact_dir" "$consumer_dir"

npm pack --pack-destination "$artifact_dir" >/dev/null

shopt -s nullglob
artifacts=("$artifact_dir"/*.tgz)
if [[ ${#artifacts[@]} -ne 1 ]]; then
  printf 'Expected one packed artifact, found %d\n' "${#artifacts[@]}" >&2
  exit 1
fi

npm install --prefix "$consumer_dir" --ignore-scripts "${artifacts[0]}" >/dev/null

installed_package="$consumer_dir/node_modules/reviewcue/package.json"
expected_version=$(node -p "require(process.argv[1]).version" "$installed_package")
actual_version=$("$consumer_dir/node_modules/.bin/reviewcue" --version)
if [[ "$actual_version" != "$expected_version" ]]; then
  printf 'Installed CLI version mismatch: expected %s, got %s\n' "$expected_version" "$actual_version" >&2
  exit 1
fi

"$consumer_dir/node_modules/.bin/reviewcue" --help | grep -F 'reviewcue diff <patch.diff>' >/dev/null

(
  cd "$consumer_dir"
  node --input-type=module --eval '
    const reviewcue = await import("reviewcue");
    if (typeof reviewcue.parseDiff !== "function") {
      throw new Error("public package export does not expose parseDiff");
    }
  '
)
