# Plan #46 — Sichtbarer „Fortschritt zurücksetzen“-Button im Growth-Settings-Fenster

## 1. Ziel & Akzeptanzkriterien

Der User kann im „Growth Settings“-Fenster per Knopfdruck den Biber auf den Start zurücksetzen — im laufenden Betrieb, ohne App-Neustart und ohne State-Dir zu löschen.

Akzeptanzkriterien:

- Ein sichtbarer, klar abgegrenzter Button („Danger zone“) in `settings.html`, mit Zwei-Klick-Bestätigung (kein versehentlicher Reset).
- Nach Auslösung: XP = 0, Level = 1, Stage = `baby`; die Hatch-Animation spielt sofort im Overlay erneut ab.
- MRR-Secrets (Stripe/RevenueCat-Keys) und Growth-Settings (Mode, Connected-Flags) bleiben vollständig erhalten.
- Tray-Pet-Label zeigt nach Reset sofort `Lv 1 — baby (0/100)`.
- Kein Re-Award der Token-Historie: der laufende Usage-Tracker darf nach dem Reset nicht die gesamte Lifetime-Historie erneut als XP gutschreiben.
- Nach App-Neustart bleibt der Reset bestehen (persistiert) und die Hatch läuft NICHT erneut (Onboarding-Flag bleibt `hatched: true`).
- Kein neuer IPC-Wildwuchs: neuer Channel folgt exakt dem bestehenden Settings-Muster (Sender-Frame-Check, Handler Electron-frei testbar).
- `npm test` (383 bestehende Tests + neue) grün, `typecheck` und `lint` sauber. Keine neuen Dependencies, `package.json`/`package-lock.json` unverändert.

## 2. Reset-Semantik

State-Dateien im einzigen State-Dir (`app.getPath('userData')`, siehe `src/main/main.ts:191`):

| Datei / Ort | Inhalt | Aktion bei Reset |
|---|---|---|
| `xp-state.json` (`src/main/xp/store.ts`) | `xp`, `lastSeenLifetimeTokens`, `lastMrrAwardDate` | `xp` → 0, `lastMrrAwardDate` → `null`. **`lastSeenLifetimeTokens` bleibt unverändert** — das ist der forward-only Durable-Cursor des Trackers (`xp/engine.ts:89-100`); ein Zurücksetzen auf 0 würde beim nächsten Tracker-Tick die komplette Token-Historie erneut als XP gutschreiben und den Reset faktisch rückgängig machen. |
| `onboarding-state.json` (`src/main/onboarding.ts`) | `hatched` | `{ hatched: true }` persistieren **bevor** die Hatch-Nachricht gesendet wird — exakt dieselbe Exactly-once-Disziplin wie der Launch-Pfad (`main.ts:197-203`): ein Kill mitten in der ~6s-Hatch führt nicht zum Re-Hatch beim nächsten Start. (`hatched: false` ist keine Option — es gibt keinen `hatch:done`-Rückkanal, die Datei würde nie wieder `true`.) |
| `growth-settings.json` (`src/main/mrr/settings-store.ts`) | `mode`, `stripeConnected`, `revenuecatConnected` | **Unangetastet.** |
| `secrets/<service>/*.enc` (Pfad-Bauer `src/main/mrr/secrets.ts:14-18`, Windows DPAPI/`safeStorage` `secrets.ts:25-35`) bzw. macOS-Keychain | Stripe/RevenueCat-Keys | **Unangetastet.** |

Folgeentscheidungen:

- **Kein App-Neustart nötig.** Alle State-Owner (`XpEngine`, Onboarding-Datei, Renderer-Hatch-State) können zur Laufzeit zurückgesetzt werden; kein Modul cached den Onboarding-Status nach dem Launch (er wird nur einmal in `main.ts:195` gelesen). Ein Neustart wäre schlechtere UX ohne jeden Korrrektheitsgewinn.
- **MRR-Modus:** `lastMrrAwardDate = null` bedeutet: der nächste MRR-Poll darf das Tages-MRR dem frischen Biber erneut gutschreiben. Das ist konsistent mit „Neustart des Tiers“ und verhindert kein Double-Award desselben Tiers (altes Tier existiert nicht mehr).
- **Kein Evolution-Signal beim Reset:** Der Stage-Wechsel adult/teen → baby ist ein Rückschritt, keine Evolution. Das vom Reset emittierte Pet-Update trägt **kein** `evolvingTo` — sonst feuert `main.ts:297-299` den `evolution`-Quip und der Renderer startet die Evolution-Sequenz (`renderer.ts:150-160`). Der Renderer synct die Stage bei Updates ohne `evolvingTo` direkt (`renderer.ts:170-174`), was während einer aktiven Hatch ebenfalls korrekt ist.
- Der versteckte QA-Flag `--reset-hatch` (`main.ts:193-196`) bleibt unverändert bestehen (minimale Änderung; der Button ist keine Ersetzung, sondern die User-sichtbare Variante).

## 3. Architektur / Flow

Neuer Channel: **`settings:reset-progress`** (Konstante `SETTINGS_RESET_PROGRESS_CHANNEL`), ohne Payload — daher entfällt eine Erweiterung von `settings-validate.ts` (nichts zu validieren; der Renderer wird weiterhin nicht vertraut, der Sender-Frame-Check ist die Absicherung).

Renderer-Flow (settings.html):

1. User klickt „Reset beaver…“ → Button armiert (Text wird zu „Sure? Click again to reset“, 5-s-Timeout disarmiert wieder).
2. Zweiter Klick innerhalb des Fensters → `api.resetProgress()` → Ergebnis in `#status` („progress reset — hatch replaying“ / `error: …`).

Main-Flow:

1. `ipcMain.handle(SETTINGS_RESET_PROGRESS_CHANNEL)` → `handlers.resetProgress(event)` (in `createSettingsHandlers`): Sender-Frame-Check (`isFromSettingsWindow`), dann `await deps.onProgressReset()`, Erfolg `{ ok: true }`, Exception → `{ ok: false, error: 'reset failed' }`.
2. `deps.onProgressReset` wird in `main.ts` (`openGrowthSettings`) verdrahtet und macht in dieser Reihenfolge:
   1. `await saveOnboardingState(stateDir, { hatched: true })`
   2. `mainWindow?.webContents.send(HATCH_START_CHANNEL)` — Hatch **vor** dem Pet-Update, dieselbe Reihenfolge-Invariante wie `main.ts:336-340` (der Renderer unterdrückt während der Hatch die Evolution-Behandlung).
   3. `await xpEngine.resetProgress()` — persistiert `xp-state.json` und emittiert das Update.
3. Overlay- und Tray-Benachrichtigung laufen **automatisch** über die bestehende `xpEngine.onUpdate`-Verdrahtung (`main.ts:294-300`): `tray.refresh()` + `PET_CHANGED_CHANNEL`-Send. Kein neuer Code nötig.
4. Renderer (`renderer.ts:183-192` / `148-176`) verarbeitet `onHatchStart` und das Pet-Update zur Laufzeit bereits korrekt (Hatch-State wird neu gesetzt, Lodge-Sheet ggf. nachgeladen, Stage synct direkt auf `baby`). **Einzige Renderer-Änderung (Ein-Zeilen-Fix, Orchestrierer-Entscheidung zu Verifikations-Befund 1):** in `onHatchStart` wird `evolutionState = null;` gesetzt — sonst verwirft der mit `!evolutionState` bewachte Direct-Sync-Zweig (`renderer.ts:170`) das Reset-Pet-Update bei zufällig aktiver Evolution (~2-s-Fenster) und der Renderer bliebe bis zum nächsten Pet-Update/Neustart auf teen/adult hängen. Die Prämisse „keine Renderer-Änderung" präzisiert sich damit auf genau diese eine Zeile.

Handler-Signatur (nach Muster `SettingsHandlers`):

```ts
resetProgress(event: IpcMainInvokeEvent): Promise<unknown>;
```

Neues Dep in `SettingsWindowDeps`:

```ts
readonly onProgressReset: () => Promise<void>;
```

## 4. Konkrete Änderungsliste pro Datei

### `src/main/ipc-channels.ts`
- Neue Konstante im Settings-Block: `export const SETTINGS_RESET_PROGRESS_CHANNEL = 'settings:reset-progress';`

### `src/main/mrr/settings-window.ts`
- `SettingsWindowDeps`: Feld `onProgressReset: () => Promise<void>` hinzufügen.
- `SettingsHandlers`: Methode `resetProgress(event): Promise<unknown>` hinzufügen.
- `createSettingsHandlers`: `resetProgress` implementieren — `if (!isAuthorized(event)) return { ok: false, error: 'unauthorized' };`, dann `try { await deps.onProgressReset(); return { ok: true }; } catch { return { ok: false, error: 'reset failed' }; }`. Kommentar im Stil der Datei: Reset-Orchestrierung (XP, Onboarding, Hatch-Send) liegt beim Dep-Aufrufer in main.ts, nicht hier.
- `registerHandlers`: `ipcMain.handle(SETTINGS_RESET_PROGRESS_CHANNEL, (event) => handlers.resetProgress(event));` + Import der Konstante.
- `openSettingsWindow`: Fensterhöhe `480` → `540` (das neue Danger-zone-Fieldset braucht ~60 px; Fenster ist `resizable: false`, also muss die Höhe mitwachsen). Breite 420 bleibt.

### `src/main/mrr/settings-preload.ts`
- Hand-gesynctes Literal: `const SETTINGS_RESET_PROGRESS_CHANNEL = 'settings:reset-progress'; // must match src/main/ipc-channels.ts`
- Im `contextBridge.exposeInMainWorld('beaverBuddySettings', …)`: `resetProgress: (): Promise<unknown> => ipcRenderer.invoke(SETTINGS_RESET_PROGRESS_CHANNEL),`
- Top-Kommentar („exposes exactly the three settings calls“) auf vier Calls aktualisieren.

### `src/renderer/renderer.ts`
- Ein-Zeilen-Fix in `onHatchStart` (`renderer.ts:183-192`): `evolutionState = null;` direkt nach `hatchState = startHatch();`. Behebt Verifikations-Befund 1: eine zum Reset-Zeitpunkt zufällig laufende Evolution würde den Stage-Direct-Sync des Reset-Pet-Updates verwerfen (`renderer.ts:170` ist mit `!evolutionState` bewacht) und bei Evolution-Ende (`renderer.ts:406-412`) zurück auf teen/adult flippen — ein persistenter Stage-Mismatch bis zum nächsten Pet-Update/Neustart. Mit dem Fix terminiert ein `HATCH_START` jede laufende Evolution sofort; das danach eintreffende Update synct die Stage direkt auf `baby`.

### `src/main/mrr/settings.html`
- Neues Fieldset **unter** „Growth source“, vor `#status`:
  ```html
  <fieldset>
    <legend>Reset</legend>
    <div class="row">
      <button id="resetProgress" type="button">Reset beaver (XP &amp; hatch)</button>
    </div>
  </fieldset>
  ```
  (Kein separates CSS nötig; optional minimaler Inline-Style für Armierungs-Farbe, bestehender Stil reicht.)
- Inline-JS (plain, kein Framework, keine Dependency — `confirm()` wird bewusst NICHT verwendet; das Zwei-Klick-Pattern ist deterministisch und im sandboxed Renderer garantiert verfügbar):
  - Klick 1: Button armiert — Text `Sure? Click again to reset`, `setTimeout` (5 s) disarmiert (Text zurück, Flag false).
  - Klick 2 (armiert): disarm + `const result = await api.resetProgress(); setStatus(result && result.ok ? 'progress reset — hatch replaying' : \`error: ${result && result.error}\`);`
  - Kein `refresh()` nach Reset nötig (Settings-Werte ändern sich nicht).
- **Rebuild nicht vergessen (Verifikations-Befund 3):** `settings.html` gelangt ausschließlich über `npm run build` (`scripts/build-assets.js`) nach `dist/main/mrr/settings.html`; `settings-window.ts` lädt nur die dist-Kopie. Vitest deckt dist nicht ab — ein veralteter dist-Stand fällt in Tests nicht auf. Nach der HTML-Änderung also zwingend `npm run build` ausführen (vor Sichtcheck/Smoke).

### `src/main/xp/engine.ts`
- Neue Methode `async resetProgress(): Promise<void>`:
  - Setzt `this.state = { ...this.state, xp: 0, lastMrrAwardDate: null }` (Cursor `lastSeenLifetimeTokens` bleibt!), `await saveState(this.stateDir, this.state)`.
  - Emittiert **ohne** `applyState` (dort würde bei Stage-Rückschritt `evolvingTo` gesetzt): `const update: PetUpdate = { level: 1, stage: 'baby' };` (bzw. aus `getState()` abgeleitet), `this.lastUpdate = update`, Listener benachrichtigen.
  - Kommentar: warum kein `evolvingTo` (Reset ist keine Evolution — kein Evolution-Quip, keine Evolution-Sequenz; Renderer synct Stage direkt) und warum der Cursor bleibt (forward-only-Invariante, kein Re-Award der Historie).

### `src/main/main.ts`
- In `openGrowthSettings()` dem `openSettingsWindow({...})`-Call das neue Dep mitgeben:
  ```ts
  onProgressReset: async () => {
    // Persist before send: same exactly-once discipline as the launch hatch
    // path — a kill mid-hatch must not re-hatch on next launch.
    await saveOnboardingState(stateDir, { hatched: true });
    // Hatch before the pet update, same ordering invariant as did-finish-load.
    mainWindow?.webContents.send(HATCH_START_CHANNEL);
    await xpEngine.resetProgress(); // onUpdate wiring does tray.refresh() + PET_CHANGED
  },
  ```
- Keine weiteren Änderungen (Tray-Refresh, PET_CHANGED laufen über `xpEngine.onUpdate`; `HATCH_START_CHANNEL`/`saveOnboardingState` sind bereits importiert).

### Nicht anzufassen
- `src/main/mrr/settings-validate.ts` — Channel hat keinen Payload.
- `src/renderer/*` außer dem oben genannten Ein-Zeilen-Fix in `renderer.ts` (`evolutionState = null;` in `onHatchStart`) — Re-Hatch und Stage-Sync funktionieren zur Laufzeit bereits.
- `scripts/build-assets.js` — kopiert `settings.html` bereits nach `dist/main/mrr/`; Build-Pfad unverändert (aber: `npm run build` nach der HTML-Änderung ausführen, s. oben).
- `package.json` / `package-lock.json` — keine neuen Dependencies.

## 5. Testplan

### `src/main/xp/engine.test.ts` (erweitern, Muster der bestehenden describe-Blöcke)
- `resetProgress` setzt XP/Level/Stage auf 0/1/`baby` und persistiert (`loadState(stateDir)` liefert danach `xp: 0`, `lastMrrAwardDate: null`).
- `resetProgress` **erhält** `lastSeenLifetimeTokens` (vorher via `ingestLifetimeTokens` Cursor auf N setzen; nach Reset weiterhin N; ein erneutes `ingestLifetimeTokens(N)` awarded nichts erneut — der zentrale No-Re-Award-Test).
- `resetProgress` emittiert genau ein Update `{ level: 1, stage: 'baby' }` **ohne** `evolvingTo` (Listener-Spy) und aktualisiert `getLastUpdate()`.

### `src/main/mrr/settings-window.test.ts` (erweitern)
- Bestehenden Unauthorized-Test („rejected on all three handlers“) auf vier Handler erweitern: `resetProgress` gibt `{ ok: false, error: 'unauthorized' }` zurück und ruft das Dep nicht auf.
- Erfolgspfad: autorisiert → Dep wird genau einmal aufgerufen, Rückgabe `{ ok: true }`.
- Fehlerpfad: Dep wirft → `{ ok: false, error: 'reset failed' }`.
- `deps()` im Test um `onProgressReset: vi.fn().mockResolvedValue(undefined)` ergänzen.

### `src/main/ipc-channels.test.ts` (erweitern)
- Drift-Guard-Case: `settings-preload.ts`-Literal `SETTINGS_RESET_PROGRESS_CHANNEL` matcht die Konstante (exakt das Regex-Muster der drei bestehenden Settings-Cases).

### Manuell / Design-Gate
- Vor Sichtcheck/Smoke zwingend `npm run build` ausführen, damit `dist/main/mrr/settings.html` aktuell ist (Verifikations-Befund 3; `npm start` baut implizit, aber der Sichtcheck gegen dist muss der Änderung folgen).
- Einmaliger Sichtcheck des Settings-Fensters (420x540): kein Overflow, Danger-zone sichtbar, Zwei-Klick-Arming lesbar. Settings-Fenster ist eine sichtbare UI-Änderung → Screenshot + kurzer Verdict unter `docs/design-reviews/` (Konvention aus CLAUDE.md).
- Smoke: App starten, XP injizieren (`--inject-xp`), Settings öffnen, Reset auslösen → Hatch spielt, Tray zeigt `Lv 1`, `xp-state.json` hat `xp: 0` mit unverändertem Cursor, `growth-settings.json` und `secrets/` unverändert.

## 6. Risiken / Offenes

- **Fensterhöhe 480 → 540:** geschätzt, nicht vermessen; beim Sichtcheck prüfen, ob 540 reicht bzw. zu viel Leerraum entsteht, ggf. feinjustieren.
- **Reset während laufender Evolution im Renderer (korrigiert gemäß Verifikations-Befund 1):** Der Direct-Sync-Zweig (`renderer.ts:170`) ist mit `!evolutionState` bewacht — trifft das Reset-Pet-Update ein, während eine Evolution (~2 s) aktiv ist, wird der Stage-Sync verworfen und `renderer.ts:406-412` setzt bei Evolution-Ende zurück auf teen/adult: persistenter Stage-Mismatch bis zum nächsten Pet-Update/Neustart (kein „paralleles Weiterlaufen"). **Entscheidung (Orchestrierer):** der Ein-Zeilen-Fix wird umgesetzt — `evolutionState = null;` in `onHatchStart` (s. §4 `src/renderer/renderer.ts`). Reset während laufender *Hatch* ist unkritisch: `hatchState` wird beim neuen `HATCH_START` einfach neu gesetzt.
- **`lastMrrAwardDate = null`:** im MRR-Modus kann der nächste Poll das Tages-MRR dem frischen Biber erneut gutschreiben (gewollt, s. §2). Falls der Owner das nicht will, stattdessen `lastMrrAwardDate` erhalten — einzeilige Änderung an `resetProgress()`.
- **Kein `hatch:done`-Rückkanal:** wie beim Launch-Pfad gilt — Kill während der Re-Hatch → beim nächsten Start keine Hatch. Als akzeptabel übernommen (bestehende Invariante).
- Offen (niedrig): Ob der Reset-Button auch im Tray verlinkt werden soll — im Plan bewusst NICHT enthalten (Scope #46: Settings-Fenster).
