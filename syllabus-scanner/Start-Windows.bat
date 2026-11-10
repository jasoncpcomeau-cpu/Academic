@echo off
title SyllaPlan
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed yet.
  echo Install the LTS version from https://nodejs.org, then double-click this file again.
  echo.
  pause
  exit /b
)

if exist .env goto havekey
echo.
echo First-time setup: paste your Anthropic API key below.
echo (Right-click in this window to paste, then press Enter.)
echo.
set /p APIKEY=API key:
if "%APIKEY%"=="" (
  echo No key entered. Close this window and try again.
  pause
  exit /b
)
> .env echo ANTHROPIC_API_KEY=%APIKEY%
echo Saved. You won't be asked again.

:havekey
if exist node_modules goto run
echo.
echo Installing (only happens the first time, takes about a minute)...
call npm install
if errorlevel 1 (
  echo Install failed. Check your internet connection and try again.
  pause
  exit /b
)

:run
echo.
echo SyllaPlan is starting. Your browser will open in a few seconds.
echo Keep this window open while you use it. Close it to stop SyllaPlan.
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server.js
pause
