# Wave 2 — Fallschirm-Drop: Runtime (Input-Capture, State-Machine, Glide, Landing)

**Status:** done (2026-07-20) — alle 4 Chunks committed auf BL-17 (HEAD `3fe1e7d`); Carry-overs ganz unten.

## Chunk-Plan (Loop: plan → review → implement → verify → doc)
- [x] C1 — Click-Counter (4-s-Fenster) + `grabbed`-Phase in `roam.ts` + Tests ✅ 2026-07-20 (planner→worker→reviewer: 2 critical Fixes [festes Fenster statt sliding, Reset bei enterGrabbed] + 5 Test-Erweiterungen; 511 Tests grün, tsc/eslint clean)
- [x] C2 — `gliding`-Physik (Wind-Sway) + `landing`-Phase + Tests ✅ 2026-07-20 (planner→worker→pi-Verifikation: 19 neue Tests, 476 grün; Commit `0076d22` auf BL-17. Neue Erkenntnisse im Plan: clampRoamStateToBounds phasenbewusst [Resize während Gleitflug], Rotation-Reset nach Climb)
- [x] C3 — Input-Capture-Layer (Renderer-Pointer + `overlay-adapter.ts`) ✅ 2026-07-20 (1 IPC-Kanal `input:capture-mode`, hover-forward Initial, reine Logik input-capture.ts; pi-Review fixte Spec-Abweichung: gliding/landing = click-through auch bei Hover; 496 grün; Commit auf BL-17)
- [x] C4 — Renderer-Verdrahtung + Integration + Pflichten ✅ 2026-07-20 (Sheet-Intake `assets/sprites/` 768×480/5 Rows via `assets:parachute` + Byte-Match-Reconciliation-Test; beaver-baby aus STAGE_SPECS entfernt; Stage-Gating baby-only; facing/rotation-Reset; interaction-model.md finalisiert; BL-17-Verdict **PASS mit 2 dokumentierten Limitations**; CDP-Screenshots pending manuell; Suite 500 grün)

## Abschluss-Notizen (2026-07-20)
- BL-17: 8 Commits auf upstream/main (`d1ace44`..`3fe1e7d`).
- Carry-over 1: Gallery-Re-Apply nach Merge PR #28–#30 (Eintrag aus Fork-Commit b6c97f1).
- Carry-over 2: Owner-Sign-off struggle left-facing Frames (Verdict: pending).
- Carry-over 3: Live-Screenshots manuell durch Owner (CDP hing in pi-Umgebung).
- Carry-over 4: PR #31 aktualisieren (Push BL-17 + Body: enthält jetzt ALLE Slices inkl. Input-Wiring + Assets).

## Prerequisites
- [ ] WAVE-1 done (Rows `struggle`/`parachute-wind`/`land` im Sheet) — **nur für C4-Integration nötig**; C1–C3 sind asset-unabhängig
- [x] `docs/interaction-model.md` als Spezifikation vorhanden (Draft seit 2026-07-20)

## Tasks
- [ ] **Input-Capture-Layer:** Pointer-Events im Renderer + Orchestrierung von
      `setIgnoreMouseEvents` im Main-Prozess (`src/main/overlay-adapter.ts`):
      Hover-Capture am Biber (Klicks sichtbar machen) → Full-Capture während
      `grabbed` (nichts darunter klickbar) → Rückgabe an Click-through nach
      der Landung
- [ ] **Click-Counter:** 3 Klicks innerhalb eines 4-s-Gesamtfensters (Fenster
      startet mit Klick 1, danach Reset); klickbar in jedem Roam-Zustand;
      Hit-Test auf die Biber-Sprite-Fläche
- [ ] **State-Machine (`src/renderer/roam.ts`, rein + unit-testbar):**
      neue Phasen `grabbed` (folgt Cursor, struggle-Row, Roam pausiert),
      `gliding` (parachute-wind-Row + Wind-Sway-Physik: sinusförmige
      horizontale Drift + leichte Rotation, rng-gestreut, Fallgeschwindigkeit
      getunt), `landing` (land-Row, danach `idle` → normaler Loop)
- [ ] **Release:** Doppelklick während `grabbed` → Übergang in `gliding` an
      der Cursor-Position
- [ ] **Verdrahtung Renderer-Loop:** Sheet-Rows laden/registrieren, Animation
      pro Phase, Bounds-Handling (Landung am unteren Rand)
- [ ] **Tests:** Unit-Tests State-Machine (Übergänge, 4-s-Fenster, Reset,
      Bounds/Landung, rng-deterministisch), Click-Counter-Tests, bestehende
      Suite grün (`./node_modules/.bin/vitest run`, `tsc`, `eslint`)
- [ ] **Design-Gate (#38):** Verdict unter `docs/design-reviews/`
- [ ] **Registrierung:** neue Rows/Assets in `docs/asset-gallery.md`
- [ ] **Doku:** `docs/interaction-model.md` gegen die Implementierung
      verifizieren und finalisieren

## Done when
- Komplette Sequenz „3× klicken (≤4 s) → grabbed (zappelt, Full-Capture) →
  Doppelklick → gliding (Wind-Sway) → landing → Roam-Loop" funktioniert live
  in der Windows-App; Tests grün; Design-Gate + Galerie + Interaktions-Doku
  erledigt.

## Notes
- `roam.ts` bleibt frei von DOM/Canvas-Zugriff (reine Funktionen, injizierte rng).
- `npx` ist geblockt (pi-safety-guard) → lokale Binaries `./node_modules/.bin/…`.

## C4-Zusatz (aus PR-Aufteilung 2026-07-20)
- [ ] **Gallery-Re-Apply:** `docs/asset-gallery.md` existiert noch nicht auf
  upstream/main (kommt mit PR #28–#30). Der vorbereitete Galerie-Eintrag
  („parachute-drop animations", Stand Fork-Commit b6c97f1) muss nach deren
  Merge erneut angewendet werden — zusammen mit dem Sheet-Intake.
