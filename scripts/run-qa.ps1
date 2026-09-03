# Chaine complete AQA : tests Playwright -> rapport Allure -> push dans Kiwi TCMS
#
# Exemples :
#   .\scripts\run-qa.ps1                      # tous les projets
#   .\scripts\run-qa.ps1 -Project api         # uniquement les tests API
#   .\scripts\run-qa.ps1 -Project ui-chromium
#   .\scripts\run-qa.ps1 -Grep "@smoke"
#   .\scripts\run-qa.ps1 -NoKiwi -OpenReport  # rapport Allure seul

param(
    [string]$Project = "",
    [string]$Grep = "",
    [switch]$NoKiwi,
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
    Write-Host "Des tests ont echoue — on continue : les echecs doivent remonter dans les rapports." -ForegroundColor Yellow
}

Write-Host "`n[2/3] Generation du rapport Allure..." -ForegroundColor Cyan
npx allure generate allure-results --clean -o allure-report
if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec de la generation Allure (Java 17+ installe ?)." -ForegroundColor Red
}

if (-not $NoKiwi) {
    Write-Host "`n[3/3] Envoi des resultats vers Kiwi TCMS..." -ForegroundColor Cyan
    node scripts/kiwi-report.mjs
} else {
    Write-Host "`n[3/3] Push Kiwi ignore (-NoKiwi)." -ForegroundColor DarkGray
}

if ($OpenReport) { npx allure open allure-report }

Write-Host "`nTermine. Code de sortie des tests : $testsExit`n" -ForegroundColor Cyan
exit $testsExit
