# AGENTS.md — Beaver Buddy

Entry point for coding agents (Codex, Kimi Code, and others). The project
guardrails live in [`CLAUDE.md`](CLAUDE.md) — read it first, every session. It
covers the locked stack, Electron hardening invariants, security/privacy rules,
code style, the definition of done, and the git/PR workflow.

The product source of truth is [`PRD.md`](PRD.md); contributions are governed by
[`CONTRIBUTING.md`](CONTRIBUTING.md).

For animation authoring, see [`docs/animation-authoring.md`](docs/animation-authoring.md)
and load the PixiJS routing skill at `.agents/skills/pixijs/SKILL.md` first.

Local planning docs (Flightplan: `.flightplan/` with `STATE.md`, `ROADMAP.md`,
`HANDOFF.md`, `NOTE.md`, `Planning/`; plus the `.fp-new-projekt/` archive) are
gitignored by design — see the "Planning & Flightplan (local-only)" section in
`CLAUDE.md`.

## Dependencies — HARD RULE

**No new dependencies without explicit prior approval from the maintainer.**

- Never add a new package to `package.json` (runtime or dev) on your own.
- Never work around this by vendoring/copying third-party code instead.
- If a task seems to require a new dependency: STOP, explain why it is needed,
  propose alternatives with the existing stack, and wait for approval.
- This applies to all agents (Codex, Kimi Code, etc.) and all subagents.
  No exceptions.
