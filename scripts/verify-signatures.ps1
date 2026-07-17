#Requires -Version 5.1
<#
.SYNOPSIS
  Verifies Authenticode signatures on built executables.

.DESCRIPTION
  Runs Get-AuthenticodeSignature on every file matching -Path (default:
  release\*.exe) and prints a result table.

  Exit code 0: every file is signed and usable.
  Exit code 1: at least one file is unsigned or has a broken signature.

  Status handling:
    Valid                     -> pass
    UnknownError              -> pass with warning (typical for self-signed
                                 certificates without root trust)
    NotSigned, HashMismatch,
    Incompatible,
    NotSupportedFileFormat    -> fail

  With -ExpectedSubjectContains, each signer's certificate subject must
  contain the given string, otherwise the file fails.

.PARAMETER Path
  File or glob to check. Default: release\*.exe

.PARAMETER ExpectedSubjectContains
  Optional substring the signer certificate subject must contain.

.EXAMPLE
  .\scripts\verify-signatures.ps1
  .\scripts\verify-signatures.ps1 -ExpectedSubjectContains "Beaver Buddy Dev"
#>
[CmdletBinding()]
param(
  [string]$Path = "release\*.exe",
  [string]$ExpectedSubjectContains = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$failStatuses = @("NotSigned", "HashMismatch", "Incompatible", "NotSupportedFileFormat")

$files = @(Get-ChildItem -Path $Path -File)
if ($files.Count -eq 0) {
  Write-Host "FAIL: no files matched '$Path'"
  exit 1
}

$results = foreach ($file in $files) {
  $sig = Get-AuthenticodeSignature -FilePath $file.FullName
  [pscustomobject]@{
    File       = $file.Name
    Status     = $sig.Status.ToString()
    Subject    = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { "-" }
    Thumbprint = if ($sig.SignerCertificate) { $sig.SignerCertificate.Thumbprint } else { "-" }
    Signature  = $sig
  }
}

$results | Format-Table File, Status, Subject, Thumbprint -AutoSize | Out-String | Write-Host

$failed = $false
foreach ($r in $results) {
  if ($failStatuses -contains $r.Status) {
    Write-Host "FAIL: $($r.File) - signature status '$($r.Status)' ($($r.Signature.StatusMessage))"
    $failed = $true
  }
  elseif ($r.Status -eq "UnknownError") {
    Write-Warning "$($r.File): UnknownError - $($r.Signature.StatusMessage)"
    Write-Warning "(expected for self-signed certificates without root trust; treated as pass)"
  }
  if ($ExpectedSubjectContains -ne "" -and $r.Subject -notlike "*$ExpectedSubjectContains*") {
    Write-Host "FAIL: $($r.File) - signer subject '$($r.Subject)' does not contain '$ExpectedSubjectContains'"
    $failed = $true
  }
}

if ($failed) {
  Write-Host "Signature verification FAILED."
  exit 1
}
Write-Host "Signature verification passed for $($results.Count) file(s)."
exit 0
