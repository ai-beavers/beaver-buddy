# Flight-Plan Item #49 — Plan-Verifikation: Codex-Pfad-Union

Geprüft: `.flightplan/Archive/plans/49-codex-pfad-union-plan.md` gegen
`src/main/usage/{paths.ts, paths.test.ts, tracker.ts, tracker.test.ts, codex-parser.ts, codex-parser.test.ts}`,
`src/main/main.ts`, `.github/workflows/ci.yml`, `package.json`. Read-only, keine Codeänderung.

## Urteil: PLAN OK

Alle tragenden Annahmen des Plans sind am Code verifiziert. Keine Blocker. Zwei Minor-Notizen
(Wording bzw. Style), keine davon mit Verhaltensfolge.

## Verifizierte Annahmen

### 1. Konsumenten-Analyse (Plan §3.1) — korrekt, vollständig

- `resolveCodexHome` (paths.ts:154-156): **privat**, einziger Aufruf paths.ts:165 in `discoverPaths`. ✓
- `codexHomes` (paths.ts:135-152): privat, einziger Aufruf paths.ts:155. ✓
- `findCodexFiles` (paths.ts:125-133): privat, einziger Aufruf paths.ts:166. ✓
- `findCodexRolloutFiles` (paths.ts:98-123): privat, Aufrufe nur paths.ts:127-128. ✓
- `discoverPaths`: exportiert; Konsumenten exakt `tracker.ts:134` (positional `env, home` —
  Platform-Default, wie behauptet) und `paths.test.ts` (durchgehend). Grep `from './paths'` über
  `src/`: nur tracker.ts:17 und paths.test.ts:5. ✓
- `codex-parser.ts`: `parseCodexFile(filePath)` (codex-parser.ts:101) konsumiert nur absolute
  Pfade; `codex-parser.test.ts` importiert `./paths` nicht. Keine Kopplung an `resolveCodexHome`. ✓
- `PathEnv`/`DiscoveredPaths` werden nur in tracker.ts typseitig verwendet — Signaturen unverändert. ✓

**Konsequenz bestätigt:** „Keine externe Schnittstellenänderung" stimmt; tracker.ts und
codex-parser.ts müssen nicht angefasst werden.

### 2. Dedup-Mechanik (Plan §2, §3.3) — korrekt beschrieben und vollständig

- `findCodexRolloutFiles` gibt bereits `Map<relative, absolute>` zurück (paths.ts:98-123);
  Schlüssel = `path.join(year, month, day, file)` (paths.ts:115) — plattformkonsistent, da beide
  Roots im selben Prozess denselben Separator nutzen (auch bei win32-Simulation auf Linux-CI). ✓
- `findCodexFiles` (paths.ts:125-133): `sessions/`-Map gewinnt, `archived_sessions/` nur bei
  fehlendem Schlüssel (paths.ts:129-131) — „sessions wins" wie behauptet. Plan-Behauptung
  „nur `[...values()]` entfällt" (§3.2) ist zutreffend: der Body baut die Gewinner-Map schon. ✓
- Geplante Cross-Root-Dedup (`!winners.has(relative)` → früherer Kandidat gewinnt) deckt alle
  Kollisionsfälle ab:
  - gleiche Datei in zwei Roots → 1 Ergebnis, Kandidaten-Reihenfolge entscheidet. ✓
  - `sessions/` in Root A vs. `archived_sessions/` in Root B (gleicher relativer Pfad) → Root A
    gewinnt; umgekehrt (archived in A, sessions in B) gewinnt ebenfalls A. Diese Asymmetrie ist in
    §3.3 Regel 2 explizit als bewusste Einfachheit dokumentiert — deterministisch, praktisch
    irrelevant (Desktop-App-userData enthält keine Rollouts). ✓
  - Identische Kandidaten-Pfade (z. B. `LOCALAPPDATA` ≡ `APPDATA`): doppelter Scan, Dedup per
    relativem Pfad absorbiert — §3.3 Nebenbedingungen deckt das ab. ✓
- Intra-Root-Overwrite in `findCodexRolloutFiles` (unbedingtes `.set`, paths.ts:116) ist harmlos:
  jedes (Y/M/D/file)-Tupel kommt pro Traversal genau einmal vor. Kein Plan-Gap.

### 3. macOS/Linux-Invarianz (AK-4) — bewiesen

- `codexHomes` liefert auf darwin/linux exakt einen Kandidaten `[~/.codex]` (paths.ts:151) bzw.
  `[CODEX_HOME]` (paths.ts:136-139) — Union über 0 oder 1 Root.
- 0 Roots: `findAllCodexFiles([])` → `[]` ≡ heute (`codexHome === undefined` → `[]`). ✓
- 1 Root: Merge-Loop über eine einzige Map → `[...winners.values()]` in identischer Insertion-
  Order wie das heutige `findCodexFiles`-Ergebnis (sessions-Traversal, dann archived-only).
  Es kommen **keine** zusätzlichen `readdir`-Aufrufe hinzu, wenn nur ein Root existiert →
  readdir-Reihenfolge unverändert → Dateiliste byte-identisch inkl. Reihenfolge. ✓
- Unix-Tests (paths.test.ts:106-141) sind order-sicher (Single-Element-`toEqual`, `toHaveLength`,
  `toBe` auf `[0]`) → bleiben grün. Kein Unix-Test kann durch Reihenfolgen kippen. ✓

### 4. Test-Realismus (Plan §5) — umsetzbar

- Temp-Dir-Muster (`fs.mkdtempSync(os.tmpdir())` paths.test.ts:14, `touch`-Helper :21-24,
  env/home/platform-Injektion, keine homedir-Mocks) trägt alle vier geplanten Tests unverändert. ✓
- Umzudrehender Test (paths.test.ts:144-153): neue Erwartung „beide Dateien, LOCALAPPDATA zuerst"
  ist deterministisch — je Root genau eine Datei, Kandidaten-Reihenfolge = Map-Insertion-Order. ✓
- AK-1-Test: `%APPDATA%\Codex` via `touch(.../Codex/config.json)` erzeugbar; leere
  `sessions/`/`archived_sessions/` liefern via `safeReaddir` leere Maps → nur die
  `~/.codex`-Session wird gefunden. ✓
- AK-3-Dedup-Test: gleicher rel-Pfad in zwei Roots mit unterschiedlichem Inhalt → genau der
  LOCALAPPDATA-Pfad. ✓
- Kontrollliste §5.3 stichprobenartig verifiziert: :155-162 (nur APPDATA gesetzt → 1 liefernder
  Root), :164-170, :172-181 (CODEX_HOME exklusiv), Unix-Block — alle grün unter Union. ✓
- **Keine stillen First-wins-Abhängigkeiten außerhalb paths.test.ts:** `tracker.test.ts` hat
  **keine einzige Codex-Fixture** (alle Tests `codex: false`, nur `.claude`-Sessions) und
  instanziiert `UsageTracker({}, home)` — mit leerem env fallen die win32-AppData-Kandidaten per
  `filter` (paths.ts:148) weg → auch auf Windows-CI-Runnern nur ein Kandidat ≡ heute. ✓

### 5. Vollständigkeit — kein fehlender Fall

- **CODEX_HOME (paths.ts:136-139):** `codexHomes` bleibt unverändert; Override retourniert vor
  den Platform-Zweigen `[configured]` → exakt ein Kandidat, kein Union-Effekt (AK-5). Semantisch
  richtig so: expliziter Override soll exklusiv gelten. Gesetzt-aber-nicht-existent → `filter` →
  `[]` ≡ heute. ✓
- **Performance:** +2 `existsSync`, maximal +2 `readdir`-Bäume pro Refresh, nur wenn Roots
  existieren; reine Verzeichnislistings, kein Gating-Bruch — tracker.ts:162-167 parst Inhalte
  weiterhin nur für enabled sources. Vernachlässigbar, korrekt eingeschätzt. ✓
- **Constraints:** keine neuen Dependencies (nur `node:fs`/`node:path`, bereits importiert);
  Oberfläche = paths.ts + paths.test.ts; `npm test`/`typecheck`/`lint` existieren als Scripts;
  CI-Matrix ubuntu-latest + windows-latest bestätigt (ci.yml:21). ✓
- **#53-Grenze:** disjunkt vermerkt — #53 betrifft `claudeConfigDirs` (paths.ts:54-56) und Test
  paths.test.ts:76-81; einzige Berührungspunkte (Nachbarzeile in `discoverPaths` :163 vs. :165-166,
  gleiche Testdatei) sind im Plan §6 korrekt benannt. ✓

## Befunde

- **[minor] Plan §5.3, Labeling:** Der als „Windows-Spy-Test" bezeichnete Test
  (`tracker.test.ts:118-133`, „does not read log file contents until the user opts in") ist
  **plattformneutral** — kein win32-Setup, läuft mit Default-Platform. Die Schlussfolgerung
  (bleibt grün, AK-6) ist trotzdem korrekt: Union fügt vor Opt-in nur `existsSync`/`readdir`
  hinzu, kein `openSync` auf `.jsonl`. Nur die Bezeichnung im Plan ist ungenau.
- **[minor] Plan §3.2, Style:** `findCodexFiles` soll `Map<rel, abs>` zurückgeben, während das neue
  `findAllCodexFiles` `string[]` liefert — leicht asymmetrische Namens-/Typ-Koppelung zweier
  privater Helfer. Funktional einwandfrei; dem Implementierer freigestellt (z. B. Map-Rückgabe
  auch als Inline-Merge in `findAllCodexFiles` denkbar). Keine Korrektur nötig.
- Hinweis ohne Befund-Charakter: Der Kommentar an `findCodexFiles` (paths.ts:126, „sessions/ wins")
  muss bei der Umstellung mitwandern bzw. durch den geplanten Prioritäten-Kommentar an
  `findAllCodexFiles` ergänzt werden — Plan §3.2 deckt das ab.

## Fazit

Plan ist implementierungsreif: Konsumenten-Analyse exakt, Dedup-Regeln vollständig und
deterministisch, Unix-Invarianz beweisbar, Testplan mit dem vorhandenen Temp-Dir-Muster direkt
umsetzbar, CODEX_HOME-Exklusivität und #53-Grenze sauber adressiert. **PLAN OK** — Umsetzung kann
wie geplant erfolgen; die beiden Minor-Notizen sind optional.
