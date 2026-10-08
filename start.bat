@echo off
rem Lancement local du jeu sous Windows.
rem Usage : start.bat [app|e2e|menu]   (sans argument : menu interactif)

setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js est introuvable. Installez la version 22.12.0 puis relancez ce script.
  exit /b 1
)

if not exist "node_modules\@playwright\test\" (
  echo Installation des dependances ^(npm ci^)...
  call npm ci
  if errorlevel 1 exit /b 1
)

if /I "%~1"=="app" goto app
if /I "%~1"=="e2e" goto e2e
if /I "%~1"=="" goto menu
echo Argument inconnu : %~1
echo Usage : start.bat [app^|e2e]
exit /b 1

:menu
echo.
echo 1. Lancer l'application ^(http://localhost:5173^)
echo 2. Lancer les tests E2E Playwright ^(interface^)
echo 3. Quitter
echo.
set /p CHOICE=Votre choix : 
if "%CHOICE%"=="1" goto app
if "%CHOICE%"=="2" goto e2e
exit /b 0

:app
call npm run dev
exit /b %errorlevel%

:e2e
call npx playwright install chromium
if errorlevel 1 exit /b 1
call npm run test:e2e:ui
exit /b %errorlevel%
