& (Join-Path $PSScriptRoot "dev-kill.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if ($env:PATH -notlike "*$env:USERPROFILE\.bun\bin*") {
    $env:PATH = "$env:PATH;$env:USERPROFILE\.bun\bin"
}

& bun dev
