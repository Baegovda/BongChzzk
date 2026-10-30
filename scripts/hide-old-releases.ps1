$ErrorActionPreference = "Stop"

$repo = if ($env:GITHUB_REPOSITORY) { $env:GITHUB_REPOSITORY } else { "Baegovda/BongDC" }

$releases = gh release list --repo $repo --limit 100 --json tagName,isDraft,isLatest |
    ConvertFrom-Json

if (-not $releases -or $releases.Count -eq 0) {
    Write-Host "No releases found for $repo"
    exit 0
}

$latest = $releases | Where-Object { $_.isLatest -eq $true } | Select-Object -First 1
if (-not $latest) {
    $latest = $releases | Where-Object { $_.isDraft -eq $false } | Select-Object -First 1
}
if (-not $latest) {
    $latest = $releases[0]
}

$latestTag = $latest.tagName
Write-Host "Latest (visible): $latestTag"

gh release edit $latestTag --repo $repo --latest --draft=false | Out-Null

foreach ($release in $releases) {
    if ($release.tagName -eq $latestTag) {
        continue
    }

    if ($release.isDraft -eq $true) {
        Write-Host "Already hidden (draft): $($release.tagName)"
        continue
    }

    Write-Host "Hiding (draft): $($release.tagName)"
    gh release edit $release.tagName --repo $repo --draft | Out-Null
}

Write-Host "Old releases hidden. Only $latestTag is public."
