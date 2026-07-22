# Kickoff — Beaver Buddy · Cycle 1 (Team: Rodgi, Vlady, Jurij)

> Read this first. Then: `ROADMAP.md` → your `Planning/Milestone-N/MILESTONE.md` → your phase.

## 🎯 Cycle 1 — Goal
**Exit criteria:** ① app publicly downloadable (installer) ② 100 downloads ③ 7 contributors (we are 3)
**Horizon:** ~6–8 weeks · **Core feature:** Recording Agent — the beaver detects via **Herdr**
when a coding agent is done or needs input, and shows it. Plus gamification:
tokens → XP → level 1–32 → 5 life stages.

## 👥 Who does what (binding)
| Person | Milestone | Agent | First task |
|---|---|---|---|
| **Jurij** (event logic, hard tech) | M3 Recording Agent | Claude Code | **M3/P1:** evaluate + integrate Herdr |
| **Rodgi** (state logic, features, review) | M4 Level/XP/Profile + M6 Release | pi | **M4/P1:** log reader (TokScale logic, real input/output tokens only) |
| **Vlady** (sprite animations) | M5 Animations | Claude Code | **M5/P1:** tree assets (WAVE-1) |

Rules: **One Accountable per phase.** Only Rodgi uses pi; Vlady & Jurij work everywhere with
Claude Code. Agents work only on instruction from the respective phase owner.

## 📁 Where things live
- **This planning (`.planning/`, committed)** = your reading source. Structure:
  - `STATE.md` — current status (Now/Next/Blockers)
  - `ROADMAP.md` — milestones, phases, **dependency overview** (what blocks whom)
  - `Planning/Milestone-N/MILESTONE.md` — Why, phases, success, dependencies
  - `Planning/Milestone-N/Phase-N/PHASE.md` — done-when, waves, **Accountable**, **Blocked by**, duration
  - `Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md` — **the XP/level spec** (curve, weights, stages)
  - `Meetings/2026-07-21-planung/` — meeting source · `Reference/` — item specs #1–#64 · `Archive/`
- Master lives locally with Rodgi (`.flightplan/`, gitignored); he syncs here.

## 📐 Conventions
- Every phase: **done-when** in the header, waves as checkboxes, check `Blocked by:` before starting.
- **One animation per phase** (M5): WAVE-1 = assets (Claude Code/ComfyUI), WAVE-2 = runtime (pi/Rodgi).
- Design gate verdicts → `docs/design-reviews/` · asset registration → `docs/asset-gallery.md`.
- Code rules: read `CLAUDE.md` (Electron hardening, security, style) — **non-negotiable**.

## 🔢 XP/level system in 30 seconds
Only **real input+output tokens** (no cache!) count → 5 XP per 1,000 tokens ×
**model weight** (Intelligence Index artificialanalysis.ai, **γ=2**: top model 1.78×, floor 0.5×)
→ cumulative quadratic curve, L32 = 120,000 XP ≈ day 60.
**5 life stages:** baby L1–4 · young baby L5–8 · teenager L9–16 · older teenager
L17–24 · adult L25–32. Interactions from L8. Everything as data in the character map (M4/P4).

## 🚀 Start
1. Read `ROADMAP.md`, find your phase, check `Blocked by:` (M3/P1, M4/P1, M5 assets: **none** → can start immediately)
2. Align the detailed definition of your phase with Rodgi (convention: at phase start)
3. Work in waves; STATE.md/PHASE.md checkboxes get updated on completion (Rodgi syncs)
