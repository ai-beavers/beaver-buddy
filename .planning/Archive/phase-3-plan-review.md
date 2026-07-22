# Phase-3-Plan Review — BL-WIN-5 (Claude-Usage-Log-Pfade auf Windows)

**Geprüfter Plan:** `.flightplan/Archive/phase-3-plan.md`  
**Ausgangslage:** Abschnitt „Phase 3: Windows Integrations (BL-WIN-5)“ aus `.flightplan/Archive/WINDOWS_PORT_PLAN.md`  
**Geprüfte Quelldateien:**
- `src/main/usage/paths.ts`
- `src/main/usage/paths.test.ts`
- `src/main/usage/tracker.ts`

**Review-Agent:** Kritischer Code-Review-Agent  
**Datum:** 2026-07-15

---

## 1. Zusammenfassung des geprüften Plans

Phase 3 ist auf das einzige Build-Item **BL-WIN-5** fokussiert: die plattformspezifische Auflösung der Claude-Code-Usage-Log-Verzeichnisse in `src/main/usage/paths.ts`.

**Geplanter Kernchange:**
- `claudeConfigDirs(env, home)` erhält einen weiteren Parameter `platform`.
- Auf `win32` wird **ausschließlich** der Legacy-Pfad `~/.claude` geprüft.
- Auf `darwin`/`linux` bleibt das bestehende Verhalten (XDG `~/.config/claude` + Legacy) erhalten.
- `CLAUDE_CONFIG_DIR` bleibt auf allen Plattformen der Override mit höchster Priorität.
- `discoverPaths()` bleibt rückwärtskompatibel, indem der neue Parameter optional mit Default `process.platform` ist.
- Tests werden plattformspezifisch erweitert, ohne bestehende Produktivlogik zu beschädigen.
- Codex-Tracking wird auf Windows bewusst **nicht** aktiviert.

Der Plan ist insgesamt **schlank, umsetzbar und konsistent** mit dem übergeordneten Windows-Port-Plan. Die Wahl von **Variante B** (injizierte Plattform statt `process.platform` direkt) ist richtig, weil sie die bestehende Teststrategie (injiziertes `env` und `home`) fortsetzt.

---

## 2. Gefundene Probleme / Lücken / Unstimmigkeiten

| # | Thema | Schwere | Beschreibung |
|---|-------|---------|--------------|
| 1 | **Bestehende Tests rufen `discoverPaths` ohne Plattform auf** | Mittel | Mehrere Tests in `paths.test.ts` (z. B. „finds top-level session files…“, „honors a comma-separated CLAUDE_CONFIG_DIR override“, „returns an empty array when nothing exists“) rufen `discoverPaths({}, home)` **ohne** `platform` auf. Auf der Windows-CI wird dann automatisch `process.platform === 'win32'` verwendet. Für `.claude`-only-Tests ist das zufällig OK, macht die Tests aber plattformabhängig und weniger deterministisch. |
| 2 | **Test „prefers XDG and legacy together…“ wird auf Windows-CI rot** | Hoch (Test-Failure) | Der bestehende Test erstellt sowohl `~/.config/claude` als auch `~/.claude` und erwartet 2 Dateien. Auf `win32` würde XDG ignoriert und nur 1 Datei zurückgegeben → Test bricht. Der Plan erwähnt die Anpassung, aber es ist ein echter Blocker, wenn vergessen wird, **alle** Aufrufe zu parametrisieren. |
| 3 | **Keine Parametrisierung über alle drei Plattformen** | Niedrig-Mittel | Der Plan fügt separate Windows-Tests hinzu, schlägt aber keine parametrisierten Tests vor, die denselben Sachverhalt für `win32`, `darwin` und `linux` wiederverwenden. Das würde die Wartbarkeit erhöhen. |
| 4 | **`Platform`-Type ist effektiv `string`** | Niedrig | Der vorgeschlagene Type `export type Platform = 'win32' | 'darwin' | 'linux' | string` kollabiert zu `string` und bietet keinen echten Type-Safety-Gewinn. |
| 5 | **CLAUDE_CONFIG_DIR-Multi-Path auf Windows nicht explizit getestet** | Niedrig | Der Plan testet den Override auf Windows nur mit einem einzigen Pfad. Die komma-separierte Multi-Path-Logik ist zwar plattformunabhängig, aber ein zusätzlicher Windows-Test mit mehreren Pfaden würde das Vertrauen erhöhen. |
| 6 | **Verhalten auf „sonstigen“ Plattformen unklar dokumentiert** | Niedrig | Der Default `platform = process.platform` kann auch Werte wie `freebsd`, `openbsd` oder `aix` annehmen. Der Plan sagt nicht, wie sich `claudeConfigDirs` in diesen Fällen verhält (es würde XDG+Legacy verwenden, was konsistent mit dem Status quo ist). |
| 7 | **`UsageTracker` kann die Plattform nicht injizieren** | Niedrig | `src/main/usage/tracker.ts` ruft `discoverPaths(this.env, this.home)` auf. Das ist für die Produktion rückwärtskompatibel. Für zukünftige Tests eines Windows-`UsageTracker` müsste jedoch entweder `UsageTracker` ebenfalls einen `platform`-Parameter erhalten oder die Plattform über `env` mitgeführt werden. Der Plan sagt korrekt, dass `tracker.ts` nicht geändert wird, erwähnt diese Test-Lücke aber nicht. |
| 8 | **Keine klare Quelle für die Windows-Claude-Pfad-Annahme** | Niedrig | Der Plan beruft sich auf den Hauptplan, der wiederum dokumentiert, dass `~/.claude` unter Windows als `%USERPROFILE%\.claude` funktioniert. Eine Verlinkung auf die entsprechende Dokumentation/Quelle wäre hilfreich. |

---

## 3. Konkrete Verbesserungsvorschläge

### 3.1 Alle Test-Aufrufe von `discoverPaths` explizit parametrisieren

Statt:

```ts
const { claudeFiles } = discoverPaths({}, home);
```

sollten alle Tests explizit werden:

```ts
const { claudeFiles } = discoverPaths({}, home, 'darwin');
// oder 'linux', 'win32' je nach Testzweck
```

**Begründung:** Deterministische Tests unabhängig von der CI-Plattform. Vermeidet, dass ein Refactor auf Windows-CI überraschend rot wird.

### 3.2 Bestehenden XDG-Test auf Nicht-Windows beschränken

Der Test „prefers XDG and legacy together when both exist“ muss entweder
- einen dritten Parameter `platform: 'darwin'` (oder `'linux'`) erhalten, oder
- in einen `describe.each(['darwin', 'linux'])` Block verschoben werden.

Empfohlene Variante:

```ts
describe.each(['darwin', 'linux'])('discoverPaths — Claude on %s', (platform) => {
  it('prefers XDG and legacy together when both exist', () => {
    touch(path.join(home, '.config', 'claude', 'projects', 'project-b', 'session-2.jsonl'));
    touch(path.join(home, '.claude', 'projects', 'project-a', 'session-1.jsonl'));

    const { claudeFiles } = discoverPaths({}, home, platform);
    expect(claudeFiles).toHaveLength(2);
  });
});
```

### 3.3 Windows-Tests parametrisieren oder ergänzen

Empfohlene Windows-Test-Suite:

```ts
describe('discoverPaths — Claude on Windows', () => {
  it('ignores XDG and uses legacy ~/.claude on win32', () => {
    touch(path.join(home, '.config', 'claude', 'projects', 'project-x', 'session-x.jsonl'));
    touch(path.join(home, '.claude', 'projects', 'project-y', 'session-y.jsonl'));

    const { claudeFiles } = discoverPaths({}, home, 'win32');
    expect(claudeFiles).toHaveLength(1);
    expect(claudeFiles[0]).toBe(path.join(home, '.claude', 'projects', 'project-y', 'session-y.jsonl'));
  });

  it('returns empty array when only XDG exists on win32', () => {
    touch(path.join(home, '.config', 'claude', 'projects', 'project-x', 'session-x.jsonl'));

    const { claudeFiles } = discoverPaths({}, home, 'win32');
    expect(claudeFiles).toEqual([]);
  });

  it('still honors CLAUDE_CONFIG_DIR override on win32 (single path)', () => {
    const customDir = path.join(home, 'custom-claude');
    touch(path.join(customDir, 'projects', 'project-z', 'session-z.jsonl'));

    const { claudeFiles } = discoverPaths({ CLAUDE_CONFIG_DIR: customDir }, home, 'win32');
    expect(claudeFiles).toHaveLength(1);
  });

  it('honors comma-separated CLAUDE_CONFIG_DIR override on win32', () => {
    const dirA = path.join(home, 'custom-a');
    const dirB = path.join(home, 'custom-b');
    touch(path.join(dirA, 'projects', 'project-a', 'session-1.jsonl'));
    touch(path.join(dirB, 'projects', 'project-b', 'session-2.jsonl'));

    const { claudeFiles } = discoverPaths(
      { CLAUDE_CONFIG_DIR: `${dirA}, ${dirB}` },
      home,
      'win32'
    );
    expect(claudeFiles).toHaveLength(2);
  });
});
```

### 3.4 `Platform`-Type einschränken

Statt:

```ts
export type Platform = 'win32' | 'darwin' | 'linux' | string;
```

besser:

```ts
export type Platform = 'win32' | 'darwin' | 'linux';
```

oder falls zukünftige Plattformen explizit erlaubt werden sollen:

```ts
export type Platform = NodeJS.Platform;
```

Falls ein Fallback-Verhalten gewünscht ist, kann `claudeConfigDirs` intern mit einem `switch` arbeiten und `default: return [xdg, legacy].filter(...)` verwenden.

### 3.5 Plattformneutrale Tests in `describe.each` fassen

Für Tests, die auf allen Plattformen gleich aussehen sollten (z. B. „finds top-level session files…“, „honors a comma-separated CLAUDE_CONFIG_DIR override“, „returns an empty array when nothing exists“), kann `describe.each(['win32', 'darwin', 'linux'])` verwendet werden. Das erhöht die Coverage und macht Abweichungen sofort sichtbar.

### 3.6 Verhalten auf unbekannten Plattformen dokumentieren

Im Code oder Plan explizit notieren:

> Für Plattformen außer `win32`, `darwin` und `linux` verhält sich `discoverPaths` wie bisher (XDG + Legacy), da dies konsistent mit dem Status quo vor BL-WIN-5 ist.

### 3.7 Optional: `UsageTracker` für zukünftige Testbarkeit vorbereiten

Aktuell kein Muss, aber erwägenswert: `UsageTracker` könnte einen optionalen dritten Konstruktor-Parameter `platform` erhalten, der an `discoverPaths` weitergereicht wird. Das würde spätere Integrationstests auf simulierten Plattformen ermöglichen, ohne `process.platform` mocken zu müssen.

---

## 4. Korrektheitsprüfung der zentralen Anforderungen

| Anforderung | Bewertung | Hinweis |
|-------------|-----------|---------|
| Schritte konkret und umsetzbar | ✅ Ja | Variante B ist klar beschrieben, Dateien und Teständerungen sind benannt. |
| Windows: nur Legacy-Pfad | ✅ Korrekt | `if (platform === 'win32') return [legacy].filter(...)` passt zur Annahme im Hauptplan. |
| macOS/Linux: XDG + Legacy | ✅ Korrekt | Unverändert zum bestehenden Verhalten. |
| `CLAUDE_CONFIG_DIR` als Override | ✅ Korrekt | Wird vor der Plattformprüfung ausgewertet und ist komma-separiert. |
| Bestehende Tests berücksichtigt | ⚠️ Teilweise | Der Plan erkennt den XDG-Test, aber nicht alle `discoverPaths`-Aufrufe in Tests werden explizit parametrisiert. |
| Tests plattformgerecht | ⚠️ Verbesserungsbedarf | Siehe Vorschläge 3.1–3.5. |
| Edge-Cases | ⚠️ Teilweise | Nur-XDG-auf-Windows und Override sind abgedeckt; Multi-Path-Override auf Windows und „andere Plattformen“ fehlen. |
| Rückwärtskompatibilität von `discoverPaths()` | ✅ Gewahrt | Optionaler Parameter mit Default `process.platform` stellt sicher, dass `tracker.ts` ohne Änderung weiter funktioniert. |

---

## 5. Risikobewertung

| Risiko | Einschätzung |
|--------|--------------|
| Test-Failure auf Windows-CI wegen nicht-parametrisiertem XDG-Test | **Mittel** — leicht zu beheben, aber ein echter Blocker, wenn übersehen. |
| Falscher Windows-Claude-Pfad | **Niedrig** — entspricht der dokumentierten Annahme im Hauptplan. |
| Rückwärtskompatibilität gebrochen | **Niedrig** — Variante B mit Default-Parameter ist rückwärtskompatibel. |
| Codex wird versehentlich auf Windows aktiviert | **Niedrig** — Plan schließt das explizit aus. |
| Unsaubere Type-Safety durch `Platform \| string` | **Niedrig** — funktional harmlos, aber stilistisch schwach. |

---

## 6. GO / NO-GO Empfehlung

### ✅ GO — mit Hinweisen

Der Plan ist **grundsätzlich umsetzbar und richtig**. Die Architekturentscheidung (injizierte Plattform, rückwärtskompatibler Default, kein `process.platform`-Mock nötig) ist die beste der beiden vorgestellten Varianten.

**Aber:** Bevor der Implementierungs-Agent loslegt, sollten die Punkte aus Abschnitt 3 (insbesondere 3.1, 3.2 und 3.4) direkt im Plan oder in der Umsetzung berücksichtigt werden. Sie sind keine Blocker für die Architektur, aber vermeiden nachfolgende Test-Iterationen.

---

## 7. Wichtige Hinweise für den Implementierungs-Agenten

1. **Nicht nur den XDG-Test anpassen — alle `discoverPaths`-Aufrufe in `paths.test.ts` müssen einen expliziten `platform`-Parameter erhalten.** Andernfalls werden Tests auf Windows-CI automatisch `win32` verwenden und sind schwer nachvollziehbar.
2. **Variante B verwenden**, aber den `Platform`-Type auf `'win32' | 'darwin' | 'linux'` einschränken (kein `| string`).
3. **CLAUDE_CONFIG_DIR-Override testen**:
   - ein Pfad auf `win32`,
   - mehrere Pfade auf `win32`,
   - mindestens ein Multi-Path-Test auf `darwin`/`linux`.
4. **`tracker.ts` nicht ändern**, aber prüfen, ob ein neuer `UsageTracker`-Konstruktor-Parameter für zukünftige Tests sinnvoll ist. Wenn der Scope strikt BL-WIN-5 ist, reicht es, `discoverPaths` rückwärtskompatibel zu halten.
5. **Keine neuen Dependencies einführen.** Der Plan verlangt das explizit; die Umsetzung kommt mit `node:os`/`node:path` aus.
6. **Lint und Typecheck nicht vergessen.** `eslint` könnte gegen nicht verwendete Imports (z. B. `node:os` in `paths.ts`, falls nur noch `process.platform` genutzt wird) meckern.
7. **Nach der Umsetzung auf beiden CI-Plattformen (`ubuntu-latest`, `windows-latest`) `npm test` ausführen.** Die injizierten Tests garantieren, dass das Windows-Verhalten auch auf Linux getestet wird; der Windows-Runner deckt zusätzlich `process.platform === 'win32'` ab.
8. **Dokumentation aktualisieren:** Falls `CLAUDE.md` oder `docs/adr/002-cross-platform-scope.md` Hinweise auf Usage-Log-Pfade enthalten, sollte der Windows-Spezialfall dort ergänzt werden.
