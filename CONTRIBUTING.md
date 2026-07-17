# Contributing

See the [Contributing section of README.md](README.md#contributing) for the full
picture. Before opening a PR, read [`CLAUDE.md`](CLAUDE.md) (the enforced guardrails)
and [`PRD.md`](PRD.md) (the product source of truth) — this doc only covers the
mechanics.

## Quick start

Requires Node 24.x and either macOS 14+ or Windows 10/11.

```sh
npm ci && npm run typecheck && npm run lint && npm test
npm start   # run the app
```

## Non-negotiables

- One branch/PR per change: `bl-item/<slug>/BL-<i>`, PR title `[BL-<i>] …`.
- Never commit directly to `main`.
- Conventional commit prefixes: `feat:`, `fix:`, `docs:`, `chore:`.
- The Definition of Done (see `CLAUDE.md`) must pass locally before opening a PR.
- New dependencies must be justified in the PR body and MIT/Apache/BSD licensed.
- Merges use `gh pr merge --merge` — never squash, never rebase.

## Reporting a vulnerability

Do not open a public issue. See [`SECURITY.md`](SECURITY.md).
