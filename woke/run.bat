@echo off
title Hotmail Full Install & Run (Stealth Mode)
echo [*] CHECKING NODE INSTALLATION...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] NODE.JS NOT FOUND. DOWNLOAD IT FROM https://nodejs.org/
    pause
    exit /b
)

echo [*] INITIALIZING NPM PROJECT...
IF NOT EXIST package.json (
    call npm init -y
)

echo [*] INSTALLING FULL DEPENDENCIES, HOMIE...

call npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth chalk minimist fs-extra readline path

echo [✓] DEPENDENCIES INSTALLED.

echo [*] RUNNING THE SCRIPT, FUCKNUT...
node hotmail.js

echo [✓] DONE. PRESS ANY KEY TO CLOSE.
pause
