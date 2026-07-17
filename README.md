# Beaver Buddy 🦫

A pixel-art desktop beaver for macOS. It hatches from a lodge on first launch, then
roams your desktop, drops the occasional quip, and **evolves as you burn AI tokens** —
a Tamagotchi for people who live in Claude Code and Codex.

> Built by **[AI Beavers](https://github.com/ai-beavers)** — a global community of
> builders. Contributors welcome (see [Contributing](#contributing) below).

<p align="center">
  <img src="assets/sprites/beaver-baby.png" alt="Baby beaver sprite sheet" width="200">
  &nbsp;&nbsp;
  <img src="assets/sprites/beaver-teen.png" alt="Teen beaver sprite sheet" width="200">
</p>
<p align="center"><em>baby → teen — the beaver evolves as you burn tokens</em></p>

## What it does

- **Lives on your desktop** — a transparent, always-on-top, **click-through** overlay
  (it never steals a click, keystroke, or focus) plus a menu-bar tray icon.
- **Hatches once** — first run plays a Pokémon-style lodge hatch, then the baby beaver
  settles in and starts roaming the screen edges.
- **Talks** — canned pixel speech-bubble quips (all-lowercase beaver voice) fire
  on events: app start, long coding session, daily token-spend tiers
  (weak / ok / crazy), idle, evolution. Frequency-capped so it stays charming.
  No LLM, no network — the lines are static strings.
- **Grows on your token burn** — reads your **local** Claude Code / Codex usage logs
  (`~/.claude`, `~/.codex`), turns them into XP, and evolves the beaver through life
  stages: **baby → teen → adult**. Reading is read-only, offline, and never leaves
  your machine — only derived token counts, never prompt contents.
- **Optional MRR mode** — instead of tokens, drive XP from Stripe / RevenueCat
  (read-only keys stored in the macOS Keychain). Off by default.
- **Respects you** — no telemetry, no auto-update, no phone-home. Pause anytime from
  the tray; animation pauses on display sleep.

macOS only (14+). No Windows/Linux.

## Run it

```bash
npm ci      # install exact, locked dependencies
npm start   # build + launch the overlay
```

Requires **Node 24.x** and **macOS 14+**. To re-play the hatch after first launch,
run with `--reset-hatch`.

## Project layout

- `src/main/` — Electron main process: overlay window + hardening, tray, usage-log
  parsing, XP/evolution engine, optional MRR (Stripe/RevenueCat) behind IPC.
- `src/renderer/` — the pet itself: canvas sprite rendering, roaming, quip bubbles,
  hatch/evolution animations (sandboxed, no Node access).
- `assets/` — committed PNG sprite sheets + `STYLE.md` (palette/grid rules).
- `scripts/gen-sprites/` — the asset-generation pipeline.

## Contributing

Contributions are welcome. This repo is executed largely by autonomous build items, so
the guardrails are strict and enforced in review — please read
[`CLAUDE.md`](CLAUDE.md) (the full guardrails) and [`PRD.md`](PRD.md) (the product
source of truth) before opening a PR.

The essentials:

- **One branch + PR per change.** Branch `bl-item/<slug>/BL-<i>`, PR title `[BL-<i>] …`
  (or `[chore] …` / `[docs] …` for housekeeping). Never commit to `main`.
- **Conventional commits** — `feat:`, `fix:`, `docs:`, `chore:`.
- **Definition of done** — before you open the PR, all of these pass locally:
  ```bash
  npm ci && npm run typecheck && npm run lint && npm test
  ```
  plus the app launches and your change's acceptance criteria demonstrably hold, and
  the diff contains only your change's scope. "Compiles" is not "verified".
- **New dependencies are a hard sell.** Default answer is no. If you truly need one,
  justify it in the PR body (what it does, why ~50 lines of our own can't, and its
  license — **MIT / Apache-2.0 / BSD only**).
- **Merges are `--merge`** (no squash, no rebase). Only a human merges to `main`.
- **Security & privacy are non-negotiable** — no secrets in the repo, no telemetry,
  and never log or commit real prompts, repo paths, usernames, or account identifiers.
  See [`SECURITY.md`](SECURITY.md) to report a vulnerability privately.

New to the project? Good first areas are quips (`src/main/quips/`) and sprite/animation
polish (`assets/`, `src/renderer/`).

## License

[Apache-2.0](LICENSE).

---

Made with 🦫 by the **[AI Beavers](https://github.com/ai-beavers)** global builder
community.
