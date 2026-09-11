#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Cần cài Node.js 22 trở lên trước khi chạy game.'
  exit 1
fi
exec node server.mjs
