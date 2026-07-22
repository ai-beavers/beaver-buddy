# Code-Verifikation #46 — Reset-Button (finale Prüfung)

**Urteil: FREIGABE**

Geprüft wurden ausschließlich die #46-Hunks in: `ipc-channels.ts`, `settings-window.ts`, `settings-preload.ts`, `settings.html`, `xp/engine.ts`, `main.ts`, `renderer/renderer.ts` + die drei Testdateien. Ältere Runde-1-Änderungen (secrets.ts, overlay-adapter.ts, package.json Scripts etc.) wurden als solche erkannt und nicht bewertet.

## Befunde

Keine Blocker. Zwei Minor-Beobachtungen, beide bewusst so geplant bzw. folgenlos:

- [minor] `src/main/main.ts:263-274` — Fehlerfenster im Reset-Flow: `saveOnboardingState` und der `HATCH_START`-Send laufen vor `xpEngine.resetProgress()`. Scheitert nur der letzte Schritt (z. B. `saveState`-IO-Fehler), wurde die Hatch bereits abgespielt, XP bleibt aber hoch. Folge: kosmetischer Mismatch, heilt sich beim nächsten Pet-Update von selbst; der Handler meldet korrekt `{ ok: false, error: 'reset failed' }`. Die Reihenfolge ist durch die Exactly-once-Disziplin (persist-before-send, wie Launch-Pfad `main.ts:197-203`) erzwungen — kein Fix sinnvoll möglich.
- [minor] `src/main/mrr/settings.html:166-178` — Der Reset-Button wird während des laufenden `api.resetProgress()`-Invokes nicht deaktiviert; ein dritter Klick kann ein zweites, paralleles Reset auslösen. Folgenlos, weil der Reset idempotent ist (XP bereits 0, Hatch spielt erneut ab).

## Verifizierte Punkte

1. **Reset-Flow-Reihenfolge** (`main.ts:263-274`): Onboarding persistieren → `HATCH_START` → `resetProgress()` — identisch zur Launch-Disziplin (`main.ts:197-203` persist-before-send, `main.ts:348-350` hatch-vor-pet-update). Kommentare im Code benennen die Invarianten korrekt.
2. **Kein Token-Re-Award** (`xp/engine.ts:127-134`): `lastSeenLifetimeTokens` bleibt unangetastet; der forward-only-Cursor verhindert Re-Award der Historie. `lastMrrAwardDate → null` ist laut Plan beabsichtigt (frischer Biber darf Tages-MRR erneut erhalten — kein Double-Award desselben Tiers).
3. **Kein Evolution-Quip bei Rückschritt**: `resetProgress()` umgeht bewusst `applyState` (das `evolvingTo` symmetrisch setzen würde, `engine.ts:145`) und emittiert `{ level: 1, stage: 'baby' }` ohne `evolvingTo`; der Quip feuert nur bei `update.evolvingTo` (`main.ts:309-310`).
4. **IPC-Sicherheit**: `resetProgress`-Handler hat denselben Sender-Frame-Check (`isAuthorized` → `isFromSettingsWindow`, `settings-window.ts:29-31,129`). Preload exposiert genau vier benannte Calls, kein generisches `invoke` (`settings-preload.ts:24-29`). Drift-Guard-Test für das hand-gesyncte Literal vorhanden und Regex passt (`ipc-channels.test.ts:61-65`). Handler-Registrierung über den bestehenden `handlersRegistered`-Guard, kein Doppel-`ipcMain.handle`.
5. **Renderer-Fix** (`renderer/renderer.ts:183-196`): `evolutionState = null` steht direkt nach `startHatch()` in `onHatchStart` — das Reset-Pet-Update trifft danach den Direct-Sync-Zweig (`renderer.ts:170-174`) und synct auf `baby`. Kein Seiteneffekt auf den Erst-Hatch: dort ist `evolutionState` ohnehin `null` (HATCH_START kommt vor jedem Pet-Update). Evolution ist frame-getrieben, kein dangling Timer beim Abbrechen.
6. **settings.html Zwei-Klick-Arming**: Logik korrekt — Klick 1 armiert + 5-s-Timeout disarmiert, Klick 2 disarmiert (inkl. `clearTimeout`) und invoked; Erfolg/Fehler wird in `#status` angezeigt. `setStatus` nutzt `textContent` (`settings.html:94-96`) — kein HTML-Injection-Pfad, alle Strings eigene Literale bzw. `result.error` als Text. Fensterhöhe 480→540 für das nicht-resizable Fenster gesetzt (`settings-window.ts:161`).
7. **Tests asserten Verhalten**: Engine-Tests prüfen State, persistierte Datei via `loadState`, No-Re-Award über Cursor-Replay und exaktes Update-Payload ohne `evolvingTo` (`engine.test.ts:239-279`). Settings-Window-Tests prüfen Unauthorized-Ablehnung inkl. „Dep nicht aufgerufen“, Erfolgspfad (Dep genau 1×) und Fehler-Mapping (`settings-window.test.ts:138-154`). Keine reinen Mock-Call-Tests.
8. **Scope/Constraints**: `package.json`-Diff enthält nur Runde-1-Asset-Scripts, `package-lock.json` unverändert, keine neuen Dependencies. Keine unrelated Edits in den #46-Dateien gefunden. `dist/main/mrr/settings.html` enthält `resetProgress` (3 Treffer) — Rebuild wurde ausgeführt.
9. **Statische Checks**: `npm run typecheck` sauber (alle drei tsconfigs), `npx eslint` auf allen #46-Dateien ohne Befund.

## Vitest-Ergebnis

`npx vitest run` (selbst ausgeführt): **Test Files 42 passed (42), Tests 389 passed | 6 skipped (395)** — exakt die Erwartung. Die 6 Skipped sind die bekannten `ingest-images.test.ts`-Skips, keine #46-Tests.
