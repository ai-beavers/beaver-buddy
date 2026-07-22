# Ideas & Notes

> Capture inbox for ideas, tasks, and notes. Written by `/fp-note`.
> Quick captures land in **Inbox**; promote them into the table once you act on them.
> One fact, one home — link out instead of duplicating detail.

**Type:** `idea` · `task` · `note` · **Status:** `idea` · `evaluation` · `approved` · `scheduled` · `implemented` · `rejected`

## Inbox (unsorted)

- 2026-07-18 **[note]** Open owner decisions from the Flight Plan: #3 designer icons, #4b SmartScreen signature (budget), #63 bubble outline snapping, #64 launch tier quip replay
- 2026-07-18 **[task]** Finalize BL-7 verdict: review snapshots + shake measurements in `docs/design-reviews/BL-7-verdict.md`, enter final verdict
- 2026-07-18 **[idea]** Angry beaver: gets mad when clicked repeatedly — hidden easter egg (raw-text find)
- 2026-07-18 **[idea]** Sleep-deprivation look: bags under the eyes when the laptop runs very long / night work 2–3 AM (raw-text find)
- 2026-07-18 **[idea]** Time-reactive behavior in general: beaver reacts to time of day (raw text: „like Claude")
- 2026-07-18 **[idea]** Glasses + book: beaver puts on glasses and reads (raw-text find)
- 2026-07-18 **[idea]** Collect „hidden" easter eggs as their own small feature cluster (raw text: "we'll add some hidden stuff")
- 2026-07-18 **[note]** Rejected in the raw text: male/female configuration ("neutral beaver for now"), "Splinter". Camera brainrot detection collides with privacy rules — only with explicit ADR + owner decision
- 2026-07-18 **[note]** Template leaks in local fp skills deliberately UNPATCHED: clarify in the template project (`~/CODING/Flightplan V1.0/_meta/planning/NOTE.md`)
- 2026-07-21 **[note]** **Cycle-1 meeting analyzed** (`.flightplan/Meetings/2026-07-21-planung/`): Recording Agent → M3 · Level/XP/Profile → M4 · naming → M4/P3 · achievements → M4/P3 · safety mechanism → M3/P3 · contribution docs → M6/P1
- 2026-07-21 **[idea]** Prestige system: back to level 1 from level 32, stars/seasonal content (meeting) → post-Cycle 1
- 2026-07-21 **[idea]** Account linking with ai-beavers web profile (sync XP/achievements), local use stays possible (meeting) → post-Cycle 1
- 2026-07-21 **[idea]** Cosmetic monetization (clothing/accessories as layers, no pay-to-win, also unlockable via level); merch (meeting) → post-Cycle 1
- 2026-07-21 **[idea]** Dino-game-like control easter egg for higher levels (meeting 01:06:21)
- 2026-07-21 **[idea]** Beaver stickers from existing character images (meeting, "next steps")
- 2026-07-21 **[task]** Maintain model weighting: periodically update the Intelligence Index table (seed ✅ 2026-07-21 via owner screenshot, 26 models, REF = 45); build mapping log model name → table model in M4/P1; unknown models = 1.0. Decision: value = intelligence, NOT token price
- 2026-07-21 **[note]** DECIDED (Owner): adopt TokScale **LOGIC** 1:1 (finding/reading local token logs) for **all coding-agent harnesses** (Claude Code, Codex, pi, among others); own reader in M4/P1, NO TokScale as tool/dependency (spec §1b)
- 2026-07-21 **[note]** DECIDED (Owner): **5 life stages** — baby, young baby, teenager, older teenager, adult → stage mapping L1–4/5–8/9–16/17–24/25–32 in spec §4; asset consequence: M5/P12 = stage art package (young baby + older teenager + adult), pulled into Z1 scope
- 2026-07-21 **[note]** DECIDED (team meeting): **multi-platform** — ship the Electron app natively for Windows AND macOS (ADR-002 update); M6/P4 builds both installers; open: Apple Developer certificate (budget), macOS test hardware (who tests?), extend QA matrix with macOS (M6/P3)
- 2026-07-21 **[note]** DECIDED (Owner): **Herdr** (open-source terminal overview tool for parallel coding agents) as the detection/notification logic for M3 — no own detection; Jurij evaluates Herdr in M3/P1 WAVE-1
- 2026-07-21 **[note]** DECIDED (Owner 2026-07-21): **XP and lifetime stay separate for now.** Main logic = XP from tokens → level. Lifetime (screen display time/total lifetime) is tracked separately and should later feed in as an additional XP source (conversion logic post-P2). Spec: `Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md`

<!-- /fp-note appends here, newest last -->

## Classified

| Topic | Type | Status | Target/Source | Decision | Defined-on | Done-on/How |
|---|---|---|---|---|---|---|
| Flightplan onboarding/migration | task | implemented | `.flightplan/Planning/` | M1–M4 incorporated | 2026-07-17 | 2026-07-18 |
| **Re-onboarding & Cycle-1 re-planning** | task | implemented | `.flightplan/` | `.fp-new-projekt/` → Meetings/Reference/Archive; M1–M6 + team matrix + dependency docs; see ROADMAP.md | 2026-07-21 | 2026-07-21: migration + ROADMAP/STATE/HANDOFF rewritten |
| Parachute drop | idea | scheduled | M2 Phase 3 (paused) | WAVE-1/2 ✅, WAVE-3 open; resume via Claude Code | 2026-07-17 | |
| Growing tree | idea | scheduled | M5 Phase 1 | Z1 scope; assets ready to start | 2026-07-17 | |
| Review majors (5 findings) | task | implemented | `.flightplan/Reviews/` | BL-15, PR #29 | 2026-07-18 | 2026-07-18: PR #29 |
| Review follow-ups (1 critical + 7 minor) | task | implemented | `.flightplan/Reviews/` | CSP first; studio.ts fix on BL-14 | 2026-07-18 | 2026-07-19: BL-16 → PR #30, PR #28 |
| Animation authoring docs | task | implemented | `docs/animation-authoring.md` | contributor/agent docs | 2026-07-19 | commit 9ff5e0a on `feature/animation-authoring-docs`; PR open |
| F1 beaver not clickable | bug | implemented | M2/P3 WAVE-2 | expected behavior; solved by C3/C4 | 2026-07-20 | 2026-07-20: WAVE-2 |
| F2 bubble artifacts | bug | implemented | M2/P3 WAVE-2 | bubbleDirtyRect + forceFullClear | 2026-07-20 | 2026-07-20: WAVE-2 F2 chunk |
