# Fresh-machine check for BongDC. Prints missing tools, MCP configs, and tokens.
# Exits non-zero only when bun install, build, or zip fails.
# Never prints secret values. Does not commit .output/.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$bunUser = Join-Path $env:USERPROFILE ".bun\bin"
if (Test-Path $bunUser) {
  $env:PATH = "$bunUser;$env:PATH"
}

$notes = @()

function Test-Tool([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Add-Tool([string]$Name) {
  if (Test-Tool $Name) {
    $ver = ""
    try { $ver = (& $Name --version 2>$null | Select-Object -First 1) } catch { $ver = "" }
    $script:notes += "ok    $Name $ver"
  } else {
    $script:notes += "MISS  $Name"
  }
}

$notes += "== tools =="
Add-Tool "node"
$hasNpm = Test-Tool "npm"
$hasPnpm = Test-Tool "pnpm"
if ($hasNpm) { Add-Tool "npm" }
if ($hasPnpm) { Add-Tool "pnpm" }
if (-not $hasNpm -and -not $hasPnpm) {
  $notes += "MISS  npm and pnpm (need one of them)"
} elseif (-not $hasNpm) {
  $notes += "MISS  npm (pnpm is present)"
} elseif (-not $hasPnpm) {
  $notes += "MISS  pnpm (npm is present; either one is enough)"
}
Add-Tool "gh"
Add-Tool "npx"
Add-Tool "docker"
Add-Tool "bun"

$notes += "== tokens and MCP =="
if ($env:GITHUB_PERSONAL_ACCESS_TOKEN) {
  $notes += "ok    GITHUB_PERSONAL_ACCESS_TOKEN is set (value hidden)"
} else {
  $notes += "MISS  GITHUB_PERSONAL_ACCESS_TOKEN (scopes: repo, workflow). Ask india 님 for the token only."
}
if ($env:CONTEXT7_API_KEY) {
  $notes += "ok    CONTEXT7_API_KEY is set (optional, value hidden)"
} else {
  $notes += "opt   CONTEXT7_API_KEY unset (Context7 still starts; higher limits need the key)"
}

foreach ($f in @(".cursor/mcp.json", ".mcp.json", ".vscode/mcp.json")) {
  if (Test-Path (Join-Path $Root $f)) { $notes += "ok    config $f" }
  else { $notes += "MISS  config $f" }
}
$notes += "servers in those files: github (required), playwright (recommended), context7 (recommended)"
$notes += "docker is optional. Committed github server is https://api.githubcopilot.com/mcp/"

if (Test-Tool "gh") {
  & gh auth status 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) { $notes += "ok    gh auth status" }
  else { $notes += "MISS  gh auth. Run: gh auth login" }
}

$notes | ForEach-Object { Write-Output $_ }

if (-not (Test-Tool "bun")) {
  Write-Output "bootstrap: bun is missing. Install it from https://bun.sh and re-run. Zip was not verified."
  exit 1
}

Write-Output "== bun install =="
& bun install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "== bun test =="
& bun test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "== bun run build =="
& bun run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "== bun run zip =="
& bun run zip
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$version = & bun -e "process.stdout.write(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "== verify release zips =="
& bun scripts/verify-release-zip.ts $version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$chrome = Get-ChildItem -Path .output -Filter "bongdc-*-chrome.zip" -ErrorAction SilentlyContinue | Select-Object -First 1
$firefox = Get-ChildItem -Path .output -Filter "bongdc-*-firefox.zip" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $chrome -or -not $firefox) {
  Write-Output "bootstrap: zip did not produce bongdc-*-chrome.zip and bongdc-*-firefox.zip"
  exit 1
}

Write-Output "bootstrap: zip ok ($($chrome.Name), $($firefox.Name)). Do not commit .output/."
Write-Output "bootstrap: if a token line says MISS, ask india 님 only for that token. Install any missing MCP from docs/HANDOFF.md without asking."
exit 0
