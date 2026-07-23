# Session Handoff — 2026-07-23

## current_state

- **Branch:** `feat/xp-cap-and-settings`, 5 commits ahead of `feat/reset-removal-xp-migration` (PR #52)
- **Working tree:** clean
- **Milestone/Phase:** M4/P2 (XP/Level) — spec curve + 5 stages + model-weighted XP migration implemented
- **App status:** Beaver Buddy runs at L122 adult with 1.76M XP (weighted, cache-excluded per model)

## completed (2026-07-23 session)

### Wave A — Reset-Feature entfernt
- Branch `feat/reset-removal-xp-migration`: Reset-Button, IPC channel, handler, engine.resetProgress(), --reset-hatch flag, allowStageSnap option + all tests/docs removed
- PR #52 opened against ai-beavers/beaver-buddy (contribution PR, English)
- Hatch onboarding preserved; QA replay via onboarding-state.json deletion

### Wave B — XP-Migration mit Modellgewichtung
- model field through usage pipeline (UsageEntry.model, lifetimeByModel per model, no cache)
- model-weights.json: 26 models, γ=2, REF=45, clamp 0.5–2.0, log-name mapping
- 5-stage curve (baby/young-baby/teen/older-teen/adult), 32-level quadratic table, XP_PER_1K_TOKENS=5
- XpState v2: per-model cursors (lastSeenByModel), schemaVersion: 2
- Idempotent migration (migrate.ts, runs once at startup before attachTracker)
- Renderer 5-stage wiring: stage union extended, stageHasInteraction correct for new stages, tray labels humanised
- 647 tests green (37 net new), typecheck + lint clean

### Wave C — XP-Cap entfernt
- No hard cap at L32. Formula extends naturally: levelForXp uses table L1-L32, formula + correction for L33+
- xpForLevel: table L1-L32, raw formula for L33+
- Float drift fix: table avoids round()-drift for L1-L32, while-loop correction for L33+
- Current user state: 1.76M XP → L122 adult

### Wave D — Settings UI
- Beaver Status section in settings.html: level, stage, XP progress bar (fraction of current level), per-model token cursors
- XpStatusPayload: {xp, level, stage, currentLevelXp, nextLevelXp, lastSeenByModel}
- SettingsWindowDeps.getXpState() wired from xpEngine
- XpEngine.getLastSeenByModel() added

### Wave E — Alterslogik-Fundament
- stage-capabilities.ts: {canGrab, canType, roamPace} per stage
- input-capture.ts: stageHasInteraction delegates to capabilities.canGrab
- RoamPace values defined (0.7–1.25) for future use

### Wave F1 — Animations-Crosscheck
- M5 12 Phases all documented as stubs. Adult sheet has rows for P1-P8 (BL-1..9). P9-P11 + young-baby/older-teen/adult full rows still needed (M5/P12).
- Meeting transcript (2026-07-21) covers M3-M6 roadmap, no detailed animation tasks.

### Docs
- CLAUDE.md: Agent hygiene rule (Electron kill only by path filter, never global)
- STATE.md: updated to 2026-07-23
- PLAN.md: full Wave A-F plan documented
- TRACKING.md: progress entries for Waves A/B, C-F plan

## remaining

1. Owner test: settings window display, cap removal verification (tray label shows L122)
2. Push `feat/xp-cap-and-settings` → update PR #52 or create separate PR
3. Wave F2: UI layout concept for settings window (waiting for owner transcript)
4. pi-agent token counter fix (own debug session)
5. M5/P12 dispatch to Vlady: young-baby/older-teen/adult complete animation rows

## decisions

- XP cap permanently removed; formula extends past L32, L25+ stays adult. New stages will be added via M5/P12.
- Settings window shows real-time xp/level/stage + per-model cursors. No extra channel needed — readStatus transports everything.
- Stage behaviour gated via capabilities module, not hard-coded stage names.
- Electron kill must filter by beaver-buddy CommandLine — never kill all electron instances.

## blockers

- M5/P12: young-baby/older-teen sheets have only idle/walk rows — needs Vlady's Comfy Cloud agent. All other P1-P8 adult rows exist (BL-1..9 build-loop merge).
- PR #52 awaiting review on ai-beavers/beaver-buddy.
- Wave F2 waiting for owner's UI transcript.

## next_action

Start the app with `npm start`, open Settings → "Beaver Status" to verify XP display. Push/pull decisions after owner test.
