# Plan: Flight-Plan Item #50 — Connect-Hint „on this Mac"

## Ziel
Der Connect-Hint in den Settings nennt „on this Mac"; auf Windows ist das sichtbar falsch.
Text plattformneutral machen: „on this computer". Rest des Satzes unverändert.

## Alter String (src/main/mrr/settings.html:63)
`Opt in to read local Claude Code / Codex usage logs on this Mac — no API keys.`

## Neuer String
`Opt in to read local Claude Code / Codex usage logs on this computer — no API keys.`

## Betroffene Datei
- src/main/mrr/settings.html (Zeile 63)
- Grep-Check: kein weiteres Vorkommen von „on this Mac" in src/ (auch nicht in Tests).

## Verifikation
1. Grep: kein „on this Mac" mehr in src/, „on this computer" genau 1x.
2. npm run build (dist/main/mrr/settings.html wird aktualisiert)
3. npm run test (Baseline: 434 passed / 6 skipped)
4. npm run typecheck
5. npm run lint
