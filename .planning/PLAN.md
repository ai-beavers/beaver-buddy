# Plan — Umstieg Fork → Direktarbeit auf ai-beavers/beaver-buddy

> **Status 2026-07-22 (nach Ausführung Teil 1):**
> - ✅ Schritt 1: Branch `docs/animation-authoring` auf ai-beavers gepusht, **PR #41** offen
> - ✅ Schritt 2.0: Berechtigung geklärt — rodgi040 + jurij haben **`maintain`**;
>   Branch Protection erzwingt Review (REVIEW_REQUIRED), Auto-Merge ist repo-weit
>   deaktiviert, `--admin`-Bypass nicht möglich. Vlady = GitHub-Login **`Gw3i`**.
> - ✅ Reviews angefragt: PR #40 + PR #41 → Reviewer **Gw3i** + **jurij**
> - ⏸ **Blockiert:** Schritte 2 (Merge) bis 5 warten auf Approval von Gw3i/jurij.
>   Nach Approval kann rodgi040 (maintain) selbst mergen: erst #40, dann #41,
>   danach Schritte 3–6 ausführen.

> Ziel: Künftig Branches direkt auf `ai-beavers/beaver-buddy` (upstream) von `main`
> erstellen und PRs dort öffnen — der Fork `rodgi040/beaver-buddy` wird nicht mehr
> bearbeitet. Der Fork wird **nicht gelöscht/geschossen**, nur entkoppelt.

## Ausgangslage (geprüft 2026-07-22)

- **Push-Zugang zu upstream ist vorhanden:** `rodgi040` hat den Branch
  `chore/zyklus1-planning` direkt auf `ai-beavers/beaver-buddy` gepusht (PR #40).
- **Lokaler `main` = `upstream/main` + 18 Commits**, davon:
  - 17 Commits stecken in **PR #40** (`chore/zyklus1-planning` @ `436ad67`,
    CI grün, Status REVIEW_REQUIRED) — bereits auf upstream.
  - **1 Commit (`1c86e57`, Merge „animation-authoring-docs") existiert nur auf dem Fork.**
- Tag `docs/animation-authoring` → `1c86e57`, nur auf dem Fork gepusht.
- `CONTRIBUTING.md` dokumentiert bereits den Upstream-Workflow
  (clone ai-beavers, branch from main, PR) — **keine Doku-Änderung nötig**.
- Offene upstream-PRs: #40 (Review), #38/#39 (Dependabot).

## Schritt 1 — Verbleibenden Commit zu upstream bringen

- Branch `docs/animation-authoring` von `1c86e57` pushen:
  `git push upstream 1c86e57:refs/heads/docs/animation-authoring`
- PR gegen `ai-beavers/main` öffnen (`gh pr create --repo ai-beavers/beaver-buddy`).
- *Verworfene Alternative:* Commit in PR #40 aufnehmen — PR ist in Review,
  soll nicht nachträglich aufgebläht werden.

## Schritt 2 — Offene PRs abschließen (Reihenfolge)

0. **Merge-Berechtigung vorab klären (unsicher — früher durfte evtl. nur der Admin mergen):**
   - `gh api repos/ai-beavers/beaver-buddy/collaborators/rodgi040/permission --jq .permission`
     → `admin`/`maintain`/`write`?
   - Zusätzlich kann **Branch Protection** auf `main` unabhängig von der Rolle
     Reviews erzwingen (PR #40 zeigt bereits REVIEW_REQUIRED).
   - **Fallback:** Wenn Rodgi nicht mergen darf, geht Schritt 1 (Branch pushen +
     PR öffnen) trotzdem — das Mergen übernimmt dann der Admin (letzter
     upstream/main-Commit stammt von Vlady → er ist der wahrscheinliche
     Ansprechpartner). Remote-Umbau (Schritt 3/4) erst NACH dem Admin-Merge.
1. PR #40 mergen, sobald Review durch (selbst oder durch Admin, siehe 0).
2. PR aus Schritt 1 mergen (selbst oder durch Admin).
3. Optional: Dependabot-PRs #38/#39 gleich mitnehmen (gleiche Berechtigungsfrage).

## Schritt 3 — Remotes umbauen (Fork entkoppeln)

```bash
git remote rename origin fork        # Fork bleibt als Backup-Remote erhalten
git remote rename upstream origin    # ai-beavers wird der Haupt-Remote
git fetch origin
git branch -u origin/main main       # main trackt künftig ai-beavers/main
```

## Schritt 4 — Lokalen main synchronisieren

- `git merge --ff-only origin/main` — funktioniert, weil nach Schritt 2 alle
  lokalen Commits in `origin/main` enthalten sind (kein Rewrite nötig).
- Tag `docs/animation-authoring` zu origin pushen (`git push origin docs/animation-authoring`),
  damit er im Haupt-Repo erhalten bleibt.

## Schritt 5 — Fork stilllegen

- Auf GitHub: `rodgi040/beaver-buddy` → Settings → **Archive this repository**
  (read-only, nichts geht verloren, alte PR-Links bleiben gültig).
- *Alternativ:* Fork unangetastet lassen, nur nicht mehr pushen. Löschen ist
  möglich (alle fork-basierten PRs sind gemerged), aber nicht empfohlen.

## Schritt 6 — Verifizieren

- `git remote -v` → origin = ai-beavers, fork = rodgi040
- `git status -sb` → `## main...origin/main`, sauber
- Neuer Standard-Workflow:
  `git checkout -b bl-item/<slug>/BL-<i>` von `origin/main` →
  `git push -u origin <branch>` → `gh pr create` (landet automatisch auf ai-beavers)

## Offene Entscheidungen (Rodgi)

- **PR #40:** selbst mergen (falls Rechte) oder auf Review warten?
- **Merge-Recht allgemein:** unklar, ob nur der Admin mergen darf (früher wohl so).
  Vorab per API prüfen + ggf. Admin (vermutlich Vlady) einspannen — siehe Schritt 2.0.
- **Dependabot #38/#39:** jetzt mitmergen oder liegen lassen?
- **Fork:** archivieren (Empfehlung) oder einfach liegen lassen?

## Risiken

- Kein Force-Push, kein History-Rewrite nötig — alle Schritte sind additiv.
- **Berechtigungsrisiko:** Falls Rodgi keine Merge-Berechtigung hat, hängt der
  Umstieg am Admin-Review von PR #40 (+ dem neuen Docs-PR). Schritt 1 ist davon
  nicht blockiert; Schritte 3–5 erst nach erfolgtem Admin-Merge ausführen.
- Einzige Fehlerquelle: Schritt 3/4 vor dem Merge der PRs ausführen →
  `main` wäre dann ahead von `origin/main`. Daher strikte Reihenfolge einhalten.
