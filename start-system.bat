@echo off
setlocal

cd /d "%~dp0"

echo ============================================================
echo  Brazil AI Commerce OS Lite - System Launcher V1
echo ============================================================
echo  Project: %CD%
echo  Starting dev server and opening the system entry...
echo  Please wait 5-8 seconds while the launcher detects the port.
echo.

set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  set "NODE_EXE=node"
) else (
  if exist "%BUNDLED_NODE%" (
    set "NODE_EXE=%BUNDLED_NODE%"
  ) else (
    echo server status: fail
    echo actual port: n/a
    echo access URL: n/a
    echo ready state: failed
    echo.
    echo Error: Node.js was not found.
    echo Please install Node.js/npm, then run this file again.
    pause
    exit /b 1
  )
)

"%NODE_EXE%" "%CD%\scripts\start-system.js"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Launcher exited with error code %EXIT_CODE%.
  pause
)

endlocal
exit /b %EXIT_CODE%
