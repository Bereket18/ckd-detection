# PowerShell Automation Script for CKD Federated Agent Project
# Replaces Makefile commands for Windows environments

param (
    [Parameter(Position=0)]
    [ValidateSet("setup", "setup-advanced", "test", "train", "run-agent", "all", "help")]
    [string]$Task = "help"
)

# Venv location, defined ONCE and derived from here everywhere below.
# This used to be spelled out at each call site, and one site drifted to
# ".env" (which is also the gitignored secrets filename) while the venv was
# actually created at "venv" — so every task failed. Keep these derived.
$VenvDir    = "venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip    = Join-Path $VenvDir "Scripts\pip.exe"
$VenvPytest = Join-Path $VenvDir "Scripts\pytest.exe"

# Colors for output formatting
function Write-Header ($text) {
    Write-Host "`n========================================`n $text`n========================================" -ForegroundColor Cyan
}

function Write-Success ($text) {
    Write-Host "[SUCCESS] $text" -ForegroundColor Green
}

function Write-Info ($text) {
    Write-Host "[INFO] $text" -ForegroundColor Yellow
}

function Write-Err ($text) {
    Write-Host "[ERROR] $text" -ForegroundColor Red
}

# Helper to check if virtualenv exists
function Test-Venv {
    if (-not (Test-Path $VenvPython)) {
        Write-Err "Virtual environment not found! Please run '.\setup.ps1 setup' first."
        return $false
    }
    return $true
}

# Task Implementations
function Invoke-Setup {
    Write-Header "Setting up Virtual Environment & Installing Dependencies"

    if (-not (Test-Path $VenvDir)) {
        Write-Info "Creating virtual environment '$VenvDir'..."
        python -m venv $VenvDir
    } else {
        Write-Info "Virtual environment '$VenvDir' already exists."
    }

    if (-not (Test-Venv)) { return }

    Write-Info "Upgrading pip..."
    & $VenvPython -m pip install --upgrade pip

    if (Test-Path "requirements.txt") {
        Write-Info "Installing dependencies from requirements.txt..."
        & $VenvPip install -r requirements.txt
        Write-Success "Base environment setup completed successfully."
    } else {
        Write-Err "requirements.txt not found!"
    }
}

function Invoke-SetupAdvanced {
    if (-not (Test-Venv)) { return }
    Write-Header "Installing Advanced Dependencies"

    if (Test-Path "requirements-advanced.txt") {
        Write-Info "Installing dependencies from requirements-advanced.txt..."
        & $VenvPip install -r requirements-advanced.txt
        Write-Success "Advanced dependencies installed successfully."
    } else {
        Write-Err "requirements-advanced.txt not found!"
    }
}

function Invoke-Test {
    if (-not (Test-Venv)) { return }
    Write-Header "Running Pytest Suite"

    if (Test-Path $VenvPytest) {
        & $VenvPytest -v
    } else {
        Write-Info "pytest executable not found in venv. Attempting module run..."
        & $VenvPython -m pytest -v
    }
}

function Invoke-Train {
    if (-not (Test-Venv)) { return }
    Write-Header "Training Baseline Model"

    if (Test-Path "scripts/train_baseline.py") {
        & $VenvPython scripts/train_baseline.py
    } else {
        Write-Err "Script 'scripts/train_baseline.py' not found!"
    }
}

function Invoke-RunAgent {
    if (-not (Test-Venv)) { return }
    Write-Header "Running Chatbot Agent"

    & $VenvPython -m src.agent.chatbot
}

function Show-Help {
    Write-Header "CKD Federated Agent - PowerShell Automation Helper"
    Write-Host "Usage:" -ForegroundColor White
    Write-Host "  .\setup.ps1 <command>`n" -ForegroundColor Yellow
    Write-Host "Available Commands:" -ForegroundColor White
    Write-Host "  setup           - Create venv and install base requirements.txt"
    Write-Host "  setup-advanced  - Install requirements-advanced.txt"
    Write-Host "  test            - Run unit tests with pytest"
    Write-Host "  train           - Execute baseline training script (scripts/train_baseline.py)"
    Write-Host "  run-agent       - Run the agent chatbot module (src.agent.chatbot)"
    Write-Host "  all             - Run setup, setup-advanced, and run tests"
    Write-Host "  help            - Display this help message`n"
}

# Main Execution Dispatcher
switch ($Task.ToLower()) {
    "setup"          { Invoke-Setup }
    "setup-advanced" { Invoke-SetupAdvanced }
    "test"           { Invoke-Test }
    "train"          { Invoke-Train }
    "run-agent"      { Invoke-RunAgent }
    "all"            { Invoke-Setup; Invoke-SetupAdvanced; Invoke-Test }
    "help"           { Show-Help }
    default          { Show-Help }
}
