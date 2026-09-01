@echo off
setlocal
for %%I in ("%~dp0..") do set "STUDIO_DIR=%%~fI"
set "STUDIO_URL=http://127.0.0.1:4173/index.html"

powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing '%STUDIO_URL%' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto open_studio

where py >nul 2>&1
if not errorlevel 1 (
  py -3 --version >nul 2>&1
  if not errorlevel 1 (
    start "FPL Studio Server" /min py -3 -m http.server 4173 --bind 127.0.0.1 --directory "%STUDIO_DIR%"
    goto wait_for_server
  )
)

where python >nul 2>&1
if not errorlevel 1 (
  python --version >nul 2>&1
  if not errorlevel 1 (
    start "FPL Studio Server" /min python -m http.server 4173 --bind 127.0.0.1 --directory "%STUDIO_DIR%"
    goto wait_for_server
  )
)

echo Python was not found. Install Python, then run this file again.
echo You can also use the published GitHub Pages address.
pause
exit /b 1

:wait_for_server
timeout /t 2 /nobreak >nul

:open_studio
start "" "%STUDIO_URL%"
endlocal
