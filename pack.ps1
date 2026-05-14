# pack.ps1 - produce a shareable openclaw-hma-vX.Y.Z.zip
# Run from PowerShell at the openclaw-hma root.

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

# Read version from runtime/package.json (or default)
$version = '0.1.1'
$pkgPath = Join-Path $root 'runtime\package.json'
if (Test-Path $pkgPath) {
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
  if ($pkg.version) { $version = $pkg.version }
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmm'
$zipName = "openclaw-hma-v$version-$timestamp.zip"
$zipPath = Join-Path (Split-Path $root -Parent) $zipName

Write-Host ""
Write-Host "=== openclaw-hma pack ===" -ForegroundColor Cyan
Write-Host "Version: $version"
Write-Host "Output:  $zipPath"
Write-Host ""

# Safety: refuse to ship if .env exists with a real key
$envPath = Join-Path $root 'runtime\.env'
if (Test-Path $envPath) {
  $envContent = Get-Content $envPath -Raw
  if ($envContent -match 'KIE_KEY=sk-(?!replace-me)\S{6,}') {
    Write-Host "ABORT: runtime\.env contains a real KIE_KEY. Remove it or revert to .env.example before packing." -ForegroundColor Red
    Write-Host "  (Pattern matched: KIE_KEY=sk-... longer than 6 chars and not 'sk-replace-me')"
    exit 2
  }
}
$legacyEnvPath = Join-Path $root 'runtime\legacy\config\api-keys.env'
if (Test-Path $legacyEnvPath) {
  Write-Host "ABORT: runtime\legacy\config\api-keys.env exists. This file is gitignored and must not ship." -ForegroundColor Red
  Write-Host "  Delete it manually after backing up the key elsewhere, then re-run pack.ps1."
  exit 2
}

# Build a temp staging dir with only what should ship
$staging = Join-Path $env:TEMP "openclaw-hma-pack-$timestamp"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging | Out-Null
$dest = Join-Path $staging 'openclaw-hma'
New-Item -ItemType Directory -Path $dest | Out-Null

Write-Host "Staging at $staging" -ForegroundColor Yellow

# robocopy with excludes - this is the cleanest way on Windows
$exclDirs = @(
  'node_modules',
  'data',
  'output',
  '.git',
  '_logs',
  '.claude',
  'tests'
)
$exclFiles = @(
  '*.log',
  '*.tmp',
  '.env',
  'api-keys.env',
  'openclaw-hma-v*.zip'
)

$rcArgs = @($root, $dest, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP')
$rcArgs += '/XD'; $rcArgs += $exclDirs
$rcArgs += '/XF'; $rcArgs += $exclFiles

& robocopy @rcArgs | Out-Null
# robocopy exit codes: 0-7 = success/info, 8+ = error
if ($LASTEXITCODE -ge 8) {
  Write-Host "robocopy failed with exit code $LASTEXITCODE" -ForegroundColor Red
  exit $LASTEXITCODE
}

# Show staging size
$staged = (Get-ChildItem $dest -Recurse -File | Measure-Object -Property Length -Sum).Sum
$stagedMb = [math]::Round($staged / 1MB, 2)
Write-Host "Staged $stagedMb MB" -ForegroundColor Yellow

# Final secret scan
Write-Host ""
Write-Host "Scanning staged content for leaked secrets..." -ForegroundColor Yellow
$leaks = Get-ChildItem $dest -Recurse -File -Include *.json,*.env,*.md,*.js,*.mjs,*.ps1 |
  Select-String -Pattern 'KIE_KEY=sk-(?!replace-me)\S{10,}' -List
if ($leaks) {
  Write-Host "ABORT: secret-like KIE_KEY patterns found:" -ForegroundColor Red
  $leaks | ForEach-Object { Write-Host "  $($_.Path) : $($_.LineNumber)" }
  Remove-Item $staging -Recurse -Force
  exit 3
}
Write-Host "  No secrets detected" -ForegroundColor Green

# Compress
Write-Host ""
Write-Host "Creating $zipName..." -ForegroundColor Yellow
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $dest -DestinationPath $zipPath -CompressionLevel Optimal

# Cleanup
Remove-Item $staging -Recurse -Force

$zipSize = (Get-Item $zipPath).Length
$zipMb = [math]::Round($zipSize / 1MB, 2)

Write-Host ""
Write-Host "=== Pack complete ===" -ForegroundColor Green
Write-Host "  $zipPath"
Write-Host "  Size: $zipMb MB"
Write-Host ""
Write-Host "To install on another machine:" -ForegroundColor Cyan
Write-Host "  1. Extract zip anywhere (e.g. D:\openclaw-hma\)"
Write-Host "  2. Run: .\setup.ps1"
Write-Host "  3. Edit runtime\.env, set KIE_KEY=sk-..."
Write-Host "  4. mklink /D `"%USERPROFILE%\.openclaw\workspace\openclaw-hma`" `"<extract-path>\openclaw-hma`""
Write-Host ""
