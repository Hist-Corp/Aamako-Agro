#!/usr/bin/env bash
# Convenience launcher for macOS/Linux only.
# On Windows, run the equivalent from this folder instead:  npm start
# Or start everything at once from the repository root:     npm run dev
cd "$(dirname "$0")" || exit 1
exec npm start
