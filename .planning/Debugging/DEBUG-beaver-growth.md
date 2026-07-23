# Debug — beaver-growth (Biber wächst nicht)

**Scope:** Milestone-4 (XP/Level) × Runtime-Stand vor M4/P1
**Branch:** — (Analyse-only, kein Fix; Auftrag 2026-07-22: „keine Änderungen, nur prüfen")
**Status:** analysiert, Root Cause bestätigt — Fix ausstehend (gehört zu M4/P2)
**Analyse:** Scout-Subagent (read-only), Evidenz unten mit file:line

## Symptom

Der Biber wird nie größer. Der User hat in der gesamten Nutzungszeit noch **nie**
eine Evolution (baby → teen → adult) beobachtet — der Biber bleibt permanent Baby.

## Kurzantwort (Root Cause)

**Die Wachstumslogik existiert und funktioniert — aber sie bekommt nie „Treibstoff".**
XP kommen ausschließlich aus zwei **opt-in**-Quellen:

1. **Token-Logs** (Claude Code / Codex) — Default: `claudeEnabled: false`,
   `codexEnabled: false` (`src/main/mrr/settings-store.ts:18-25`)
2. **MRR** (Stripe / RevenueCat) — Default: nicht verbunden; MRR-Modus im Tray
   sogar unsichtbar, solange keine Quelle verbunden ist (`src/main/tray.ts:55-62`)

Ohne expliziten Connect (Tray → Connect… → *Connect Claude Code* / *Connect Codex*)
parst der `UsageTracker` keine Logs → `delta = 0` → `XpEngine.applyXp` wird nie
aufgerufen → Biber bleibt Level 1 / baby. **Das ist der Grund, warum der User noch
nie ein Wachsen gesehen hat.**

Verschärfend: Selbst MIT aktivierter Quelle liegt die erste Evolution (teen,
Level 16) bei **150.000 Tokens** (1.500 XP × 100 Tokens/XP) — das dauert bei
normalem Gebrauch sehr lange (`src/main/xp/curve.ts:9-41`).

## Hypothesen (geprüft)

- [x] **H1: Wachstumslogik ist gar nicht implementiert** → *widerlegt.* Vollständig
  vorhanden: Kurve (`src/main/xp/curve.ts:15-41`), Engine mit Stufenwechsel-Erkennung
  (`src/main/xp/engine.ts:105-148`), Persistenz `xp-state.json` (`src/main/xp/store.ts:9-53`),
  Evolutions-Sequenzer (`src/renderer/evolution.ts:16-35`), 3 Sprite-Stufen inkl.
  Sheets (`assets/sprites/beaver-{baby,teen,adult}.png`), Renderer-Verdrahtung
  (`src/renderer/renderer.ts:132-212`, `src/main/main.ts:393`). Test existiert:
  Stufenwechsel baby → teen bei L16 (`src/main/xp/engine.test.ts:88-100`).
- [x] **H2: Logik ist toter Code / nicht verdrahtet** → *widerlegt.* `main.ts:393`
  sendet `PET_CHANGED_CHANNEL` inkl. `evolvingTo` an den Renderer; Tray refresht.
- [x] **H3: XP-Quelle ist standardmäßig aus (Opt-in)** → ***bestätigt — Root Cause.***
  `freshState()` setzt beide Tracker-Flags auf `false`
  (`src/main/mrr/settings-store.ts:18-25`); `UsageTracker.refresh()` parst nur bei
  `enabled.claude || enabled.codex` (`src/main/usage/tracker.ts:92-148`).
- [x] **H4: Assets für höhere Stufen fehlen** → *widerlegt.* teen + adult Sheets
  existieren und werden via `loadCurrentSheet()` geladen
  (`src/renderer/renderer.ts:157-164`).

## Evidence

| Befund | Stelle |
|---|---|
| Stufen-Mapping: L1 baby, L16 teen, L32 adult | `src/main/xp/curve.ts:36` |
| 100 Tokens = 1 XP, 100 XP = 1 Level (linear, ungewichtet) | `src/main/xp/curve.ts:9-13` |
| Stufenwechsel → `evolvingTo` an Renderer | `src/main/xp/engine.ts:121-148`, `src/main/main.ts:393` |
| Defaults: beide Token-Quellen AUS | `src/main/mrr/settings-store.ts:18-25` |
| Tracker liest nur bei Opt-in | `src/main/usage/tracker.ts:92-148` |
| Cache-Tokens werden derzeit **mitgezählt** (Spec-Verstoß) | `src/main/usage/totals.ts:24` |
| Sprite-Sheets baby/teen/adult vorhanden | `assets/sprites/beaver-*.png/.json` |
| Persistenz: `xp-state.json`, `growth-settings.json`, `onboarding-state.json` | `src/main/xp/store.ts:14`, `src/main/mrr/settings-store.ts:14` |

## Zusatzbefund: Code ≠ aktuelle Spec

Der implementierte Stand ist ein **älteres, vereinfachtes Modell**; die aktuelle
Zyklus-1-Spec (`.planning/Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md`) sieht vor:

| Thema | Spec (M4/P2) | Code heute |
|---|---|---|
| Lebenszyklen | **5 Stufen** (Baby → Erwachsener) | 3 Stufen |
| Kurve | quadratisch, 120.000 XP total (L32 ≈ Tag 60) | linear, 100 XP/Level |
| Konversion | 5 XP / 1.000 **echte** Input+Output-Tokens | 1 XP / 100 Tokens |
| Cache | strikt ausgeschlossen | wird mitgezählt |
| Modellgewichtung | γ=2 (Intelligence Index) | keine |

M4/P2 ist offiziell **not-started** — die Diskrepanz ist bekannt und verplant.

## Fix (vorgeschlagen, NICHT umgesetzt)

Kein Code-Fix in dieser Session (Auftrag: nur prüfen). Vorschlag in zwei Ebenen:

1. **Sofort für den User (kein Code):** Im Tray → *Connect…* → Claude Code bzw.
   Codex verbinden. Danach wächst der Biber mit Token-Verbrauch (erste Evolution
   bei 150k Tokens). Das erklärt auch, warum das Wachsen „unsichtbar" war:
   ohne Opt-in kann physisch nichts wachsen.
2. **Geplant (M4/P1 + M4/P2):** Reader auf echte Input/Output-Tokens umstellen
   (Cache raus), quadratische Kurve + 5 Lebenszyklen + Modellgewichtung nach
   XP-LEVEL-MODEL.md, dazu M5/P12 (Stufen-Art-Paket). Erwägen: Onboarding-Hinweis,
   dass Wachstum einen Connect braucht (sonst wirkt die App „kaputt").

## Verification

Analyse-only — kein Fix, daher keine Fix-Verifikation. Hypothesen H1–H4 durch
read-only Code-Inspektion mit file:line-Evidenz bestätigt/widerlegt (siehe Tabelle).
Nach Umsetzung von M4/P2: Verifikation über `src/main/xp/engine.test.ts` erweitern
(quadratische Kurve, Cache-Ausschluss, 5 Stufen).
