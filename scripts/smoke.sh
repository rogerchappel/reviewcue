#!/usr/bin/env bash
set -euo pipefail

node dist/src/cli.js diff fixtures/basic.diff > /tmp/reviewcue-smoke.json
node -e "const fs=require('node:fs'); const out=JSON.parse(fs.readFileSync('/tmp/reviewcue-smoke.json','utf8')); const file=out.files[0]; if (out.files.length !== 1 || file.path !== 'README.md' || file.additions !== 1 || file.deletions !== 0) process.exit(1);"
