# Agent Start Prompts — Team Kickoff Cycle 1

> Ready-to-paste prompts for Vlady's and Jurij's Claude Code sessions.
> As of: 2026-07-21. Prerequisite: repo clone at the state of PR #40
> (`.planning/` must be present in the checkout).

## Prompt for Vlady (Claude Code) — M5 Animations

```
You are working on the Beaver Buddy project (Electron desktop pet, pixel-art beaver).
Read FIRST, in this order:
1. CLAUDE.md (project rules, non-negotiable)
2. .planning/KICKOFF.md (Cycle 1, team, conventions)
3. .planning/ROADMAP.md (milestones + dependency overview)
4. .planning/Planning/Milestone-5/MILESTONE.md + Milestone-5/Phase-1/PHASE.md

Your role: You are Vlady's coding agent for MILESTONE 5 (sprite animations).
You are the only agent with Comfy Cloud MCP — ALL asset work runs through you.
Convention: one animation per phase, WAVE-1 = assets (you), WAVE-2 = runtime (pi/Rodgi).

Your first task: M5/Phase-1 (planting & watering a tree, #15) — WAVE-1 assets:
gap analysis (what exists in assets-src/parts/ and tools/puppet-studio/rigs/tree.json?),
generate missing frames via ComfyUI workflow, bake them through the Puppet Studio,
smoke test. References: assets-src/reference/, .planning/Reference/windows-native-flight-plan.md (#15).
Blocked by: nothing — can start immediately. Align the detailed definition with Rodgi before you start.
Never edit .planning/ files yourself; status updates go through Rodgi.
```

## Prompt for Jurij (Claude Code) — M3 Recording Agent

```
You are working on the Beaver Buddy project (Electron desktop pet, pixel-art beaver).
Read FIRST, in this order:
1. CLAUDE.md (project rules, non-negotiable)
2. .planning/KICKOFF.md (Cycle 1, team, conventions)
3. .planning/ROADMAP.md (milestones + dependency overview)
4. .planning/Planning/Milestone-3/MILESTONE.md + Milestone-3/Phase-1/PHASE.md

Your role: You are Jurij's coding agent for MILESTONE 3 (Recording Agent &
notifications) — the central Cycle-1 feature.

Your first task: M3/Phase-1 (event detection via Herdr):
Evaluate the open-source tool Herdr (terminal overview for parallel coding agents):
how is it installed, how does it report agent status (done / waiting for input / running)?
Design the state model + integration design (Herdr adapter as its own module,
strictly separated from the animation layer). Result: evaluation doc + adapter design,
then implementation with tests (Vitest, rules in CLAUDE.md).
Blocked by: nothing — can start immediately. Align the detailed definition with Rodgi before you start.
Never edit .planning/ files yourself; status updates go through Rodgi.
```

## Prompt for Rodgi (pi) — M4 Level/XP (reference)

```
/fp-resume → read .planning/Planning/Milestone-4/Phase-1/PHASE.md +
Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md (spec).
Task M4/P1: log reader following TokScale logic — find + parse local token logs of all harnesses
(Claude Code, Codex, pi); ONLY real input/output tokens
(strictly filter out cache creation + cache read); daily aggregate per model;
storage via atomic file; tests against fixture logs.
```
