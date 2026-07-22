# Phase 3: Windows Integrations — Implementierungslog (BL-WIN-5)

**Datum:** 2026-07-15
**Build-Item:** BL-WIN-5 — Claude-Usage-Log-Pfade Windows-kompatibel machen
**Geänderte Dateien:**
- `src/main/usage/paths.ts`
- `src/main/usage/paths.test.ts`

---

## 1. Was wurde geändert

### `src/main/usage/paths.ts`

- Neuer `Platform`-Type auf `'win32' | 'darwin' | 'linux'` eingeschränkt.
- `claudeConfigDirs(env, home, platform)` erhält einen dritten `platform`-Parameter.
  - `CLAUDE_CONFIG_DIR` bleibt Override mit höchster Priorität, plattformübergreifend.
  - Auf `win32` wird ausschließlich der Legacy-Pfad `~/.claude` geprüft.
  - Auf `darwin`/`linux` bleibt das bisherige Verhalten (XDG `~/.config/claude` + Legacy) erhalten.
- `discoverPaths(env, home, platform)` erhält einen optionalen dritten Parameter mit Default `process.platform` (als `Platform` gecastet), um Rückwärtskompatibilität zu `tracker.ts` zu wahren.
- `CLAUDE_CONFIG_DIR` akzeptiert nun zusätzlich zum dokumentierten Komma auch Semikolon als Trennzeichen (`split(/[,;]/`).
  - Begründung: Semikolon ist der konventionelle PATH-Trenner auf Windows. Ein Doppelpunkt wurde bewusst nicht unterstützt, weil er mit Windows-Laufwerksbuchstaben (`C:\`) kollidieren würde.

### `src/main/usage/paths.test.ts`

- Alle `discoverPaths`-Aufrufe werden nun mit einem expliziten `platform`-Parameter aufgerufen.
- Plattformneutrale Claude-Tests laufen parametrisiert über `win32`, `darwin` und `linux`.
- Der XDG-Test („prefers XDG and legacy together when both exist") wurde auf `darwin`/`linux` beschränkt.
- Neue Windows-spezifische Tests unter `discoverPaths — Claude on Windows`:
  - Ignoriert XDG und nutzt Legacy auf `win32`.
  - Liefert leeres Array, wenn nur XDG existiert.
  - `CLAUDE_CONFIG_DIR` Override mit einem Pfad auf `win32`.
  - `CLAUDE_CONFIG_DIR` Multi-Path-Override mit Semikolon-Trennung auf `win32`.
- Codex-Tests wurden ebenfalls mit einem festen `platform`-Parameter (`'linux'`) parametrisiert, bleiben aber inhaltlich unverändert.

---

## 2. Entscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| Plattform als injizierter Parameter (Variante B) | Konsistent mit bestehender Teststrategie (injiziertes `env` und `home`); kein `process.platform`-Mock nötig. |
| `Platform` auf drei Werte eingeschränkt | Type-Safety; Review-Befund verlangte kein `\| string`. |
| Auf `win32` nur Legacy-Pfad | Entspricht der dokumentierten Annahme, dass Claude Code unter Windows `%USERPROFILE%\.claude` verwendet. XDG existiert auf Windows nicht. |
| `CLAUDE_CONFIG_DIR` zusätzlich Semikolon-tolerant | Review-Beforderte Multi-Path-Test auf Windows; Semikolon ist der Windows-PATH-Standard und zerstört keine Windows-Pfade. |
| Kein Doppelpunkt als Trennzeichen | Würde Windows-Laufwerksbuchstaben (`C:\`) falsch parsen. |
| `tracker.ts` nicht geändert | `discoverPaths` bleibt rückwärtskompatibel durch optionalen Parameter mit Default. |
| Keine neuen Dependencies | Nur `node:fs`, `node:os`, `node:path` verwendet. |

---

## 3. Testergebnisse

Lokale Verifikation auf Windows-Entwicklungsrechner (`process.platform === 'win32'`):

```bash
npm run typecheck   # ✅ erfolgreich
npm run lint        # ✅ erfolgreich
npm test            # ✅ 323 passed | 6 skipped (329 total)
npm run build       # ✅ erfolgreich
```

Alle neuen und bestehenden Tests in `src/main/usage/paths.test.ts` sind grün (20 Tests).

---

## 4. Offene Probleme / Hinweise

- **CI-Verifikation auf `ubuntu-latest` und `windows-latest`:** Lokal wurde auf Windows getestet. Da alle `discoverPaths`-Aufrufe explizit parametrisiert sind, sollten die Tests auch auf Linux-CI-Knoten deterministisch laufen. Ein erneuter CI-Lauf ist empfohlen.
- **Doppelpunkt als `CLAUDE_CONFIG_DIR`-Trennzeichen:** Bewusst nicht implementiert, um Windows-Pfade nicht zu zerstören. Falls zukünftig ein echter Bedarf besteht, müsste eine plattformabhängige Trennlogik mit Laufwerkserkennung eingeführt werden.
- **Andere Plattformen (`freebsd`, `openbsd`, etc.):** `discoverPaths` castet `process.platform` auf `Platform`. Bei Aufruf ohne Parameter auf nicht gelisteten Plattformen entsteht ein TypeScript-Cast; das Laufzeitverhalten fällt auf XDG + Legacy zurück, was konsistent mit dem Status quo vor BL-WIN-5 ist. Für typsichere Aufrufe sollten Aufrufer eine der drei unterstützten Plattformen übergeben.
- **UsageTracker-Plattform-Injektion:** `tracker.ts` ruft `discoverPaths(this.env, this.home)` ohne Plattform auf. Das ist für BL-WIN-5 ausreichend, da der Default `process.platform` greift. Für zukünftige Windows-Integrationstests könnte `UsageTracker` optional einen `platform`-Parameter erhalten.
