#!/bin/bash
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js is not installed yet."
  echo "Install the LTS version from https://nodejs.org, then run this again."
  read -r -p "Press Enter to close."
  exit 1
fi

if [ ! -f .env ]; then
  echo
  echo "First-time setup: paste your Anthropic API key below (Cmd+V), then press Enter."
  read -r -p "API key: " APIKEY
  if [ -z "$APIKEY" ]; then
    echo "No key entered. Close this window and try again."
    exit 1
  fi
  echo "ANTHROPIC_API_KEY=$APIKEY" > .env
  echo "Saved. You won't be asked again."
fi

if [ ! -d node_modules ]; then
  echo
  echo "Installing (only happens the first time, takes about a minute)..."
  npm install || { echo "Install failed. Check your internet connection and try again."; exit 1; }
fi

echo
echo "SyllaPlan is starting. Your browser will open in a few seconds."
echo "Keep this window open while you use it. Press Ctrl+C or close it to stop."
echo
(sleep 3; open http://localhost:3000) &
node server.js
