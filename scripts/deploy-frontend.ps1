param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [string]$ApiBase,

    [string]$Region = "us-central1",

    [string]$ServiceName = "hopenet-web",

    [string]$ImageName = "hopenet-web"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "frontend"
$image = "gcr.io/$ProjectId/$ImageName"

Push-Location $frontendDir
gcloud builds submit `
    --project $ProjectId `
    --config cloudbuild.yaml `
    --substitutions "_IMAGE_NAME=$ImageName,_VITE_API_BASE=$ApiBase"
gcloud run deploy $ServiceName `
    --image $image `
    --platform managed `
    --region $Region `
    --allow-unauthenticated
Pop-Location

Write-Host "Frontend deployed as Cloud Run service '$ServiceName'"
