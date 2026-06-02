@echo off
cd /d C:\Users\user\Desktop\vibecoding\study-pdf
set PYTHON=C:\Users\user\AppData\Local\Programs\Python\Python311\python.exe
echo Starting PDF Converter...
echo Browser will open automatically in a few seconds.
echo Close this window to stop the server.
echo.
start /b "" "%PYTHON%" open_browser.py
"%PYTHON%" app.py
