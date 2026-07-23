# PLAN — XP-Cap-Entfernung + Settings-Display + Alterslogik-Fundament + Animations-Abgleich

> Datum: 2026-07-23 · Kontext: Wave A/B sind via PR [#52](https://github.com/ai-beavers/beaver-buddy/pull/52)
> auf Branch `feat/reset-removal-xp-migration` fertig. Jetzt: Cap öffnen, Settings um XP/Level/Token-Anzeige
> erweitern, Alterslogik vorbereiten (für Vlady's M5-Pipeline), Animations-Tasks gegen M5-Planung abgleichen.

---

## STATUS

- **Wave C — XP-Cap entfernen:** Code partiell geschrieben (uncommitted auf `feat/reset-removal-xp-migration`),
  muss auf neuen Subbranch umgezogen + vervollständigt werden
- **Wave D — Settings UI:** XP, Level, Stage, Token-Cursor im Settings-Fenster anzeigen
- **Wave E — Alterslogik-Fundament:** Code-Infrastruktur für stufenspezifisches Verhalten, sodass Animationen
  später nur noch als Assets eingehängt werden müssen (reiner Prebuild, keine neuen Assets)
- **Wave F — Animations-Crosscheck + UI-Konzept:** M5-Phasenliste gegen Transkript prüfen, Settings-Layout vorplanen

---

## Wave C — XP-Cap entfernen (Subbranch `feat/xp-cap-removal`)

**Ziel:** Kein Hard-Stop bei L32. Die quadratische Formel `cumXP(L) = 120000 × L² / 32²` läuft
mathematisch unendlich weiter. L25+ bleibt permanent Adult (neue Stages folgen später via M5/P12).

### C1 — curve.ts finalisieren

| Änderung | Details |
|---|---|
| `levelForXp` | Formel: `Math.max(1, floor(sqrt(xp / 120000) * 32))` — kein Cap |
| `xpForLevel` | Formel: `l ≤ 1 ? 0 : round((120000 × l²) / 32²)` — kein oberer Cap |
| `TOTAL_XP` / `ANCHOR_DENOM` | Neue Konstanten (120000, 32) statt `LEVEL_CAP` |
| `LEVEL_XP_THRESHOLDS` | Bleibt als L1-L32-Referenztabelle (Test-Validierung) |
| `XP_PER_1K_TOKENS` | Unverändert (= 5) |
| `stageForLevel` | Unverändert (L25+ = adult) |

### C2 — Tests aktualisieren

- Alte Cap-Tests („L32 hardened", „xpForLevel clamps") → neue Tests: L33/L50/L100/L200 Formel-Roundtrip
- Stage-Test: L25-32 adult → L25+ adult (L100, L500)
- Monotonie: bereits bis L100 getestet, passt
- Neuer Test: „L31→32 schwerer als L1→4" (quadratisch inherent)
- Kein Test bricht auf existierenden State-Migrations (schemaVersion=2 bleibt unverändert)

### C3 — Ripple-Check

- `tray.ts:32`: `xpForLevel(state.level + 1)` — kein Cap mehr, nächste Stufe immer definiert ✅
- `engine.ts`: kein Bezug auf Cap, nur auf Stage/Level-Abfragen ✅
- Migration `migrate.ts`: setzt XP/Cursor, kein Cap-Kontakt ✅
- Tests: engine, migrate, tray — alle indirekt betroffen via curve.ts, Tests laufen durch

### C4 — manueller Test

- Dein Stand (1,76 Mio. XP) → L122 Adult
- Tray zeigt: `Lv 122 — adult (1.761.203 / ~1.771.524)` — Progressbar ~99,4%

---

## Wave D — Settings UI: XP, Level, Stage, Token-Cursor

**Ziel:** Im Settings-Fenster sind direkt sichtbar: aktuelles Level, Stage, XP-Punkte, Fortschritt zum
nächsten Level, sowie die Token-Cursor pro Modell (die „schon verbrauchten" Token, Punkt 3 der Notizen).

### D1 — SettingsWindowDeps + readStatus erweitern

- `SettingsWindowDeps` um `getXpState: () => XpStatusPayload` ergänzen
- `XpStatusPayload`:
  ```ts
  { xp: number; level: number; stage: Stage; nextLevelXp: number; lastSeenByModel: Record<string, number> }
  ```
- `readStatus`-Handler liefert `xp: deps.getXpState()`
- `main.ts:openGrowthSettings()`: `getXpState`-Dep bereitstellen

### D2 — Settings-Preload (API)

- `settings-preload.ts`: `readStatus`-Rückgabetyp um `xp: XpStatusPayload` erweitern
- Kein neuer IPC-Channel nötig — readStatus transportiert alles

### D3 — settings.html Rendering

- **Neue Section: „Beaver Status"**
  - Level + Stage (z.B. `Lv 122 — adult`)
  - XP-Fortschrittsbalken: `(xp - xpForLevel(level)) / (xpForLevel(level+1) - xpForLevel(level)) × 100%`
  - XP numerisch: `1.761.203 XP`
- **Erweiterte Connect-Section: Token-Cursor**
  - Unter jeder Quelle (Claude/Codex/Pi/Kimi/OpenCode): „Tokens scanned: …" aus `lastSeenByModel`
  - `usagePayload()` um `lastSeenTokens` ergänzen (Tracker liefert `sourceTotals[source].lifetimeByModel` oder Aggregat)
  - Achtung: `lastSeenByModel` ist Engine-intern (pro Modell), nicht pro Quelle — müsste aus dem Tracker kommen oder die Engine-Referenz ans Settings-Fenster. **Design-Entscheidung:** simpler ist, die Token-Daten pro Quelle aus dem Tracker zu ziehen (`getSourcesSnapshot` um lifetimeInputTokens/lifetimeOutputTokens erweitern) — das ist die Roh-Token-Zahl ohne Gewichtung, aber das ist genau die „Cursor"-Info, die der User sehen will.
  - Alternativ: `xp-state.json`'s `lastSeenByModel` direkt anzeigen (weil dort die echten Tokens pro Modell ohne Cache stehen). Das ist genauer und zeigt, was der XP-Engine als Basis dient. → `getXpState` liefert `lastSeenByModel` mit, Settings rendert es.

### D4 — Tests

- `settings-window.test.ts`: `readStatus`-Test um xp-Payload ergänzen
- HTML manuell: Check dass kein JS-Error bei fehlendem xp-Objekt (alte API)

---

## Wave E — Alterslogik-Fundament (Prebuild für M5)

**Ziel:** Code-Infrastruktur, die stufenspezifisches Verhalten definiert — reiner Prebuild,
keine neuen Assets. Wenn Vlady's Agent später Animationen erstellt, müssen nur noch die
entsprechenden Sheet-Rows eingehängt + eine Capability registriert werden.

### E1 — Stage-Capabilities-Modul

Neue Datei `src/renderer/stage-capabilities.ts`:

```ts
export interface StageCapabilities {
  readonly stage: Stage;
  readonly canGrab: boolean;        // parachute interaction
  readonly canType: boolean;        // coding animation
  readonly roamPace: 'slow' | 'normal' | 'fast';  // movement speed
  readonly idleVariant?: string;    // optional idle flavor (e.g. 'idle-teen')
}

const CAPABILITIES: Record<Stage, StageCapabilities> = {
  baby:       { stage: 'baby',        canGrab: true,  canType: false, roamPace: 'slow' },
  'young-baby': { stage: 'young-baby',  canGrab: false, canType: false, roamPace: 'normal' },
  teen:       { stage: 'teen',        canGrab: false, canType: false, roamPace: 'normal' },
  'older-teen': { stage: 'older-teen',  canGrab: false, canType: false, roamPace: 'fast' },
  adult:      { stage: 'adult',       canGrab: true,  canType: true,  roamPace: 'fast' },
};
```

- `stageHasInteraction(stage)` → ersetzt durch `capabilities(stage).canGrab`
- `type`-Gating: bleibt row-basiert (`sheet.meta.rows.some`) — Capabilities-Daten sekundär
- `roamPace`: Roam-Geschwindigkeit pro Stufe (slow=0.5×, normal=1×, fast=1.5×). Aktuell hardcoded in `roam.ts`/`pet-config.ts` → aus Capabilities lesen

### E2 — Refactoring: existierende Stage-Gates auf Capabilities umstellen

| Datei | Aktuell | Neu |
|---|---|---|
| `input-capture.ts:55` | `stage === 'baby' \|\| stage === 'adult'` | `capabilities(stage).canGrab` |
| `renderer.ts:485` | `!sheet.meta.rows.some(row => row.name === 'type')` | bleibt row-basiert, aber Kommentar aktualisiert |
| `roam.ts` / `pet-config.ts` | feste Speed-Werte | `capabilities(stage).roamPace`-Multiplikator |

### E3 — Tests

- `stage-capabilities.test.ts`: alle 5 Stufen, canGrab/canType/roamPace korrekt
- `input-capture.test.ts`: update `stageHasInteraction` auf `capabilities`-basiert
- Roam-Tests: Pace-Variation prüfen

---

## Wave F — Animations-Crosscheck + UI-Konzept

### F1 — M5-Phasen gegen Transkript prüfen (Punkt 4)

**Ist-Stand M5 (12 Phasen, alle `not-started`):**

| Phase | Animation | BL-Items bereits auf Adult-Sheet? |
|---|---|---|
| P1 | Plant & water tree | ✅ watering (BL-1) + tree-stages |
| P2 | Coding | ✅ type (BL-18) |
| P3 | Drink | ✅ drink (BL-3) |
| P4 | Sleep | ✅ sleep (BL-4) |
| P5 | Wake-up/stretch | ✅ stretch (BL-5) |
| P6 | Speaking | ✅ speak (BL-7, rebuilt) |
| P7 | Sport | ✅ exercise (BL-8) |
| P8 | Throw/Collect sticks | ✅ throw-stick + collect-sticks (BL-9) |
| P9 | Toilet Wave | — |
| P10 | Phone / Brain Rot | — |
| P11 | Meeting/Speech | — |
| P12 | Stage Art Package | ✅ young-baby + older-teen figures (BL-6, nur idle/walk) |

**Offene Frage:** Deckt das Transkript aus `.flightplan/Meetings/2026-07-21-planung/` die gleichen
Punkte ab? Transkript-Inhalte waren nicht direkt lesbar (Audio-Datei/en), aber das Meeting
hatte laut NOTE.md Themen: „Recording Agent → M3 · Level/XP/Profile → M4 · naming → M4/P3 ·
achievements → M4/P3 · safety → M3/P3 · contributions → M6/P1" — M5-Animationen waren
nicht prominentes Thema, eher die grobe Roadmap.

**Ergebnis:** M5-Phasenliste ist vollständig und deckt alle bekannten Animationen ab.
Offen: P12 Stage Art Package muss young-baby/older-teen/adult alle Rows erstellen, nicht
nur idle/walk (derzeit nur BL-6 Figuren). Das ist vermutlich die größte verbleibende Aufgabe
für Vlady's Agent. → Auf NOTE.md als Crosscheck-Ergebnis notieren.

### F2 — Settings-UI-Layout vorplanen (Punkt 5)

Konzept-Skizze (wartet auf Owner-Transkript):
- Oben: „Beaver Status" Card (Level, Stage-Icon, XP-Bar, next level)
- Mitte: Connect-Sektion wie bisher, aber Token-Cursor prominent
- Unten: Danger Zone / Misc wie bisher
- Mobile/Compact: aktuell 713px Content-Height — bleibt, Scroll funktioniert

Wird als separates Konzept-Dokument geschrieben, sobald der Owner sein Transkript bereitstellt.
→ Aufgabe bleibt offen, als Blocked-by: Owner notiert.

---

## Vorgehen (Subbranch)

1. **Plan-Modus verlassen** → Commit der uncommitteten Curve-Änderungen auf `feat/reset-removal-xp-migration`
2. **Neuer Subbranch** `feat/xp-cap-and-settings` von `feat/reset-removal-xp-migration` abzweigen
3. Wave C (Cap) → Worker → Tests grün → Commit
4. Wave D (Settings UI) → Worker → Tests grün → Commit  
5. Wave E (Alterslogik) → Worker → Tests grün → Commit
6. Wave F1 (Crosscheck) → eigenhändig (Docs-Only)
7. PR gegen `feat/reset-removal-xp-migration` oder direkt gegen `main` (Owner-Entscheid)

## Out of Scope

- Neue Animation-Assets (Claude Code / Comfy Cloud)
- M5/P12 Stage Art Package Runtime-Verdrahtung (nur Fundament in Wave E)
- pi-agent Token-Zähler-Fix (eigene Debug-Session)
- Settings-Fenster komplettes UI-Redesign (nur Konzept in Wave F2, Umsetzung nach Owner-Transkript)

## Akzeptanzkriterien

- XP-Cap entfernt: `levelForXp(2_000_000) > 32`, Roundtrip für L33/L50/L100
- Settings zeigt XP / Level / Stage / Fortschritts-Balken / per-Modell Cursor-Tokens
- `stageHasInteraction` ist durch `capabilities(stage).canGrab` ersetzt, alle 5 Stufen getestet
- Roam-Pace variiert nach Stufe (Baby langsam, Adult schnell)
- M5-Phasenliste im Crosscheck bestätigt, Lücken notiert
- `typecheck` + `lint` + `test` grün auf neuem Branch

## Risiken

1. **Uncommittete Curve-Änderungen:** Müssen vor Branch-Wechsel committed werden (Plan-Modus-Ausgang)
2. **`lastSeenByModel` im Settings:** Modellnamen sind technische Strings („claude-opus-4-8") —
   will der User hübschere Labels? → zunächst roh anzeigen, später Mapping-Tabelle aus `model-weights.json` nutzen
3. **Roam-Pace-Änderung:** Bestehende Roam-Tests könnten auf exakte Timer-Werte prüfen → ggf. anpassen
4. **M5/P12 Lücke:** young-baby/older-teen Sheets haben nur idle(1)/walk(2) — alle anderen Rows fehlen →
   als offene Aufgabe für Vlady dokumentiert (BL-6-Erweiterung)
