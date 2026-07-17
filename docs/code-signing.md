# Code Signing (Windows)

Beaver Buddy signs its Windows executables (NSIS installer and portable exe)
with Authenticode via electron-builder / signtool. This document covers the
signing infrastructure (flight-plan item 4a); the production certificate
decision is item 4b.

## Why sign at all — and what self-signed does *not* do

Signing proves the binary was produced by our pipeline and was not modified
afterwards. It also lets us verify in CI that every shipped `.exe` is
byte-identical to what was signed.

A **self-signed certificate does not remove SmartScreen warnings.** Windows
SmartScreen builds reputation per publisher identity; a self-signed publisher
has no reputation and no trust chain, so users still see the blue "Windows
protected your PC" prompt. Self-signed certs exist here to exercise and verify
the signing pipeline — not to look trustworthy.

## Configuration reference

`electron-builder.yml` (`win` section):

```yaml
win:
  signtoolOptions:
    signingHashAlgorithms:
      - sha256
    rfc3161TimeStampServer: http://timestamp.digicert.com
```

- `signingHashAlgorithms: [sha256]` — digest algorithm for the signature.
- `rfc3161TimeStampServer` — RFC 3161 timestamp counter-signature, so
  signatures stay valid after the certificate expires.

electron-builder picks the certificate up from environment variables:

| Variable | Meaning |
| --- | --- |
| `WIN_CSC_LINK` | Path to a `.pfx` file, a base64-encoded `.pfx`, or an HTTPS link to one |
| `WIN_CSC_KEY_PASSWORD` | Password of the `.pfx` |

If these variables are unset, electron-builder **skips signing silently** —
local unsigned builds keep working. `forceCodeSigning` is deliberately **not**
set (see Security rules).

## Local development

Unsigned local builds are fine for day-to-day work. To exercise signing
locally, create a dev certificate:

```powershell
.\scripts\new-dev-signing-cert.ps1
# optional: -OutPath .\my-dev.pfx -ValidYears 1
```

The script creates a self-signed code-signing cert in your user store, exports
it as a password-protected PFX (default `.\beaver-buddy-dev.pfx` — matched by
`.gitignore`), and prints the two env vars to set:

```powershell
$env:WIN_CSC_LINK = 'C:\...\beaver-buddy-dev.pfx'
$env:WIN_CSC_KEY_PASSWORD = '<your password>'
npx electron-builder --win --publish never
```

Verify the result:

```powershell
.\scripts\verify-signatures.ps1 -ExpectedSubjectContains 'Beaver Buddy Dev'
```

`verify-signatures.ps1` checks every `release\*.exe` with
`Get-AuthenticodeSignature` and exits non-zero on unsigned or broken
signatures. Self-signed certs report status `UnknownError` (untrusted root) —
expected, treated as pass with a warning.

## CI behavior

The Windows leg of `.github/workflows/ci.yml` signs every build:

1. **Determine signing mode** — if the `WIN_CSC_LINK` and
   `WIN_CSC_KEY_PASSWORD` secrets are present, mode is `real` and they are
   forwarded to later steps. Secrets are unavailable on fork PRs and on repos
   without them configured, so those runs fall back to `selfsigned`. This is
   fork-PR-safe: nothing secret is read or required.
2. **Create throwaway self-signed certificate** (selfsigned mode only) — a
   random-password, 2-day-valid cert is generated on the runner, exported to
   the runner temp dir, and removed from the cert store. It exists only to
   prove the signing path works end-to-end.
3. **Package Windows** — `npx electron-builder --win --publish never` signs
   with whatever `WIN_CSC_LINK` points to.
4. **Verify signatures** — `scripts/verify-signatures.ps1` runs before the
   artifact upload, so a silently unsigned build fails the job instead of
   shipping. In selfsigned mode it also asserts the signer subject.

## Road to 4b: production certificate

Options for a publicly trusted certificate:

- **Azure Trusted Signing** — cloud HSM, short-lived certs, no token hardware,
  ~$10/month, integrates with electron-builder via the TrustedSigning module.
  Currently the cheapest practical path for indie OSS.
- **OV certificate** — org-validated, classic USB-token/cloud-HSM purchase,
  builds SmartScreen reputation slowly.
- **EV certificate** — instant SmartScreen reputation, but expensive and
  hardware-token-bound.

Until 4b lands, all builds are self-signed and SmartScreen warnings are
expected and documented.

## Security rules

- **Never commit certificates or private keys.** `*.pfx` / `*.p12` are
  gitignored; CI certs live in GitHub Actions secrets only.
- **Never set `forceCodeSigning: true`** in `electron-builder.yml`. A missing
  cert must downgrade to an unsigned build (or the CI self-signed fallback),
  never break local developer builds.
- **Throwaway CI certs are ephemeral**: random password, 2-day validity,
  runner temp dir, removed from the store after export.
- The timestamp server URL is plain HTTP (standard for RFC 3161 — the
  timestamp is itself signed, so transport tampering is detectable).
