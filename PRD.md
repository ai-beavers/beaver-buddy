# PRD: Beaver Buddy — a pixel-art desktop beaver for macOS

## Vision

A Tamagotchi-style desktop pet in the spirit of VS Code Pets — but living on the
macOS desktop itself, not inside an editor. A unique, pixel-art **beaver** runs
around your screen, reacts to what you do, occasionally says something, and
**evolves as you burn AI tokens** (or, later, as your MRR grows). It must look
genuinely good — cool colors, coherent pixel aesthetic, "Steve Jobs and Jony Ive
would be proud" — never like AI slop.

## Explicitly OUT of scope (MVP)

- No chat with the beaver, no question-asking UI, no buttons for prompts.
- No OpenAI / LLM calls anywhere in the MVP. Quips are canned strings.
- No Windows/Linux, no multiple simultaneous pets, no App Store distribution.
- No telemetry.

## Tech direction (decided)

- **Electron + TypeScript (strict)**. Transparent, frameless, click-through,
  always-on-top overlay window; tray (menu-bar) app. Swift/AppKit is the
  documented fallback if Electron's overlay quality or perf proves inadequate —
  record the evidence in an ADR before switching.
- Pixel art = **PNG sprite sheets** rendered on a canvas (SVG contradicts the
  pixel aesthetic and complicates frame animation).
- Sprite/asset generation: image-gen (Codex/ChatGPT image tooling) as the
  starting point, then cleaned to a fixed palette and grid for consistency.

## Requirements

### R1: Open-source research pass (first item, blocks asset/shell decisions)
Survey existing OSS we can reuse instead of building blind: vscode-pets,
shimeji-ee / shimeji forks, DesktopGoose, Electron desktop-pet projects,
**ccusage** (Claude Code local-log token parsing) and equivalent Codex usage
tooling, plus any pixel sprite-animation libs.
**Acceptance:** an ADR (`docs/adr/001-reuse.md`) listing ≥5 evaluated projects
with reuse/skip decisions and license notes; the chosen reuse targets are
reflected in later items' implementations.

### R2: Overlay app shell
Electron tray app; transparent click-through overlay on the primary display;
beaver layer NEVER steals clicks or keystrokes from the apps below; tray menu
with Pause/Resume and Quit; launches on macOS 14+.
**Acceptance:** with the beaver on screen, clicking "through" it hits the app
underneath; idle CPU < 5%; overlay survives display sleep/wake.

### R3: Sprite animation system
Sprite-sheet renderer (canvas, 8–12 fps pixel timing): idle, walk left/right,
run, sleep, react/celebrate. The beaver roams the screen (left/right along the
bottom edge; up/down along screen edges), with natural pauses. Walking on other
apps' window tops is OUT of MVP — it would require the Accessibility permission
to read window geometry; icebox it.
**Acceptance:** all listed animations play from one sprite-sheet format; roaming
never jitters or teleports; movement pauses when Paused from tray.

### R4: The beaver — unique pixel asset set
One unique beaver character in three life stages (baby / teen with visibly more
muscle / adult, bigger again), fixed cool-toned palette, consistent grid across
all stages and animations. A short style guide (`assets/STYLE.md`) pins palette,
grid, and outline rules so future frames stay coherent.
**Acceptance:** all three stages + full animation set exist as sprite sheets;
passes the R10 design gate; a stranger would call it distinctive, not generic.

### R5: Hatch onboarding
First launch: a pixel-art beaver **lodge** appears in a screen corner, shakes
Pokémon-hatch style with escalating intensity, bursts in a particle "explosion",
and the baby beaver emerges and settles in the corner. Runs exactly once
(re-triggerable via a hidden reset for QA).
**Acceptance:** full sequence plays at 60fps-smooth without frame skips; state
persists so relaunch skips straight to the pet.

### R6: Quips (no LLM)
Pixel speech bubble; canned quip pool triggered by events: app start, long
continuous coding session, **daily token-spend tiers** (weak / ok / crazy —
once per day on upward crossing of today's cumulative token total), idle
period, evolution moments. Frequency-capped so it's charming, not annoying.
Voice: **all-lowercase**, short reactions (not explainers), Gen Z / tech-bro
slang OK, beaver "dam" as expression (not "damn").
**Acceptance:** each trigger type demonstrably fires; no more than one quip per
cooldown window; copy tone reviewed in R10 gate.

### R7: Token-burn tracking (growth system 1)
Parse **local** Claude Code and Codex usage (ccusage-style log parsing from
~/.claude and ~/.codex — no API keys, no network) into daily and lifetime token
totals, refreshed on a timer.
**Acceptance:** totals match ccusage output within ±5% on the same machine;
missing/absent logs degrade gracefully to zero without errors.

### R8: Level & evolution system
XP accrues from tracked tokens. Levels 1–15 = baby, **16 = evolution to teen**,
**32 = evolution to adult** (thresholds continue doubling for future stages).
Evolution plays a dedicated animation (shake → flash → new stage). Level + XP
persist locally and are visible in the tray menu.
**Acceptance:** simulated XP injection walks the beaver through both evolutions
with animations; state survives relaunch; level curve is defined in one
constants file.

### R9: MRR growth mode (growth system 2, phase 2)
Optional settings: connect **Stripe** and/or **RevenueCat** with read-only keys;
daily MRR poll converts to XP under a user-selected mode toggle
(tokens | MRR). Keys stored in macOS Keychain, never in plaintext config.
**Acceptance:** with a test Stripe account, MRR fetch works and drives XP; with
no keys, the mode is hidden; toggling modes never double-counts XP.

### R10: Design QA gate (cross-cutting)
Every UI-visible item (R3–R6, R8) closes with a designer-skill review pass
(frontend-design / design-review) on real screenshots: palette coherence, pixel
grid discipline, animation timing, "would a human designer approve this?"
**Acceptance:** review artifacts (screenshots on a clean/synthetic desktop — no
personal windows, notifications, or file names; repo is public — plus verdict
notes) committed under `docs/design-reviews/`; any FAIL loops back before the
item merges.

## Non-functional

- TypeScript strict mode; ESLint clean; app bundle < 300 MB.
- All persistent state in one local app-support directory; delete = fresh pet.
- 60fps target for movement; battery-friendly (no busy loops, timers coalesced).
