$root = 'C:\Users\poude\Desktop\Aamako Agro\Aamako-Agro'
function Start-Detached([string]$workdir, [string]$exe, [string]$args, [string]$log) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $exe
  $psi.Arguments = $args
  $psi.WorkingDirectory = $workdir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  $out = Join-Path $root $log
  Start-Job -ScriptBlock { param($proc, $file) } -ArgumentList $p, $out | Out-Null
  return $p.Id
}

# Dashboard (Next.js on :3001) — detached via cmd so output redirection works
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "cd /d `"$root\Dashboard`" && npm run dev > `"$root\dash-sync.log`" 2>&1" -WindowStyle Hidden | Out-Null
# Storefront (static server on :8080)
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "cd /d `"$root\Frontend`" && node server.js > `"$root\store-sync.log`" 2>&1" -WindowStyle Hidden | Out-Null
Write-Output 'launched dashboard + storefront'