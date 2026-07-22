# Beaver Buddy — Phase 3: Windows Integrations (BL-WIN-5)

**Status:** Planungsdokument — noch nicht umgesetzt.  
**Ziel:** Claude-Code-Usage-Log-Pfade auf Windows korrekt auflösen, ohne bestehende macOS-/Linux-Verhaltensweisen zu beschädigen.  
**Scope:** ausschließlich Build-Item **BL-WIN-5** (Claude-Usage-Log-Pfade Windows-kompatibel machen). Codex-Tracking bleibt vorerst außerhalb des Windows-Scopes.

---

## 1. Zusammenfassung der Phase

Phase 3 ist die kleinste Phase des Windows-Ports. Sie besteht nur aus dem Build-Item **BL-WIN-5** und fokussiert sich auf die Pfad-Auflösung für Claude-Code-Usage-Logs in `src/main/usage/paths.ts`.

Die derzeitige Implementierung prüft zwei mögliche Claude-Code-Konfigurationsverzeichnisse:

1. **XDG-Pfad:** `~/.config/claude`
2. **Legacy-Pfad:** `~/.claude`

Auf Windows existiert der XDG-Pfad nicht in dokumentierter Form. Der Legacy-Pfad `~/.claude` wird jedoch von Claude Code auf Windows genutzt und liegt unter `%USERPROFILE%\.claude`. Node.js löst `os.homedir()` auf Windows automatisch zu `%USERPROFILE%` auf, sodass `path.join(home, '.claude')` bereits korrekt funktioniert.

**Kernänderung:** Auf Windows (`process.platform === 'win32'`) wird nur noch der Legacy-Pfad `~/.claude` geprüft. Auf macOS und Linux bleibt das bisherige Verhalten (XDG + Legacy) erhalten. `CLAUDE_CONFIG_DIR` bleibt auf allen Plattformen der Override mit höchster Priorität.

Codex-Log-Pfade werden in dieser Phase auf Windows nicht aktiviert, da der offizielle Windows-Pfad der Codex-CLI noch nicht geklärt ist (siehe „Risiken“).

---

## 2. Konkrete Schritte für BL-WIN-5

### 2.1 Dateiänderungen

| Datei | Art der Änderung | Begründung |
|-------|------------------|------------|
| `src/main/usage/paths.ts` | Funktionale Anpassung | Plattformspezifische Auswahl der Claude-Code-Config-Verzeichnisse. |
| `src/main/usage/paths.test.ts` | Testanpassung + Ergänzung | Plattformneutrale Tests beibehalten, plattformspezifische Tests für Windows und Unix hinzufügen. |

### 2.2 Geplante Code-Änderung in `src/main/usage/paths.ts`

Die Funktion `claudeConfigDirs(env, home)` soll um eine Plattformunterscheidung erweitert werden.

#### Variante A: `process.platform` direkt verwenden (einfach, aber schwerer testbar)

```ts
import os from 'node:os';

function claudeConfigDirs(env: PathEnv, home: string): string[] {
  const configured = env.CLAUDE_CONFIG_DIR;
  if (configured && configured.trim().length > 0) {
    return configured
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
  }

  const legacy = path.join(home, '.claude');

  if (os.platform() === 'win32') {
    return [legacy].filter((d) => fs.existsSync(d));
  }

  const xdg = path.join(home, '.config', 'claude');
  return [xdg, legacy].filter((d) => fs.existsSync(d));
}
```

#### Variante B: Plattform als Parameter injizieren (bevorzugt, testbar)

Da `paths.ts` bereits `env` und `home` als Parameter akzeptiert, um Tests unabhängig vom echten System zu machen, sollte auch die Plattform injizierbar sein.

```ts
export interface PathEnv {
  readonly CLAUDE_CONFIG_DIR?: string;
  readonly CODEX_HOME?: string;
}

export type Platform = 'win32' | 'darwin' | 'linux' | string;

function claudeConfigDirs(env: PathEnv, home: string, platform: Platform): string[] {
  const configured = env.CLAUDE_CONFIG_DIR;
  if (configured && configured.trim().length > 0) {
    return configured
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
  }

  const legacy = path.join(home, '.claude');

  if (platform === 'win32') {
    return [legacy].filter((d) => fs.existsSync(d));
  }

  const xdg = path.join(home, '.config', 'claude');
  return [xdg, legacy].filter((d) => fs.existsSync(d));
}

export function discoverPaths(
  env: PathEnv = process.env,
  home: string = os.homedir(),
  platform: Platform = process.platform,
): DiscoveredPaths {
  const claudeFiles = claudeConfigDirs(env, home, platform).flatMap(findClaudeFiles);
  // ... rest unchanged
}
```

**Empfehlung:** Variante B verwenden, da sie konsistent mit der bestehenden Teststrategie ist (kein `process.platform`-Mock nötig) und keine zusätzlichen Dependencies erfordert.

### 2.3 Geplante Teständerungen in `src/main/usage/paths.test.ts`

#### a) Bestehende Tests anpassen

Der Test „prefers XDG (~/.config/claude) and legacy (~/.claude) together when both exist“ muss explizit auf Nicht-Windows-Plattformen laufen oder für Windows umformuliert werden.

**Option 1:** Test erhält einen dritten Parameter `platform` und wird nur für `darwin`/`linux` ausgeführt.

```ts
it('prefers XDG and legacy together when both exist on non-Windows', () => {
  touch(path.join(home, '.config', 'claude', 'projects', 'project-b', 'session-2.jsonl'));
  touch(path.join(home, '.claude', 'projects', 'project-a', 'session-1.jsonl'));

  const { claudeFiles } = discoverPaths({}, home, 'darwin');
  expect(claudeFiles).toHaveLength(2);
});
```

**Option 2:** Test bleibt plattformneutral, indem er nur `legacy` prüft, wenn `xdg` nicht existiert. Dies ist weniger präzise, aber einfacher.

**Empfehlung:** Option 1 wählen, da sie das tatsächliche Verhalten dokumentiert.

#### b) Neue plattformspezifische Tests hinzufügen

```ts
describe('discoverPaths — Claude on Windows', () => {
  it('ignores XDG path and uses legacy ~/.claude on win32', () => {
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

  it('still honors CLAUDE_CONFIG_DIR override on win32', () => {
    const customDir = path.join(home, 'custom-claude');
    touch(path.join(customDir, 'projects', 'project-z', 'session-z.jsonl'));

    const { claudeFiles } = discoverPaths({ CLAUDE_CONFIG_DIR: customDir }, home, 'win32');
    expect(claudeFiles).toHaveLength(1);
  });
});
```

#### c) Plattformneutrale Tests beibehalten

Folgende Tests funktionieren unverändert auf allen Plattformen, wenn `discoverPaths` einen `platform`-Parameter erhält:

- „finds top-level session files and subagent files, ignores non-jsonl entries“ → muss lediglich `platform` übergeben.
- „honors a comma-separated CLAUDE_CONFIG_DIR override“ → funktioniert unabhängig von der Plattform.
- „returns an empty array when nothing exists“ → funktioniert unabhängig von der Plattform.

Alle Codex-Tests bleiben unverändert, da Codex in dieser Phase nicht auf Windows aktiviert wird.

### 2.4 Keine Änderungen an `tracker.ts`

`src/main/usage/tracker.ts` verwendet `discoverPaths()` als black box. Solange die Signatur von `discoverPaths` rückwärtskompatibel bleibt (z. B. durch einen optionalen `platform`-Parameter mit Default `process.platform`), ist keine Änderung nötig.

### 2.5 Erwartete Ergebnisse

- Auf Windows findet `discoverPaths()` Claude-Code-Logs nur unter `%USERPROFILE%\.claude`.
- Auf Windows wird `~/.config/claude` ignoriert.
- Auf macOS und Linux bleibt das bestehende Verhalten erhalten.
- `CLAUDE_CONFIG_DIR` funktioniert auf allen Plattformen als Override.
- Alle bestehenden Tests bleiben grün.
- Neue Tests decken das Windows-Verhalten explizit ab.

---

## 3. Abhängigkeiten zu Phase 1 und Phase 2

| Phase | Build-Items | Relevanz für BL-WIN-5 |
|-------|-------------|-----------------------|
| **Phase 1: Foundation** | BL-WIN-1, BL-WIN-2, BL-WIN-9 | Voraussetzung, damit der Code überhaupt auf Windows gebaut und getestet werden kann (plattformunabhängige Build-Scripts, Windows-CI-Runner). Ohne Phase 1 kann BL-WIN-5 nicht verifiziert werden. |
| **Phase 2: Core Windows Experience** | BL-WIN-3, BL-WIN-4 | Nicht direkt blockierend für BL-WIN-5, aber Teil des gleichen Windows-Port-Themas. Stellt sicher, dass die App auf Windows läuft und somit der Usage-Tracker in der realen Windows-Umgebung getestet werden kann. |

**Abhängigkeiten zu anderen Modulen:**

- `src/main/usage/tracker.ts`: Keine direkte Abhängigkeit, da `discoverPaths` rückwärtskompatibel bleibt.
- `src/main/usage/config.ts`: Nicht betroffen.
- `src/main/usage/claude-parser.ts`, `codex-parser.ts`, `totals.ts`: Nicht betroffen.

---

## 4. Akzeptanzkriterien für die gesamte Phase

1. `discoverPaths()` löst auf Windows (`win32`) Claude-Code-Logs ausschließlich aus `%USERPROFILE%\.claude` auf.
2. `discoverPaths()` prüft auf Windows nicht mehr den XDG-Pfad `~/.config/claude`.
3. Auf macOS (`darwin`) und Linux (`linux`) bleibt die bisherige Logik mit XDG + Legacy erhalten.
4. `CLAUDE_CONFIG_DIR` hat auf allen Plattformen weiterhin höchste Priorität und funktioniert komma-separiert.
5. `src/main/usage/paths.test.ts` enthält:
   - Plattformneutrale Tests für allgemeine Logik (Dateifindung, Override, leere Ergebnisse).
   - Plattformspezifische Tests für Windows (`win32`), die belegen, dass XDG ignoriert wird.
   - Plattformspezifische Tests für Nicht-Windows-Plattformen (`darwin`/`linux`), die belegen, dass XDG weiterhin verwendet wird.
6. `npm run typecheck`, `npm run lint`, `npm run test` und `npm run build` sind lokal und in der CI auf Windows und Nicht-Windows-Plattformen grün.
7. Keine neuen Dependencies werden eingeführt.
8. Keine Änderungen an `tracker.ts`, Parsern oder Aggregationslogik sind nötig.
9. Codex-Tracking wird auf Windows in dieser Phase nicht aktiviert oder dokumentiert als unterstützt.

---

## 5. Risiken und wie sie gemindert werden

| Risiko | Auswirkung | Wahrscheinlichkeit | Mitigation |
|--------|------------|-------------------|------------|
| **Falsche Annahme über den Windows-Claude-Code-Pfad.** Falls Claude Code unter Windows doch `%LOCALAPPDATA%\Claude` oder einen anderen Pfad verwendet, findet der Tracker keine Logs. | Hoch | Mittel | Dokumentierte Entscheidung aus dem Hauptplan beibehalten: Legacy-Pfad `~/.claude` bleibt primär. Falls neue Erkenntnisse auftauchen, wird ein Follow-up-Build-Item erstellt. |
| **Tests sind auf der aktuellen CI-Plattform nicht aussagekräftig.** CI läuft auf `ubuntu-latest` und `windows-latest`. Windows-Tests würden `process.platform === 'win32'` automatisch treffen; Unix-Tests nutzen den injizierten Parameter. | Mittel | Niedrig | Injektion des `platform`-Parameters in `discoverPaths` ermöglicht explizite Tests für `win32`, `darwin` und `linux` unabhängig von der realen CI-Plattform. |
| **Rückwärtskompatibilität von `discoverPaths` wird gebrochen.** Falls ein externer Aufrufer `discoverPaths()` ohne `platform`-Parameter aufruft und der Default nicht `process.platform` ist, verhält sich die App falsch. | Hoch | Niedrig | `platform` als optionaler Parameter mit Default `process.platform` implementieren. Keine externen Aufrufer außerhalb von `tracker.ts` bekannt. |
| **Codex-Tracking wird versehentlich auf Windows aktiviert.** | Niedrig | Niedrig | Keine Code-Änderungen an Codex-Pfaden vornehmen. Im Plan und in der Doku explizit dokumentieren, dass Codex auf Windows nicht unterstützt wird. |
| **Unterschiedliche Pfad-Trenner auf Windows führen zu Test-Fehlvergleichen.** | Niedrig | Niedrig | `path.join` verwenden, keine hartcodierten Slashes in Tests oder Produktivcode. |

---

## 6. Test- und Verifikationsschritte

### 6.1 Lokale Verifikation

```bash
# TypeScript-Prüfung
npm run typecheck

# Linter
npm run lint

# Unit-Tests (alle Plattformen)
npm test

# Build
npm run build
```

### 6.2 Manuelle Verifikation auf Windows

1. Auf einem Windows-Rechner mit installiertem Claude Code prüfen, ob `%USERPROFILE%\.claude\projects\*` existiert.
2. Beaver Buddy starten.
3. Sicherstellen, dass der Token-Burn-Tracker Daten ausgibt.
4. Sicherstellen, dass kein Fehler auftritt, wenn `%USERPROFILE%\.config\claude` nicht existiert.

### 6.3 CI-Verifikation

- GitHub Actions Matrix (`ubuntu-latest`, `windows-latest`) muss für `npm run test` grün sein.
- Windows-Runner deckt automatisch das Verhalten bei `process.platform === 'win32'` ab.
- Injizierte Plattform-Parameter in Tests ermöglichen es, Windows-Verhalten auch auf Linux-CI-Knoten explizit zu testen.

### 6.4 Test-Coverage-Ziele

- `claudeConfigDirs` wird für `win32`, `darwin` und `linux` getestet.
- Override `CLAUDE_CONFIG_DIR` wird für mindestens zwei Plattformen getestet.
- Edge-Cases abgedeckt:
  - Nur XDG existiert auf Windows → leeres Ergebnis.
  - Weder XDG noch Legacy existieren → leeres Ergebnis.
  - Beide Verzeichnisse existieren auf Nicht-Windows → beide werden gefunden.

---

## 7. Nicht-Ziele dieser Phase

- Keine Unterstützung für Codex-Logs auf Windows.
- Keine neuen Features im Usage-Tracking (z. B. neue Parser, neue Metriken).
- Keine Änderungen am Secret-Store (BL-WIN-6), Overlay (BL-WIN-3) oder Tray (BL-WIN-4).
- Keine neuen Dependencies.
- Keine Änderungen an der Build- oder Packaging-Infrastruktur.

---

## 8. Nächste Schritte nach Phase 3

1. **Phase 4: Polish & Release-Readiness** (BL-WIN-8, BL-WIN-10) umsetzen.
2. **Codex-Tracking auf Windows** recherchieren und ggf. als separates Build-Item planen.
3. **BL-WIN-6 (Keychain/Secret-Store)** mit dem Projekt-Administrator abstimmen.
4. **BL-WIN-7 (Atomares Schreiben)** recherchieren.

---

## 9. Änderungsübersicht

| Datei | Änderung |
|-------|----------|
| `src/main/usage/paths.ts` | `claudeConfigDirs` erhält Plattform-Parameter; auf `win32` wird nur `~/.claude` geprüft. |
| `src/main/usage/paths.test.ts` | Plattformspezifische Tests für Windows und Nicht-Windows hinzugefügt; bestehende Tests bleiben plattformneutral. |
