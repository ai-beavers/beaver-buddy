# Plan — Fork → upstream migration (COMPLETED 2026-07-22)

> **Status: fully implemented.** PR #41 (animation-authoring docs) and PR #40
> (vendored skills + Cycle-1 planning, fully English) were merged by Gw3i.
> Remote layout swapped: `origin` = ai-beavers/beaver-buddy (contributor workflow:
> branch from `origin/main`, push to `origin`, PR against ai-beavers/main; rule
> recorded in AGENTS.md). Fork `rodgi040/beaver-buddy` remains as read-only
> backup remote `fork` (archiving in the GitHub UI is a pending owner action).
> 15 stale upstream branches were closed with `archive/*` tags; tags `v0.1.0` +
> `docs/animation-authoring` pushed upstream. Dependabot PRs #38/#39 remain for
> owner merge. The full step-by-step plan lived in this file during execution;
> see git history (2026-07-22) for details.

---

# Plan — Flightplan Re-Onboarding & Cycle-1 Planning

> Context: The old Flightplan version did not sort `.flightplan/` cleanly; the meeting
> of 2026-07-21 (`.fp-new-projekt/MEETINGS-TRANSCRIPTS/`) defines **Cycle 1** for the first time,
> which is not reflected in any planning file. The ongoing M2/P3 parachute work
> (WAVE-3 with Claude Code) is **paused** and will be continued later.
>
> **Team (3 contributors):**
> - **Rodgi (Owner)** — involved everywhere; focus: building features together, helping
>   with animations, **precise definition of the state logic**; overall review & owner decisions
> - **Vlady** — **sprite animations** (drives Claude Code/ComfyUI generation, asset review)
> - **Jurij** — **event logic & hard tech** (state machine, tracking, IPC, architecture)
> - **Agent rule (binding): pi = Rodgi only** · **Claude Code = Vlady & Jurij, everywhere**
>   (not just assets; still the only agent with Comfy Cloud MCP)
>
> Tasks are distributed so that work does not overlap:
> exactly **one human Accountable per phase**, parallel work only on disjoint phases.

## Step 0 — Pause the running phase cleanly (fp-pause)

- Rewrite `HANDOFF.md`: status „WAVE-3 PAUSED (owner decision)". Document the resume path
  exactly: Claude Code later continues P1 (white artifacts) + P3a (struggle-b/c)
  via `/fp-resume`; pi then P2/P4/P3b. Spec remains `WAVE-3.md`.
- `STATE.md`: set Now/Next to „re-onboarding & Cycle-1 planning"; P3 as „paused".
- `Planning/Milestone-2/Phase-3/PHASE.md`: status → `in-progress (paused)`.

## Step 1 — Cleanup & migration (re-onboarding)

Target structure (all local/gitignored, convention stays):

```
.flightplan/
  STATE.md · ROADMAP.md · HANDOFF.md · NOTE.md
  Meetings/2026-07-21-planung/   ← raw transcript text + summary + animations raw text
  Reference/windows-native-flight-plan.md   ← active item source #1–#64
  Archive/                        ← .fp-new-projekt remainder (phase-*.md, plans/, …)
  Planning/Milestone-N/Phase-N/…  (unchanged)
  Reviews/ · Debugging/
```

- `MEETINGS-TRANSCRIPTS/` → `.flightplan/Meetings/2026-07-21-planung/` (normalize
  filenames: `transcript-raw.md`, `summary.md`, `animations-rohtext.md`).
- `windows-native-flight-plan.md` → `.flightplan/Reference/`.
- Remainder of `.fp-new-projekt/` → `.flightplan/Archive/`; then delete `.fp-new-projekt/`.
- **Update references:** ROADMAP.md, MILESTONE.md (M1–M4), NOTE.md; check `.gitignore`.
- **Clean up NOTE.md:** mark F2 as done; remove inbox duplicates; add new
  meeting items to the inbox (Level/XP, Recording Agent, naming, achievements,
  prestige, safety mechanism, account linking later, cosmetic monetization).
- **Fix Debugging/README.md** (reference to non-existent `Planning/Debugging/`).

## Step 2 — Anchor Cycle 1 in ROADMAP.md

- **Cycle-1 header** with exit criteria (meeting 2026-07-21):
  1. Working, downloadable app (Windows installer)
  2. 100 downloads
  3. 7 additional contributors (currently: 3 — Owner, Vladi, Juri)
- Every milestone gets a cycle marker + **owner field** (team responsible).
- Reference block (source: `Meetings/…/summary.md`): XP = input+output tokens (excluding cache),
  daily-aggregated per model, local config file (no auth in Z1), levels 1–32
  (1–16 ≈ baby→teen), interactions from ~level 8, prestige post-Z1, character-map JSON,
  separation of event logic ↔ character animation.

## Step 3 — Define milestones together (team walkthrough)

**Order (option B, derived from meeting signals + dependencies — draft,
finalized in the walkthrough) — with team assignment:**

| # | Milestone | Core | Accountable | Agent | Cycle |
|---|---|---|---|---|---|
| M1 | Windows-native app ✅ | done | Rodgi | pi | Z1 (done) |
| M2 | Asset pipeline & animations | P1/P2 ✅ · **P3 parachute paused** | Vlady + Rodgi | Claude Code (+ pi) | ongoing |
| M3 | Recording Agent & notifications | central Z1 feature: event detection (agent done/input needed), event↔animation strictly separated, safety mechanism; display initially via bubble/quip | **Jurij** | Claude Code | Z1 |
| M4 | Level, XP & profile system | token tracking (aggregated/per model), XP prototype, level table 1–32, state logic of the stages, character-map JSON, local persistence, naming, achievements | **Rodgi** (Jurij advises on data model) | pi | Z1 |
| M5 | Animations (rest) | formerly M2 P4–P15 — „one animation per phase"; WAVE-1 assets = Vlady + Claude Code, WAVE-2 runtime = Rodgi + pi | **Vlady** | Claude Code | Z1 (staggered) |
| M6 | Contribution readiness & release | contributor/API/asset-builder docs, settings/tray, QA gates, release pipeline → **Z1 exit** | **Rodgi** (everyone reviews) | pi | Z1 |
| — | Post-Cycle 1 | auth/account, prestige, monetization, MRR #26, quips/state machine extensions, owner decisions #3/#4b/#63/#64 | — | — | post |

**Procedure in the walkthrough (interactive with the team):**
1. Confirm/adjust milestone order (table above).
2. Per milestone: define purpose in 2–3 sentences (team-comprehensible) + phase list.
   Phases stay deliberately coarse; detailed definition as usual at phase start.
3. **Time estimate:** rough size per phase (S/M/L + day estimate), milestone duration
   aggregated from that; reality check against the Z1 time horizon (~2 months per meeting).
4. **Team matrix (binding):** see table — Jurij = M3, Rodgi = M4 + M6,
   Vlady = M5. Rules: exactly one Accountable per phase; Rodgi helps everywhere
   but is never a hidden second owner. **Agent rule: only Rodgi uses pi;
   Vlady & Jurij work with Claude Code in all milestones.** Agents
   work only on instruction from the respective phase owner.
5. **Blocker/dependency documentation (mandatory, directly in Flightplan):**
   - Every `PHASE.md` gets a mandatory **`Blocked by:`** field (phase list or „none", with reason).
   - Every `MILESTONE.md` gets a **Dependencies** section (blocked by / blocks).
   - `ROADMAP.md` contains a compact **dependency overview** (table) so the
     team sees at a glance what blocks whom.
   - The `STATE.md` blockers field remains the short operational view.
6. Write the result into `ROADMAP.md` + `Planning/Milestone-N/MILESTONE.md` (Why/Phases/Success/
   Owner/Duration/Dependencies); dissolve old M3/M4 and reassign items.

## Step 4 — Verification & handoff

- Self-check: all `.fp-new-projekt` references resolved? ROADMAP lean? NOTE.md without
  duplicates? STATE/HANDOFF consistent? Does every phase have exactly one owner?
- `STATE.md` final: „re-onboarding done · Cycle 1 defined · M2/P3 paused" +
  next = detail the first phase of the first new milestone.
- No code changes, no git commits (planning files are gitignored).

## Execution

- Steps 0–2: `worker` subagent + `reviewer` check, orchestrator verifies references.
- Step 3: interactive with the team (no subagent — decisions belong to the humans);
  the agent writes the results into the files after approval.
- Step 4: `reviewer` subagent as final consistency check.

