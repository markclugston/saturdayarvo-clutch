# Ensures the standalone Aspire dashboard container is running, then opens it in the default browser.
if (-not (docker ps -q -f 'name=^aspire-dashboard$')) {
    docker rm -f aspire-dashboard *> $null
    docker run -d --name aspire-dashboard `
        -p 18888:18888 -p 4317:18889 `
        -e DASHBOARD__FRONTEND__BROWSERTOKEN=clutch-local-dev `
        mcr.microsoft.com/dotnet/aspire-dashboard:latest | Out-Null
}

# Wait until the dashboard responds so the API can export immediately on launch.
foreach ($i in 1..20) {
    try {
        Invoke-WebRequest -Uri 'http://localhost:18888' -UseBasicParsing -TimeoutSec 2 | Out-Null
        break
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}
