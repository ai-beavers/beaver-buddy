# PLAN — Reset-Feature entfernen + XP-State-Migration mit Punkte-Matrix

> Datum: 2026-07-23 · Kontext: Debug-Befund „Biber wächst nicht" (Cursor `lastSeenLifetimeTokens`
> = 7,2 Mrd. bei `xp = 0`, siehe `.planning/Debugging/DEBUG-beaver-growth.md` + Scout-Analyse 2026-07-23)

## Ziel

1. **Aufgabe 1:** Die Funktion „Reset Beaver XP + Hatch" vollständig aus Code, UI und Tests entfernen.
2. **Migration:** `xp-state.json` einmalig sauber migrieren — XP korrekt aus der Token-Historie
   mit der **Punkte-Matrix-Logik** (Modellgewichtung γ=2 nach XP-LEVEL-MODEL.md §1a) berechnen,
   Cache-Tokens strikt ausschließen, Cursor korrekt setzen.
3. **Aufgabe 2 (Konzept):** Tokenstand persistent im Profil speichern, sodass der Start nur noch
   das 24h-Delta berechnen muss → in dieser Runde nur **Konzept erarbeiten** (Owner: „muss noch
   genauer durchgeplant werden"), Umsetzung danach.
4. **Aufgabe 3:** pi-agent Token-Zähler fehlerhaft → ✅ bereits als offen in `.flightplan/NOTE.md`
   erfasst (2026-07-23). Kein Code in dieser Runde.

## Kontext-Antwort: onboarding-state.json (Owner-Rückfrage)

- **Einziger Zweck:** `{ hatched: boolean }` — merkt, ob die einmalige Hatch-Onboarding-Sequenz
  schon lief (`src/main/onboarding.ts`).
- **Fehlt die Datei** (oder ist korrupt) → `hatched: false` → Hatch spielt beim nächsten Start
  erneut. Genau das ist der QA-Weg, den `--reset-hatch` heute abkürzt.
- **Konsumenten:** `main.ts:174-182` (Launch-Hatch + sofortiges Persistieren, exactly-once),
  `main.ts:393` (Senden an Renderer nach did-finish-load), `main.ts:269-272` (der zu löschende
  Reset-Pfad), `renderer.ts` (Hatch-Animation, unterdrückt Evolution/Roaming währenddessen).
- **Konsequenz:** Die Datei selbst **bleibt** (Onboarding braucht sie). Entfernt wird nur der
  Reset-Schreibpfad + das `--reset-hatch`-Flag. QA-Replay geht danach weiterhin über
  „Datei löschen" (Factory-Reset-Prinzip laut CLAUDE.md).

## Scope

### Wave A — Reset-Feature entfernen (Aufgabe 1) — ✅ IMPLEMENTED 2026-07-23

| Ebene | Datei | Änderung |
|---|---|---|
| Settings-UI | `src/main/mrr/settings.html` | Reset-Button + JS-Handler entfernt |
| Preload | `src/main/mrr/settings-preload.ts` | `resetProgress`-Binding + Channel-Konstante entfernt |
| IPC | `src/main/ipc-channels.ts` | `SETTINGS_RESET_PROGRESS_CHANNEL` entfernt |
| Handler | `src/main/mrr/settings-window.ts` | Interface-Eintrag, Handler, Registrierung entfernt |
| Orchestrierung | `src/main/main.ts` | `onProgressReset`-Dep entfernt |
| Engine | `src/main/xp/engine.ts` | `resetProgress()` + `allowStageSnap`-Option entfernt (keine weiteren Nutzer) |
| QA-Flag | `src/main/main.ts` | `--reset-hatch` entfernt; QA-Replay = `onboarding-state.json` löschen |
| Tests | `engine.test.ts`, `settings-window.test.ts`, `ipc-channels.test.ts` | Reset-Tests entfernt; Hatch/Evolution-Interplay-Tests behalten (Hatch bleibt) |
| Docs | `README.md`, `docs/design-reviews/BL-7/BL-11/BL-19-verdict.md` | QA-Anleitung auf Datei-Löschen umgestellt |

Verifikation: typecheck ✅ · lint ✅ · 610 Tests ✅ · grep clean ✅

### Wave B — XP-State-Migration mit Punkte-Matrix (Aufgabe „sauber migrieren")

1. **`model`-Feld durchziehen:** `UsageEntry.model?: string` (`usage/totals.ts`); Parser
   `claude-parser.ts`, `codex-parser.ts`, `generic-parser.ts` extrahieren den Model-Namen
   aus den Roh-Logs; Tests + Fixtures ergänzen.
2. **Gewichtstabelle als Daten:** Seed-Tabelle aus XP-LEVEL-MODEL.md §1a (26 Modelle,
   REF=45, γ=2, Clamp 0.5–2.0, unknown = 1.0) als JSON-Datendatei (Vorläufer der
   Character Map aus M4/P4) + Mapping-Funktion Log-Modelname → Tabellen-Modell.
3. **Einmal-Migration (idempotent, Schema-Version in `xp-state.json`):**
   - Voller Rescan der Logs → Summe **echter Input+Output-Tokens pro Modell** (Cache ausgeschlossen).
   - `XP = Σ_model (tokens_model / 1000 × 5 × weight[model])` (XP_PER_1K_TOKENS = 5).
   - `xp-state.json` neu schreiben: `xp` = berechneter Wert, `lastSeenLifetimeTokens` =
     aktuelle **Cache-bereinigte** Gesamtsumme, `schemaVersion: 2` als Migrations-Marker.
   - Bei bereits migriertem State (Version 2): kein erneutes Aufaddieren.
4. **Laufender Pfad:** `XpEngine` auf Cache-bereinigte, gewichtete XP umstellen — Delta
   weiterhin forward-only, aber Basis = input+output ohne Cache, gewichtet pro Modell.
   (Engine braucht dafür per-Modell-Deltas statt einer Lifetime-Summe → `TrackerLike`-
   Interface erweitern, `ingestLifetimeTokens` → `ingestModelDeltas`.)
5. **Kurve/Stufen:** Umstellung auf Spec-Kurve (quadratisch, TOTAL 120.000, 5 Stufen
   L1–4/5–8/9–16/17–24/25–32) in `curve.ts` + Stage-Typ erweitern. **Assets für alle
   5 Stufen liegen bereits vor** (`beaver-young-baby`, `beaver-older-teen` seit Merge).
   Renderer-Verkabelung der 2 neuen Stufen (Sheet-Loading, Evolution) inklusive.
   **Owner-Entscheid 2026-07-23: jetzt komplett umsetzen.**

### Wave C — Konzept „Tokenstand im Profil / 24h-Start" (Aufgabe 2, nur Design)

Kurzes Konzept-Dokument (`.planning/Planning/Milestone-4/` als Entwurf, Freigabe durch Rodgi):
- Persistenz der Tages-Aggregate (pro Datum + Modell) in einer Profil-/State-Datei
  (Anschluss an M4/P1 WAVE-2 Storage + M4/P3 Profil).
- Start-Verhalten: nur Dateien mit mtime innerhalb der letzten 24h neu parsen; ältere
  Aggregate aus dem persistierten Stand laden; Cursor-Abgleich.
- Schnittstelle zum M4/P1-Reader (TokScale-Logik) und zur Character Map.

## Out of Scope

- pi-agent Token-Zähler-Fix (nur notiert; eigene Debug-Session später)
- M4/P2 vollständig (Level-Up-Events, Unlocks, Quips-Anbindung)
- M4/P3 (Naming-Flow, Achievements, Lifetime-Counter)
- MRR-Modus-Änderungen (bestehendes Verhalten bleibt; Cursor-Disziplin in `mrr`-Mode
  entfällt nicht — sie ist Teil der No-Double-Count-Invariante)
- Prestige-System, Account-Linking (post-C1)

## Akzeptanzkriterien

- ~~`grep -ri "resetProgress\|reset-progress\|reset-hatch" src/` → keine Treffer.~~ ✅ (Wave A)
- ~~Settings-Fenster zeigt keinen Reset-Button mehr~~ ✅ (Wave A)
- Nach Migration: App-Start zeigt Level/Stufe passend zur gewichteten Token-Historie;
  `xp-state.json` hat `schemaVersion: 2`, korrekten Cursor; kein erneutes Anrechnen
  beim Folgestart (Idempotenz-Test).
- Neue Token-Zuwächse werden ohne Cache-Anteil und modellgewichtet in XP umgerechnet
  (Unit-Tests: Gewicht 1.78 Top-Modell, 0.5 Floor, unknown = 1.0, Cache ausgeschlossen).
- 5 Stufen rendern korrekt; Evolutionen an L5/L9/L17/L25 feuern (Engine-Tests).
- `npm run typecheck && npm run lint && npm test` grün.
- Konzept-Dokument Aufgabe 2 liegt zur Owner-Freigabe vor.

## Risiken / Offene Fragen

1. ~~Scope-Frage Wave B~~ → **entschieden: komplett, jetzt** (Owner 2026-07-23).
2. **Codex/pi-Logs ohne Model-Feld:** Fallback = 1.0 (neutral), im Konzept dokumentieren.
3. **Historische Cache-Verschmutzung:** Der alte Cursor (7,2 Mrd.) enthält Cache-Anteile;
   die Migration setzt ihn bewusst neu auf die bereinigte Summe — einmaliger, gewollter
   Bruch der No-Double-Count-Historie (dokumentiert im Migrations-Code).
4. M4/P1 läuft parallel (Cloud-Agent, WAVE-1) — **Abstimmung nötig**, damit deren Reader
   und unser `model`-Feld/Storage nicht kollidieren (gleiche Dateien: usage/*).

## Vorgehen

Sequenziell mit Owner: Wave A ✅ → Wave B → Wave C (Konzept).
Umsetzung je Wave via Worker-Subagent, Review via Reviewer, danach Owner-Test in der App.
