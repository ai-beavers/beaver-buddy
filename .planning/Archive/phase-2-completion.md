# Beaver Buddy — Phase 2 Completion: Core Windows Experience

**Datum:** 2026-07-15
**Build-Items:** BL-WIN-3 (Overlay-Adapter für Windows), BL-WIN-4 (Tray-Adapter für Windows)
**Status:** ✅ Abgeschlossen

---

## Zusammenfassung

Phase 2 hat die beiden zentralen sichtbaren Windows-Blocker gelöst:

- **BL-WIN-3:** Das Overlay-Fenster verhält sich auf Windows nativ. Es wird an die
  verfügbare Arbeitsfläche (`workArea`) des primären Displays ausgerichtet, reagiert
  auf Display-/Taskleisten-Änderungen und kommuniziert neue Bounds über den
  IPC-Kanal `state:bounds` an den Renderer.
- **BL-WIN-4:** Das Tray-Icon lädt auf Windows das farbige `assets/tray-icon.png`
  und behält auf macOS das Template-Image-Verhalten bei.

Alle automatisierten Checks (Typecheck, Lint, Tests, Build, Windows-Packaging)
laufen erfolgreich durch.

---

## Umgesetzte Build-Items

| Build-Item | Status | Kurzbeschreibung |
|------------|--------|------------------|
| BL-WIN-3 | ✅ Abgeschlossen | Overlay-Adapter für Windows: Z-Order, WorkArea, Taskleisten-Kante, Bounds-IPC |
| BL-WIN-4 | ✅ Abgeschlossen | Tray-Adapter für Windows: farbiges Icon auf Windows, Template-Image auf macOS |

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/main/overlay-adapter.ts` | Neu: Plattform-Adapter für AlwaysOnTop, WorkArea, Taskleisten-Kante |
| `src/main/overlay-adapter.test.ts` | Neu: 14 Unit-Tests für den Overlay-Adapter |
| `src/main/preload.test.ts` | Neu: 3 Tests für `onBoundsChanged` |
| `src/main/main.ts` | Overlay-Adapter-Integration, Bounds-IPC, Deduplizierung, Smoke-Test-Erweiterung |
| `src/main/ipc-channels.ts` | Neuer Kanal `BOUNDS_CHANGED_CHANNEL = 'state:bounds'` |
| `src/main/preload.ts` | `onBoundsChanged` via `contextBridge` exposed |
| `src/renderer/renderer.ts` | Bounds-Change-Handler, Canvas-Resize aus IPC-Payload |
| `src/renderer/roam.ts` | `clampRoamStateToBounds` für sanfte Rückführung in neue WorkArea |
| `src/main/tray.ts` | Plattformspezifische Icon-Auswahl (`loadTrayIcon`) |
| `src/main/tray.test.ts` | +3 Tests für `loadTrayIcon` |

---

## Ergebnisse der Verifikation

| Befehl | Ergebnis |
|--------|----------|
| `npm run typecheck` | ✅ grün |
| `npm run lint` | ✅ grün |
| `npm test` | ✅ 312 passed, 6 skipped |
| `npm run build` | ✅ grün |
| `npx electron-builder --win --publish never` | ✅ grün (NSIS + portable) |

**Neue Testabdeckung:**

- `src/main/overlay-adapter.test.ts`: 14 Tests
- `src/main/preload.test.ts`: 3 Tests
- `src/main/tray.test.ts`: +3 Tests für `loadTrayIcon`

---

## Verbleibende offene Punkte / Warnungen

1. **Auto-Hide-Limitation**
   - `detectTaskbarEdge` vergleicht `display.bounds` mit `display.workArea`.
   - Bei einer Auto-Hide-Taskleiste sind beide auf Windows oft identisch, sodass
     die Taskleisten-Kante nicht erkannt wird.
   - Das Overlay wird auf die volle Bildschirmgröße ausgerichtet; der Biber kann
     kurzzeitig von der eingeblendeten Taskleiste verdeckt werden.
   - Eine vollständige Lösung würde die native Windows AppBar-API erfordern, was
     neue Dependencies bedeuten würde.

2. **Z-Order-Hardware-Test ausstehend**
   - `setAlwaysOnTop(true, 'normal')` ist die konservative Startwahl für Windows.
   - Ob das Overlay über der sichtbaren Taskleiste bleibt, muss auf echter
     Windows-Hardware verifiziert werden.
   - Dokumentierter Fallback: `setAlwaysOnTop(true, 'pop-up-menu')`.

3. **Tray-Icon-Kontrast**
   - Das farbige `assets/tray-icon.png` wurde nicht visuell auf dunklen
     Windows-Taskleisten-Hintergründen geprüft.
   - Phase 4 (BL-WIN-10 / HiDPI) sollte ein Design-Gate für ein kontrastreiches
     Icon vorsehen.

4. **Multi-Monitor und HiDPI/Scaling**
   - Aktuell nur primäres Display (`screen.getPrimaryDisplay()`).
   - HiDPI/Scaling ist nicht Teil dieser Phase und ist für Phase 4 geplant.

---

## Nächste Phase

**Phase 3: Windows Integrations (BL-WIN-5)**

- **Ziel:** Claude-Code-Usage-Tracking funktioniert auf Windows.
- **Build-Item:** BL-WIN-5 — Claude-Usage-Log-Path-Windows-Adapter
- **Akzeptanz:** App findet `%USERPROFILE%\.claude` und wertet Logs korrekt aus;
  `CLAUDE_CONFIG_DIR`-Override bleibt erhalten; XDG-Pfad wird auf Windows
  ignoriert; Codex-Tracking bleibt vorerst zurückgestellt.
