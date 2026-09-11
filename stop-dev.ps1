$ports = 3000, 3001, 8080
foreach ($p in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    try {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop
      Write-Output ("Port {0}: killed PID {1}" -f $p, $c.OwningProcess)
    } catch {
      Write-Output ("Port {0}: could not kill PID {1} - {2}" -f $p, $c.OwningProcess, $_.Exception.Message)
    }
  }
}
Write-Output "done"