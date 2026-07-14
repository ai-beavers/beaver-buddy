# Security Policy

## Supported versions

Only the `main` branch / latest release is supported. Please make sure you can
reproduce an issue there before reporting.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repo: go to the
[Security tab of `ai-beavers/beaver-buddy`](https://github.com/ai-beavers/beaver-buddy/security)
and choose **"Report a vulnerability"**. Do not open a public issue for security
reports.

We'll acknowledge your report and follow up as we investigate.

## Sensitive surface

Beaver Buddy reads local Claude Code / Codex usage logs (`~/.claude`, `~/.codex`)
read-only to compute XP, and can store Stripe/RevenueCat API keys in the macOS
Keychain. If your report includes reproduction steps, logs, or screenshots, please
redact real prompts, repo paths, usernames, and account identifiers before sharing
them with us.

## Bug bounty

There is no paid bug bounty program. We appreciate responsible disclosure and will
credit reporters in release notes if desired.
