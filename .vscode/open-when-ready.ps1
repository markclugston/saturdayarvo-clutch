# Opens the Aspire dashboard only once the API (5041) and the frontend (5173) accept connections,
# so the app shows up before Aspire. Started detached by the pre-launch so F5 does not wait on it.
param([int]$TimeoutSeconds = 180)

# Tries IPv4 then IPv6: Vite on Node 24 binds localhost as IPv6 [::1] only, and a default
# TcpClient is IPv4-only, so each family needs its own client.
function Test-PortOpen([int]$Port) {
    foreach ($address in '127.0.0.1', '::1') {
        $family = if ($address -eq '::1') { [System.Net.Sockets.AddressFamily]::InterNetworkV6 } else { [System.Net.Sockets.AddressFamily]::InterNetwork }
        $client = New-Object System.Net.Sockets.TcpClient($family)
        try {
            $async = $client.BeginConnect($address, $Port, $null, $null)
            if ($async.AsyncWaitHandle.WaitOne(1000)) {
                $client.EndConnect($async)   # Connected is only set after EndConnect
                if ($client.Connected) { return $true }
            }
        }
        catch { }
        finally { $client.Close() }
    }
    return $false
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    if ((Test-PortOpen 5041) -and (Test-PortOpen 5173)) {
        # Give Vite a moment to finish serving before the browser requests it.
        Start-Sleep -Seconds 3
        Start-Process 'http://localhost:18888/login?t=clutch-local-dev'
        exit 0
    }
    Start-Sleep -Milliseconds 500
}

# Timed out: still open Aspire so the dashboard is available for diagnosing the failure.
Start-Process 'http://localhost:18888/login?t=clutch-local-dev'
exit 1
