# Ideas & Notes

> Capture inbox for ideas, tasks, and notes. Written by `/fp-note`.
> Quick captures land in **Inbox**; promote them into the table once you act on them.
> One fact, one home — link out instead of duplicating detail.

**Type:** `idea` · `task` · `note` · **Status:** `idea` · `evaluation` · `approved` · `scheduled` · `implemented` · `rejected`

## Inbox (unsorted)

- 2026-07-18 **[note]** Offene Owner-Entscheidungen aus dem Flight-Plan: #3 Designer-Icons, #4b SmartScreen-Signatur (Budget), #63 Bubble-Outline-Snapping, #64 Launch-Tier-Quip-Replay
- 2026-07-18 **[task]** BL-7-Verdict finalisieren: Snapshots + Shake-Messwerte in `docs/design-reviews/BL-7-verdict.md` begutachten, finales Verdict eintragen
- 2026-07-18 **[idea]** Wütender Biber: wird bei wiederholtem Anklicken sauer — Hidden-Easter-Egg (Rohtext-Fund)
- 2026-07-18 **[idea]** Schlafmangel-Look: Augenringe bei sehr lang laufendem Laptop / Nachtarbeit 2–3 Uhr (Rohtext-Fund)
- 2026-07-18 **[idea]** Zeit-reaktives Verhalten allgemein: Biber reagiert auf Tageszeit (Rohtext: „wie Claude")
- 2026-07-18 **[idea]** Brille + Buch: Biber setzt Brille auf und liest (Rohtext-Fund)
- 2026-07-18 **[idea]** „Hidden"-Easter-Eggs als eigenes kleines Feature-Cluster sammeln (Rohtext: „wir machen dann so Hidden rein")
- 2026-07-18 **[note]** Im Rohtext verworfen: Mann/Frau-Konfiguration („erstmal neutraler Biber"), „Splinter". Kamera-Brainrot-Erkennung kollidiert mit Privacy-Regeln — nur mit explizitem ADR + Owner-Entscheid
- 2026-07-18 **[note]** Template-Lecks in lokalen fp-Skills bewusst UNGEPATCHT: Klärung im Template-Projekt (`~/CODING/Flightplan V1.0/_meta/planning/NOTE.md`)
- 2026-07-21 **[note]** **Zyklus-1-Meeting ausgewertet** (`.flightplan/Meetings/2026-07-21-planung/`): Recording Agent → M3 · Level/XP/Profil → M4 · Namensgebung → M4/P3 · Achievements → M4/P3 · Sicherheitsmechanismus → M3/P3 · Contribution-Doku → M6/P1
- 2026-07-21 **[idea]** Prestige-System: ab Level 32 zurück auf 1, Sterne/saisonale Inhalte (Meeting) → post-Zyklus 1
- 2026-07-21 **[idea]** Account-Verknüpfung ai-beavers Web-Profil (XP/Achievements syncen), lokale Nutzung bleibt möglich (Meeting) → post-Zyklus 1
- 2026-07-21 **[idea]** Kosmetische Monetarisierung (Kleidung/Accessoires als Layer, kein Pay-to-Win, auch per Level freischaltbar); Merch (Meeting) → post-Zyklus 1
- 2026-07-21 **[idea]** Dino-Game-artiges Steuerungs-Easter-Egg für höhere Level (Meeting 01:06:21)
- 2026-07-21 **[idea]** Biber-Sticker aus vorhandenen Charakterbildern (Meeting, „Nächste Schritte")
- 2026-07-21 **[task]** Modell-Gewichtung pflegen: Intelligence-Index-Tabelle (Seed ✅ 2026-07-21 via Owner-Screenshot, 26 Modelle, REF = 45) periodisch aktualisieren; Mapping Log-Modellname → Tabellen-Modell in M4/P1 bauen; unbekannte Modelle = 1,0. Beschluss: Wert = Intelligenz, NICHT Token-Preis
- 2026-07-21 **[note]** ENTSCHIEDEN (Owner): TokScale-**LOGIK** 1:1 übernehmen (Finden/Auslesen lokaler Token-Logs) für **alle Coding-Agent-Harnesses** (Claude Code, Codex, pi u. a.); eigener Reader in M4/P1, KEIN TokScale als Tool/Dependency (Spec §1b)
- 2026-07-21 **[note]** ENTSCHIEDEN (Owner): **5 Lebenszyklen** — Baby, junges Baby, Jugendlicher, älterer Jugendlicher, Erwachsener → Stufen-Mapping L1–4/5–8/9–16/17–24/25–32 in Spec §4; Asset-Konsequenz: M5/P12 = Stufen-Art-Paket (junges Baby + älterer Jugendlicher + Erwachsener), in Z1-Scope gezogen
- 2026-07-21 **[note]** ENTSCHIEDEN (Teambesprechung): **Multiplattform** — Electron-App nativ für Windows UND macOS ausliefern (ADR-002-Update); M6/P4 baut beide Installer; offen: Apple-Developer-Zertifikat (Budget), macOS-Testhardware (wer testet?), QA-Matrix um macOS erweitern (M6/P3)
- 2026-07-21 **[note]** ENTSCHIEDEN (Owner): **Herdr** (Open-Source-Terminal-Übersichtstool für parallele Coding-Agents) als Erkennungs-/Benachrichtigungslogik für M3 — keine eigene Detektion; Jurij evaluiert Herdr in M3/P1 WAVE-1
- 2026-07-21 **[note]** ENTSCHIEDEN (Owner 2026-07-21): **XP und Lebenszeit bleiben vorerst getrennt.** Hauptlogik = XP aus Tokens → Level. Lebenszeit (Bildschirm-Anzeigezeit/Gesamtlebenszeit) wird separat getrackt und soll später als zusätzliche XP-Quelle einfließen (Konvertierungslogik post-P2). Spec: `Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md`

<!-- /fp-note appends here, newest last -->

## Classified

| Topic | Type | Status | Target/Source | Decision | Defined-on | Done-on/How |
|---|---|---|---|---|---|---|
| Flightplan-Onboarding/Migration | task | implemented | `.flightplan/Planning/` | M1–M4 eingearbeitet | 2026-07-17 | 2026-07-18 |
| **Re-Onboarding & Zyklus-1-Neuplanung** | task | implemented | `.flightplan/` | `.fp-new-projekt/` → Meetings/Reference/Archive; M1–M6 + Team-Matrix + Dependency-Doku; siehe ROADMAP.md | 2026-07-21 | 2026-07-21: Migration + ROADMAP/STATE/HANDOFF neu |
| Fallschirm-Drop | idea | scheduled | M2 Phase 3 (pausiert) | WAVE-1/2 ✅, WAVE-3 offen; Resume via Claude Code | 2026-07-17 | |
| Wachsender Baum | idea | scheduled | M5 Phase 1 | Z1-Scope; Assets startbar | 2026-07-17 | |
| Review-Majors (5 Findings) | task | implemented | `.flightplan/Reviews/` | BL-15, PR #29 | 2026-07-18 | 2026-07-18: PR #29 |
| Review-Follow-ups (1 critical + 7 minor) | task | implemented | `.flightplan/Reviews/` | CSP zuerst; studio.ts-Fix auf BL-14 | 2026-07-18 | 2026-07-19: BL-16 → PR #30, PR #28 |
| Animation-Authoring-Doku | task | implemented | `docs/animation-authoring.md` | Contributor-/Agent-Doku | 2026-07-19 | Commit 9ff5e0a auf `feature/animation-authoring-docs`; PR offen |
| F1 Biber nicht klickbar | bug | implemented | M2/P3 WAVE-2 | Erwartetes Verhalten; gelöst durch C3/C4 | 2026-07-20 | 2026-07-20: WAVE-2 |
| F2 Bubble-Artefakte | bug | implemented | M2/P3 WAVE-2 | bubbleDirtyRect + forceFullClear | 2026-07-20 | 2026-07-20: WAVE-2 F2-Chunk |
