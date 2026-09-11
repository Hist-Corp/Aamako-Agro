$ErrorActionPreference = 'Stop'
Write-Output '=== E2E sync verification ==='

# 1. Public content feed + ETag
$r = Invoke-WebRequest -Uri 'http://localhost:3000/api/content' -UseBasicParsing -TimeoutSec 15
$etag = $r.Headers['ETag']
Write-Output ("1. GET /api/content -> {0}, ETag: {1}" -f $r.StatusCode, $etag)
$data = $r.Content | ConvertFrom-Json
Write-Output ("   content items: {0}" -f @($data).Count)
$pt = @($data | Where-Object { $_.key -like 'product-template.*' })
Write-Output ("   product-template items in feed: {0}" -f $pt.Count)

# 2. Conditional request -> 304 path for the storefront poller
try {
  $r2 = Invoke-WebRequest -Uri 'http://localhost:3000/api/content' -Headers @{ 'If-None-Match' = $etag } -UseBasicParsing -TimeoutSec 15
  Write-Output ("2. If-None-Match request -> {0} (304 means poller skips re-hydrate)" -f $r2.StatusCode)
} catch {
  Write-Output ("2. If-None-Match request -> {0} {1}" -f $_.Exception.Response.StatusCode.value__, $_.Exception.Response.StatusCode)
}

# 3. Newsletter subscribe (public)
try {
  $body = '{"email":"e2e-sync-test@example.com","source":"e2e"}'
  $r3 = Invoke-WebRequest -Uri 'http://localhost:3000/api/newsletter/subscribe' -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 15
  Write-Output ("3. POST /newsletter/subscribe -> {0} {1}" -f $r3.StatusCode, $r3.Content)
} catch {
  Write-Output ("3. POST /newsletter/subscribe FAILED: {0}" -f $_.Exception.Message)
}

# 4. CORS preflight for storefront origin
try {
  $r4 = Invoke-WebRequest -Uri 'http://localhost:3000/api/content' -Method Options -Headers @{
    'Origin' = 'http://localhost:8080'
    'Access-Control-Request-Method' = 'GET'
  } -UseBasicParsing -TimeoutSec 15
  $allow = $r4.Headers['Access-Control-Allow-Origin']
  Write-Output ("4. CORS preflight from :8080 -> {0}, Allow-Origin: {1}" -f $r4.StatusCode, $allow)
} catch {
  Write-Output ("4. CORS preflight FAILED: {0}" -f $_.Exception.Message)
}

# 5. Dashboard compile check of the pages editor config is done separately;
#    here verify the storefront page renders product.html data-cms hydration hook
$sf = Invoke-WebRequest -Uri 'http://localhost:8080/product.html' -UseBasicParsing -TimeoutSec 15
$hasCms = $sf.Content -match 'data-cms=' -and $sf.Content -match 'js/content.js'
Write-Output ("5. storefront product.html loads CMS hydration: {0}" -f $hasCms)

Write-Output '=== done ==='