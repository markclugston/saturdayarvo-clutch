# Ensures the standalone Aspire dashboard container is running and responding on http://localhost:18888.
# Exits non-zero on failure so the pre-launch task stops F5 with a clear error.

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Start Docker Desktop, then press F5 again." -ForegroundColor Red
    exit 1
}

if (-not (docker ps -q -f 'name=^aspire-dashboard$')) {
    docker rm -f aspire-dashboard *> $null
    docker run -d --name aspire-dashboard `
        -p 18888:18888 -p 4317:18889 `
        -e DASHBOARD__FRONTEND__BROWSERTOKEN=clutch-local-dev `
        mcr.microsoft.com/dotnet/aspire-dashboard:latest | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start the aspire-dashboard container." -ForegroundColor Red
        exit 1
    }
}

# Wait until the dashboard responds so the API can export immediately on launch.
$ready = $false
foreach ($i in 1..20) {
    try {
        Invoke-WebRequest -Uri 'http://localhost:18888' -UseBasicParsing -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}

if (-not $ready) {
    Write-Host "The Aspire dashboard did not respond on http://localhost:18888." -ForegroundColor Red
    exit 1
}
exit 0
