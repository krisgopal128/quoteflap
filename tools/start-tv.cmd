@echo off
rem Launch QuoteFlap fullscreen on a TV/display: starts the server if needed,
rem then opens the browser in kiosk mode (true fullscreen on open, no UI).
rem Windows: double-click this file.

rem Start the server only if it is not already up
curl -sf http://localhost:8000/health >nul 2>nul
if errorlevel 1 (
    start "" /MIN python "%~dp0server.py" 8000
    rem server takes a few seconds to load its quote chunk
    ping -n 9 127.0.0.1 >nul
)

where chrome >nul 2>nul
if not errorlevel 1 ( start chrome --kiosk http://localhost:8000 & exit /b )

where msedge >nul 2>nul
if not errorlevel 1 ( start msedge --kiosk http://localhost:8000 & exit /b )

start http://localhost:8000
