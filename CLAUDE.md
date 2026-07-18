# CLAUDE.md — Beaver Buddy

Read first, every session. `PRD.md` is the product source of truth; this file is the
guardrails. Most work here is executed by autonomous /build items — these rules are
written to be enforceable without a human in the loop.

## What this is

A pixel-art desktop beaver for macOS and Windows: transparent Electron overlay,
roams the screen, canned quips, evolves on AI-token burn (later: MRR). Public repo.

**Scope note:** This repository currently focuses on building out the Windows
implementation. macOS support remains in the codebase but is not actively
extended.

## Stack (locked)

- **Electron + TypeScript strict.** No UI framework (no React/Vue/etc. — canvas + a
  little DOM is the app). Test/build tooling is fixed: vitest, electron-builder.
  Switching away from Electron requires an ADR with measured evidence — never an
  in-item decision.
- Pixel art = PNG sprite sheets on canvas. No SVG sprites, no CSS-animation characters.
- Node and Electron majors pinned in `package.json` (`engines` + exact Electron);
  installs use `npm ci` (lockfile committed and authoritative).
- ADR 001 (the R1 reuse research) must be merged before any item that depends on
  shell or asset-pipeline decisions starts.

## Electron hardening (P1 invariants, checked in review)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for every
  renderer; preload exposes a minimal typed API only.

## App lifecycle

- Only one app instance may run at a time. `src/main/main.ts` requests an Electron
  single-instance lock at startup; a second launch exits immediately without
  creating a window, tray icon, or extra tracking process. If a second launch
  occurs while the running instance is minimized, that instance is restored and
  focused.
- All filesystem, Keychain, and network access lives in the **main process** behind
  narrow validated IPC. The renderer never sees raw paths, log contents, or secrets.
- No remote content: deny navigation, new-window creation, arbitrary protocols,
  downloads, and permission requests. Electron auto-update and crash reporter stay
  disabled (no phone-home).

## Security & privacy (public repo — non-negotiable)

- **No secrets in the repo, ever**: no API keys, tokens, or `.env` files. R9 secrets
  live in the platform's secure storage (macOS Keychain / Windows secure storage)
  — the one sanctioned exception to the single state-directory rule below.
- Usage-log reading (PRD R7) is **read-only and enumerated**: only the specific
  Claude Code / Codex usage files the parser documents, parsed with bounded reads and
  schema validation; treat contents as sensitive AND malformed-by-default. Never log,
  persist, or display raw log content — derived token counts only. Tests use
  synthetic fixtures, never the operator's real `~/.claude` / `~/.codex`.
- XP ingestion is idempotent: durable read cursor, no double-counting across
  restarts, log rotation, or replays.
- Real prompts, repo paths, usernames, or account identifiers must never appear in
  app logs, test fixtures, screenshots, or PR descriptions.
- **The app makes no runtime network calls before the R9 item starts** (R9 is
  phase 2 — do not pull it forward). Development-time networking (`npm ci`, R1
  research, gh) is of course fine. When R9 lands: HTTPS to an allowlist of exactly `api.stripe.com` and
  RevenueCat's documented API host; minimum-scope restricted keys; keys never reach
  the renderer or error messages.
- No telemetry. No LLM/OpenAI calls anywhere in the MVP. Quips are static strings.

## Usage-log paths

Discovery differs per platform — Windows and macOS/Linux are documented
separately below. The source of truth is `src/main/usage/paths.ts`; keep this
section in sync with it.

### Windows

- Claude Code: Union of `%USERPROFILE%\.claude` (legacy) and
  `%USERPROFILE%\.config\claude` (XDG) — every existing location is scanned
  and merged (users who migrated or use WSL toolchains may have data in
  either spot).
- Codex: Union across all existing candidates — `%LOCALAPPDATA%\Codex`,
  `%APPDATA%\Codex`, `~/.codex` (legacy) — merged and deduplicated by relative
  session path (earliest candidate wins on collision; within one root,
  `sessions/` beats `archived_sessions/`).

### macOS / Linux

- Claude Code: Union of `~/.config/claude` (XDG) and `~/.claude` (legacy) —
  every existing location is scanned.
- Codex: `~/.codex` only.

### All platforms

- `CLAUDE_CONFIG_DIR` overrides Claude Code discovery with highest priority.
  It accepts comma-separated paths on all platforms; semicolons are
  additionally accepted (the conventional PATH separator on Windows). Colons
  are intentionally not treated as separators on Windows because they would
  conflict with drive letters (`C:\`).
- `CODEX_HOME` overrides Codex discovery with a single directory.

## Overlay etiquette

- Click-through is a hard invariant: the overlay never steals clicks, keystrokes, or
  focus. Any regression is a P1.
- Standard floating window level only; the pet keeps out of the menu-bar strip and
  Dock area. MVP roaming is the desktop plane (bottom edge + screen edges) — no
  reading other apps' window geometry, no Accessibility API.
- No busy loops; timers coalesced; animation pauses on tray Pause and display sleep.
  Budget: idle CPU ~<5%, movement smooth at display refresh; sprite frames animate at
  their own 8–12 fps cadence (two separate constants — don't conflate render Hz with
  sprite fps).
- HiDPI scaling must not break click-through, pixel-grid discipline, or logical
  bounds. Roaming, hatch placement, bubbles and dirty rects always use logical
  pixels; the canvas backing store and context transform scale by device pixel
  ratio. `imageSmoothingEnabled` stays `false` so pixel art stays nearest-neighbor.

## Code style

- Split files on responsibility; ~300 lines is a smell threshold, not a rule.
- Tuning values (level curve, XP rates, quip cooldowns, sprite fps, render Hz) live
  in small domain config modules — no magic numbers in logic, no single dumping-
  ground constants file.
- Comments carry invariants and rationale for platform workarounds / parsing quirks —
  not narration. No PR/plan references in comments.
- **Quip voice:** every canned line is all-lowercase. Short reactions over
  explainers; "dam" is the beaver expression (never "damn"). Spend-tier quips
  key off today's cumulative token total (weak <2M / ok 2M–20M / crazy ≥20M),
  once per day on upward crossing — not a per-minute rate and not USD.
- App state persists in ONE app-support directory (secrets excepted → platform
  secure storage); deleting it = factory reset.

## Assets

- All sprites follow `assets/STYLE.md` (palette, grid, outline rules) — created by
  the first asset item, then binding. Off-palette colors or mixed pixel densities
  fail the design gate.
- Commit final PNGs + the style guide. STYLE.md records provenance (generator,
  date, human cleanup). Rig-ready character parts (`assets-src/parts/<figure>/`)
  and curated reference images (`assets-src/reference/`) are committed as
  source assets — they are what new figures and animations are built from. Raw
  ComfyUI dumps (`assets-src/comfyui/`) and pre-review bakes
  (`assets-src/baked/`) stay out of the repo: only assets that are actually
  used get committed.

## Dev-time asset authoring (PixiJS studio)

- `tools/puppet-studio/` rigs ComfyUI-generated character parts and bakes
  app-compatible sprite sheets (ADR 003). It is **dev-time tooling only**:
  `pixi.js` is a devDependency, the studio is not part of `npm run build`, and
  an eslint `no-restricted-imports` rule blocks any `pixi.js` import under
  `src/` — the shipped renderer stays plain Canvas2D (ADR 001).
- Run: `npm run studio:parts` (placeholder parts) → `npm run studio`
  → http://localhost:8377/. Baked output goes to `assets-src/baked/`
  (gitignored) and passes the normal asset review before landing in
  `assets/sprites/`.

## Definition of done (every autonomous item)

`npm ci` clean → typecheck → lint → `npm test` → app launches and the item's
acceptance criteria demonstrably hold → diff contains only the item's scope. Then PR.
"Compiles" is never "verified".

For materially visible Windows changes (overlay, tray, icons, HiDPI), the
acceptance criteria must also hold in a Windows design gate: clean/synthetic
desktop screenshots, a verdict under `docs/design-reviews/`, and any FAILs either
fixed or documented as known limitations.

## Testing & design gate

- Every logic module (level curve, XP accrual, log parser, quip scheduler) ships with
  a vitest test.
- The design gate (PRD R10) runs per feature and per materially visible change — not
  per micro-tweak. Screenshots are taken on a clean/synthetic desktop background
  (no personal windows, notifications, or file names) and land in
  `docs/design-reviews/` with verdict notes.
- Windows-specific visual changes must be evaluated on Windows or a Windows VM at
  100 % and at least one HiDPI scaling (preferably 200 %). Automated packaging
  (`electron-builder --win`) is required, but cannot replace the visual gate.

## Git & PRs

- Never commit directly to `main`. One branch/PR per build-loop item
  (`bl-item/<slug>/BL-<i>`), PR titles `[BL-<i>] …`.
- Merges are `gh pr merge --merge` — never squash, never rebase. Only the build-loop
  merges into its integration branch; only a human merges to main.
- Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`).
- New dependencies are justified in the PR body (what it does, why our own ~50 lines
  can't, license — MIT/Apache/BSD only). Default answer is no.

## Autonomous-run rules (build-loop items)

- An item implements its ledger spec — nothing more. Discoveries go to the loop's
  icebox/follow-up routing, never into the current diff.
- Ambiguity about *what* to build → exit `blocked: needs-human`. Ambiguity about
  *how* → pick the least-expansive interpretation, log it in the plan's
  Auto-decisions, move on.
- ADRs (`docs/adr/NNN-title.md`) are for costly or hard-to-reverse cross-cutting
  decisions (renderer approach, state schema, asset pipeline) — not every choice.

## Planning & Flightplan (local-only)

Detailed planning lives in **local, gitignored files** — linked here so every
agent session can find them. They exist on the maintainer's machine only; never
`git add` them, and never copy their contents into committed docs or PRs.

- `.fp-new-projekt/windows-native-flight-plan.md` — the detailed item plan
  (Windows port #1–#62 done; next: #26 MRR mode, #8–#18 animations, #7 final
  adult art).
- Flightplan state lives under `.flightplan/` (one directory, gitignored):
  `STATE.md` (digest: Now/Next), `ROADMAP.md` (milestones/phases),
  `HANDOFF.md` (session resume), `NOTE.md` (idea/task inbox), plus the
  `Planning/` (Milestone/Phase/Wave) and `Debugging/` templates.
- The Flightplan workflow runs via `/fp-status`, `/fp-note`, `/fp-pause`,
  `/fp-resume`. The skills live locally under `.claude/skills/` and
  `.agents/skills/` (gitignored agent tooling, not project content) and are
  also installed globally on the maintainer's machine.
