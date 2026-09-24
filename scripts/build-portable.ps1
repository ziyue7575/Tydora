#Requires -Version 5.1
<#
.SYNOPSIS
  构建 Tydora Windows 免安装单 exe（不生成 MSIX / 不上传商店）。

.DESCRIPTION
  1. 读取 VERSION 文件
  2. 运行 `tauri build --no-bundle` 编译出 exe（可 -SkipBuild 复用已有产物）
  3. 把 exe + CLI sidecar 复制到输出目录，保持单文件可执行

  比 build-msix.ps1 快很多，因为跳过 MSIX 打包、manifest 处理和证书签名。

.PARAMETER SkipBuild
  跳过 tauri build，直接用 target/release 下已存在的 exe。

.PARAMETER OutDir
  输出目录，默认 target/portable。

.EXAMPLE
  ./scripts/build-portable.ps1
  ./scripts/build-portable.ps1 -SkipBuild
  ./scripts/build-portable.ps1 -OutDir D:\temp\tydora-portable
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# ── 0. 版本号 ─────────────────────────────────────────────────────────────
$version = (Get-Content "$repoRoot/VERSION" -Raw).Trim()
Write-Host "Version: $version" -ForegroundColor Cyan

# ── 1. 编译 Tauri（仅 exe，不打包任何安装器）───────────────────────────────
if (-not $SkipBuild) {
    Write-Host "`n==> Building Tauri app (--no-bundle) ..." -ForegroundColor Green
    npm run tauri -- build --no-bundle
    if ($LASTEXITCODE -ne 0) { throw "tauri build 失败（exit $LASTEXITCODE）" }
}

# ── 2. 定位 exe ───────────────────────────────────────────────────────────
$releaseDir = "$repoRoot/target/release"
$candidates = @(
    "$releaseDir/Tydora.exe",
    "$releaseDir/tydora-desktop.exe"
)
$appExe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $appExe) {
    Write-Host 'target/release 下现有的可执行文件：' -ForegroundColor Yellow
    Get-ChildItem "$releaseDir" -Filter '*.exe' -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Name
    throw "找不到 app exe。Tried: $($candidates -join ', ')"
}
$exeSizeMB = [math]::Round((Get-Item $appExe).Length / 1MB, 2)
Write-Host "App exe: $appExe ($exeSizeMB MB)"

# ── 3. 准备输出目录 ───────────────────────────────────────────────────────
if (-not $OutDir) { $OutDir = "$repoRoot/target/portable" }
if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# ── 4. 复制主程序 ─────────────────────────────────────────────────────────
$outExe = Join-Path $OutDir 'Tydora.exe'
Copy-Item $appExe $outExe -Force
Write-Host "Copied -> $outExe" -ForegroundColor Green

# ── 5. 复制 CLI sidecar（可选）──────────────────────────────────────────────
$cliSidecar = 'app/tydora-desktop/binaries/tydora-cli-x86_64-pc-windows-msvc.exe'
if (Test-Path $cliSidecar) {
    Copy-Item $cliSidecar (Join-Path $OutDir 'tydora-cli.exe') -Force
    Write-Host "Copied CLI sidecar -> $OutDir\tydora-cli.exe"
}
else {
    Write-Warning "CLI sidecar not found at $cliSidecar; portable build ships without CLI"
}

# ── 6. 完成 ─────────────────────────────────────────────────────────────────
Write-Host "`n✓ 免安装版已生成: $outExe" -ForegroundColor Green
Write-Host "  输出目录: $OutDir" -ForegroundColor DarkGray

# 输出路径供 CI 消费
if ($env:GITHUB_ENV) {
    "PORTABLE_DIR=$OutDir" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding UTF8
}

return $outExe
