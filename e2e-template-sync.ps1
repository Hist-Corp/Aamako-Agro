$ErrorActionPreference = 'Stop'
Write-Output '=== Product-template instant-sync E2E ==='

# 1. Login as admin
$login = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"email":"admin@aamako.agro","password":"Admin123!","scope":"dashboard"}' -TimeoutSec 15
$token = $login.accessToken
Write-Output ("1. admin login -> OK (role: {0})" -f $login.user.role)

# 2. Read current feed ETag
$before = Invoke-WebRequest -Uri 'http://localhost:3000/api/content' -UseBasicParsing -TimeoutSec 15
Write-Output ("2. ETag before edit: {0}" -f $before.Headers['ETag'])

# 3. Simulate a content-writer edit of a product-template field (upsert path
#    used by the dashboard template editor)
$key = 'product-template.e2e-test.headline'
$body = @{
  title = 'E2E Test Headline - sync check'
  shortDescription = 'Written from the dashboard template editor'
  body = 'Simulated dashboard product-template edit for the E2E sync verification.'
} | ConvertTo-Json
$upsert = Invoke-RestMethod -Uri "http://localhost:3000/api/content/$([uri]::EscapeDataString($key))" -Method Put -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body $body -TimeoutSec 15
Write-Output ("3. PUT {0} -> {1}" -f $key, ($upsert | ConvertTo-Json -Compress))

# 4. Feed now includes the item and the ETag changed
$after = Invoke-WebRequest -Uri 'http://localhost:3000/api/content' -UseBasicParsing -TimeoutSec 15
$data = $after.Content | ConvertFrom-Json
$found = $data | Where-Object { $_.key -eq $key }
$changed = $before.Headers['ETag'] -ne $after.Headers['ETag']
Write-Output ("4. feed contains item: {0}; ETag changed: {1} ({2} -> {3})" -f [bool]$found, $changed, $before.Headers['ETag'], $after.Headers['ETag'])

# 5. Conditional poll sees the change (no 304 since ETag differs)
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/content' -Headers @{ 'If-None-Match' = $before.Headers['ETag'] } -UseBasicParsing -TimeoutSec 15
  Write-Output ("5. poller revalidation with stale ETag -> {0} (200 = change detected, storefront rehydrates)" -f $r.StatusCode)
} catch {
  Write-Output ("5. poller revalidation -> {0}" -f $_.Exception.Response.StatusCode.value__)
}

# 6. Clean up the test item
Invoke-RestMethod -Uri "http://localhost:3000/api/content/$([uri]::EscapeDataString($key))" -Method Delete -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 15 | Out-Null
$clean = Invoke-WebRequest -Uri 'http://localhost:3000/api/content' -UseBasicParsing -TimeoutSec 15
$stillThere = ($clean.Content | ConvertFrom-Json) | Where-Object { $_.key -eq $key }
Write-Output ("6. cleanup DELETE -> item removed: {0}" -f (-not $stillThere))
Write-Output '=== done ==='