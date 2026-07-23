# Tracking

- **2026-07-22** — Intent: Close open branches (merge + tag), goal "only main".
  Status: **implemented** (15 already-merged upstream branches tagged with `archive/*` +
  deleted; tags v0.1.0 + docs/animation-authoring pushed upstream; PRs #38–#41
  blocked by org ruleset → resolved: Gw3i merged #40 + #41 + #42).

- **2026-07-22** — Intent: Fork → direct work on ai-beavers/beaver-buddy:
  bring the last fork-only commit (`1c86e57`, animation-authoring) upstream as branch + PR,
  await/merge PR #40, rename remotes (upstream→origin, origin→fork), track main on
  origin/main, push tag `docs/animation-authoring` to origin, archive fork.
  Status: **implemented** (PRs #41 + #40 merged by Gw3i; remotes swapped — `origin` =
  ai-beavers, `fork` = read-only backup; remote rule recorded in AGENTS.md via PR #40;
  main synced. Fork archiving remains as owner action in the GitHub UI.)

- **2026-07-22** — Intent: Translate all `.planning/` docs to English (owner requirement
  for PR #40), verified by 2 scout + 2 worker subagents + manual byte-level umlaut sweep.
  Status: **implemented** (PR #40 merged fully English; `.flightplan/` master mirrored
  in the main files — note: some `.flightplan/Archive/` counterparts still German,
  local-only, no PR impact.)

- **2026-07-22** — Intent: M4/P1 multi-harness usage-log work (from the parallel Kimi
  session) moved to its own branch `feat/multi-harness-usage-logs` off `origin/main`,
  verified (tsc/eslint/582 tests) and pushed as PR #42 — **merged by Gw3i**.
  Status: **implemented**

- **2026-07-19** — Intent: Short contributor doc `docs/animation-authoring.md`
  for animation authoring (ComfyUI + PixiJS, macOS & Windows, incl. PixiJS-/
  comfy skills and Comfy Cloud MCP setup) for human contributors and
  agentic coding agents; link from `docs/README.md` and `README.md`.
  Status: **implemented** (merged via PR #41)
- **2026-07-21** — Intent: Flightplan re-onboarding & Cycle-1 planning — pause M2/P3 (parachute);
  migrate `.fp-new-projekt/` to `.flightplan/{Meetings,Reference,Archive}`;
  extend ROADMAP with Cycle-1 exit criteria (app downloadable, 100 downloads, 7 contributors);
  re-cut milestones (new: M3 Level/XP/Profile, M4 Recording Agent, M5 remaining animations,
  M6 Contribution readiness & release); clean up NOTE.md/STATE/HANDOFF.
  Status: **implemented** (2026-07-21: migration + ROADMAP/MILESTONE×5 + 11 PHASE stubs +
  STATE/HANDOFF/NOTE new; reviewer check passed after fixing dependency cross-check findings)

## 2026-07-23 — Reset-Feature entfernen + XP-State-Migration mit Punkte-Matrix

Vorhaben: „Reset Beaver XP + Hatch" vollständig aus Code/UI/Tests entfernen (Root Cause des
0-XP-Befunds), einmalige idempotente Migration der `xp-state.json` mit Modellgewichtung (γ=2,
Cache ausgeschlossen) inkl. Umstellung auf Spec-Kurve (5 Stufen), dazu Konzept für persistierten
Tokenstand/24h-Start (Aufgabe 2). pi-agent-Zähler als offen notiert.

**Wave A** implementiert (PR #52: Reset-Button, IPC, Engine-Methode, --reset-hatch, allowStageSnap
entfernt; typecheck/lint/610 Tests).
**Wave B** implementiert (B1–B7: model-Feld + lifetimeByModel, Gewichtstabelle γ=2 REF=45, 5-Stufen-
Kurve quadratisch 120k XP, XpState v2 mit per-Modell-Cursor, idempotente Migration schemaVersion: 2,
Renderer 5 Stufen + stageHasInteraction korrekt + tray-Labels; typecheck/lint/647 Tests grün).
Auf Branch `feat/reset-removal-xp-migration`, noch zu committen + pushen (PR-Update).
**Wave C** Konzept-Doc für 24h-Start ausstehend.
