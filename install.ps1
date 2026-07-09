<#
  SWTD Studio — trình cài & cập nhật qua terminal (Windows PowerShell)

  CÀI hoặc CẬP NHẬT (chạy lại lệnh này bất cứ lúc nào để lên bản mới nhất):
    irm https://raw.githubusercontent.com/Tieudi-Worker/SWTD-Studio/main/install.ps1 | iex

  Cài im lặng (không hiện cửa sổ trình cài):
    $s = irm https://raw.githubusercontent.com/Tieudi-Worker/SWTD-Studio/main/install.ps1
    & ([scriptblock]::Create($s)) -Silent

  Cài một phiên bản cụ thể:
    & ([scriptblock]::Create((irm .../install.ps1))) -Tag v0.4.1

  Script chỉ tải file cài chính thức từ GitHub Releases của repo rồi chạy nó.
  Không thu thập gì, không cần quyền admin (cài theo người dùng).
#>
[CmdletBinding()]
param(
  [switch]$Silent,     # cài im lặng (NSIS /S)
  [string]$Tag         # tag release cụ thể, ví dụ v0.4.1 (mặc định: bản mới nhất)
)

$ErrorActionPreference = 'Stop'
$Repo = 'Tieudi-Worker/SWTD-Studio'

# GitHub cần TLS 1.2 trên Windows PowerShell 5.x
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$headers = @{ 'User-Agent' = 'swtd-studio-installer'; 'Accept' = 'application/vnd.github+json' }
$api = if ($Tag) {
  "https://api.github.com/repos/$Repo/releases/tags/$Tag"
} else {
  "https://api.github.com/repos/$Repo/releases/latest"
}

Write-Host "SWTD Studio — đang kiểm tra bản phát hành…" -ForegroundColor Cyan
try {
  $rel = Invoke-RestMethod -Uri $api -Headers $headers
} catch {
  throw "Không lấy được thông tin release ($Repo). Repo đã public và đã phát hành ít nhất 1 Release chưa? Chi tiết: $($_.Exception.Message)"
}

# Tìm file cài .exe (NSIS: 'SWTD-Studio-Setup-x.y.z.exe')
$asset = $rel.assets | Where-Object { $_.name -match '(?i)setup.*\.exe$' -or $_.name -match '(?i)\.exe$' } | Select-Object -First 1
if (-not $asset) {
  throw "Release '$($rel.tag_name)' chưa có file cài .exe nào. Hãy phát hành bằng: npm run desktop:dist -- --publish always"
}

$dest = Join-Path $env:TEMP $asset.name
Write-Host "Phiên bản: $($rel.tag_name)" -ForegroundColor Green
Write-Host "Đang tải: $($asset.name) ($([math]::Round($asset.size/1MB,1)) MB)…"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest -Headers $headers -UseBasicParsing

Write-Host "Đang cài đặt…"
$nsisArgs = @()
if ($Silent) { $nsisArgs += '/S' }   # NSIS silent
if ($nsisArgs.Count -gt 0) {
  Start-Process -FilePath $dest -ArgumentList $nsisArgs -Wait
} else {
  Start-Process -FilePath $dest -Wait
}

Write-Host ""
Write-Host "✔ Hoàn tất. Mở 'SWTD Studio' từ Start menu để dùng." -ForegroundColor Green
Write-Host "  Lần sau muốn cập nhật: chạy lại đúng lệnh này (hoặc để app tự cập nhật)." -ForegroundColor DarkGray
