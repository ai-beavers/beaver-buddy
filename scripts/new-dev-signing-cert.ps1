#Requires -Version 5.1
<#
.SYNOPSIS
  Creates a self-signed code-signing certificate for local Beaver Buddy builds.

.DESCRIPTION
  Generates a self-signed code-signing certificate in the current user's
  certificate store and exports it as a password-protected PFX file. Point
  electron-builder at the PFX via WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD to get
  signed local builds.

  A self-signed certificate does NOT remove SmartScreen warnings — it only
  exercises the signing pipeline. See docs/code-signing.md.

.PARAMETER OutPath
  Destination for the exported PFX. Default: .\beaver-buddy-dev.pfx
  (matched by .gitignore, so it can never be committed).

.PARAMETER Subject
  Certificate subject. Default: CN=Beaver Buddy Dev (self-signed)

.PARAMETER ValidYears
  Certificate validity in years. Default: 2

.EXAMPLE
  .\scripts\new-dev-signing-cert.ps1
  .\scripts\new-dev-signing-cert.ps1 -OutPath "$env:TEMP\bb-dev.pfx"
#>
[CmdletBinding()]
param(
  [string]$OutPath = ".\beaver-buddy-dev.pfx",
  [string]$Subject = "CN=Beaver Buddy Dev (self-signed)",
  [int]$ValidYears = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$outFile = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutPath)
if (Test-Path -LiteralPath $outFile) {
  throw "Output file already exists: $outFile (delete it first or choose another -OutPath)"
}

$password = Read-Host -Prompt "PFX export password" -AsSecureString
$confirm = Read-Host -Prompt "Confirm password" -AsSecureString
$pwdPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
$confirmPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirm))
if ($pwdPlain -cne $confirmPlain) { throw "Passwords do not match." }
if ([string]::IsNullOrEmpty($pwdPlain)) { throw "Password must not be empty." }
$confirmPlain = $null

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $Subject `
  -FriendlyName "Beaver Buddy dev signing (self-signed)" `
  -CertStoreLocation Cert:\CurrentUser\My `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears($ValidYears)

Export-PfxCertificate -Cert $cert -FilePath $outFile -Password $password | Out-Null
$pwdPlain = $null

Write-Host ""
Write-Host "Created self-signed code-signing certificate:"
Write-Host "  Subject:    $($cert.Subject)"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  Expires:    $($cert.NotAfter.ToString('yyyy-MM-dd'))"
Write-Host "  PFX:        $outFile"
Write-Host ""
Write-Host "To sign local builds, set these before running electron-builder:"
Write-Host ""
Write-Host "  `$env:WIN_CSC_LINK = '$outFile'"
Write-Host "  `$env:WIN_CSC_KEY_PASSWORD = '<the password you just entered>'"
Write-Host ""
Write-Host "Then verify with: .\scripts\verify-signatures.ps1 -ExpectedSubjectContains 'Beaver Buddy Dev'"
Write-Host ""
Write-Host "Note: self-signed builds still trigger SmartScreen. Never commit the PFX."
