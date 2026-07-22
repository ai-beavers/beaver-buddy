# Bereich 6 — Icons & Build-Config nach Merge (electron-builder.yml, tray.ts loadTrayIcon, installer-config.test.ts)

Geprüft: Merge d7acaf0 (Merge-Base a6108ed, Eltern 4667082 + a6108ed), Stand HEAD bl-item/windows-native/BL-WIN.

## 1. Urteil: PARITÄT OK

Keine Lücke gefunden. Der Merge von electron-builder.yml ist zeilenkorrekt (beide Seiten vollständig erhalten), alle referenzierten Asset-Dateien existieren und sind formatvalide, loadTrayIcon wurde von Upstream nicht angefasst, und installer-config.test.ts läuft gegen die gemergte yml grün (5/5). Einziges Restrisiko: die von Upstream d1b4ebe neu gesetzten BrowserWindow-Icons (PNG) sind auf Windows funktional, aber ungetestet.

## 2. Befunde

### [risiko] BrowserWindow.icon nutzt 1024²-PNG statt ICO auf Windows
- **Datei:Zeile:** `src/main/mrr/settings-window.ts:257` (`icon: path.join(app.getAppPath(), 'assets', 'beaver-buddy-icon.png')`), `src/main/main.ts:124` (`appIconPath()` → `assets/beaver-buddy-icon.png`), Call-Site `src/main/main.ts:204`
- **Beschreibung:** Upstream d1b4ebe setzt das Fenster-Icon als PNG-Pfad. Das Pet-Overlay-Fenster ist auf Windows irrelevant (`skipTaskbar: true`, `main.ts:138`); das Settings-Fenster erscheint aber in der Taskleiste. Electron akzeptiert PNG auf Windows (wird intern skaliert), empfiehlt aber ICO für scharfe Taskbar-Icons. Kein Test verifiziert das Icon unter win32; 530-KB-PNG für ein Taskbar-Icon ist zudem überdimensioniert. Rein kosmetisch, kein Funktionsverlust.
- **Fix-Vorschlag (ohne neue Dependencies):** In `settings-window.ts` plattform-gaten: `process.platform === 'win32' ? assets/icon.ico : assets/beaver-buddy-icon.png`. `assets/icon.ico` existiert bereits und enthält 16–256px-Stufen. Optional Mini-Test analog `loadTrayIcon`-Tests (withPlatform-Pattern in `tray.test.ts:221-249`).

## 3. Verifiziert-OK-Liste

- **electron-builder.yml Merge-Auflösung:** Konfliktauflösung in d7acaf0 korrekt — `git diff upstream/main HEAD` zeigt ausschließlich unseren angehängten win/nsis-Block, kein Upstream-Verlust. `mac.icon: assets/beaver-buddy-icon.icns` (yml:14) und kompletter win/nsis-Block (yml:15-34) koexistieren.
- **Alle Asset-Referenzen existieren & sind formatvalide:**
  - `assets/beaver-buddy-icon.icns` (yml:14) — valides icns, 273 KB
  - `assets/icon.ico` (yml:19, 27, 28) — valides ICO, 7 Stufen 16/24/32/48/64/128/**256** px → erfüllt electron-builder-256px-Anforderung
  - `assets/tray-icon.png` (tray.ts:85, win/linux-Pfad) — valides PNG, 32×32 RGBA, 2312 B (aus echtem Biber-Sprite generiert, Commit 94ace5c)
  - `assets/tray-iconTemplate.png` (tray.ts:85, darwin-Pfad) — valides PNG, 16×16 gray+alpha (Template-Konvention, nur macOS)
  - `assets/beaver-buddy-icon.png` (main.ts:124, settings-window.ts:257) — existiert, 1024², 530 KB
  - Packaging abgedeckt: `files: assets/**/*` (yml:7) packt alle Icons mit.
- **win/nsis-Block vollständig erhalten (yml:15-34):** target nsis+portable, signtoolOptions sha256 + rfc3161TimeStampServer, installerIcon/uninstallerIcon, createDesktopShortcut/createStartMenuShortcut, shortcutName, installerLanguages [en_US, de_DE].
- **loadTrayIcon unverändert durch Upstream:** `git diff a6108ed upstream/main -- src/main/tray.ts` ist leer — Upstream hat tray.ts seit Merge-Base nicht angefasst. Unsere Plattform-Verzweigung (tray.ts:84-91: darwin→Template+setTemplateImage, sonst tray-icon.png) und der win32-Single-Click-Handler (tray.ts:106-108) sind intakt. Upstream-Altcode hätte das 16×16-Template-Icon unbedingt auf allen Plattformen genutzt — unser Branch ist für Windows strikt besser.
- **installer-config.test.ts läuft gegen gemergte yml:** 5/5 grün (live ausgeführt). Regex toleriert CRLF (`\r?\n` — yml ist CRLF) und Block-Listen; nsis:-Extraktion (installer-config.test.ts:13) matcht yml:26-34 sauber; en_US vor de_DE bestätigt.
- **Zugehörige Tests grün (live):** tray.test.ts 20/20 (inkl. loadTrayIcon win32/darwin/linux, tray.test.ts:221-249), app-icon.test.ts 6/6.
- **app-icon.ts Windows-sicher:** `setUnpackagedDockIcon` ist darwin-gegatet und no-op auf Windows (`src/main/app-icon.ts:128`); Squircle/Dock-Logik läuft nie auf win32.

## 4. Vorgeschlagene Flight-Plan-Items

1. **Windows-Fenster-Icon auf ICO umstellen** — settings-window.ts (und ggf. appIconPath) auf win32 `assets/icon.ico` statt 1024²-PNG nutzen; Plattform-Gate + Mini-Test nach loadTrayIcon-Muster.
