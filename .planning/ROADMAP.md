# Roadmap — Beaver Buddy

> The route: milestones and their phases. `[ ]` open · `[x]` done.
> Waves live in each phase's `Planning/Milestone-N/Phase-N/Waves/WAVE-X.md`.
> Item-Specs #1–#64: `.flightplan/Reference/windows-native-flight-plan.md` ·
> Meeting source Cycle 1: `.flightplan/Meetings/2026-07-21-planung/`

## 🎯 Cycle 1 (defined 2026-07-21)

**Exit criteria:** ① downloadable app (installer via release pipeline) ② 100 downloads ③ 7 contributors (currently 3)
**Horizon:** ~6–8 weeks with parallel work (M3 ∥ M4 ∥ M5 assets)

**Team & agents (binding):**
| Person | Role | Agent |
|---|---|---|
| Rodgi (Owner) | State-logic definition, features, review, owner decisions | **pi (Rodgi only)** |
| Vlady | Sprite animations | **Claude Code** |
| Jurij | Event logic, hard tech | **Claude Code** |

Rule: exactly **one accountable per phase**; agents work only for the phase owner.

## Milestones

### M1 — Windows-native app ✅ · Z1 (done, Rodgi)
- [x] Phase 1 — Windows infrastructure (#1–#6)
- [x] Phase 2 — Round 2 parity & polish (#46–#62)

### M2 — Asset pipeline & animations · in progress (Vlady + Rodgi)
- [x] Phase 1 — PixiJS Puppet Studio (BL-14)
- [x] Phase 2 — ComfyUI “PixelArt Builder"
- [ ] Phase 3 — Parachute drop · **PAUSED** (WAVE-1/2 ✅, WAVE-3 open → resume via Claude Code, spec `Milestone-2/Phase-3/Waves/WAVE-3.md`)

### M3 — Recording Agent & notifications · Z1 (**Jurij**, 2–3 w)
- [ ] Phase 1 — Event detection via **Herdr** (open-source agent overview; done / input needed) · none
- [ ] Phase 2 — Notification display (bubble/sign) · ← M3/P1
- [ ] Phase 3 — Security gate & event↔animation hardening · ← M3/P1

### M4 — Level, XP & profile system · Z1 (**Rodgi**, 3–4 w, ∥ M3)
- [ ] Phase 1 — Token tracking & aggregation (daily, per model, no cache; #24/#25) · none
- [ ] Phase 2 — XP/level model + level table 1–32 · ← M4/P1
- [ ] Phase 3 — Persistence & profile (naming, achievements) · ← M4/P2
- [ ] Phase 4 — Character-map JSON (level↔sprites↔animations) · ← M2/P1–P2 ✅

### M5 — Animations (rest) · Z1 staggered (**Vlady**, ~1 w/animation)
- [ ] P1 Tree (#15) · P2 Coding (#8) · P3 Drinks (#9) · P4 Sleep (#10) · P5 Stretch (#11) — **Z1 scope**
- [ ] P12 Stage art package: young baby, older teenager, adult (#7) — **Z1 (added later: 5 life stages)**
- [ ] P6–P11 (Talk, Sport, Stick, Toilet, Phone, Meeting) — **post-Z1**

### M6 — Contribution readiness & release · Z1 exit (**Rodgi**, ~2 w)
- [ ] Phase 1 — Contributor/API/asset-builder docs · ← M3, M4
- [ ] Phase 2 — Settings & tray (#33–#36) · none
- [ ] Phase 3 — QA & design gates (#37–#41) · ← M5 Z1 scope
- [ ] Phase 4 — Release pipeline & distribution (#42–#45, download tracking) · none → **Z1 exit**

### Post-Cycle 1
Auth/account linking · Prestige system · Cosmetic monetization · MRR #26/#27 ·
Overlay & window behavior #28–#32 · Quips/state-machine extensions #19–#23 ·
M5 P6–P12 · Owner decisions #3/#4b/#63/#64 · Hidden easter eggs (NOTE.md)

## 🔗 Dependency overview

| Phase | Blocked by | Reason |
|---|---|---|
| M3/P1, M4/P1, M6/P2, M6/P4 | **none** | can be started in parallel immediately |
| M5 assets (all phases) | M2/P1–P2 ✅ | already fulfilled → assets can start immediately |
| M3/P2, M3/P3 | M3/P1 | display/security need event model |
| M4/P2 | M4/P1 | XP model needs token data basis |
| M4/P3 | M4/P2 | profile/achievements need level model |
| M4/P4 | M2/P1–P2 ✅ | character map uses bake format |
| M5 runtime (level-trigger) | M4/P2 | unlock from ~level 8 |
| Future event animations (new M5 phases, e.g. holding up a sign) | M3/P2 | display contract from Recording Agent |
| M6/P1 | M3, M4 | docs document their architecture |
| M6/P3 | M5 P1–P5 | QA/design gates need Z1 animation scope |

**Long version:** `Blocked by:` field in every `PHASE.md`, `Dependencies` section in every `MILESTONE.md`.
