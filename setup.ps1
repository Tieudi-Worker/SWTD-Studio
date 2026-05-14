# setup.ps1 - one-shot install for openclaw-hma
# Run from PowerShell at the openclaw-hma root.

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

Write-Host ""
Write-Host "=== openclaw-hma setup ===" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host ""

# 1. Verify Node
$nodeVersion = & node --version 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Node.js not found in PATH. Install Node 18+ from https://nodejs.org/" -ForegroundColor Red
  exit 1
}
Write-Host "Node: $nodeVersion"
$major = [int]($nodeVersion -replace '^v(\d+).*', '$1')
if ($major -lt 18) {
  Write-Host "ERROR: Node $nodeVersion is too old. Need >= 18." -ForegroundColor Red
  exit 1
}

# 2. Install legacy deps (sharp, pino, dotenv)
$legacyDir = Join-Path $root 'runtime\legacy'
if (-not (Test-Path $legacyDir)) {
  Write-Host "ERROR: runtime\legacy not found. Bundle corrupted." -ForegroundColor Red
  exit 1
}
Write-Host ""
Write-Host "[1/3] Installing runtime\legacy deps (sharp, pino, dotenv)..." -ForegroundColor Yellow
Push-Location $legacyDir
try {
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install failed in runtime\legacy" }
} finally {
  Pop-Location
}

# 3. Install bridge runtime deps (dotenv only)
$runtimeDir = Join-Path $root 'runtime'
Write-Host ""
Write-Host "[2/3] Installing runtime deps (dotenv)..." -ForegroundColor Yellow
Push-Location $runtimeDir
try {
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install failed in runtime" }
} finally {
  Pop-Location
}

# 4. Create .env from example if missing
$envPath = Join-Path $runtimeDir '.env'
$envExample = Join-Path $runtimeDir '.env.example'
Write-Host ""
Write-Host "[3/3] Configuring runtime\.env..." -ForegroundColor Yellow
if (-not (Test-Path $envPath)) {
  Copy-Item $envExample $envPath
  Write-Host "  Created runtime\.env from .env.example"
} else {
  Write-Host "  runtime\.env already exists - leaving untouched"
}

# 5. Quick lint smoke test
Write-Host ""
Write-Host "Running syntax check on bin/*.mjs..." -ForegroundColor Yellow
Push-Location $runtimeDir
try {
  $files = @('bin/master.mjs','bin/listing.mjs','bin/aplus.mjs','bin/video.mjs','bin/precheck.mjs','bin/single-skill.mjs','lib/legacy-bridge.mjs')
  $allOk = $true
  foreach ($f in $files) {
    & node -c $f
    if ($LASTEXITCODE -eq 0) { Write-Host "  OK $f" -ForegroundColor Green }
    else { Write-Host "  FAIL $f" -ForegroundColor Red; $allOk = $false }
  }
  if (-not $allOk) { throw "Lint failed" }
} finally {
  Pop-Location
}

# Final guidance
Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit runtime\.env, set KIE_KEY=sk-..."
Write-Host ""
Write-Host "  2. Mount into Openclaw (admin cmd):"
Write-Host "     mklink /D `"%USERPROFILE%\.openclaw\workspace\openclaw-hma`" `"$root`""
Write-Host ""
Write-Host "  3. Or copy without admin:"
Write-Host "     xcopy /E /I /Y `"$root`" `"%USERPROFILE%\.openclaw\workspace\openclaw-hma`""
Write-Host ""
Write-Host "  4. In Openclaw: /new then /skills list (expect 13 hma-* skills)"
Write-Host ""
Write-Host "  5. Smoke test: cd runtime && node bin/precheck.mjs ../data/<SKU>"
Write-Host ""
