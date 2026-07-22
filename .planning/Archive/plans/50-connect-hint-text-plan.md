# Plan: Flight-Plan Item #50 — Connect Hint "on this Mac"

## Goal
The Connect hint in the settings says "on this Mac"; on Windows that is visibly wrong.
Make the text platform-neutral: "on this computer". Rest of the sentence unchanged.

## Old string (src/main/mrr/settings.html:63)
`Opt in to read local Claude Code / Codex usage logs on this Mac — no API keys.`

## New string
`Opt in to read local Claude Code / Codex usage logs on this computer — no API keys.`

## Affected file
- src/main/mrr/settings.html (line 63)
- Grep check: no other occurrence of "on this Mac" in src/ (including tests).

## Verification
1. Grep: no "on this Mac" left in src/, "on this computer" exactly 1×.
2. npm run build (dist/main/mrr/settings.html is updated)
3. npm run test (baseline: 434 passed / 6 skipped)
4. npm run typecheck
5. npm run lint
