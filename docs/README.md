# Documentation

Index of the committed project docs. The product source of truth is
[`../PRD.md`](../PRD.md); guardrails for contributors live in
[`../CLAUDE.md`](../CLAUDE.md) and [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

## Architecture decisions (ADRs)

- [`adr/001-reuse.md`](adr/001-reuse.md) — reuse research: renderer approach, asset pipeline
- [`adr/003-pixijs-authoring.md`](adr/003-pixijs-authoring.md) — dev-time PixiJS puppet studio (never shipped)

> ADR 002 (cross-platform scope) was retired on 2026-07-18: its outcome lives in
> the scope notes of `../README.md` / `../CLAUDE.md`; the decision detail was
> moved into the maintainer's local planning (`.flightplan/`, gitignored).

## Design reviews

Visual design gates per build item — screenshots + verdicts:

- [`design-reviews/`](design-reviews/) — per-item verdicts (`BL-*-verdict.md`)
- [`design-reviews/phase-4-windows/`](design-reviews/phase-4-windows/) — the Windows phase-4 gate

## Assets & pipelines

- [`asset-gallery.md`](asset-gallery.md) — catalog of every figure/animation asset (registration required)
- [`comfyui-avatar-generation.md`](comfyui-avatar-generation.md) — ComfyUI parts pipeline into the studio
- [`../assets/STYLE.md`](../assets/STYLE.md) — sprite style guide + provenance (binding)

## Operations

- [`code-signing.md`](code-signing.md) — Windows code-signing infrastructure (dev/CI certs)
