# Bereich 3 — Spend-Tier-Quips (Paritäts-Analyse macOS ↔ Windows)

Scope: `src/main/quips/detectors.ts`, `src/main/quips/quips.ts`, `src/main/quips/quip-config.ts`, `src/main/quips/detectors.test.ts` (+ Datenquellen `src/main/usage/totals.ts`, `src/main/usage/tracker.ts`, Verdrahtung `src/main/main.ts`). Stand: Merge `d7acaf0`.

## 1. Urteil: PARITÄT OK

0 Lücken, 0 Windows-spezifische Risiken. Die Spend-Tier-Quips (tägliche Token-Count-Tiers, lowercase Voice) hängen an keinerlei macOS-spezifischen Pfaden, Datums- oder Locale-Annahmen; die Merge-Auflösung der Detector↔Tracker-Verdrahtung ist intakt und mit Upstream byte-identisch; alle 66 Tests des Bereichs laufen auf diesem Windows-Rechner grün.

## 2. Befunde

Keine [lücke]- oder [risiko]-Befunde.

**Paritäts-neutrale Beobachtung (kein Windows-Gap, betrifft beide Plattformen identisch):** Die Tier-Ankündigung beim ersten Snapshot (Mid-Day-Launch, `detectors.ts:69-80`) wird in der Praxis immer verschluckt: `usageTrackerInstance.start()` (`main.ts:358`) feuert den ersten onTick synchron, bevor `rendererReadyForQuips = true` gesetzt wird (`main.ts:400`), und `fireQuip` ist vorher ein No-op (`main.ts:71-72`) — der Detektor markiert den Tier aber bereits als announced (`detectors.ts:77-79`), sodass er bis zum nächsten Tier-Crossing/Mitternacht nicht erneut feuert. Da der Code mit Upstream identisch ist (`git show d7acaf0^2:src/main/main.ts`, Zeilen 297-307), ist das kein Paritätsproblem, sondern eine Upstream-Designfrage. Fix-Vorschlag (ohne neue Dependencies, upstream-tauglich): den ersten Detektor-Lauf erst im `did-finish-load`-Handler füttern oder das Launch-Tier-Event analog zum Evolution-Replay (`main.ts:406-408`) nach dem Laden erneut feuern.

## 3. Verifiziert-OK-Liste

- **(a) Herkunft der Tages-Token-Counts:** `todayTotalTokens(totals, nowMs)` liest die `daily`-Map aus `aggregate()` (`src/main/usage/totals.ts:56-58`, `60-71`); Einträge liefern die Parser via `Date.parse(ISO-String)` (`claude-parser.ts:54`, `codex-parser.ts:84`); Einspeisung in den Detektor pro Tick in `main.ts:365-374`.
- **(b) Keine macOS-Pfade / TZ-Fallen:** `localDateKey` nutzt bewusst lokale Kalendertage (dokumentiert: ccusage-Akzeptanzmetrik, `totals.ts:44-52`) — numerische `getFullYear/getMonth/getDate`, keine ICU/Locale-Abhängigkeit, identische Semantik unter Windows. Pfad-Discovery hat explizite, getestete win32-Zweige (`paths.ts:54-56`, `141-149`; Tests `paths.test.ts:66-104`, `143-178`).
- **(c) Verdrahtung Detector→Tracker intakt:** Merge-Ergebnis `main.ts:364-374` ist byte-identisch mit Upstream (`d7acaf0^2`, Z. 297-307). tracker.ts-Konfliktauflösung behält Upstreams Opt-in-API (`setEnabledSources`/`getSourcesSnapshot`, `tracker.ts:74-97`) plus unsere async-toleranten Listener (`tracker.ts:100-114`, `207-218`); `onTick` feuert bei jedem Refresh (`tracker.ts:214-218`). Kein `tokenSpike`/`TOKEN_SPIKE`-Rest mehr im Code (Grep über `src/` leer).
- **Tier-Logik & Mitternachts-Reset:** Tier-Crossing feuert nur aufsteigend (`detectors.ts:100-107`), Reset über lokalen Datums-Key (`detectors.ts:94-99`); über Mitternacht ohne neue Log-Schreibzugriffe liefert `todayTotalTokens` korrekt 0, da die `daily`-Map nach Entry-Zeitstempel bucktet, nicht nach "jetzt".
- **(d) Tests laufen unter Windows:** `npx vitest run src/main/quips src/main/usage/totals.test.ts src/main/usage/tracker.test.ts` → 66/66 grün auf diesem Rechner. `detectors.test.ts` hat keine Pfad-/Locale-Abhängigkeiten; Mitternachts-Tests (`detectors.test.ts:96-97`, `totals.test.ts:32-33`) konstruieren beide Zeitpunkte in lokaler Zeit → zeitzonen-unabhängig; kein Testdatum liegt auf einer DST-Umstellung.
- **Lowercase-Voice abgesichert:** Copy-Invarianten-Test inkl. `line.toLowerCase()`-Check (`quips.test.ts:28-32`), plattformunabhängig (ASCII-only Pools).
- **QA-Flag abgedeckt:** `--quip`-Triggerliste leitet sich aus `Object.keys(QUIP_POOLS)` ab (`main.ts:35`) und enthält `spendWeak/spendOk/spendCrazy` automatisch.

## 4. Vorgeschlagene Flight-Plan-Items

Keine Lücken → keine Pflicht-Items. Optional (paritäts-neutral, ggf. besser upstream):

- **"Launch-Tier-Quip wird verschluckt"** — Ersten Spend-Tier-Event nach `did-finish-load` replayen (analog Evolution-Replay), damit die Mid-Day-Launch-Ankündigung sichtbar wird; betrifft macOS und Windows gleichermaßen.
