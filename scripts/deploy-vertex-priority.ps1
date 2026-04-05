param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "us-central1",

    [string]$BucketName = "",

    [string]$ModelDisplayName = "hopenet-priority-model",

    [string]$EndpointDisplayName = "hopenet-priority-endpoint"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$artifactPath = Join-Path $root "backend\ml\artifacts\priority_model.joblib"

if (-not (Test-Path $artifactPath)) {
    throw "Model artifact not found at $artifactPath. Run 'python ml\train_priority_model.py' first."
}

if ([string]::IsNullOrWhiteSpace($BucketName)) {
    $BucketName = "$ProjectId-hopenet-models"
}

$bucketUri = "gs://$BucketName"
$uploadUri = "$bucketUri/priority-model"

try {
    gsutil ls $bucketUri | Out-Null
} catch {
    gsutil mb -p $ProjectId -l $Region $bucketUri
}

gsutil cp $artifactPath $uploadUri

$modelUploadOutput = gcloud ai models upload `
    --project $ProjectId `
    --region $Region `
    --display-name $ModelDisplayName `
    --artifact-uri $uploadUri `
    --container-image-uri "us-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-5:latest" `
    --format "value(name)"

if (-not $modelUploadOutput) {
    throw "Model upload failed."
}

$existingEndpoint = gcloud ai endpoints list `
    --project $ProjectId `
    --region $Region `
    --filter "displayName=$EndpointDisplayName" `
    --format "value(name)"

if (-not $existingEndpoint) {
    $existingEndpoint = gcloud ai endpoints create `
        --project $ProjectId `
        --region $Region `
        --display-name $EndpointDisplayName `
        --format "value(name)"
}

gcloud ai endpoints deploy-model $existingEndpoint `
    --project $ProjectId `
    --region $Region `
    --model $modelUploadOutput `
    --display-name "$ModelDisplayName-deployed" `
    --machine-type "n1-standard-2" `
    --traffic-split "0=100"

Write-Host "Model resource: $modelUploadOutput"
Write-Host "Endpoint resource: $existingEndpoint"
Write-Host "Put this endpoint id or full name into backend/.env as VERTEX_ENDPOINT_ID"

