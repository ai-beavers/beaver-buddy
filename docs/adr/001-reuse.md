# ADR 001: OSS reuse research

## Status

Accepted

## Date

2026-07-14

## Context

Beaver Buddy (PRD R1) requires an open-source research pass before any shell
(R2), animation (R3), or usage-parsing (R7) work starts, so those items build
on evidence rather than guesswork. Three areas were surveyed: desktop-pet
projects (overlay shell + roaming/animation patterns), sprite-animation
approaches (library vs. hand-rolled canvas), and local AI-usage-log parsing
(Claude Code / Codex). CLAUDE.md restricts dependencies to MIT/Apache/BSD (and
here, zlib) licenses only, and rules out reading other apps' window geometry
(no Accessibility API) — both apply directly to the verdicts below.

## Decisions

### Summary table

| Project | What it is | License | Verdict |
|---|---|---|---|
| vscode-pets | VS Code webview desktop-pet extension | MIT | Adapt-ideas-only |
| Shimeji-ee lineage (gil, DalekCraft2, Valkryst forks) | Java Swing desktop mascot, window-climbing | zlib (core) + BSD-3-Clause + MIT (i18n) | Adapt-ideas-only |
| DesktopGoose | C#/WinForms Windows desktop pet | **None** | Skip |
| OpenPets (alvinunreal/openpets) | TS/Electron desktop-pet overlay app | MIT | **Reuse** (primary reference) |
| Vixie | Desktop pet | **None** | Skip |
| ccusage | Claude Code / Codex local usage-log CLI (Rust binary) | MIT | Vendor ideas, don't depend |
| codex-trace | Codex session-log viewer UI | MIT | Skip as dep (path-glob confirmation only) |
| PixiJS | WebGL/WebGPU 2D scene-graph engine | MIT | Skip |
| kontra.js | Micro game lib (sprite/loop/physics helpers) | MIT | Skip (borderline) |
| spritejs | Canvas scene-graph sprite lib | MIT | Skip (stale since 2024-06) |

Other projects considered and skipped without a table row: maotoumao/desktop-pet
(MIT, stale since 2024), spyderweb47/Desktop-Virtual-buddy (MIT, window-climbing
pattern we avoid), canvas-sprite-animations (MIT, abandoned 2020/2021, no TS
types), ModelMeter/SessionWatcher (SaaS usage collectors — violate the
no-network constraint), ccstat/cusage-rs/codexusage (unverified licenses, no
advantage over ccusage). All redundant next to the projects above.

### Per-project notes

**vscode-pets** (MIT) — VS Code webview pet extension. No real OS window, so
nothing to borrow for transparency/click-through. Reusable idea: the
animation state-machine shape in `src/panel/states.ts` / `basepettype.ts`
(States enum — sitIdle, walkLeft/Right, runLeft/Right, lie, climb… — with
`nextFrame()` and a `speed` field per pet type). Adapt-ideas-only: wrong
runtime to depend on.

**Shimeji-ee lineage** (zlib core + BSD-3-Clause + MIT i18n, all permissive) —
Java Swing + JNA window introspection that climbs other apps' windows, which
our PRD/CLAUDE.md explicitly rule out. Reusable ideas only: per-frame PNG +
XML action/behavior config (a data-driven animation format) and behavior-tree
roaming variety. Note: unrelated GPL-licensed repos share the "shimeji" name
(a1098832322/shimeji, hitomi-team/shimeji) — not this lineage, not reusable.

**DesktopGoose** — no license (all-rights-reserved by default), C#/WinForms,
Windows-only GDI+. Skip entirely: legal exposure plus wrong platform.

**OpenPets** (MIT, TS, Electron, actively maintained) — strongest match: a
maintained MIT Electron/TS desktop-pet overlay app whose hardening defaults
already match ours. Reuse as primary shell reference (see Guidance below).

**Vixie** — no license. Skip; no code copying possible.

**ccusage** (MIT, Rust-core CLI with a JS/TS data-loader surface) — legally
fine to depend on, but the native Rust binary is heavy for "parse two log
formats into daily/lifetime totals," and its Codex support is explicitly
beta/experimental. Vendor the ideas (path discovery, dedup strategy) from its
adapter source and hand-roll a small TS parser instead of depending on it.

**codex-trace** (MIT) — a session-log *viewer*, not an aggregator; useful only
to confirm the Codex log glob independently of ccusage. Skip as a dependency.

**PixiJS** (MIT) — full WebGL/WebGPU scene-graph engine (881KB min / 251KB
gzip). Forces a persistent GPU-compositor context for what is one animated
sprite; wrong tool for the job and works against the idle-CPU budget. Skip.

**kontra.js** (MIT, 39KB min / 13.7KB gzip, zero deps) — closest borderline
case. Its SpriteSheet/Animation helpers are roughly the 80–100 lines our own
frame-index accumulator needs; pulling in a whole micro game library (loop,
physics, input) for that is not justified. Skip; reconsider only if the
animation state machine grows well beyond one pet.

**spritejs** (MIT) — canvas scene-graph lib but stale (last push 2024-06, npm
2022-12) with 7 transitive deps. Skip.

## License-hygiene note

DesktopGoose and Vixie ship with **no license** (all-rights-reserved by
default under law) — no source code, assets, or config formats from either
may be copied, adapted line-for-line, or depended on; ideas about *what to
avoid* (window-climbing, Windows-only GDI+) are the only takeaway. Per
CLAUDE.md's dependency policy, only MIT/Apache/BSD/zlib-licensed code may be
copied or added as a dependency — every "Reuse" or "Adapt" verdict above
satisfies that; every "Skip" either fails the license test or fails it on
merit (heavy, stale, wrong-platform, or redundant).

## Guidance for downstream items

### Shell (BL-2 / PRD R2)

OpenPets (MIT) is the primary reference; its hardening defaults already match
CLAUDE.md's Electron invariants (`contextIsolation: true`, `nodeIntegration:
false`, `sandbox: true`). Concrete modules/mechanisms to follow:

- `apps/desktop/src/pet-window.ts` `createBasePetWindow` options: `frame:
  false`, `transparent: true`, `skipTaskbar`, `alwaysOnTop`, `hasShadow:
  false`, `backgroundColor: "#00000000"`, plus the `webPreferences` block
  above.
- `installMousePassthroughAndDrag()` — click-through/drag via
  `setIgnoreMouseEvents`, with per-platform mouse-forwarding and a
  `setPassthrough()` helper; this is the direct mechanism for the "never
  steals clicks" invariant.
- `display.ts` clamping — `clampToNearestDisplayIfOffscreen`,
  `clampToVisibleWorkArea`, `getDefaultPetInitialPosition` — for keeping the
  overlay on the primary display and out of the menu-bar/Dock strip.
- `tray.ts` pattern — `Tray` + `Menu.buildFromTemplate` with pause/resume,
  matching the R2 tray-menu acceptance criterion.

Explicitly **excluded**: `window-tracker.ts`, `window-occlusion.ts`, and
`terminal-focus.ts` — these read other apps' window geometry to climb/occlude
against them. Our roaming is desktop-plane only (bottom edge + screen edges,
per CLAUDE.md) and must never touch the Accessibility API; these modules are
cleanly separated in OpenPets and can simply be omitted.

### Animation/roaming (BL-4 / PRD R3)

Plain canvas, no sprite library. PixiJS is a persistent-GPU-context
scene-graph engine for what is one animated sprite (rejected on power/weight
grounds — WebKit guidance notes simple WebGL scenes can burn more power than
lean Canvas2D). kontra.js's helpers are ~80–100 lines we'd write anyway, and
its game-loop/physics/input machinery is unused weight (rejected as
unjustified; reconsider only if the animation state machine grows well
beyond one pet). spritejs is stale since 2024-06 (rejected on maintenance
grounds).

Design:
- Two clocks, matching CLAUDE.md's "two separate constants" rule: a `rAF`
  loop drives movement interpolation; a separate 83–125ms (8–12fps)
  accumulator drives sprite-frame index.
- Keep Electron's `backgroundThrottling` enabled (default) — do not disable
  it; it's how the idle-CPU budget is met when occluded.
- Gate draws on `document.visibilityState`/occlusion, and skip redraws when
  nothing moved — transparent windows force the WindowServer to resample the
  desktop behind on every paint, so unnecessary redraws are costlier than on
  an opaque window.
- `ctx.imageSmoothingEnabled = false` to keep pixel art crisp.
- vscode-pets' `states.ts` state-machine shape (per-state `nextFrame()` +
  `speed`) is the design reference for the roaming/animation state machine —
  ported as a pattern, not copied code (wrong runtime).

### Usage parsing (BL-5 / PRD R7)

Hand-roll a small TS parser; vendor ideas from ccusage's (MIT) adapter source
(`rust/crates/ccusage/src/adapter/claude/*.rs` and `.../codex/*.rs`) for path
discovery and dedup strategy, rather than depending on the ccusage package —
it ships as a native Rust binary (heavy for "daily + lifetime totals") and
its Codex support is explicitly beta/experimental.

Concrete log-format facts to implement against:

- **Claude Code**: `$CLAUDE_CONFIG_DIR` (comma-separated) →
  `~/.config/claude/projects/` → legacy `~/.claude/projects/`, glob
  `projects/{project}/{session}.jsonl` (+ `{session}/subagents/{subagent}.jsonl`).
  Assistant lines carry `message.usage` with `input_tokens`,
  `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`.
  Dedup key is `message.id` + `requestId` — but ccusage's own keep-first
  dedup has a known bug (GH #888): recent Claude Code logs an intermediate
  usage snapshot before the final one under the same key, so keep-first
  undercounts output tokens. Our parser should use keep-**last** (or
  max-per-field) instead. Schema drifts silently between Claude Code
  releases — parse defensively (missing fields default to zero, don't
  throw).
- **Codex**: `$CODEX_HOME` (default `~/.codex`), files at
  `sessions/YYYY/MM/DD/rollout-{ISO}-{UUID}.jsonl` (plus
  `archived_sessions/`, with `sessions/` winning on duplicate relative
  path). Token events are `{type: "event_msg", payload: {type:
  "token_count", info: {total_token_usage: {input_tokens,
  cached_input_tokens, output_tokens, reasoning_output_tokens}}}}` and are
  **cumulative per session** — per-day/per-turn totals require taking deltas
  between consecutive events, not summing raw values.

Use ccusage's `--json` CLI output as the ±5% acceptance cross-check tool
required by R7 (run it locally on the same machine, compare totals — do not
depend on it programmatically).

## Consequences

- BL-2 (shell) has a concrete, license-clear (MIT) reference implementation
  to follow for the transparent/click-through overlay and tray, which removes
  the biggest open question (does Electron overlay quality suffice) — OpenPets
  proves the pattern works in production.
- BL-4 (animation) avoids adding any runtime dependency for sprite rendering;
  the plain-canvas approach is a small, fully-owned surface (~50–100 lines)
  with no license or maintenance risk, at the cost of writing (and testing)
  the sheet-slice/accumulator logic ourselves instead of importing it.
- BL-5 (usage parsing) avoids a heavy native-binary dependency and an
  experimental Codex path, at the cost of maintaining our own parser against
  log formats that "drift silently between releases" (per ccusage's own
  findings) — this parser will need defensive schema handling and its own
  test fixtures (synthetic, per CLAUDE.md — never real `~/.claude`/`~/.codex`
  contents).
- No code is copied from DesktopGoose or Vixie (unlicensed) or from GPL
  "shimeji" repos outside the Shimeji-ee lineage — only ideas/patterns, never
  literal source.
- If OpenPets, ccusage, or kontra.js are later added as actual npm
  dependencies (rather than pattern references), that still requires the
  standard PR-body license/justification per CLAUDE.md's dependency policy —
  this ADR documents the reuse *decision*, not a blanket dependency add.
