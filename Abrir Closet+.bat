@echo off
rem Abre Closet+ en el navegador. Deja esta ventana abierta mientras uses la app.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dev -- --open
pause
