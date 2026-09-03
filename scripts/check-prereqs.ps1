# Verifie les prerequis de la stack QA sur Windows.
# Lancer dans PowerShell :  .\scripts\check-prereqs.ps1

Write-Host "`n=== Verification des prerequis ===`n" -ForegroundColor Cyan

function Test-Tool($name, $cmd, $versionArgs, $installHint) {
    $exe = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($exe) {
        try   { $v = (& $cmd @versionArgs 2>&1 | Select-Object -First 1) }
        catch { $v = "(version indisponible)" }
        Write-Host ("[OK]     {0,-16} {1}" -f $name, $v) -ForegroundColor Green
        return $true
    }
    Write-Host ("[MANQUE] {0,-16} -> {1}" -f $name, $installHint) -ForegroundColor Yellow
    return $false
}

$ok = $true
$ok = (Test-Tool "Docker"  "docker"  @("--version") "https://www.docker.com/products/docker-desktop/") -and $ok
$ok = (Test-Tool "Node.js" "node"    @("--version") "https://nodejs.org (LTS 20 ou 22)") -and $ok
$ok = (Test-Tool "npm"     "npm"     @("--version") "installe avec Node.js") -and $ok
$ok = (Test-Tool "Java"    "java"    @("-version")  "requis par Allure : winget install Microsoft.OpenJDK.21") -and $ok

Write-Host ""

# Docker doit aussi tourner, pas seulement etre installe
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK]     Docker Desktop est demarre" -ForegroundColor Green
    } else {
        Write-Host "[ATTENTION] Docker est installe mais ne tourne pas : lance Docker Desktop." -ForegroundColor Yellow
        $ok = $false
    }
}

# Ports utilises par Kiwi TCMS
foreach ($p in 8080, 8443) {
    $busy = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($busy) {
        Write-Host "[ATTENTION] Le port $p est deja utilise (PID $($busy[0].OwningProcess)) — change-le dans kiwi/docker-compose.yml" -ForegroundColor Yellow
    } else {
        Write-Host "[OK]     Port $p libre" -ForegroundColor Green
    }
}

Write-Host ""
if ($ok) { Write-Host "Tout est pret. Etape suivante : voir README.md`n" -ForegroundColor Cyan }
else     { Write-Host "Installe les elements marques [MANQUE], puis relance ce script.`n" -ForegroundColor Cyan }
