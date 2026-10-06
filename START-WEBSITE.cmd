@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python is required for this launcher. You can also run npm start manually.
  pause
  exit /b 1
)
python launch.py
if errorlevel 1 pause
