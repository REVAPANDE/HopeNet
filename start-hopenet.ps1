param(
    [switch]$Install
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$venvActivate = Join-Path $backend ".venv\Scripts\Activate.ps1"

if ($Install) {
    if (-not (Test-Path (Join-Path $backend ".venv"))) {
        Write-Host "Creating backend virtual environment..."
        python -m venv (Join-Path $backend ".venv")
    }

    Write-Host "Installing backend dependencies..."
    & $venvActivate
    pip install -r (Join-Path $backend "requirements.txt")

    Write-Host "Installing frontend dependencies..."
    Push-Location $frontend
    npm install
    Pop-Location
}

if (-not (Test-Path $venvActivate)) {
    throw "Backend virtual environment not found. Run .\start-hopenet.ps1 -Install first."
}

Write-Host "Starting HopeNet backend and frontend..."

$backendCommand = "cd '$backend'; & '$venvActivate'; uvicorn app.main:app --reload"
$frontendCommand = "cd '$frontend'; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null

Write-Host "Backend starting at http://127.0.0.1:8000"
Write-Host "Frontend starting at http://127.0.0.1:5173"
