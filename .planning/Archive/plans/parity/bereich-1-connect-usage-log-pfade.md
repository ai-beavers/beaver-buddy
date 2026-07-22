# Bereich 1 — Connect-Usage-Log-Pfade unter Windows

Analyse: `src/main/usage/{tracker,paths,codex-parser,claude-parser,totals,read-lines,config}.ts` + Tests,
Merge-Stand `d7acaf0` (upstream/main → bl-item/windows-native/BL-WIN). Read-only, keine Codeänderung.

## 1. Urteil: LÜCKE GEFUNDEN (bedingt) — Standardfall paritätisch

Die Windows-Pfad-Discovery **existiert** und ist sauber implementiert (kein hartcodierter macOS-Pfad,
`os.homedir()`/`path.join`/env-Injektion durchgehend, CI-Matrix läuft real auf `windows-latest`).
Claude-Code-Logs (`%USERPROFILE%\.claude`) werden unter Windows zuverlässig gefunden.
Codex-Logs (`%USERPROFILE%\.codex`) werden gefunden — **außer** wenn `%LOCALAPPDATA%\Codex` oder
`%APPDATA%\Codex` existiert (z. B. durch die Codex Desktop App): dann entscheidet ein
First-existing-wins-Vorrang zugunsten des falschen, session-losen Verzeichnisses.

## 2. Befunde

### B1 — [lücke, bedingt] Codex: First-existing-wins verdeckt den echten `~/.codex`-Pfad

- `src/main/usage/paths.ts:154-156` — `resolveCodexHome` gibt `codexHomes(...).find(fs.existsSync)` zurück: **genau ein** Kandidat gewinnt.
- `src/main/usage/paths.ts:141-149` — Reihenfolge auf win32: `%LOCALAPPDATA%\Codex` → `%APPDATA%\Codex` → `~/.codex`.
- `src/main/usage/paths.test.ts:144-153` — ein Test nagelt genau dieses First-wins-Verhalten als Spezifikation fest ("prefers %LOCALAPPDATA%\Codex over ~/.codex when both exist").

Der dokumentierte Codex-CLI-Pfad unter Windows ist `%USERPROFILE%\.codex` (CODEX_HOME-Default;
Codex Desktop App und CLI teilen sich laut openai/codex-Issues denselben `~/.codex`-Baum).
`%LOCALAPPDATA%\Codex` ist **kein** bekannter Codex-CLI-Sessions-Pfad; `%APPDATA%\Codex` ist der
Electron-userData-Ordner der Codex **Desktop App** (Roaming-Konvention) — existiert dort also, sobald
die Desktop App installiert ist, enthält aber keine `sessions/`-Rollouts. Folge: Für Nutzer mit
Codex Desktop App + CLI meldet Beaver Buddy auf Windows dauerhaft "keine Codex-Logs gefunden",
obwohl `~/.codex/sessions` voll ist. Das Connect-Feature (Codex-Hälfte) ist für diese Nutzergruppe
funktionslos. Auf macOS existiert das Problem nicht (dort wird nur `~/.codex` geprüft, paths.ts:151).

**Fix-Vorschlag (ohne neue Dependencies):** `resolveCodexHome` durch eine Union ersetzen — alle
existierenden Kandidaten zurückgeben, `findCodexFiles` über jeden laufen lassen und global per
relativem Pfad dedupen (Priorität: Kandidaten-Reihenfolge, darin `sessions/` vor `archived_sessions/`,
Mechanik existiert bereits in `findCodexFiles`, paths.ts:98-133). Alternativ minimal-invasiv:
`~/.codex` an die erste Stelle der win32-Kandidaten setzen. Test ergänzen: "leeres/existierendes
`%APPDATA%\Codex` verdeckt `~/.codex`-Sessions nicht". Schärft Flight-Plan-Item #24.

### B2 — [risiko] WSL-Installationen von Claude Code / Codex werden nicht gefunden

- `src/main/usage/paths.ts:52-56, 141-151` — alle Kandidaten liegen im nativen Windows-Profil.

Auf Windows laufen Claude Code und Codex CLI häufig **in WSL** (historisch der einzige Weg, weiterhin
verbreitet); deren Logs landen im Linux-Home der Distro (`\\wsl$\<distro>\home\<user>\.claude|\.codex`)
und sind für einen nativen Windows-Prozess unsichtbar. Auf macOS gibt es kein Äquivalent → reine
Windows-Lücke im Nutzerkreis. Standard-Windows-Nutzer mit nativer Installation sind **nicht** betroffen.

**Fix-Vorschlag:** Zunächst als bekanntes Limit dokumentieren (README/Connect-Hinweistext). Optional
später: Enumeration installierter Distros über `HKCU\Software\Microsoft\Windows\CurrentVersion\Lxss`
ist ohne neue npm-Dependencies nicht sauber erreichbar (Registry-Zugriff) — daher eher: dokumentierter
Workaround über `CLAUDE_CONFIG_DIR`/`CODEX_HOME` auf den `\\wsl$`-Pfad (beide Overrides existieren
bereits, paths.ts:42-50, 136-139). Als Flight-Plan-Item evaluieren, nicht vorschnell bauen.

### B3 — [risiko, klein] Claude auf win32 ignoriert XDG-Layout vollständig

- `src/main/usage/paths.ts:54-56` — win32-Zweig liefert ausschließlich `~/.claude`; der Unix-Zweig
  (paths.ts:61-62) nutzt dagegen `~/.config/claude` **und** `~/.claude` als Union.

Claude Code unter Windows schreibt standardmäßig `%USERPROFILE%\.claude` — Hauptfall abgedeckt.
Nutzer mit Unix-artigem Setup (Git-Bash/msys-Profile, manuell migriertes `~/.config/claude`) werden
unter Windows nicht gefunden, unter macOS/Linux schon. Asymmetrie ohne ersichtlichen Grund.

**Fix-Vorschlag:** win32-Zweig wie Unix als Union `[xdg, legacy].filter(existsSync)` behandeln
(eine Zeile); bestehender Test `paths.test.ts:76-81` ("returns empty array when only XDG exists on
win32") müsste dann bewusst umgedreht werden.

### Hinweise (keine Flight-Plan-Items)

- Junction/Symlink-Projektordner werden übersprungen (`Dirent.isDirectory()` ist für Links `false`,
  paths.ts:73, 82) — plattformübergreifend identisch, daher kein Paritätsbefund; unter Windows nur
  bei manuell verlinkten `.claude\projects`-Ordnern relevant.
- CRLF: `readBoundedLines` splittet auf `0x0A` (read-lines.ts:39), Zeilen behalten `\r`; `JSON.parse`
  toleriert trailing Whitespace, `second()` arbeitet auf geparstem Timestamp — funktional sicher,
  aber es gibt **keinen** CRLF-Test (read-lines.test.ts ohne `\r`-Fall). Optional nachrüsten.
- `CLAUDE_CONFIG_DIR`-Split auf `/[,;]/` gilt jetzt plattformübergreifend (paths.ts:47) — auf macOS
  würde ein Pfad mit literalem `;` brechen; praktisch irrelevant, aber eine stille Verhaltensänderung
  gegenüber upstream (dort nur `,`).
- Fremdbefund (Bereich Connect-UI): `src/main/mrr/settings.html:63` sagt "on this Mac" — bereits im
  Merge-Verifikationsbericht als [minor] erfasst, hier nur der Vollständigkeit halber notiert.

## 3. Verifiziert-OK

- **Plattform-Verzweigungen vorhanden:** win32-Zweige in `claudeConfigDirs` (paths.ts:54-56) und
  `codexHomes` (paths.ts:141-149); `normalizePlatform(process.platform)` (paths.ts:34-39, 161);
  `UsageTracker` reicht env/home durch und nutzt den Runtime-Default (tracker.ts:65, 134;
  paths.ts:158-162; Instanzierung ohne Args in main.ts:352).
- **Keine hartcodierten Pfade:** durchgehend `os.homedir()` + `path.join` (paths.ts:52, 61, 147, 151,
  160). `os.homedir()` löst unter Windows `%USERPROFILE%` korrekt auf. Grep über `src/` zeigt keinerlei
  literal `~/.claude`-/`~/.codex`-Strings außerhalb von Kommentaren/Tests.
- **Opt-in-Gating nach Merge intakt:** Discovery (nur Verzeichnislisting) immer, Parser nur nach
  `setEnabledSources` (tracker.ts:93-97, 162-167; Header-Kommentar :11-13); `connected` =
  `enabled && logsFound` (:79, :86); Deaktivieren evictet Cache (:169-177). Deckt sich mit
  Merge-Verifikation Punkt F.
- **Tests mocken weder homedir noch Pfade:** echte Temp-Bäume via `fs.mkdtempSync(os.tmpdir())`,
  home/env/platform werden injiziert (paths.test.ts:13-19, tracker.test.ts:10-17). Windows-Spy-Test
  belegt, dass vor Opt-in keine `.jsonl` geöffnet wird (tracker.test.ts:118-133).
- **CI deckt Windows real ab:** Matrix `ubuntu-latest` + `windows-latest`, inkl. `npm test`
  (ci.yml:21, 43) — die win32-Simulations-Tests laufen dort zusätzlich mit echten Win32-Pfaden.
- **win32-Tests vorhanden:** Claude-win32 4 Fälle (paths.test.ts:66-104, inkl. `;`-Separator),
  Codex-win32 4 Fälle (paths.test.ts:143-181, inkl. CODEX_HOME-Vorrang :172-181).
- **Codex-Layout plattformunabhängig korrekt:** `sessions/YYYY/MM/DD/rollout-*.jsonl` +
  `archived_sessions/` mit sessions-wins-Dedup (paths.ts:98-133); Replay-Elision/Dedup im Parser
  (codex-parser.ts:101-177) ohne Pfadbezug.
- **Bounded Reads / defensives Parsen plattformunabhängig** (read-lines.ts:16-106,
  claude-parser.ts:32-66): kein Windows-Sonderfall nötig, kein Fehlerpfad auf fehlende Dateien.
- **Merge sauber:** `git diff upstream/main HEAD -- src/main/usage/` enthält ausschließlich unsere
  Windows-Erweiterungen + async-Listener-Absicherung (tracker.ts:100-114, 207-218); kein
  upstream-Verhalten ging verloren.

## 4. Vorgeschlagene Flight-Plan-Items

- **Codex-Homes unter Windows vereinigen statt First-wins (schärft #24):** `%APPDATA%\Codex` der Desktop App darf `~/.codex`-Sessions nicht mehr verdecken — Union aller existierenden Kandidaten + relative-Pfad-Dedup, Regressionstest ergänzen.
- **WSL-Usage-Logs evaluieren/dokumentieren:** WSL-basierte Claude-/Codex-Installationen werden nicht gefunden; vorerst dokumentieren + Override-Workaround (`CLAUDE_CONFIG_DIR`/`CODEX_HOME` auf den `\\wsl$`-Pfad der Distro).
- **Claude-XDG-Kandidat auch unter Windows nachrangig prüfen:** win32-Zweig von exklusiv auf Union umstellen (eine Zeile), betroffenen Test bewusst umdrehen.
