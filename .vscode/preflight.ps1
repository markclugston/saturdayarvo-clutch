# Runs first on F5. Fails with a clear message instead of a half-started debug session.
$root = Split-Path -Parent $PSScriptRoot
$problems = @()

# Ports the API binds after this runs. Not 5173: the compound starts Vite at the same time as this task,
# and Vite's own --strictPort reports a conflict. 18888/4317 belong to the Aspire container, managed elsewhere.
foreach ($port in 5041, 7180) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        $problems += "Port $port is already in use. Stop the previous debug session (Shift+F5) and try again."
    }
}

$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (-not (Test-Path $node)) {
    $problems += "Node.js not found at $node. Install Node 24 or update runtimeExecutable in .vscode/launch.json."
}

if (-not (Test-Path (Join-Path $root 'src\clutch-web\node_modules\vite\bin\vite.js'))) {
    $problems += "Frontend dependencies are missing. Run 'npm ci' in src\clutch-web."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    $problems += "Docker is not installed or not on PATH. The Aspire dashboard needs it."
}

if ($problems.Count -gt 0) {
    Write-Host "F5 preflight failed:" -ForegroundColor Red
    $problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "F5 preflight passed."
exit 0
