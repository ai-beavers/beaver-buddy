# Roadmap — Beaver Buddy

> The route: milestones and their phases. `[ ]` open · `[x]` done.
> Waves live in each phase's `Planning/Milestone-N/Phase-N/Waves/WAVE-X.md`.
> Item-Specs #1–#64: `.flightplan/Reference/windows-native-flight-plan.md` ·
> Meeting-Quelle Zyklus 1: `.flightplan/Meetings/2026-07-21-planung/`

## 🎯 Zyklus 1 (definiert 2026-07-21)

**Exit-Kriterien:** ① herunterladbare App (Installer via Release-Pipeline) ② 100 Downloads ③ 7 Contributors (aktuell 3)
**Horizont:** ~6–8 Wochen bei paralleler Arbeit (M3 ∥ M4 ∥ M5-Assets)

**Team & Agenten (verbindlich):**
| Person | Rolle | Agent |
|---|---|---|
| Rodgi (Owner) | State-Logik-Definition, Features, Review, Owner-Entscheide | **pi (nur Rodgi)** |
| Vlady | Sprite-Animationen | **Claude Code** |
| Jurij | Event-Logik, hart Technisches | **Claude Code** |

Regel: genau **ein Accountable pro Phase**; Agenten arbeiten nur für den Phase-Owner.

## Milestones

### M1 — Windows-native App ✅ · Z1 (erledigt, Rodgi)
- [x] Phase 1 — Windows-Infrastruktur (#1–#6)
- [x] Phase 2 — Runde 2 Parität & Feinschliff (#46–#62)

### M2 — Asset-Pipeline & Animationen · läuft (Vlady + Rodgi)
- [x] Phase 1 — PixiJS Puppet Studio (BL-14)
- [x] Phase 2 — ComfyUI „PixelArt Builder"
- [ ] Phase 3 — Fallschirm-Drop · **PAUSIERT** (WAVE-1/2 ✅, WAVE-3 offen → Resume via Claude Code, Spec `Milestone-2/Phase-3/Waves/WAVE-3.md`)

### M3 — Recording Agent & Benachrichtigungen · Z1 (**Jurij**, 2–3 W)
- [ ] Phase 1 — Event-Erkennung via **Herdr** (Open-Source-Agent-Übersicht; fertig / Input nötig) · none
- [ ] Phase 2 — Benachrichtigungs-Darstellung (Bubble/Sign) · ← M3/P1
- [ ] Phase 3 — Security-Gate & Event↔Animation-Härtung · ← M3/P1

### M4 — Level-, XP- & Profil-System · Z1 (**Rodgi**, 3–4 W, ∥ M3)
- [ ] Phase 1 — Token-Tracking & Aggregation (täglich, pro Modell, ohne Cache; #24/#25) · none
- [ ] Phase 2 — XP-/Level-Modell + Level-Tabelle 1–32 · ← M4/P1
- [ ] Phase 3 — Persistenz & Profil (Namensgebung, Achievements) · ← M4/P2
- [ ] Phase 4 — Character-Map-JSON (Level↔Sprites↔Animationen) · ← M2/P1–P2 ✅

### M5 — Animationen (Rest) · Z1 gestaffelt (**Vlady**, ~1 W/Animation)
- [ ] P1 Baum (#15) · P2 Coding (#8) · P3 Drinks (#9) · P4 Schlaf (#10) · P5 Stretch (#11) — **Z1-Scope**
- [ ] P12 Stufen-Art-Paket: junges Baby, älterer Jugendlicher, Erwachsener (#7) — **Z1 (nachgezogen: 5 Lebenszyklen)**
- [ ] P6–P11 (Sprechen, Sport, Stock, Toilette, Handy, Meeting) — **post-Z1**

### M6 — Contribution-Readiness & Release · Z1-Exit (**Rodgi**, ~2 W)
- [ ] Phase 1 — Contributor-/API-/Asset-Builder-Doku · ← M3, M4
- [ ] Phase 2 — Einstellungen & Tray (#33–#36) · none
- [ ] Phase 3 — QA & Design-Gates (#37–#41) · ← M5 Z1-Umfang
- [ ] Phase 4 — Release-Pipeline & Distribution (#42–#45, Download-Tracking) · none → **Z1-Exit**

### Post-Zyklus 1
Auth/Account-Verknüpfung · Prestige-System · kosmetische Monetarisierung · MRR #26/#27 ·
Overlay & Fensterverhalten #28–#32 · Quips/State-Machine-Erweiterungen #19–#23 ·
M5 P6–P12 · Owner-Entscheide #3/#4b/#63/#64 · Hidden-Easter-Eggs (NOTE.md)

## 🔗 Dependency-Übersicht

| Phase | Blocked by | Grund |
|---|---|---|
| M3/P1, M4/P1, M6/P2, M6/P4 | **none** | sofort parallel startbar |
| M5 Assets (alle Phasen) | M2/P1–P2 ✅ | bereits erfüllt → Assets sofort startbar |
| M3/P2, M3/P3 | M3/P1 | Darstellung/Security brauchen Event-Modell |
| M4/P2 | M4/P1 | XP-Modell braucht Token-Datenbasis |
| M4/P3 | M4/P2 | Profil/Achievements brauchen Level-Modell |
| M4/P4 | M2/P1–P2 ✅ | Character-Map nutzt Bake-Format |
| M5 Runtime (Level-Trigger) | M4/P2 | Freischaltung ab ~Level 8 |
| Künftige Event-Animationen (neue M5-Phasen, z. B. Schild hochhalten) | M3/P2 | Darstellungs-Contract aus Recording Agent |
| M6/P1 | M3, M4 | Doku dokumentiert deren Architektur |
| M6/P3 | M5 P1–P5 | QA/Design-Gates brauchen Z1-Animationsumfang |

**Langfassung:** `Blocked by:`-Feld in jeder `PHASE.md`, Abschnitt „Dependencies" in jeder `MILESTONE.md`.
