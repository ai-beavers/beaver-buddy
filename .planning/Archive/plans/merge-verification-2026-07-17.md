# Merge-Verifikation `upstream/main` → `bl-item/windows-native/BL-WIN` (2026-07-17)

Unabhängige Endprüfung des staged (nicht committeten) Merge-Stands durch den
Verifikations-Sub-Agenten. Grundlage: .flightplan/Archive/plans/merge-upstream-main-2026-07-17.md.

## Urteil: FREIGABE FÜR MERGE-COMMIT

Alle 12 Feature-Punkte im Code verifiziert, keine Konfliktmarker, Working Tree
vollständig staged ohne Artefakte, Tests/Typecheck/Lint selbst ausgeführt und
grün. Einziger Befund: ein [minor] UI-Text (Upstream-Erbe), kein Merge-Defekt.

## Checkliste der 12 Punkte

| # | Punkt | Status | Beleg (Datei:Zeile) |
|---|-------|--------|---------------------|
| 1 | secrets.ts win32 safeStorage/DPAPI, genutzt von mrr-engine + settings-window | ✓ | src/main/mrr/secrets.ts:25-35 (win32-Backend), src/main/mrr/mrr-engine.ts:11 (`import { getSecret } from './secrets'`), src/main/mrr/settings-window.ts:21,118,167 — kein direkter keychain.ts-Zugriff für Secret-I/O (main.ts:23 nutzt nur `isValidKeychainService`, reine Namensvalidierung) |
| 2 | IPC `settings:reset-progress` in ipc-channels + settings-preload + settings-window | ✓ | src/main/ipc-channels.ts:21, src/main/mrr/settings-preload.ts:15+30, src/main/mrr/settings-window.ts:194-202 (async Handler, `{ ok: false, error: 'reset failed' }` bei Dep-Fehler), Drift-Guard src/main/ipc-channels.test.ts:62-65 |
| 3 | tray.ts win32-Gate click → popUpContextMenu | ✓ | src/main/tray.ts:106-108 (einmal registriert, außerhalb rebuildMenu) |
| 4 | effectiveWorkArea / getOverlayWindowBounds (Auto-Hide-Inset) | ✓ | src/main/overlay-adapter.ts:34-52 (AUTO_HIDE_INSET_DIP=2, win32-Gate), 74-76; Verwendung src/main/main.ts:128,184 |
| 5 | renderer.ts `evolutionState = null` bei HATCH_START genau einmal | ✓ | src/renderer/renderer.ts:190 (einzige Stelle im onHatchStart; Vorkommen in :415 ist der normale Evolution-Abschluss im Tick, kein Duplikat) |
| 6 | electron-builder.yml: win/nsis-Block + upstream mac.icns | ✓ | electron-builder.yml:14 (`mac.icon: assets/beaver-buddy-icon.icns`), 15-25 (win-Block inkl. signtoolOptions sha256 + rfc3161), 26-34 (nsis: Icons, Desktop-/Startmenü-Shortcuts, installerLanguages en_US+de_DE) |
| 7 | settings.html Danger-Zone Zwei-Klick-Arming, kein window.confirm | ✓ | src/main/mrr/settings.html:114-123 (Pet-Fieldset), 244-271 (Arming-Script, 5s-Fenster, `api.resetProgress()`); `window.confirm` kommt in der Datei nicht vor |
| 8 | main.ts onProgressReset-Ordering (persist → HATCH_START → reset, awaited) | ✓ | src/main/main.ts:284-295 (`await saveOnboardingState` → `send(HATCH_START_CHANNEL)` → `await xpEngine.resetProgress()`) |
| 9 | Connect Claude Code / Codex komplett | ✓ | Tray-Eintrag src/main/tray.ts:66 + Callback :20, verdrahtet src/main/main.ts:330; Settings-Handler src/main/mrr/settings-window.ts:204-226 (`connectUsage`, validiert via settings-validate); IPC-Kanal src/main/ipc-channels.ts:24 + preload :16,31-32; tracker.ts parst erst nach Opt-in (s. F) |
| 10 | Spend-Tier-Quips | ✓ | src/main/quips/detectors.ts:11 (SpendTier spendWeak/Ok/Crazy), 56-61 (classify), 92-105 (Tages-Reset + Tier-Crossing); src/main/quips/quips.ts:7 (lowercase-Voice-Invariante), 77-79 (Pools) |
| 11 | Retina-Bubble / DPR (Superset applyDpr/logicalBounds) | ✓ | src/renderer/renderer.ts:94-100,205-218 (logicalBounds, currentDpr, applyDpr bei Bounds- und DPR-Wechsel); src/renderer/bubble.ts:116-118 (logische Koordinaten, Schärfe via DPR-Backing-Store); src/renderer/canvas-dpr.ts vorhanden + Test |
| 12 | Pet-Reset vereinheitlicht (allowStageSnap, Cursor bleibt) | ✓ | src/main/xp/engine.ts:129-131 (`applyState({ xp: 0, lastMrrAwardDate: null }, { allowStageSnap: true })`), 137-151 (Snap-Update ohne `evolvingTo`); `lastSeenLifetimeTokens` nicht im Patch → Cursor bleibt (Begründung :125-128) |

## Selbst ausgeführte Prüfungen

- `npx vitest run`: **43 Dateien, 434 passed / 6 skipped (440)** — exakt der im
  Merge-Doku behauptete Stand. Keine unhandled errors.
- `npm run typecheck` (tsc --noEmit, renderer-tsconfig, gen-sprites-tsconfig): **clean**.
- `npm run lint` (eslint .): **clean** (zusätzlich zur geforderten Prüfung).
- `git diff --cached --check`: sauber (keine Whitespace-/Marker-Reste).

## A. Konfliktmarker

Keine. Grep nach `<<<<<<<` / `=======` / `>>>>>>>` über src/ sowie nach
`<<<<<<< HEAD` / `>>>>>>> upstream|hash` über alle ts/html/yml/md/json im Repo
(node_modules ausgenommen) ohne Treffer.

## C. Git-Status

"All conflicts fixed but you are still merging." — 39 Dateien, alle staged
(`M`/`A`), keine unstaged Änderungen, keine untracked Dateien, keine
`*.orig`- oder sonstigen Merge-Artefakte, keine unmerged paths.

## E. Semantik-Stichprobe Reset

Vereinheitlichung stimmt: Upstream-Mechanik (`applyState` + `allowStageSnap`,
Snap trägt kein `evolvingTo` → kein Evolution-Quip/Sequenz, src/main/xp/engine.ts:146-148)
auf unserem async Store (`await saveState`, :140) mit unserer IPC-Benennung.
`lastSeenLifetimeTokens`-Cursor bleibt unangetastet (kein Re-Award der Historie),
`lastMrrAwardDate` wird gelöscht. Kette in main.ts:284-295 vollständig awaited;
settings-window.ts:194-202 mappt Fehler auf `{ ok:false, error:'reset failed' }`.
settings-store.ts:78-80 enthält den dokumentierten Fix `void saveSettingsState(...).catch(...)`
(kein Floating Promise bei Migration).

## F. Semantik-Stichprobe Connect

tracker.ts parst Dateiinhalte ausschließlich nach Opt-in: Discovery (logsFound)
läuft immer, `processFile`/Parser nur unter `if (this.enabled.claude/codex)`
(src/main/usage/tracker.ts:160-167, Header-Kommentar :11-13). `connected` ist
nur `enabled && logsFound` (:79,86); Tokenzahlen werden bei disabled auf 0
gemeldet (:80-81,87-88). Deaktivieren evictet Cache-Einträge (:169-177).
Tray zeigt "Connect…"-Eintrag (tray.ts:66), verdrahtet in main.ts:330;
Opt-in-Flags werden beim Start aus persistierten Settings gesetzt (main.ts:354-357)
und bei Änderung via onUsageEnabledChanged nachgezogen (main.ts:305-307).

## G. package.json / package-lock.json

`git diff upstream/main -- package.json` zeigt nur legitime Branch-eigene
Änderungen (description "macOS and Windows", author, build via
scripts/build-assets.js, assets:*-Skripte) — nichts darüber hinaus.
package-lock.json ist **identisch zu upstream/main** (leerer Diff); electron
43.1.1 in package.json:27 und im Lockfile bestätigt.

## Befunde

- [minor] src/main/mrr/settings.html:63 — Connect-Hinweistext sagt wörtlich
  "on this Mac" (Upstream-Text unverändert übernommen). Auf Windows-Builds
  für Nutzer sichtbar; kein Merge-Defekt, kein Funktionsproblem. Empfehlung:
  in einem Follow-up plattformneutral formulieren ("on this computer").
- Hinweis (kein Befund): tray.ts:19-20 kommentiert "focused on Connect", aber
  main.ts:329-330 verdrahtet `onOpenConnect` und `onOpenGrowthSettings` auf
  dieselbe Funktion — "Fokus" ergibt sich aus dem Layout (Connect-Fieldset
  steht oben). Entspricht dem Upstream-Design, keine Aktion nötig.

## Fazit

Der staged Merge-Stand ist vollständig, konfliktfrei und verifiziert. Beide
Feature-Sets (Windows-native + Upstream) sind intakt, die kritischen
Semantik-Entscheidungen (Reset-Vereinheitlichung, Connect-Opt-in) stimmen im
Code, und die behaupteten Metriken (434/6, typecheck/lint/build) lassen sich
reproduzieren. **Merge-Commit kann erfolgen.**
