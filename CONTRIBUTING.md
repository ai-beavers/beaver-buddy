# Contributing to Beaver Buddy

Thanks for helping build the beaver. 🦫 This guide walks you through the whole
process: setup → change → verify → pull request. The rules below are enforced in
review — most of them exist because large parts of this repo are executed by
autonomous build items, so the guardrails must work without a human in the loop.

Two documents to read before you write any code:

- [`PRD.md`](PRD.md) — the product source of truth (what the app is and does).
- [`CLAUDE.md`](CLAUDE.md) — the project guardrails (stack, invariants, style).

## 1. Pick something to work on

- Open an issue first for anything non-trivial, so effort isn't duplicated.
- Good first areas: quips (`src/main/quips/`) and sprite/animation polish
  (`assets/`, `src/renderer/`).
- One change per pull request. If you spot something unrelated that needs
  fixing, open a separate issue/PR for it — do not fold it into your diff.

## 2. Set up your environment

Requires **Node 24.x** and **macOS 14+** or **Windows 10/11**.

```sh
git clone https://github.com/ai-beavers/beaver-buddy.git
cd beaver-buddy
npm ci          # exact, locked dependencies — never `npm install` for setup
npm start       # build + launch the overlay
```

### Agent skills

The repo vendors agent skills in `skills/` (currently the PixiJS v8 set; more,
e.g. ComfyUI skills, land there once they leave the local review loop). Agents
only pick skills up from `.agents/skills/`, which is gitignored — so before
working with agents in this project, install them once after cloning:

```sh
npm run skills:install
```

- The installer copies each `skills/<name>/` to `.agents/skills/<name>/` and
  skips skills that already exist locally, so local edits are never overwritten
  (`node scripts/install-skills.mjs --force` resets to the committed versions).
- Iterate on skills freely in `.agents/skills/` — nothing there is ever
  committed. When a skill is stable and worth sharing, copy it back into
  `skills/` and open a PR.

## 3. Create a branch

Never commit directly to `main`. Branch off an up-to-date `main`:

```sh
git checkout main && git pull
git checkout -b fix/beaver-idle-jitter
```

- Build-loop items use `bl-item/<slug>/BL-<i>` and PR titles `[BL-<i>] …`.
- Human contributions use a short descriptive branch (`fix/…`, `feat/…`,
  `docs/…`, `chore/…`) and the matching conventional prefix in the PR title.

## 4. Make your change

- **TypeScript strict, no UI framework.** Canvas + a little DOM is the app.
  No React/Vue. The shipped renderer is plain Canvas2D — `pixi.js` is dev-time
  tooling only (`tools/puppet-studio/`) and must never be imported under `src/`.
- **Electron hardening is non-negotiable:** `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true` for every renderer; the preload
  exposes a minimal typed API only. The renderer never sees raw paths, log
  contents, or secrets.
- **Code style:** split files on responsibility (~300 lines is a smell
  threshold). Tuning values live in small domain config modules — no magic
  numbers in logic. Comments carry invariants and rationale, not narration.
  Quips are all-lowercase beaver voice; "dam" is the beaver expression
  (never "damn").
- **Security & privacy:** no secrets, API keys, or `.env` files in the repo —
  ever. No telemetry. No runtime network calls. Never log, commit, or
  screenshot real prompts, repo paths, usernames, or account identifiers.
- **Sprites & visual assets** must follow [`assets/STYLE.md`](assets/STYLE.md)
  (palette, grid, outline rules). Commit final PNGs only — raw image-gen
  intermediates stay out of the repo. Catalog new figures/animations in the
  [asset gallery](docs/asset-gallery.md).
- **Two platforms, different directories.** The app ships for **Windows 10/11**
  and **macOS 14+**, and platform behavior genuinely differs — e.g. usage-log
  discovery scans different directories per platform (Windows: Union of
  `%USERPROFILE%\.claude` + `~/.config/claude` and three Codex candidates;
  macOS/Linux: XDG + legacy and `~/.codex` only). The authoritative reference
  is [CLAUDE.md → Usage-log paths](CLAUDE.md#usage-log-paths), kept in sync
  with `src/main/usage/paths.ts`. When you touch platform-specific code, keep
  both platforms in mind: gate with the platform helpers, cover both sides in
  tests, and never let a Windows-only assumption leak into shared code. Note:
  the repo currently **focuses on the Windows implementation**; macOS support
  remains in the codebase but is not actively extended.
- **PixiJS agent skills are vendored** under `.agents/skills/pixijs*` (read by
  Kimi Code, Codex and other agents; Claude Code users may copy them into
  `.claude/skills/` locally). `skills-lock.json` pins them (upstream source +
  SHA-256 per skill) for update detection — don't hand-edit it. Flightplan
  fp-* tooling (`.claude/`, `.agents/skills/fp-*`, `.flightplan/`) is
  maintainer-local and gitignored, not part of the repo.

## 5. Verify — the Definition of Done

All of this must pass locally **before** you open the PR:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm start   # the app launches and your change demonstrably works
```

- Every logic module ships with a vitest test.
- The diff contains only your change's scope — no drive-by refactors or
  reformats.
- "Compiles" is never "verified".

**Design gate for visible changes:** if your change materially affects what
users see (overlay, tray, icons, sprites, HiDPI behavior), take screenshots on
a clean/synthetic desktop (no personal windows, notifications, or file names)
and add a short verdict note under `docs/design-reviews/`. Windows-specific
visual changes need to be checked on Windows at 100 % and at least one HiDPI
scaling (preferably 200 %).

**Animation changes need a frame contact sheet in the PR.** If your change adds
or edits a sprite animation — new/retimed/resized frames, or a new animated
stage (any row of `assets/sprites/*.png`) — include an image in the PR that
shows **every frame of the affected animation(s), laid out in order**, so
reviewers can judge the motion, sizing and consistency directly in the PR
without building the app. Guidelines:

- Show each affected row frame-by-frame. For a **new stage**, include the whole
  sheet so `idle`/`walk` and the animated rows read as the **same character at
  the same size** (a common defect: animation frames that don't match the
  resting sprite).
- Render at an integer nearest-neighbor upscale (~3–8×) so pixels stay crisp,
  on a **contrasting background** — a dark or magenta backdrop makes stray
  transparency obvious (e.g. holes in white detail like the parachute canopy).
- Drag-and-drop the image into the PR description so it previews inline, and
  commit it beside the verdict note under `docs/design-reviews/`.
  `scripts/gen-sprites/contact-sheet.ts` builds labeled per-frame contact sheets
  and is a good starting point.

## 6. Open the pull request

- Use **conventional commit prefixes**: `feat:`, `fix:`, `docs:`, `chore:`.
- Fill in the PR template; link the issue it closes.
- **New dependencies are a hard sell** — the default answer is no. If you truly
  need one, justify it in the PR body: what it does, why ~50 lines of our own
  can't do it, and its license (**MIT / Apache-2.0 / BSD only**).
- Merges are done by a maintainer with `gh pr merge --merge` — never squash,
  never rebase. Please keep your branch merge-ready (no force-pushes after
  review started).

## 7. Reporting a vulnerability

Do **not** open a public issue for security problems.
See [`SECURITY.md`](SECURITY.md) for private reporting.

## Questions?

Open an issue with your question — there is no wrong door. We're happy to help
you get your first PR in.

---

Made with 🦫 by the **[AI Beavers](https://github.com/ai-beavers)** global
builder community.
