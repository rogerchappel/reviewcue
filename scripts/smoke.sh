#!/usr/bin/env bash
set -euo pipefail

node dist/src/cli.js diff fixtures/basic.diff > /tmp/reviewcue-smoke.json
node -e "const fs=require('node:fs'); const out=JSON.parse(fs.readFileSync('/tmp/reviewcue-smoke.json','utf8')); if (out.files.length !== 1 || out.files[0].additions !== 1) process.exit(1);"
