# Flight-Plan Item #49 — Codex-Homes unter Windows: Union statt First-wins

Quelle: `.flightplan/Archive/plans/parity/bereich-1-connect-usage-log-pfade.md` (Befund B1).
Stand: Planung abgeschlossen, noch nicht implementiert.

## 1. Ziel & Akzeptanzkriterien

**Ziel:** Unter Windows dürfen existierende, aber session-lose Codex-Kandidaten
(`%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex` — letzterer ist der Electron-userData-Ordner der
Codex Desktop App) die echten CLI-Sessions unter `%USERPROFILE%\.codex` nicht mehr verdecken.

**Akzeptanzkriterien:**

- AK-1: Ein Nutzer mit installierter Codex Desktop App (also existierendem `%APPDATA%\Codex`)
  **und** Codex CLI (Sessions in `%USERPROFILE%\.codex\sessions`) bekommt seine CLI-Sessions
  gefunden — Connect-Codex funktioniert für diese Nutzergruppe. (Regressionstest vorhanden.)
- AK-2: Sessions, die über mehrere existierende Kandidaten-Roots verstreut liegen, werden
  **alle** gefunden (Union), nicht nur die des ersten existierenden Roots.
- AK-3: Dieselbe Session (gleicher relativer Pfad `YYYY/MM/DD/rollout-*.jsonl`), über zwei
  Roots erreichbar, wird genau einmal gelistet — der frühere Kandidat in der bisherigen
  Reihenfolge gewinnt (deterministische Priorität).
- AK-4: macOS/Linux-Verhalten ist byte-identisch (dort existiert nur der Kandidat `~/.codex`;
  Union über 0 oder 1 Root ≡ bisheriges Ergebnis, inkl. Reihenfolge der Dateiliste).
- AK-5: `CODEX_HOME`-Override unverändert: genau ein Kandidat, kein Union-Effekt.
- AK-6: Opt-in-Gating unverändert: `UsageTracker` parst Dateiinhalte weiterhin erst nach
  `setEnabledSources`; Discovery bleibt reines Verzeichnislisting (Union fügt maximal zwei
  zusätzliche `readdir`-Scans hinzu, keine Dateiinhalte).
- AK-7: `npm test`, `npm run typecheck`, `npm run lint` grün. Keine neuen Dependencies.

## 2. Entscheidung: Union (nicht Reordering)

**Entscheidung: Union aller existierenden Kandidaten**, wie in der Analyse empfohlen.

Begründung, ehrlich abgewogen:

- **Reordering** (`~/.codex` an erste Stelle der win32-Kandidaten, 1 Zeile) fixt nur den
  gemeldeten Fall „Desktop App installiert". Es lässt die umgekehrte Verdeckung bestehen:
  Sessions unter `%LOCALAPPDATA%\Codex` würden dann von `~/.codex` verdeckt. Ob dort je
  reale Sessions liegen, ist nicht verifiziert — Reordering wettet darauf, Union nicht.
- **Union** fixt die ganze Fehlerklasse („irgendein existierender Kandidat verdeckt Sessions
  eines anderen"), unabhängig davon, welcher Root Sessions enthält.
- **Kohärenz-Argument:** Die Codebasis akzeptiert Union-Semantik bereits für Claude auf Unix
  (`paths.ts:58-62`, Kommentar: „users who migrated may still have data in the old spot").
  Dasselbe Migrations-/Misch-Argument gilt für Codex unter Windows exakt genauso.
- **Aufwand ehrlich:** Union ≈ +12 Zeilen netto in `paths.ts` (Dedup-Mechanik per
  `Map<relativ, absolut>` existiert bereits in `findCodexRolloutFiles`/`findCodexFiles`,
  paths.ts:98-133, und wird nur eine Ebene höher wiederverwendet). Reordering wäre 1 Zeile,
  aber semantisch schwächer. Der Mehrpreis ist klein und kapselt sich vollständig intern.

## 3. Design

### 3.1 Konsumenten-Analyse (verifiziert per Grep über `src/`)

| Symbol | Sichtbarkeit | Konsumenten |
|---|---|---|
| `resolveCodexHome` | **privat** (nicht exportiert) | nur `discoverPaths`, `paths.ts:165` |
| `codexHomes` | privat | nur `resolveCodexHome`, `paths.ts:155` |
| `findCodexFiles` | privat | nur `discoverPaths`, `paths.ts:166` |
| `discoverPaths` | **exportiert** | `tracker.ts:134` (positional: env, home — Platform-Default), `paths.test.ts` (durchgehend) |
| `parseCodexFile` / `codex-parser.ts` | exportiert | konsumiert ausschließlich **absolute Dateipfade** (`codex-parser.ts:101`), keinerlei Kopplung an `resolveCodexHome` |

**Konsequenz: Die exportierte Schnittstelle (`discoverPaths`, `DiscoveredPaths`, `PathEnv`)
bleibt unverändert.** Die Signaturänderung `string | undefined` → `string[]` betrifft nur die
private Funktion `resolveCodexHome`. `tracker.ts` und `codex-parser.ts` werden **nicht**
angefasst.

### 3.2 Geänderte/neue private Funktionen in `paths.ts`

```
codexHomes(env, home, platform): string[]            // UNVERÄNDERT — Kandidatenliste,
                                                     // Reihenfolge bleibt:
                                                     // win32: LOCALAPPDATA → APPDATA → ~/.codex
                                                     // unix:  [~/.codex]; Override: [CODEX_HOME]

resolveCodexHomes(env, home, platform): string[]     // ERSETZT resolveCodexHome (Plural):
  return codexHomes(env, home, platform)
    .filter((d) => fs.existsSync(d));                // .filter statt .find — die ganze Änderung

findCodexFiles(codexHome): Map<string, string>       // RÜCKGABETYP string[] → Map<rel, abs>
                                                     // (bisheriger Body gibt schon die
                                                     // sessions-wins-Map her, nur [...values()]
                                                     // entfällt)

findAllCodexFiles(roots: readonly string[]): string[]  // NEU — Cross-Root-Union:
  const winners = new Map<string, string>();
  for (const root of roots)
    for (const [relative, absolute] of findCodexFiles(root))
      if (!winners.has(relative)) winners.set(relative, absolute);   // früherer Kandidat gewinnt
  return [...winners.values()];
```

Naming-Note (aus Verifikation, Minor): die leichte Asymmetrie `findCodexFiles → Map` vs.
`findAllCodexFiles → string[]` ist bewusst akzeptiert — kosmetisch, keine Verhaltensfolge,
die Implementierung folgt dem obigen Schema.

`discoverPaths` (paths.ts:165-166) wird zu einer Zeile:

```ts
const codexFiles = findAllCodexFiles(resolveCodexHomes(env, home, platform));
```

Kommentar an `findAllCodexFiles`: Union über alle existierenden Kandidaten; bei doppeltem
relativem Pfad gewinnt der früheste Kandidat (Kandidaten-Reihenfolge = Priorität), innerhalb
eines Roots weiterhin `sessions/` vor `archived_sessions/`.

### 3.3 Dedup-Regeln (exakt)

Dedup-Schlüssel ist der **relative Pfad** `YYYY/MM/DD/rollout-*.jsonl` (via `path.join`,
plattformkonsistent). Priorität bei Kollision, von oben nach unten:

1. **Kandidaten-Reihenfolge über Root-Grenzen hinweg:** `%LOCALAPPDATA%\Codex` >
   `%APPDATA%\Codex` > `~/.codex`. Begründung: Bewahrt die bisherige First-wins-Priorität als
   Determinismus — der Kandidat, der früher *allein* geliefert hätte, liefert bei echter
   Dopplung weiterhin „seine" Kopie. Praktisch ist die Kollision nahezu ausgeschlossen
   (Desktop-App-userData enthält keine `sessions/`-Rollouts); die Regel braucht nur
   Determinismus, nicht Wahrheit über „die richtige" Kopie.
2. **Innerhalb eines Roots:** `sessions/` vor `archived_sessions/` (bestehende Mechanik,
   unverändert, paths.ts:126-131). Über Root-Grenzen hinweg gilt Regel 1 — auch wenn die
   Kopie des früheren Roots aus `archived_sessions/` stammt. Das ist bewusst so einfach
   gehalten (ein einziger Merge-Loop) und im Kommentar zu dokumentieren.

Nebenbedingungen:

- Identische Kandidaten-Pfade (z. B. `LOCALAPPDATA` ≡ `home`-Konstrukte) sind harmlos:
  Dedup per relativem Pfad absorbiert doppelte Roots.
- Kein Kandidat existiert → `[]` ≡ bisher. `CODEX_HOME` gesetzt, aber nicht existent → `[]` ≡ bisher.
- Ergebnis-Reihenfolge: Kandidaten-Reihenfolge, darin Insertion-Order der Map (sessions-
  Traversal, dann archived-only) — bei genau einem Root **byte-identisch** zu heute (AK-4).

## 4. Änderungsliste pro Datei

- **`src/main/usage/paths.ts`** (einzige Produktivdatei):
  - `resolveCodexHome` → `resolveCodexHomes`, Rückgabe `string[]`, `.find` → `.filter`
    (paths.ts:154-156).
  - `findCodexFiles`: Rückgabetyp `string[]` → `Map<string, string>`, finales
    `[...winners.values()]` entfällt (paths.ts:125-133).
  - Neu: `findAllCodexFiles(roots)` mit Merge-Loop + Kommentar (Prioritätsregeln 3.3).
  - `discoverPaths`: Zeile 165-166 durch den einen `findAllCodexFiles(resolveCodexHomes(...))`-
    Aufruf ersetzen. Claude-Zweig (Zeile 163) **nicht anfassen** (#53-Grenze, s. §6).
- **`src/main/usage/paths.test.ts`**: ein Test umgedreht, drei neue Tests (§5).
  Temp-Dir-Muster (`fs.mkdtempSync(os.tmpdir())`, injiziertes env/home/platform, keine
  homedir-Mocks) exakt beibehalten.
- **Nicht geändert:** `tracker.ts`, `codex-parser.ts`, `main.ts`, alles andere — belegt durch
  Konsumenten-Tabelle §3.1.

## 5. Testplan

### 5.1 Umzudrehender Test (bewusst, dokumentiert)

- `paths.test.ts:144-153` — „prefers %LOCALAPPDATA%\Codex over ~/.codex when both exist"
  nagelt das Fehlverhalten als Spezifikation fest. **Ersetzen durch:**
  „findet Sessions aus %LOCALAPPDATA%\Codex **und** ~/.codex (Union)" — gleiches Setup
  (je eine `rollout-*.jsonl` mit *unterschiedlichen* Dateinamen), Erwartung: **beide** Pfade,
  Reihenfolge LOCALAPPDATA-Datei zuerst (Kandidaten-Reihenfolge, deterministisch).

### 5.2 Neue Tests (alle in `describe('discoverPaths — Codex on Windows')`)

1. **AK-1-Regression:** „existierendes %APPDATA%\Codex ohne Sessions verdeckt ~/.codex-
   Sessions nicht" — `%APPDATA%\Codex` als Verzeichnis anlegen (plus einer Nicht-Session-
   Datei, z. B. `config.json`, um den Desktop-App-Fall zu imitieren), Session unter
   `~/.codex/sessions/...` → genau diese eine Datei wird gefunden.
2. **AK-3-Dedup:** „gleicher relativer Pfad in zwei Roots → früherer Kandidat gewinnt" —
   identischen `YYYY/MM/DD/rollout-dup.jsonl` unter `%LOCALAPPDATA%\Codex\sessions` und
   `~/.codex\sessions` anlegen (unterschiedlicher Inhalt) → genau 1 Ergebnis, und zwar der
   LOCALAPPDATA-Pfad.
3. **AK-2/AK-3-Union mit archived:** „sessions in Root A schlägt archived_sessions in Root B
   für dieselbe Datei" — identischer relativer Pfad, Kopie in `%LOCALAPPDATA%\Codex\sessions`
   und in `~/.codex\archived_sessions` → genau 1 Ergebnis, der LOCALAPPDATA-Pfad
   (Kandidaten-Reihenfolge schlägt archived über Root-Grenzen hinweg, §3.3 Regel 2).

### 5.3 Unverändert bestehen bleibende Tests (Kontrollliste)

- `paths.test.ts:155-162` („falls back to %APPDATA%\Codex when LOCALAPPDATA is missing"):
  Semantik heute = Union mit nur einem liefernden Root → grün, Name bleibt tolerierbar.
- `paths.test.ts:164-170` („falls back to ~/.codex when no AppData paths exist"): grün.
- `paths.test.ts:172-181` (CODEX_HOME-Vorrang): grün (AK-5).
- Gesamter Unix-Codex-Block `paths.test.ts:106-141` inkl. sessions-wins-Dedup: grün (AK-4).
- `tracker.test.ts` (inkl. plattformneutralem Spy-Test „does not read log file contents
  until the user opts in", tracker.test.ts:118-133 — kein win32-Setup): grün (AK-6).

### 5.4 Verifikation

- `npm test` (vitest run), `npm run typecheck`, `npm run lint` — alle lokal grün.
- CI-Matrix (`ubuntu-latest` + `windows-latest`) läuft die win32-Simulations-Tests zusätzlich
  mit echten Win32-Pfaden.

## 6. Risiken / Offenes

- **#53-Grenze (Claude-XDG-Union, gleiche Datei):** Item #53 wird `claudeConfigDirs`
  (paths.ts:54-56) und Test `paths.test.ts:76-81` anfassen — disjunkte Funktionen, disjunkte
  Tests. Einzige Berührungspunkte: die benachbarte Zeile in `discoverPaths` (163 vs. 165) und
  dieselbe Testdatei. Dieser Plan ändert bewusst **nichts** am Claude-Zweig; der spätere
  #53-Loop soll auf dem #49-Stand aufsetzen (Rebase), Konfliktrisiko maximal trivial.
- **macOS-Invarianz:** Union über genau einen Kandidaten (`~/.codex`) bzw. null Kandidaten
  ist per Konstruktion ergebnis- und reihenfolgenidentisch (§3.3); abgesichert durch die
  unverändert grünen Unix-Tests (§5.3). Kein plattformspezifischer Sonderpfad nötig.
- **Kollisions-Priorität ist Konvention, kein Wissen:** Welche Kopie bei echter Cross-Root-
  Dopplung „richtiger" ist, ist unbekannt; Kandidaten-Reihenfolge liefert nur Determinismus.
  Akzeptiert, weil der Fall praktisch nicht auftritt (Desktop-App-userData hat keine
  `sessions/`). Im Code-Kommentar festgehalten.
- **Performance:** Bis zu zwei zusätzliche `readdir`-Bäume pro Refresh, nur wenn die Roots
  existieren; vernachlässigbar gegenüber dem Datei-Parsing, kein Gating-Bruch (nur Listings).
