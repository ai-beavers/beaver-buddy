# AGENTS.md — Beaver Buddy

Entry point for coding agents (Codex, Kimi Code, and others). The project
guardrails live in [`CLAUDE.md`](CLAUDE.md) — read it first, every session. It
covers the locked stack, Electron hardening invariants, security/privacy rules,
code style, the definition of done, and the git/PR workflow.

The product source of truth is [`PRD.md`](PRD.md); contributions are governed by
[`CONTRIBUTING.md`](CONTRIBUTING.md).

Hard-won gotchas — skim before touching the sprite pipeline, the grab/parachute
interaction, or generating animation art:
[`docs/dev-guardrails.md`](docs/dev-guardrails.md).

For animation authoring, see [`docs/animation-authoring.md`](docs/animation-authoring.md)
and load the PixiJS routing skill at `.agents/skills/pixijs/SKILL.md` first.

## Project planning docs — `.planning/` (committed)

**In this project, the planning/tracking docs live in `.planning/`, NOT in a
Flightplan directory.** Read these first when working on planned features:

- `.planning/KICKOFF.md` — team onboarding (Zyklus 1, roles, conventions) — **start here**
- `.planning/STATE.md` — current status (Now/Next/Blockers)
- `.planning/ROADMAP.md` — milestones M1–M6, phases, dependency overview
- `.planning/Planning/Milestone-N/...` — milestone/phase/wave detail (each phase has
  `Accountable`, `Blocked by:`, waves)
- `.planning/Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md` — XP/level spec
- `.planning/Meetings/`, `.planning/Reference/`, `.planning/Archive/` — sources & item specs

Rules: one accountable owner per phase (see ROADMAP team matrix); check a phase's
`Blocked by:` before starting; never edit `.planning/` planning state yourself —
updates flow through Rodgi (the local Flightplan master `.flightplan/` is gitignored
and synced into `.planning/` by him).

## Asset generation & editing — TOOLING RULE

**All ComfyUI asset work (generating new sprite strips AND editing/cleaning
existing generated frames) is done by Claude Code**, because only Claude Code
has the Comfy Cloud MCP server configured (`https://cloud.comfy.org/mcp`).
The pi agent has no MCP support by design — it owns runtime/logic work and
delegates every asset task to a Claude Code session via the Flightplan
handoff (`.flightplan/HANDOFF.md` + the active phase's `WAVE-X.md` carry the
concrete asset brief). If the Comfy Cloud connection is missing in Claude
Code, reconnect: `claude mcp add --transport http comfy-cloud
https://cloud.comfy.org/mcp`, then `/mcp` → Authenticate.

## Dependencies — HARD RULE

**No new dependencies without explicit prior approval from the maintainer.**

- Never add a new package to `package.json` (runtime or dev) on your own.
- Never work around this by vendoring/copying third-party code instead.
- If a task seems to require a new dependency: STOP, explain why it is needed,
  propose alternatives with the existing stack, and wait for approval.
- This applies to all agents (Codex, Kimi Code, etc.) and all subagents.
  No exceptions.

## Agent hygiene — Electron process handling

**Never `taskkill /f /im electron.exe` globally.** The dev machine runs multiple
Electron apps (UltraWhisperFlow etc.). Always filter by the beaver-buddy path:
```powershell
Get-CimInstance Win32_Process -Filter "name='electron.exe'" |
  Where-Object { $_.CommandLine -like '*beaver-buddy*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```
This kills only the beaver-buddy instance and leaves other Electron apps untouched.
Applies to pi, Codex, Kimi Code, and all subagents.
