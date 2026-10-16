#!/usr/bin/env bash
# 复盘通 ReviewPal · macOS/Linux 启动脚本
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请先安装 Node.js (>= 22.5，建议 v24)：https://nodejs.org"
  exit 1
fi
[ -f .env ] || cp .env.example .env
echo "复盘通后端启动中… 浏览器请打开 http://localhost:8787"
node server/index.js
