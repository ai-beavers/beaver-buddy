# Session Handoff — 2026-08-22

> This handoff is authoritative. Beaver Buddy stores live Flightplan state under `.planning/`, so `/fp-resume` must read `.planning/STATE.md`, `.planning/ROADMAP.md`, the active phase and wave after this file.

## current_state

- **Branch:** `bl-figure/beaver-baby`, pushed to `origin`, 6 commits ahead of `origin/main` and 0 behind. `origin/main` = `5914070` (PR #60, 2026-08-01) — unchanged since then apart from Dependabot.
- **M3/P1 WAVE-1 is complete.** The Herdr evaluation and integration plan now live at `docs/research/herdr-evaluation.md` and `docs/research/herdr-integration-plan.md`.
- **M3 is blocked on the owner, not on work.** Three decisions gate WAVE-2 — and with it M3/P2 and M3/P3.
- Tests 683 passed / 36 skipped (59 files), lint clean.

## completed (this session)

- **Secured everything before touching anything.** Backup at `../_backup-2026-08-22/`: a `git bundle` of all refs (verified, complete history), the uncommitted worktree patch (690 lines), all untracked files, and the gitignored `.flightplan/` mirror (106 files).
- **Pushed `bl-figure/beaver-baby` to `origin`** — 3 commits from 2026-07-27 (baby 360 turnaround sheet, `ingest-turnaround.mjs` + tests, design verdict) had never left this machine. No PR opened.
- **Committed the documentation diff** that had been open in the working tree since 2026-07-26 (`ca56d65`, 20 files), including the previously untracked M3/P1 `WAVE-1.md` research brief.
- **Merged `origin/main` into the branch** (`0ba368f`) after it had fallen 13 commits behind. One conflict in `assets/STYLE.md`, resolved additively — upstream's `toilet-read(8)`/`shake-dry(8)` entries kept ahead of this branch's baby turnaround section, nothing dropped. `package.json` and `docs/asset-gallery.md` auto-merged.
- **Recovered the Herdr research** (`546cdf9`, cherry-pick of `2acdfaa`) from fork PR #3.
- Updated `.planning/` (STATE, ROADMAP, M3/P1 PHASE, NOTE) against verified reality.

## the finding that mattered

The M3/P1 research was **not** missing — it was delivered on 2026-07-26 into the **fork** `rodgi040/beaver-buddy` as PR #3 (branch `codex/analyze-fp-resume-skill-documentation`, commit `2acdfaa`), fork-internal, never pointed at `ai-beavers/beaver-buddy`. Nothing of it existed in the team repo, so the phase read as "not started" for four weeks. The fork PR is still open and unmerged.

Process lesson (recorded in NOTE.md): cloud agents inherit whatever remote configuration they find. The AGENTS.md rule "fork = read-only backup, never push" has to be repeated inside the agent start prompt itself.

## remaining

1. **Owner: answer the three M3/P1 gate questions** (below). Everything in M3 waits on this.
2. Decide whether the Herdr research should reach `ai-beavers/beaver-buddy` as a PR — it currently exists there only on `bl-figure/beaver-baby`.
3. Decide the fate of fork PR #3 (close it, now that the commit is recovered?).
4. Three untracked files are still uncommitted and only backed up: `.kimi-code/mcp.json` (local MCP config — probably belongs in `.gitignore`), `BEAVER BUDDY ANIMATIONS WORKFLOW.json` (1.1 MB ComfyUI workflow), `design-assets/beaver-idle-frame.glsl`.
5. Open independently of M3: M4/P1 WAVE-2 (durable daily aggregate storage), M5 runtime waves, M2/P3 WAVE-3 (paused), 4 Dependabot PRs (#38, #74, #75, #76).

## decisions — the owner gate blocking M3

1. **Distribution:** Herdr as a separately installed and already-running prerequisite; Beaver Buddy neither installs nor bundles it. If the app must work *without* a separate Herdr installation, the plan needs revision and explicit dependency approval.
2. **State language:** Herdr has no `question` state — question, approval request and decision prompt all collapse into `blocked`. Accept a single generic `needs-attention` instead of the `waiting-for-input`/`question` split M3/P1 originally specified?
3. **Scope:** default Herdr session only, with agents required to run inside Herdr panes.

Approving all three makes WAVE-2A and WAVE-2B technically ready with **no new npm dependency** (Node built-in `net` over a local socket / named pipe). WAVE-2C stays gated on Windows beta verification.

## blockers

- **What WAVE-1 could not verify:** no coding agent was tested against a live authenticated session — only the socket protocol, synthetically. Claude Code and Codex rest on Herdr's documentation alone. **Windows was never tested**, and it is the primary target platform.
- Herdr checks `herdr.dev` for update manifests by default — collides with the no-runtime-network invariant; must be disabled via `[update].manifest_check = false` and verified.
- Trust boundary: any same-user process with socket access can forge states. Herdr is a **local advisory source**, not an authenticated authority. Hardening belongs to M3/P3.
- Herdr 0.7.5 is Apache-2.0 — no license obstacle.

## next_action

Owner answers the three gate questions above. Until then M3 cannot move; M4/P1 WAVE-2 and the M5 runtime waves are the available parallel work.

## suggested_skills

- `/fp-resume` — restore this handoff and the live `.planning/` artifacts.
- `/fp-plan` — turn the approved gate answers into WAVE-2A/2B.
