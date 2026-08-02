@echo off
title NEUROCENTER - Inicializador de Todos os 11 Microservicos
echo ========================================================
echo         NEUROCENTER - INICIALIZADOR DE MICROSERVICOS
echo ========================================================
echo.
echo Liberando portas de 3000 a 3012 se houver processos antigos...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3000 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3002 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3003 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3005 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3006 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3007 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3008 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3010 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3011 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3012 "') do taskkill /F /PID %%a 2>nul

echo Limpando arquivos temporarios e PIDs antigos...
if exist "%~dp0NEUROGESTAO\tmp\pids\server.pid" del /f /q "%~dp0NEUROGESTAO\tmp\pids\server.pid" 2>nul
if exist "%~dp0NEUROCONTROL\tmp\pids\server.pid" del /f /q "%~dp0NEUROCONTROL\tmp\pids\server.pid" 2>nul

echo.
echo Iniciando os 11 microservicos em portas exclusivas...
echo.

cd /d "%~dp0"

echo [1/11] Iniciando NeuroChat (:3000)...
start "NeuroChat (:3000)" cmd /k "cd /d "%~dp0NEUROCHAT" && node server.js"

echo [2/11] Iniciando Suporte Interno (:3001)...
start "Suporte Interno (:3001)" cmd /k "cd /d "%~dp0SUPORTE INTERNO" && node server.js"

echo [3/11] Iniciando NeuroAgenda (:3002)...
start "NeuroAgenda (:3002)" cmd /k "cd /d "%~dp0NEUROAGENDA" && node server.js"

echo [4/11] Iniciando NeuroCar (:3003)...
start "NeuroCar (:3003)" cmd /k "cd /d "%~dp0NEUROCAR" && node server.js"

echo [5/11] Iniciando SolicitaMKT (:3005)...
start "SolicitaMKT (:3005)" cmd /k "cd /d "%~dp0SOLICITAMKT" && node server.js"

echo [6/11] Iniciando NeuroPrint (:3006)...
start "NeuroPrint (:3006)" cmd /k "cd /d "%~dp0NEUROPRINT" && node server.js"

echo [7/11] Iniciando NeuroCompras (:3007)...
start "NeuroCompras (:3007)" cmd /k "cd /d "%~dp0NEUROCOMPRAS" && node server.js"

echo [8/11] Iniciando NeuroGente (:3008)...
start "NeuroGente (:3008)" cmd /k "cd /d "%~dp0NEUROGENTE" && node app.js"

echo [9/11] Iniciando NeuroEscuta (:3010)...
start "NeuroEscuta (:3010)" cmd /k "cd /d "%~dp0NEUROESCUTA" && node app.js"

echo [10/11] Iniciando NeuroGestao (:3011)...
start "NeuroGestao (:3011)" cmd /k "cd /d "%~dp0NEUROGESTAO" && rails s -p 3011"

echo [11/11] Iniciando NeuroControl (:3012)...
start "NeuroControl (:3012)" cmd /k "cd /d "%~dp0NEUROCONTROL" && rails s -p 3012"

echo.
echo ========================================================
pause
