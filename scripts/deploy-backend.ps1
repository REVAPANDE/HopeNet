param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "us-central1",

    [string]$ServiceName = "hopenet-api",

    [string]$ImageName = "hopenet-api",

    [string]$GeminiApiKey = "",

    [switch]$UseLocalModel = $true
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$image = "gcr.io/$ProjectId/$ImageName"
$envVars = @(
    "GOOGLE_CLOUD_PROJECT=$ProjectId",
    "VERTEX_PROJECT_ID=$ProjectId",
    "VERTEX_LOCATION=$Region",
    "VERTEX_USE_LOCAL_MODEL=$($UseLocalModel.ToString().ToLower())"
)

if (-not [string]::IsNullOrWhiteSpace($GeminiApiKey)) {
    $envVars += "GEMINI_API_KEY=$GeminiApiKey"
    $envVars += "GEMINI_USE_VERTEXAI=false"
}

Push-Location $backendDir
gcloud builds submit --tag $image --project $ProjectId
gcloud run deploy $ServiceName `
    --image $image `
    --platform managed `
    --region $Region `
    --allow-unauthenticated `
    --set-env-vars ($envVars -join ",")
Pop-Location

Write-Host "Backend deployed as Cloud Run service '$ServiceName'"
