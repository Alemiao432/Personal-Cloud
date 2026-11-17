#!/usr/bin/env bash
# Nuvola Personale — startup for Mac/Linux
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js not found."
  echo "Install it from https://nodejs.org (LTS version) and try again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run: downloading dependencies, please wait a few seconds..."
  npm install --no-audit --no-fund || exit 1
fi

echo ""
echo " Nuvola Personale is starting... Keep this terminal open."
echo "     When the server is ready, open your browser at: http://localhost:3000"
echo ""
node server.js
