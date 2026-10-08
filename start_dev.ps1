<#
.SYNOPSIS
    CodeGuardian Local Development Stack Launcher for PowerShell

.DESCRIPTION
    Launches Django backend, Celery workers, and Next.js frontend in one unified process.

.EXAMPLE
    .\start_dev.ps1
    .\start_dev.ps1 -Worker
    .\start_dev.ps1 -Setup
    .\start_dev.ps1 -Build
#>

param (
    [switch]$Worker,
    [switch]$Setup,
    [switch]$Build,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$Host.UI.RawUI.WindowTitle = "CodeGuardian Dev Stack"

# Resolve Python Executable
$PythonExec = "python"
if (Test-Path ".\.venv\Scripts\python.exe") {
    $PythonExec = ".\.venv\Scripts\python.exe"
}

# Build arguments array
$ArgsList = @()
if ($Worker) { $ArgsList += "--worker" }
if ($Setup) { $ArgsList += "--setup" }
if ($Build) { $ArgsList += "--build" }
if ($BackendOnly) { $ArgsList += "--backend-only" }
if ($FrontendOnly) { $ArgsList += "--frontend-only" }

# Execute unified runner
& $PythonExec run_all.py $ArgsList
