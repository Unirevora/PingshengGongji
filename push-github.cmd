@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "PROJECT=%~dp0"
set "REPOSITORY=https://github.com/Unirevora/PingshengGongji.git"
set "BRANCH=main"
set "MESSAGE=Update PingshengGongji"
set "CHECK_ONLY=0"
set "NETWORK_CHECK=0"
if /I "%~1"=="--check" set "CHECK_ONLY=1"
if /I "%~1"=="--check-network" set "CHECK_ONLY=1"
if /I "%~1"=="--check-network" set "NETWORK_CHECK=1"
if not "%~1"=="" if "%CHECK_ONLY%"=="0" set "MESSAGE=%~1"

pushd "%PROJECT%"
if errorlevel 1 goto failed
where git >nul 2>&1
if errorlevel 1 (
    echo Git for Windows was not found. Install Git, then run this file again.
    goto failed
)
if not exist "index.html" (
    echo This script must stay in the PingshengGongji folder.
    goto failed
)
call :configure_network
if "%NETWORK_CHECK%"=="1" goto check_network
if "%CHECK_ONLY%"=="1" goto check

if exist ".git" goto remote
git init -b "%BRANCH%"
if errorlevel 1 goto failed

:remote
set "CURRENT_REMOTE="
for /f "delims=" %%U in ('git remote get-url origin 2^>nul') do set "CURRENT_REMOTE=%%U"
if not defined CURRENT_REMOTE (
    git remote add origin "%REPOSITORY%"
    if errorlevel 1 goto failed
    goto identity
)
if /I "%CURRENT_REMOTE%"=="%REPOSITORY%" goto identity
if /I "%CURRENT_REMOTE%"=="https://github.com/Unirevora/PingshengGongji" goto identity
if /I "%CURRENT_REMOTE%"=="git@github.com:Unirevora/PingshengGongji.git" goto identity
echo This folder points to a different GitHub repository. No push was made.
goto failed

:identity
git config user.name Unirevora
if errorlevel 1 goto failed
git config user.email Unirevora@users.noreply.github.com
if errorlevel 1 goto failed
set "HAS_HEAD=1"
git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 set "HAS_HEAD=0"
echo Connecting to GitHub...
call :network fetch origin
if errorlevel 1 goto failed
set "HAS_REMOTE=1"
git show-ref --verify --quiet "refs/remotes/origin/%BRANCH%"
if errorlevel 1 set "HAS_REMOTE=0"
if "%HAS_HEAD%"=="1" goto stage
if "%HAS_REMOTE%"=="0" goto stage
git reset --mixed "origin/%BRANCH%"
if errorlevel 1 goto failed

:stage
git rm -r --cached --ignore-unmatch -- data/source docs/reports docs/verification tests .taste-skill styles/LaobaoSong.source.ttf
if errorlevel 1 goto failed
git add -A -- .
if errorlevel 1 goto failed
for /f "delims=" %%F in ('git -c core.quotepath=false ls-files') do (
    if exist "%%F" for %%S in ("%%F") do if %%~zS GTR 99614720 (
        echo File exceeds the GitHub size limit: %%F
        goto failed
    )
)
git diff --cached --quiet
if errorlevel 2 goto failed
if not errorlevel 1 goto synchronize
git commit -m "%MESSAGE%"
if errorlevel 1 goto failed

:synchronize
if "%HAS_REMOTE%"=="0" goto publish
git merge-base --is-ancestor "origin/%BRANCH%" HEAD
if not errorlevel 1 goto publish
git rebase "origin/%BRANCH%"
if errorlevel 1 (
    echo Rebase stopped. Resolve the conflict before running this file again.
    goto failed
)

:publish
echo Pushing website changes...
call :network push -u origin "HEAD:refs/heads/%BRANCH%"
if errorlevel 1 goto failed
echo.
echo Done: https://github.com/Unirevora/PingshengGongji
popd
pause
exit /b 0

:check
git --version
git remote get-url origin
if errorlevel 1 goto failed
echo CMD entry is ready. Check only: no commit, fetch or push was performed.
popd
exit /b 0

:check_network
echo Checking GitHub connection without changing repository files...
call :network ls-remote "%REPOSITORY%" HEAD
if errorlevel 1 goto failed
echo GitHub connection OK. No commit, fetch or push was performed.
popd
exit /b 0

:configure_network
rem Existing Git and environment proxy settings take precedence.
if defined HTTPS_PROXY exit /b 0
if defined HTTP_PROXY exit /b 0
if defined ALL_PROXY exit /b 0
set "EXISTING_GIT_PROXY="
for /f "delims=" %%G in ('git config --get-urlmatch http.proxy "%REPOSITORY%" 2^>nul') do set "EXISTING_GIT_PROXY=%%G"
if defined EXISTING_GIT_PROXY exit /b 0
set "SYSTEM_PROXY_ENABLED="
set "SYSTEM_PROXY="
for /f "tokens=1,2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable 2^>nul') do if /I "%%A"=="ProxyEnable" set "SYSTEM_PROXY_ENABLED=%%C"
if /I not "%SYSTEM_PROXY_ENABLED%"=="0x1" exit /b 0
for /f "tokens=1,2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer 2^>nul') do if /I "%%A"=="ProxyServer" set "SYSTEM_PROXY=%%C"
if not defined SYSTEM_PROXY exit /b 0
set "PROXY_ADDRESS="
for %%P in ("%SYSTEM_PROXY:;=" "%") do call :proxy_piece "%%~P"

:apply_proxy
if not defined PROXY_ADDRESS exit /b 0
if /I "%PROXY_ADDRESS:~0,7%"=="http://" goto proxy_ready
if /I "%PROXY_ADDRESS:~0,8%"=="https://" goto proxy_ready
if /I "%PROXY_ADDRESS:~0,9%"=="socks5://" goto proxy_ready
set "PROXY_ADDRESS=http://%PROXY_ADDRESS%"
:proxy_ready
set "HTTPS_PROXY=%PROXY_ADDRESS%"
echo Using Windows system proxy for this run.
exit /b 0

:proxy_piece
for /f "tokens=1,* delims==" %%S in ("%~1") do (
    if "%%T"=="" set "PROXY_ADDRESS=%%S"
    if /I "%%S"=="http" if not defined PROXY_ADDRESS set "PROXY_ADDRESS=%%T"
    if /I "%%S"=="https" set "PROXY_ADDRESS=%%T"
)
exit /b 0

:network
set "NETWORK_ATTEMPT=0"
:network_retry
set /a NETWORK_ATTEMPT+=1 >nul
git -c http.version=HTTP/1.1 -c http.lowSpeedLimit=1 -c http.lowSpeedTime=30 %*
if not errorlevel 1 exit /b 0
if %NETWORK_ATTEMPT% GEQ 3 exit /b 1
echo Connection failed. Retrying %NETWORK_ATTEMPT% of 3...
timeout /t 2 /nobreak >nul 2>&1
goto network_retry

:failed
echo.
echo Stopped. No force push was used. Read the Git message above.
echo If your system proxy is enabled, keep the proxy application running.
popd
if "%CHECK_ONLY%"=="0" pause
exit /b 1
