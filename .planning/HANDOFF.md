# Handoff

> Full resume context. Written by `/fp-pause`, read by `/fp-resume`. `STATE.md` is the short digest;
> this file is the complete picture so the next session loses no context.

**Last updated:** 2026-07-21 (pi, fp-pause — planning session wrapped up cleanly)

## current_state
**Cycle 1 is fully planned; the team can start.** Re-onboarding of `.flightplan/`
completed, planning committed under `.planning/` (team snapshot; `.flightplan/` remains the local
gitignored master). **PR #40** (vendored skills + Cycle-1 planning → `ai-beavers/main`):
**CI ubuntu + windows GREEN ✅, status: `REVIEW_REQUIRED`** — merge waiting for approval
(Gw3i/org admin; Rodgi cannot approve himself). Branch `chore/zyklus1-planning` on
upstream is the current state (`4b55734`); fork main synced. Working tree clean.
**M2/P3 parachute:** still officially paused (WAVE-1/2 ✅ merged upstream via PR #33,
WAVE-3 polish open → resume later, Claude Code).

## completed (Session 2026-07-21)
- **Re-onboarding:** `.fp-new-projekt/` dissolved → `Meetings/2026-07-21-planung/`,
  `Reference/windows-native-flight-plan.md`, `Archive/`; all path references updated;
  `.gitignore` cleaned up; Debugging README fixed; NOTE.md de-duplicated (F1/F2 done)
- **Cycle 1 defined:** exit criteria (app downloadable · 100 downloads · 7 contributors);
  ROADMAP with M1–M6 + team matrix + dependency overview; 11 new PHASE.md stubs with
  required fields (`Accountable`, `Blocked by:`, `Blocks:`, `Duration`); M2/P4–P15 → M5/P1–P12 moved over
- **Team matrix:** Jurij = M3 (Recording Agent) · Rodgi = M4 (Level/XP) + M6 (Release) ·
  Vlady = M5 (Animations) · agent rule: **pi = Rodgi only, Claude Code = Vlady & Jurij**
- **XP/level spec** (`Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md`): only real
  input+output tokens (cache strictly excluded), 5 XP/1k, cumulative quadratic curve TOTAL 120,000
  (L32 ≈ day 60, reference 400k tokens/day), **γ=2** model weighting via Artificial Analysis
  Intelligence Index (seed table 26 models from owner screenshot, REF=45, top 1.78× / floor 0.5×),
  lifetime tracking separate from XP
- **5 life stages:** baby L1–4 · young baby L5–8 · teenager L9–16 · older teenager
  L17–24 · adult L25–32 → M5/P12 pulled into Z1 scope as the stage art package
- **M3:** Herdr as the detection logic (instead of own detection) · **M4/P1:** TokScale **logic**
  1:1 for all harnesses (Claude Code, Codex, pi), own reader, no tool dependency
- **Multi-platform decision** (team meeting): Windows + macOS native; ADR-002 update (M1),
  M6/P4 with macOS targets/signing/CI runner
- **Contributor workflow:** merge upstream/main (41 commits: BL-17, BL-18/19 typing animation),
  conflicts resolved cleanly (package.json union, AGENTS.md guardrails + .planning section),
  verification tsc/eslint/573 tests ✓; direct push → branch protection (PR + CI enforced) →
  **PR #40 created**, CI green, REVIEW_REQUIRED; `KICKOFF.md` + `KICKOFF-AGENT-PROMPTS.md`
- **Name fix:** Vady → **Vlady** (21 files + PLAN.md, verified 0 remaining hits)

## remaining (in order)
1. **Rodgi:** request review for PR #40 (Gw3i/org admin) → after merge: **team dispatch**
   (prompts from `.planning/KICKOFF-AGENT-PROMPTS.md` to Vlady + Jurij)
2. **Team start (parallel, „Blocked by: none"):** Jurij = M3/P1 (Herdr evaluation) ·
   Rodgi = M4/P1 (log reader TokScale logic) · Vlady = M5/P1 (tree assets)
3. **Open owner decisions (NOTE.md):** Apple Developer account (~$99/year) ·
   macOS test hardware in the team · macOS on par for the Z1 launch? · #3/#4b/#63/#64
4. **Later:** M2/P3 WAVE-3 resume (Claude Code) · reconcile M5/P2 scope against BL-18/19
   (typing animation already exists upstream) · check `feature/animation-authoring-docs` PR
   · BL-7 verdict · calibrate XP constant after 1 week of M4/P1 data

## decisions (Owner, verbatim)
- „pi = only me; Vlady & Jurij everywhere with Claude Code" — 2026-07-21
- „Note blockers directly in the Flightplan docs — which phase blocks which" — 2026-07-21
- „XP and lifetime separate; main logic = XP points → level" — 2026-07-21
- „Only input and output tokens count, no cache/cache-read" — 2026-07-21
- „γ = 2" (spread of model weighting; value = intelligence, not token price) — 2026-07-21
- „5 life stages: baby, young baby, teenager, somewhat older teenager, adult" — 2026-07-21
- „Use TokScale logic 1:1 for fetching the local token logs, all coding-agent harnesses" — 2026-07-21
- „For detection we want to use Herdr" (open-source terminal overview tool) — 2026-07-21
- „Electron app directly as a multi-platform app native for Windows and macOS" (team meeting) — 2026-07-21
- „Parachute resume: later!" — 2026-07-21

## blockers
- **PR #40: REVIEW_REQUIRED** — merge needs approval (Gw3i/org admin). Not a code blocker;
  the team can already read from branch `chore/zyklus1-planning`.

## next_action
**Request review for PR #40** (CI green) → after merge: send prompts from
`.planning/KICKOFF-AGENT-PROMPTS.md` to Vlady (M5/P1) and Jurij (M3/P1);
Rodgi starts M4/P1 via `/fp-resume`.
