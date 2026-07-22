# Single-Instance-Schutz für Beaver Buddy

**Datum:** 2026-07-15  
**Auslöser:** Beim manuellen Testen der Windows-App wurden zwei Biber-Instanzen gleichzeitig angezeigt. Der Nutzer hat festgelegt, dass nur eine App-Instanz zur gleichen Zeit laufen darf.

---

## Problem

Beaver Buddy nutzt Electron. Ohne expliziten Schutz startet jeder Aufruf von `npm start` (bzw. jeder Klick auf die `.exe`) eine weitere, vollständige Electron-Hauptprozess-Instanz. Das führt dazu:

- Mehrere Overlay-Fenster mit Bibern übereinander.
- Mehrere Tray-Icons.
- Doppelte Token-Tracking-, XP- und MRR-Prozesse.
- Inkonsistenten App-Zustand, weil mehrere Prozesse in dieselbe `userData` schreiben.

## Lösung

In `src/main/main.ts` wurde ganz am Anfang des Hauptprozesses ein Electron-Single-Instance-Lock eingebaut:

```ts
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});
```

### Verhalten

- **Erster Start:** Erhält den Lock, Fenster wird erstellt, App läuft normal.
- **Zweiter Start:** Bekommt keinen Lock, beendet sich sofort mit Exit-Code `0`. Es erscheint kein zweites Fenster, kein zweites Tray-Icon, kein zweiter Tracking-Prozess.
- **Fokus-Wiederherstellung:** Falls die bestehende Instanz je minimiert sein sollte, wird das Fenster wiederhergestellt und in den Vordergrund geholt.

## Betroffene Dateien

- `src/main/main.ts` — hinzugefügt: `app.requestSingleInstanceLock()`, `app.on('second-instance', ...)`.

## Tests / Verifikation

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅ (341 passed, 6 skipped)
- `npm start` (erster Start) zeigt den Biber.
- `npm start` (zweiter Start) beendet sich sofort, ohne ein zweites Fenster zu öffnen.

## Hinweise / Einschränkungen

- Der Lock gilt pro Benutzerprofil (Electron verwendet den App-Namen als Lock-Name). Andere Windows-Benutzer können weiterhin eine eigene Instanz starten — das ist das erwartete Verhalten.
- Falls Beaver Buddy jemals absichtlich mit separaten Profilen (z. B. `--user-data-dir`) parallel laufen soll, muss der Lock-Mechanismus entsprechend erweitert werden.
- Der `second-instance`-Handler zeigt das Fenster in den Vordergrund. Da das Overlay-Fenster `focusable: false` und `alwaysOnTop: true` ist, bleibt das Klick-Through-Verhalten erhalten.
