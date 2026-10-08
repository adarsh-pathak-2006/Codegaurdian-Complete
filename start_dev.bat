@echo off
TITLE CodeGuardian Local Development Stack
COLOR 0A

echo ===================================================
echo   CodeGuardian - Starting Local Development Stack
echo ===================================================

REM Check Python in virtual environment or fallback to system python
IF EXIST ".venv\Scripts\python.exe" (
    SET PYTHON_EXEC=.venv\Scripts\python.exe
) ELSE (
    SET PYTHON_EXEC=python
)

REM Run unified python orchestrator
%PYTHON_EXEC% run_all.py %*

PAUSE
