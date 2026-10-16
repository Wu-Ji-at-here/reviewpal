@echo off
chcp 936 >nul
title 复盘通 ReviewPal 后端（关掉这个窗口 = 停止服务）
cd /d "%~dp0"

set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "D:\software\node.js\node.exe" (
    set "NODE_EXE=D:\software\node.js\node.exe"
  ) else (
    echo.
    echo [错误] 没找到 node.exe。
    echo 解决：把 Node 加入系统 PATH，或把本文件里的 NODE_EXE 改成你的 node.exe 完整路径。
    echo.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo [提示] 还没有 .env 文件，正在用 .env.example 生成一份（默认 MOCK=1）...
  copy /y ".env.example" ".env" >nul
)

echo.
echo ====================================================
echo  复盘通后端启动中...
echo  浏览器请打开： http://localhost:8787
echo  停止服务：直接关掉这个窗口，或按 Ctrl+C
echo ====================================================
echo.
"%NODE_EXE%" "server\index.js"

echo.
echo [后端已停止]
pause
