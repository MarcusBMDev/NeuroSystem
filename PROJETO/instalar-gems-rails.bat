@echo off
title NEUROCENTER - Configurar Ruby DevKit e Gems do Rails
echo ========================================================
echo   CONFIGURANDO DEPENDENCIAS DO RAILS (NEUROGESTAO E NEUROCONTROL)
echo ========================================================
echo.
echo IMPORTANTE: Clique com o botao direito neste arquivo .bat e
echo selecione "Executar como Administrador".
echo.

cd /d "%~dp0"

echo [1/4] Desativando checagem de assinatura de PGP no MSYS2...
powershell -Command "(Get-Content 'C:\Ruby32-x64\msys64\etc\pacman.conf') -replace 'SigLevel    = Required', 'SigLevel = Never' | Set-Content 'C:\Ruby32-x64\msys64\etc\pacman.conf'"

echo.
echo [2/4] Instalando bibliotecas C (libyaml e MariaDB Connector)...
call C:\Ruby32-x64\bin\ridk.cmd exec pacman -S --noconfirm mingw-w64-ucrt-x86_64-libyaml mingw-w64-ucrt-x86_64-libmariadbclient

echo.
echo [3/4] Instalando gems do NeuroGestao (porta 3011)...
cd /d "%~dp0NEUROGESTAO"
call C:\Ruby32-x64\bin\ridk.cmd exec bundle install

echo.
echo [4/4] Instalando gems do NeuroControl (porta 3012)...
cd /d "%~dp0NEUROCONTROL"
call C:\Ruby32-x64\bin\ridk.cmd exec bundle install

echo.
echo ========================================================
echo ✅ Concluido! Agora os servidores Rails podem ser iniciados.
echo ========================================================
pause
