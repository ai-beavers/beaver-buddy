# XP-/Level-Modell — Detail-Spec (M4/P2)

> Owner-Entscheid 2026-07-21: **XP und Lebenszeit bleiben vorerst getrennt.**
> Hauptlogik: **XP-Punkte → Level** (Level N ab X XP). Lebenszeit wird separat getrackt
> und später als zusätzliche XP-Quelle konvertierbar (Konvertierung ≠ V1).

## 1. XP-Quellen

| Quelle | V1 (Z1) | Später |
|---|---|---|
| **Tokens** (Input + Output, **ohne Cache**, pro Modell, tagesaggregiert aus M4/P1) | ✅ einzige XP-Quelle, **gewichtet nach Modell-Intelligenz** (siehe §1a) | Re-Gewichtung bei Leaderboard-Updates |
| **Lebenszeit** (sichtbare Bildschirmzeit + Gesamtlebenszeit) | ❌ nur Tracking, kein XP | Konvertierungsregel (z. B. X XP pro aktive Stunde) — eigener Owner-Entscheid |

**XP-Konstante (initial):** `XP_PER_1K_TOKENS = 5` → 5 XP pro 1.000 Tokens, multipliziert
mit dem Modell-Gewicht.

> **Wichtig (Owner 2026-07-21): Gezählt werden ausschließlich echte Input- und
> Output-Tokens. KEIN Cache — weder Cache-Creation noch Cache-Read noch ähnliches.**
> Das verändert die Größenordnung deutlich: Cache-Anteile machen in Agent-Logs
> typischerweise 80–95 % des Gesamtverbrauchs aus. Die Referenz-Rechnung basiert
> deshalb auf **~400k echten Input+Output-Tokens/Tag** (schwerer Nutzer),
> nicht auf Millionen:
> 400k ÷ 1.000 × 5 XP × Gewicht ~1,0 = **2.000 XP/Tag** → L32 an Tag 60.

→ **Kalibrierung:** nach 1 Woche echter M4/P1-Daten `XP_PER_1K_TOKENS` so anpassen,
dass ein aktiver Referenz-Nutzer Level 32 in ~60 Tagen erreicht (Meeting-Vorgabe
„2 Monate"). Die Kurvenform bleibt davon unberührt.

## 1a. Modell-Gewichtung via Artificial Analysis Intelligence Index (Owner-Beschluss 2026-07-21)

> **Prinzip: Nicht der Token-Preis zählt, sondern die Intelligenz des Modells.**
> Tokens eines smarteren Modells sind mehr XP wert. Quelle der Index-Werte:
> <https://artificialanalysis.ai/models#intelligence>

**Formel (final, Owner-Beschluss 2026-07-21: γ = 2):**
```
weight[model]      = (intelligenceIndex[model] / REFERENCE_INDEX)^2
XP_per_1k[model]   = XP_PER_1K_TOKENS × weight[model]   (geklammert auf 0,5–2,0)
```
- `REFERENCE_INDEX` = Median der unterstützten Modelle → Mittelfeld-Modell ≈ 1,0× XP.
- **γ = 2 (quadratisch, Owner-Wahl):** smarte Modelle werden überproportional belohnt
  (Top ≈ 1,78×), Anreiz für Qualität. `γ` bleibt Datenfeld → später justierbar ohne Code.
- **Klammer 0,5–2,0:** Modelle unter Index ~32 landen im 0,5-Floor (bewusst in Kauf
  genommen); kein Modell gibt „nichts". Wird bei der Kalibrierung geprüft.
- Cache-Tokens (Creation + Read) sind immer ausgeschlossen (gilt pro Modell).

**Datenhaltung:** Die Index-Werte leben als **Datentabelle in der Character-Map (M4/P4)**
(`models: { name, intelligenceIndex, weight }`) — Update der Werte = Datenänderung,
kein Code-Change. Bei größeren Leaderboard-Releases aktualisieren wir die Tabelle.

**Seed-Daten (Stand 2026-07-21, Screenshot Owner, <https://artificialanalysis.ai/models#intelligence>):**
`REFERENCE_INDEX = 45` (Median der 26 gelisteten Modelle) · `weight = (index/45)²` (**γ=2**), Klammer 0,5–2,0

| Modell | Index | Gewicht | | Modell | Index | Gewicht |
|---|---|---|---|---|---|---|
| Claude Fable 5 (w. fallback) | 60 | **1,78** | | MiniMax-M3 | 44 | 0,96 |
| GPT-5.6 Sol (max) | 59 | **1,72** | | DeepSeek V4 Pro (max) | 44 | 0,96 |
| Kimi K3 | 57 | **1,61** | | MiMo-V2.5-Pro | 42 | 0,87 |
| Claude Opus 4.8 (max) | 56 | **1,55** | | Inkling | 41 | 0,83 |
| GPT-5.6 Terra (max) | 55 | **1,49** | | DeepSeek V4 Flash (max) | 40 | 0,79 |
| Grok 4.5 (high) | 54 | **1,44** | | Nemotron 3 Ultra | 38 | 0,71 |
| Claude Sonnet 5 (max) | 53 | **1,39** | | Gemini 3.5 Flash-Lite | 36 | 0,64 |
| GPT-5.6 Luna (max) | 51 | 1,28 | | Mistral Medium 3.5 | 30 | 0,44 → **0,50** (Floor) |
| GLM-5.2 (max) | 51 | 1,28 | | Claude 4.5 Haiku | 30 | 0,44 → **0,50** (Floor) |
| Muse Spark 1.1 (xhigh) | 51 | 1,28 | | Gemma 4 31B | 29 | 0,42 → **0,50** (Floor) |
| Gemini 3.6 Flash | 50 | 1,23 | | gpt-oss-120b (high) | 24 | 0,28 → **0,50** (Floor) |
| Gemini 3.1 Pro Preview | 46 | 1,05 | | Command A+ | 23 | 0,26 → **0,50** (Floor) |
| Qwen3.7 Max | 46 | 1,05 | | K2 Think V2 | 17 | 0,14 → **0,50** (Floor) |

- **Effekt (γ=2):** Top-Modell verdient ~3,6× so viel XP pro Token wie ein Floor-Modell;
  Mittelfeld (Index ~45) bleibt ~1,0×. Modelle unter Index ~32 sitzen im Floor.
- Mapping Log-Modellname → Tabellen-Modell in M4/P1; unbekannte Modelle = 1,0 (neutral).
- Pflege: Tabelle bei Leaderboard-Updates aktualisieren (Task in NOTE.md).

## 1b. Token-Datenquelle: TokScale-Logik (Owner-Beschluss 2026-07-21, korrigiert)

> Wir nutzen **die Logik von TokScale** — also dessen Ansatz zum **Finden und Auslesen
> der lokal gespeicherten Token-Logs** — als Vorlage für unsere eigene Berechnung.
> **Kein TokScale als Tool/Dependency in der App**; M4/P1 implementiert einen eigenen
> Reader, der dieselben Log-Pfade/Formate nutzt. Da TokScales Fetch-Logik 1:1
> übernehmbar ist, gilt das für **alle Coding-Agent-Harnesses: Claude Code, Codex, pi
> und weitere** (Owner-Beschluss 2026-07-21).

- Aufgabe in M4/P1: TokScale-Ansatz analysieren (Wo liegen die Logs? Welches Format?
  Wie werden Modelle unterschieden?) → eigener Reader: Log-Files → Tages-Aggregat pro
  Modell (Datum, Modell, Input-, Output-Tokens, ohne Cache).
- Vorteil: keine externe Laufzeit-Abhängigkeit, volles Format-Verständnis im eigenen
  Code, testbar gegen Fixture-Logs.

## 2. Level-Kurve

- **Form:** kumulativ quadratisch — frühe Level schnell (Bindung, Meeting 01:13:51), später zunehmend teurer.
- **Formel:** `cumXP(L) = round(TOTAL × L² / 32²)` mit `TOTAL = 120.000 XP` (Referenz: ~400k echte Input+Output-Tokens/Tag × 5 XP/1k ≈ 2.000 XP/Tag → L32 an Tag 60).
- **Implementierung:** Tabelle (unten) als Daten, nicht als Formel im Code → jederzeit rekalibrierbar ohne Logik-Änderung.

## 3. Level-Tabelle (V1-Vorschlag, kalibrierbar)

| Level | kum. XP | ≈ Tag* | Stufe | Freischaltung |
|---|---|---|---|---|
| 1 | 0 | 0 | 🍼 Baby | Start (Namensgebung) |
| 2 | 469 | <1 | Baby | |
| 3 | 1.055 | <1 | Baby | |
| 4 | 1.875 | 1 | Baby | |
| 5 | 2.930 | 1,5 | 🐣 **junges Baby** | Evolution Baby→junges Baby |
| 6 | 4.219 | 2 | junges Baby | |
| 7 | 5.742 | 3 | junges Baby | |
| 8 | 7.500 | 4 | junges Baby | **Erste Interaktionen** (Meeting: „ab Level 8") |
| 9 | 9.492 | 5 | 🧒 **Jugendlicher** | Evolution → Jugendlicher |
| 10 | 11.719 | 6 | Jugendlicher | |
| 11 | 14.180 | 7 | Jugendlicher | |
| 12 | 16.875 | 8 | Jugendlicher | |
| 13 | 19.805 | 10 | Jugendlicher | |
| 14 | 22.969 | 11 | Jugendlicher | |
| 15 | 26.367 | 13 | Jugendlicher | |
| 16 | 30.000 | 15 | Jugendlicher | Ende „Phase 1" (Meeting: 1–16) |
| 17 | 33.867 | 17 | 🧑 **älterer Jugendlicher** | Evolution |
| 18 | 37.969 | 19 | älterer Jugendlicher | |
| 20 | 46.875 | 23 | älterer Jugendlicher | |
| 22 | 56.719 | 28 | älterer Jugendlicher | |
| 24 | 67.500 | 34 | älterer Jugendlicher | |
| 25 | 73.242 | 37 | 🦫 **Erwachsener** | Evolution → final Stage |
| 26 | 79.219 | 40 | Erwachsener | |
| 28 | 91.875 | 46 | Erwachsener | |
| 30 | 105.469 | 53 | Erwachsener | |
| 31 | 112.617 | 56 | Erwachsener | |
| 32 | 120.000 | 60 | Erwachsener | **Cap** → Prestige (post-Z1) |

\* Referenz-Nutzer 2.000 XP/Tag (≈ 400k echte Input+Output-Tokens/Tag, Cache ausgeschlossen); volle Tabelle (jedes Level) wird als JSON in der Character-Map (M4/P4) gepflegt.

## 4. Stufen-Mapping (5 Lebenszyklen — Owner-Beschluss 2026-07-21)

- **Baby:** Level 1–4 · **junges Baby:** 5–8 · **Jugendlicher:** 9–16 ·
  **älterer Jugendlicher:** 17–24 · **Erwachsener:** 25–32
- Begründung: Meeting „Level 1–16 = Entwicklungsphase Baby→Teen" bleibt gewahrt;
  Interaktionen ab L8 fallen mit dem Übergang junges Baby→Jugendlicher zusammen;
  die zwei Zusatz-Stufen geben mehr sichtbare Fortschritts-Momente (4 Evolutionen
  statt 2).
- Stufen-Grenzen sind Owner-justierbar — sie leben in der Character-Map, nicht im Code.
- **Asset-Konsequenz (M5):** Es werden **5 Stufen-Sprite-Sets** gebraucht; existieren:
  Baby ✅, Teen (≈ Jugendlicher) ✅, Adult nur als Placeholder ⚠️. **Neu zu bauen:
  junges Baby, älterer Jugendlicher, Erwachsener (final)** → M5/P12 wird zum
  Stufen-Art-Paket; Z1-Einordnung: Erwachsener-Art spätestens bis Nutzer L25 erreichen
  (~Tag 37 beim Referenz-Nutzer) → in Z1-Scope ziehen.

## 5. Lebenszeit-Tracking (getrennt, V1)

- Zwei Counter im Profil (M4/P3): `screenVisibleSeconds` (Biber sichtbar) + `lifetimeSeconds` (gesamt).
- Werden für Achievements (7/30 Tage) genutzt — **keine XP-Konvertierung in V1**.
- Schema reserviert `lifetimeXpRule: null` → spätere Konvertierung ohne Migration.

## 6. Level-Up-Events

- `level:up` Event (neues Level, Stufenwechsel ja/nein) → Animation/Quip aus M5 bzw. Evolution-Flash.
- Freischaltungen werden aus der Character-Map gelesen (kein hartkodierter Level-Switch).

## Offene Kalibrierungs-Punkte (nach M4/P1-Daten)
1. `XP_PER_1K_TOKENS` (initial 5) gegen reale Tagesmengen **echter Input+Output-Tokens**
   setzen (Cache-Anteile rausfiltern — sie sind der größte Teil der Roh-Logs!).
2. `TOTAL` prüfen (60-Tage-Ziel).
3. ~~Intelligence-Index-Werte live ziehen~~ ✅ Seed-Tabelle eingepflegt (Screenshot
   2026-07-21, 26 Modelle, REF = 45). Rest: Mapping Log-Modellname → Tabellen-Modell
   in M4/P1 + periodische Pflege (NOTE.md).
