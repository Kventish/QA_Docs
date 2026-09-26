$branch = git branch --show-current

switch ($branch) {
    "dev" {
        $source = ".env.dev.local"
        $label = "DEV / phase-a-test"
    }

    "main" {
        $source = ".env.prod.local"
        $label = "PRODUCTION"
    }

    default {
        # Feature-ветки считаем dev по умолчанию
        $source = ".env.dev.local"
        $label = "DEV / phase-a-test"
    }
}

if (-not (Test-Path $source)) {
    Write-Error "Environment file '$source' not found."
    exit 1
}

Copy-Item $source ".env" -Force
Copy-Item $source ".env.local" -Force

Write-Host ""
Write-Host "Environment switched:"
Write-Host "Branch: $branch"
Write-Host "Target: $label"
Write-Host "Source: $source"
Write-Host ""