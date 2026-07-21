# Tracking

- **2026-07-22** — Vorhaben: Umstieg Fork → Direktarbeit auf ai-beavers/beaver-buddy:
  letzten Fork-only-Commit (`1c86e57`, animation-authoring) als Branch + PR zu upstream
  bringen, PR #40 abwarten/mergen, Remotes umbenennen (upstream→origin, origin→fork),
  main auf origin/main tracken, Tag `docs/animation-authoring` zu origin pushen,
  Fork archivieren. Kein Rewrite, strikte Reihenfolge (erst PRs mergen, dann Remote-Umbau).
  Status: **teilweise umgesetzt — blockiert auf Review** (Branch `docs/animation-authoring`
  zu ai-beavers gepusht, PR #41 geöffnet, Merge-Recht geklärt: `maintain`, aber Branch
  Protection verlangt Review; Reviews bei Gw3i + jurij angefragt für PR #40 + #41).
  Remote-Umbau/main-Sync/Fork-Archivierung (Schritte 3–5) folgen nach den Merges.

- **2026-07-19** — Vorhaben: Kurze Contributor-Doku `docs/animation-authoring.md`
  zur Animations-Erstellung (ComfyUI + PixiJS, macOS & Windows, inkl. PixiJS-/
  comfy-skills und Comfy-Cloud-MCP-Einrichtung) für menschliche Contributors und
  agentische Coding Agents; Verlinkung aus `docs/README.md` und `README.md`.
  Status: **geplant**
- **2026-07-21** — Vorhaben: Flightplan Re-Onboarding & Zyklus-1-Planung — M2/P3 (Fallschirm)
  pausieren; `.fp-new-projekt/` nach `.flightplan/{Meetings,Reference,Archive}` migrieren;
  ROADMAP um Zyklus-1-Exit-Kriterien (App downloadbar, 100 Downloads, 7 Contributors) erweitern;
  Milestones neu schneiden (neu: M3 Level/XP/Profil, M4 Recording Agent, M5 Animationen-Rest,
  M6 Contribution-Readiness & Release); NOTE.md/STATE/HANDOFF bereinigen.
  Status: **umgesetzt** (2026-07-21: Migration + ROADMAP/MILESTONE×5 + 11 PHASE-Stubs +
  STATE/HANDOFF/NOTE neu; Reviewer-Check bestanden nach Fix der Dependency-Kreuzcheck-Funde)
