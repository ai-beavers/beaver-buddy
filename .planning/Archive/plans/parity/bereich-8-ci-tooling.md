# Bereich 8 — CI/Tooling nach Merge (d7acaf0)

## 1. Urteil: PARITÄT OK (mit 2 Risiken, keine harte Lücke)

Der Merge hat unseren CI/Signing-Flow unversehrt übernommen; package.json ↔ package-lock.json
sind konsistent (`npm ci` lauffähig); typecheck, lint und 434 Tests lokal verifiziert grün.
Zwei Risiken: der schwebende Dependabot-Branch `typescript-7.0.2` würde den Build brechen,
und `@types/node` 26 passt nicht zur Node-24-Runtime (von Upstream geerbt).

## 2. Befunde

### Befund 1 — [risiko] Dependabot-Branch `typescript-7.0.2` bricht typecheck/build beim Merge

- **Datei:Zeile:** `tsconfig.json:6` (`"moduleResolution": "node10"`), `tsconfig.json:7` (`"ignoreDeprecations": "6.0"`)
- **Beschreibung:** Der Branch `upstream/dependabot/npm_and_yarn/typescript-7.0.2` (auch auf
  unserem Remote abrufbar; `.github/dependabot.yml` generiert wöchentlich npm-Updates) merged
  textuell konfliktfrei (per `git merge-tree --write-tree` verifiziert) und sein Lockfile ist
  intern konsistent (Spec `^7.0.2` ↔ Version 7.0.2, Plattform-Pakete
  `@typescript/typescript-win32-x64`/`-arm64` vorhanden). Semantisch bricht er den Build:
  das installierte TS 6.0.3 beweist es selbst —
  `npx tsc --noEmit --ignoreDeprecations 5.0` liefert:
  `error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in
  TypeScript 7.0.` Nach einem Merge des Bumps schlagen `npm run typecheck` und `npm run build`
  auf **beiden** OS-Matrix-Jobs fehl (ci.yml:37, ci.yml:46). Der Branch ist zudem stale
  (Diff zu upstream/main zeigt rückwirkende Löschungen, z. B. assets-Icons).
- **Fix-Vorschlag (keine neuen Dependencies):** Vor dem TS-7-Merge die Root-`tsconfig.json`
  migrieren: `"module": "nodenext"` + `"moduleResolution": "nodenext"` (ersetzt `commonjs`/`node10`)
  und `"ignoreDeprecations"` entfernen; CJS-Emit für den Main-Prozess bleibt erhalten
  (kein `"type": "module"` in package.json). Danach den Dependabot-PR rebasen statt den
  stale Branch zu mergen.

### Befund 2 — [risiko] `@types/node` ^26.1.1 vs. Node-24-Runtime (von Upstream geerbt)

- **Datei:Zeile:** `package.json:24` (`"@types/node": "^26.1.1"`, Dependabot-Commit b94bffe)
  vs. `package.json:9` (`engines.node: 24.x`), `ci.yml:30` (`node-version: 24`)
- **Beschreibung:** Der Code wird gegen Node-26-Typen kompiliert, läuft aber auf Node 24:
  CI nutzt Node 24, Electron 43.1.1 bundled Node **v24.18.0** (gemessen via
  `ELECTRON_RUN_AS_NODE=1 electron -e "process.version"`). Node-26-only-APIs würden sauber
  typechecken und erst zur Laufzeit scheitern. Aktuell ist das latent: Grep über `src/` findet
  keine kritischen Neuzugänge (`node:sqlite`, `styleText`, `globSync`, `fs.promises.glob`,
  `process.features` — keine Treffer). Upstream selbst trägt dieselbe Inkonsistenz.
- **Fix-Vorschlag (keine neuen Dependencies):** `@types/node` auf `^24.x` zurückpinnen
  (Revert des Major-Bumps) und ggf. in `.github/dependabot.yml` ein `ignore`-Entry für
  `@types/node` Major-Updates setzen, damit Typen und Runtime-Generation (engines/CI/Electron)
  gekoppelt bleiben.

### Befund 3 — [risiko] Lokale node_modules stale nach dem Merge (nur Arbeitsplatz-Zustand)

- **Datei:Zeile:** `package.json:27` (`"electron": "43.1.1"`, exakt gepinnt) vs. installiert
  `node_modules/electron/package.json` = **43.1.0**
- **Beschreibung:** Der lokale Installationsstand stammt von vor dem Electron-Bump (174dd58).
  Kein Repo-Defekt — Lockfile und package.json sind konsistent (siehe Verifiziert-OK) — aber
  lokale Builds/Signier-Tests laufen gegen die alte Electron-Version, bis `npm ci` läuft.
- **Fix-Vorschlag:** Einmalig `npm ci` ausführen (keine Änderung am Repo nötig).

## 3. Verifiziert-OK-Liste

- **ci.yml unversehrt gemergt:** Inhaltlich identisch zu unserem Pre-Merge-Stand cd4ef80
  (Diff nur CRLF); Upstream änderte ci.yml im Merge-Range nicht
  (`git log 833de1f..upstream/main -- .github/workflows/ci.yml` → keine Treffer). Keine
  doppelten Steps, keine Konfliktmarker — `.github/workflows/ci.yml:1-108` vollständig gelesen.
- **Signing-Flow konsistent:** Mode-Detection fork-safe (ci.yml:48-68), Throwaway-Cert-Subject
  `CN=Beaver Buddy CI (self-signed)` (ci.yml:78) matcht den Verify-Aufruf
  `-ExpectedSubjectContains 'Beaver Buddy CI (self-signed)'` (ci.yml:98) und die
  Substring-Prüfung in `scripts/verify-signatures.ps1:74`. Secret-Propagation via GITHUB_ENV
  (ci.yml:63-64) — Werte bleiben maskiert.
- **Verify-vor-Upload-Reihenfolge:** Verify (ci.yml:93-101) läuft vor Upload (ci.yml:103-108);
  Default-Pfad `release\*.exe` (verify-signatures.ps1:36) passt zu `directories.output: release`
  (electron-builder.yml:3-4) und `path: release/*.exe` (ci.yml:108). Throwaway-Cert läuft nach
  2 Tagen ab (ci.yml:82), aber `rfc3161TimeStampServer` (electron-builder.yml:25) macht die
  Signatur dauerhaft prüfbar.
- **Dependabot checkout-7 / setup-node-7:** Beide Branches mergen konfliktfrei (merge-tree) und
  ändern jeweils nur die eine `uses:`-Zeile — keine Kollision mit Matrix/Signing-Steps.
- **package-lock.json ↔ package.json:** lockfileVersion 3, Root-Specs deckungsgleich
  (0 Mismatches, programmatisch geprüft), electron 43.1.1, typescript 6.0.3,
  @types/node 26.1.1, vitest 4.1.10, eslint 10.7.0 → `npm ci` lauffähig.
- **assets:*-Scripts:** Alle Ziele existieren (`scripts/gen-sprites/build.ts`,
  `build-adult-placeholder.ts`, `build-icons.ts`, `ingest-images.mjs`); keine
  `enum`/`namespace`-Konstrukte in `scripts/` oder `src/` (Grep) → direktes
  `node *.ts` per Type-Stripping funktioniert (mit lokalem Node 22.19 nachgewiesen).
- **scripts/ vom Merge unangetastet:** Merge-Stat (d7acaf0) enthält keine `scripts/`-Dateien;
  `verify-signatures.ps1`, `new-dev-signing-cert.ps1`, `cdp-screenshot.mjs` (Node-22+-APIs:
  fetch/WebSocket), `build-assets.js`, `usage-cli.js` unverändert funktionsfähig; referenzierte
  Pfade (`dist/main/usage/tracker.js`, `src/main/mrr/settings.html`, `assets/sprites/`) existieren.
- **electron-builder.yml:** Merge-Konflikt sauber aufgelöst; mac-/win-/nsis-Sektionen konsistent
  (electron-builder.yml:9-34); Signing strikt opt-in via WIN_CSC_LINK (Kommentar Zeile 20-21).
- **vitest.config.ts:** dist/-Exclude intakt (vitest.config.ts:8); `npm test` lokal verifiziert:
  43 Dateien, **434 passed**, 6 skipped.
- **typecheck + lint:** `npm run typecheck` (3 tsconfigs) und `npm run lint` lokal grün.
- **engines/CI/Electron-Node-Kohärenz:** engines 24.x (package.json:9) = CI node-version 24
  (ci.yml:30) = Electron-43-Runtime Node v24.18.0.

## 4. Vorgeschlagene Flight-Plan-Items

1. **TS-7-ready tsconfig (node10 → nodenext):** Root-tsconfig auf `module`/`moduleResolution:
   nodenext` migrieren und `ignoreDeprecations` entfernen, bevor Dependabot typescript-7.x merged.
2. **@types/node an Node-24-Runtime koppeln:** Major-Bump (b94bffe) auf `^24` zurückpinnen und
   Dependabot-Ignore für `@types/node`-Major setzen.
3. **Post-Merge-Hygiene: `npm ci`:** Lokale Installation auf gelockten Stand heben
   (electron 43.1.0 → 43.1.1); optional als Hinweis in CONTRIBUTING.md.
