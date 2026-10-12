#!/usr/bin/env bash
# Stop hook: run `pnpm typecheck` + `pnpm lint` when the working tree has
# uncommitted source changes, so a turn can't end on broken types or lint.
# Skips clean trees and Stop-triggered re-invocations (stop_hook_active).

set -euo pipefail

input="$(cat)"
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
	exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

relevant_changes="$(git status --porcelain 2>/dev/null \
	| awk '{ if ($1 == "R") print $NF; else print substr($0, 4) }' \
	| grep -Ev '^(\.claude/|README\.md$|\.gitignore$)' || true)"
if [ -z "$relevant_changes" ]; then
	exit 0
fi

if [ ! -x "node_modules/.bin/tsc" ]; then
	echo "Stop hook: node_modules missing — run \`pnpm install && pnpm typecheck && pnpm lint\` before merging." >&2
	exit 0
fi

if ! out="$(pnpm typecheck 2>&1)"; then
	printf 'Stop hook: `pnpm typecheck` failed. Fix before ending this turn.\n\n%s\n' "$out" >&2
	exit 2
fi

if ! out="$(pnpm lint 2>&1)"; then
	printf 'Stop hook: `pnpm lint` failed. Run `pnpm format`, then fix remaining errors.\n\n%s\n' "$out" >&2
	exit 2
fi
