@echo off
echo Starting Yodobashi Bot...

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if yodobashi.xlsx exists
if not exist "yodobashi.xlsx" (
    echo Error: yodobashi.xlsx not found!
    echo Please create yodobashi.xlsx with required configuration.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies!
        pause
        exit /b 1
    )
)

:: Install Playwright browsers if not installed
if not exist "%USERPROFILE%\AppData\Local\ms-playwright" (
    echo Installing Playwright browsers...
    call npx playwright install chromium
    if %errorlevel% neq 0 (
        echo Error: Failed to install Playwright browsers!
        pause
        exit /b 1
    )
)

:: Create required directories
if not exist "logs" mkdir logs
if not exist "data" mkdir data

:: Run the bot
echo Running bot...
node yodobashiBot.js --excel yodobashi.xlsx

:: If bot exits with error
if %errorlevel% neq 0 (
    echo Bot stopped with error!
    pause
    exit /b 1
)

@REM pause 