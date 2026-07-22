# Wave 3 — Fallschirm-Drop: Polish (Owner-Feedback 2026-07-20)

**Status:** not-started · Anlass: Owner-Sichtung der Assets/Integration; 4 Anpassungspunkte

## Chunks (Loop wie gehabt: plan → worker → pi-Verifikation)
- [ ] P1 — **Weiß-Artefakte im Fallschirm entfernen (Assets):** → **CLAUDE CODE**
      (Owner-Beschluss 2026-07-20: Asset-Bearbeitung/-Generierung grundsätzlich
      durch Claude Code, wegen Comfy-Cloud-MCP + Tooling). Zwei Wege, Claude
      Code entscheidet nach Machbarkeit:
      (a) **Mechanisch (bevorzugt, keine Credits):** Near-White-Pass in
      `scripts/gen-sprites/ingest-animation-frames.mjs` — Connected-Components
      auf opake Near-White-Pixel (min(r,g,b) ≥ ~240, kalibrieren), NUR Regionen
      ≥ Größen-Guard (z. B. 0,05 % der Rohframe-Fläche) entfernen, damit
      Augen-Highlights/Bauch-Spritzer überleben; danach re-bake + re-intake +
      Tests (kein opakes Near-White ≥ Guard; Bauch/Augen-Samples bleiben opak;
      Determinismus/Byte-Match neu vergolden).
      (b) **Regeneration:** parachute-wind-Frames per ComfyUI-Workflow neu
      generieren (BiRefNet-Alpha entfernt eingeschlossenes Weiß an der Quelle;
      Style-Anchoring + Seeds dokumentieren).
      Ziel: nur Seile + rote Kanzel sichtbar, kein Weiß-Artefakt mehr.
      Diagnose (bestätigt): Panel-Weiß ist eingeschlossen, Flood-Fill von den
      Rändern erreicht es nicht.
- [ ] P2 — **Biber beim Runterschweben größer (Runtime):** Skalierfaktor
      während `gliding` (und ggf. `landing`), Vorschlag `GLIDE_SCALE = 1.5`
      (PET_SCALE=1; drawFrame unterstützt scale bereits; Pixel-Art-Smoothing
      prüfen: imageSmoothingEnabled=false → nearest-neighbor). Dirty-Rect/Pad
      muss den größeren Footprint abdecken!
- [ ] P3 — **Mehr Variation in der struggle-Animation:** ✅ Entscheid (c):
      (a) **Claude Code** generiert 1–2 zusätzliche struggle-Strips via
      Comfy-Cloud-MCP (Style-Anchoring! Seeds dokumentieren) + intake als
      weitere Rows (`struggle-b`, `struggle-c`) — Auftrag in HANDOFF.md;
      (b) **pi** baut den Runtime-Player: während `grabbed` läuft eine
      rng-gesteuerte Sequenz aus 2–3 struggle-Rows (Zufallsreihenfolge,
      saubere Übergänge am Loop-Ende, Seed-deterministisch testbar)
- [ ] P4 — **Stärkere Wind-Varianz (Runtime, roam.ts):** zusätzlich zum Sway
      ein persistenter horizontaler Wind-Drift: `glideDriftV` (px/s, rng aus
      [-MAX, +MAX], neue Konstante `GLIDE_WIND_DRIFT_MAX_PX_S` ~25–40) schiebt
      `glideBaseX` während des Flugs; optional Gust-Events (Drift wird
      mid-flight neu gewürfelt, `GLIDE_GUST_INTERVAL_S`). Bounds-Clamping
      bleibt hart. Tests: Drift-Richtung/-Betrag, Seed-Determinismus, Bounds.

## Offene Entscheidungen (Owner) — ENTSCHIEDEN 2026-07-20
1. **P2 Skalierfaktor:** ✅ **1,5×** (GLIDE_SCALE = 1.5)
2. **P3 Ansatz:** ✅ **(c) beides kombiniert** — 1–2 zusätzliche struggle-Strips
   (neue Rows, z. B. `struggle-b`, `struggle-c`) per ComfyUI + Runtime-Player,
   der während `grabbed` zufällig 2–3 der struggle-Animationen nacheinander
   abspielt (rng-gesteuerte Sequenz, Variablen in roam.ts/renderer)
3. **Asset-Erzeugung UND -Bearbeitung prinzipiell via Claude Code**
   (Comfy-Cloud-MCP; Owner-Vermerk 2026-07-20, zweiter Vermerk gleicher Tag:
   „das mit dem Bearbeiten muss Claude Code machen“). Das schließt P1 ein —
   Claude Code wählt dort zwischen mechanischem Pipeline-Fix (a) und
   Regeneration (b), je nachdem, was mit Workflow-Dateien/PixiJS-Tools
   praktikabel ist. pi übernimmt weiterhin die Runtime-Chunks (P2, P3b, P4).

## Tracked Open Task (über diese Wave hinaus)
- **Flug-Animationen pro Biber-Stadium:** Wenn der Biber wächst (teen/adult,
  spätere Stages), müssen struggle/parachute-wind/land je Stadium neu erzeugt
  + intake werden. Aktuell ist die Interaktion bewusst baby-only (C4-Gating).
  → betrifft ROADMAP M2 Phase 5+ (jede Animations-Phase) und Phase 15
  (Adult-Art); bei jeder künftigen Stage-Art-Phase mit einsammeln.
