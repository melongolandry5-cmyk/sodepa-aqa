# Chaine AQA complete : tests Playwright -> rapport Allure -> publication Squash TM
#
# Exemples :
#   .\scripts\run-qa.ps1                      # tous les projets
#   .\scripts\run-qa.ps1 -Project api         # uniquement les tests API
#   .\scripts\run-qa.ps1 -Project ui-chromium
#   .\scripts\run-qa.ps1 -Grep "@smoke"
#   .\scripts\run-qa.ps1 -NoSquash -OpenReport   # rapport seul, sans publication
#
# Le rapport Allure est un fichier unique (allure-report\index.html), partageable
# tel quel. Le catalogue des cas se pousse a part : npm run squash:sync

param(
    [string]$Project = "",
    [string]$Grep = "",
    [switch]$NoSquash,
    [switch]$OpenReport
)

$ErrorActionPreference = "Continue"

Write-Host "`n[1/3] Execution des tests Playwright..." -ForegroundColor Cyan
$pwArgs = @("playwright", "test")
if ($Project) { $pwArgs += @("--project", $Project) }
if ($Grep)    { $pwArgs += @("--grep", $Grep) }
npx @pwArgs
$testsExit = $LASTEXITCODE
if ($testsExit -ne 0) {
    Write-Host "Des tests ont echoue - on continue : les echecs doivent remonter dans le rapport." -ForegroundColor Yellow
}

Write-Host "`n[2/3] Generation du rapport Allure (fichier unique)..." -ForegroundColor Cyan
$reportArgs = @("scripts/allure-report.mjs")
if ($OpenReport) { $reportArgs += "--open" }
node @reportArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec de la generation Allure." -ForegroundColor Red
}

if (-not $NoSquash) {
    Write-Host "`n[3/3] Publication des resultats dans Squash TM..." -ForegroundColor Cyan
    node scripts/squash-push-results.mjs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Echec de la publication Squash - le rapport Allure reste disponible." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[3/3] Publication Squash ignoree (-NoSquash)." -ForegroundColor DarkGray
}

Write-Host "`nTermine. Code de sortie des tests : $testsExit`n" -ForegroundColor Cyan
exit $testsExit
