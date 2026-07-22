Project-wide debug logs live here. For phase- or wave-bound debugging, use `.flightplan/Debugging/`.

## Logs

- [DEBUG-beaver-growth.md](DEBUG-beaver-growth.md) — **Biber wächst nicht** (2026-07-22, analysiert):
  Root Cause = Wachstumslogik existiert + ist verdrahtet, aber XP-Quellen sind Opt-in
  (`claudeEnabled`/`codexEnabled` default `false`) → ohne Connect kein XP → Dauer-Baby.
  Zusatz: Code (3 Stufen, linear, zählt Cache) ≠ Spec M4/P2 (5 Stufen, quadratisch, Cache raus).
  Fix ausstehend, gehört zu M4/P2.
