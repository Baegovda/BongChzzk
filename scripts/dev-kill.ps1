$ErrorActionPreference = "SilentlyContinue"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$projectName = Split-Path -Leaf $projectRoot

foreach ($name in @("bun.exe", "node.exe")) {
    Get-CimInstance Win32_Process -Filter "Name = '$name'" |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -like "*wxt*" -and
            $_.CommandLine -like "*$projectName*"
        } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

Start-Sleep -Milliseconds 500
