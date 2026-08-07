# PowerShell Automation Script for CKD Federated Agent Project
# Replaces Makefile commands for Windows environments

param (
    [Parameter(Position=0)]
    [ValidateSet("setup", "setup-advanced", "test", "train", "run-agent", "all", "help")]
    [string]$Task = "help"
)

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
    if (-not (Test-Path ".env\Scripts\python.exe")) {
        Write-Err "Virtual environment not found! Please run '.\setup.ps1 setup' first."
        return $false
    }
    return $true
}

# Task Implementations
function Invoke-Setup {
    Write-Header "Setting up Virtual Environment & Installing Dependencies"
    
    if (-not (Test-Path ".env")) {
        Write-Info "Creating virtual environment 'venv'..."
        python -m venv venv
    } else {
        Write-Info "Virtual environment 'venv' already exists."
    }

    Write-Info "Upgrading pip..."
    .env\Scripts\python.exe -m pip install --upgrade pip

    if (Test-Path "requirements.txt") {
        Write-Info "Installing dependencies from requirements.txt..."
        .env\Scripts\pip.exe install -r requirements.txt
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
        .env\Scripts\pip.exe install -r requirements-advanced.txt
        Write-Success "Advanced dependencies installed successfully."
    } else {
        Write-Err "requirements-advanced.txt not found!"
    }
}

function Invoke-Test {
    if (-not (Test-Venv)) { return }
    Write-Header "Running Pytest Suite"
    
    if (Test-Path ".env\Scripts\pytest.exe") {
        .env\Scripts\pytest.exe -v
    } else {
        Write-Info "pytest executable not found in venv. Attempting module run..."
        .env\Scripts\python.exe -m pytest -v
    }
}

function Invoke-Train {
    if (-not (Test-Venv)) { return }
    Write-Header "Training Baseline Model"
    
    if (Test-Path "scripts/train_baseline.py") {
        .env\Scripts\python.exe scripts/train_baseline.py
    } else {
        Write-Err "Script 'scripts/train_baseline.py' not found!"
    }
}

function Invoke-RunAgent {
    if (-not (Test-Venv)) { return }
    Write-Header "Running Chatbot Agent"
    
    .env\Scripts\python.exe -m src.agent.chatbot
}

function Show-Help {
    Write-Header "CKD Federated Agent - PowerShell Automation Helper"
    Write-Host "Usage:" -ForegroundColor BrightWhite
    Write-Host "  .\setup.ps1 <command>`n" -ForegroundColor Yellow
    Write-Host "Available Commands:" -ForegroundColor BrightWhite
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
