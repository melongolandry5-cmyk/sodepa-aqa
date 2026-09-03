<#
.SYNOPSIS
    Enregistre un jeton d'API Squash TM dans le fichier .env du depot.

.DESCRIPTION
    Le jeton est saisi en mode masque et ecrit directement dans .env, en UTF-8
    SANS BOM : un BOM casserait la lecture de la premiere cle par les scripts
    Node. Le mot de passe eventuellement present est efface au passage.

        cd "D:\automatisation test\sodepa\sodepa_aqa\plawright api_ui\sodepa-aqa"
        powershell -ExecutionPolicy Bypass -File .\scripts\set-squash-token.ps1
#>

[CmdletBinding()]
param(
    [string] $EnvFile = (Join-Path (Split-Path $PSScriptRoot -Parent) '.env')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) { throw "Fichier introuvable : $EnvFile" }

Write-Host "Colle le jeton genere dans Squash (la saisie reste invisible)." -ForegroundColor Yellow
$sec = Read-Host '  Jeton' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try   { $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

$token = $token.Trim()
if (-not $token) { throw 'Aucun jeton saisi.' }
if ($token -notmatch '^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$') {
    Write-Host "  [ATTN] Ce n'est pas la forme habituelle d'un JWT (trois parties separees par des points)." -ForegroundColor Yellow
    Write-Host "         Verifie que tu as bien copie le jeton entier." -ForegroundColor Yellow
}

$text = [System.IO.File]::ReadAllText($EnvFile)
$eol  = if ($text -match "`r`n") { "`r`n" } else { "`n" }

# Echappe $ pour l'operateur -replace, dont la chaine de remplacement interprete $1, $&, etc.
$safe = $token.Replace('$', '$$')

if ($text -match '(?m)^SQUASH_TOKEN=.*$') {
    $text = $text -replace '(?m)^SQUASH_TOKEN=.*$', "SQUASH_TOKEN=$safe"
} else {
    $text = $text.TrimEnd() + $eol + "SQUASH_TOKEN=$token" + $eol
}
$text = $text -replace '(?m)^SQUASH_PASSWORD=.*$', 'SQUASH_PASSWORD='

[System.IO.File]::WriteAllText($EnvFile, $text, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "  [OK] Jeton enregistre dans $EnvFile" -ForegroundColor Green
Write-Host "       longueur : $($token.Length) caracteres"
Write-Host "       SQUASH_PASSWORD vide : le script utilisera l'en-tete Bearer."
Write-Host ""
Write-Host "  Verification :" -ForegroundColor Cyan
Write-Host "     npm run squash:dry"
