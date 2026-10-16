# 复盘通 ReviewPal · 目标复盘打卡工具

> OPC 黑客松参赛作品　|　版本 V1.18（2026-10）

**一句话**：把「每日进步五问」变成一张「每日复盘卡」的打卡工具——填入五问 → 自动判定**推进度** → 生成可导出 / 可保存的复盘卡 → 沉淀成打卡墙（按推进度筛选）。
**不含任何心理 / 情绪功能**（唯一例外：卡片末尾一句可更换的鸡汤）。

## 亮点
- **零依赖后端**：只用 Node 内置能力（`node:http`、`node:sqlite`、`fetch`），无需 `npm install`。
- **单文件前端**：`web/index.html` 纯 HTML + CSS + 原生 JS，无框架。
- **人机协同可视化**：AI 思考流；结论逐条可改并记入 `edit_history`（人在回路）。
- **产出可带走**：复盘卡一键导出 PNG；100 句鸡汤随机轮换，也可手动挑一句。
- **坚持可视化**：月热力图 + 连续天数；打卡墙按推进度筛选 + 搜索 + 删除。
- **双轨运行**：真实模型（DeepSeek 等）/ Mock 兜底；**API Key 只存后端**，前端只拿掩码。

## 怎么跑（30 秒）
1. 准备 Node（≥ 20，含 `node:sqlite`）。本机路径：`D:\software\node.js\node.exe`。
2. 双击 **`start.bat`**（没有 `.env` 会自动用 `.env.example` 生成，默认 **Mock** 模式）。
3. 浏览器打开 **http://localhost:8787**。

> 端口默认 8787，可用环境变量 `PORT` 覆盖。

## 目录结构
```
.
├─ start.bat                # 双击启动
├─ package.json             # 无依赖
├─ .env.example             # 复制为 .env 再填 Key
├─ server/                  # 零依赖后端
│  ├─ index.js              # 路由 + 调模型（Key 只在后端）
│  ├─ classify.js           # 推进度判定（自评优先、关键词兜底）
│  ├─ schema.js             # 数据契约校验（两阶段）
│  ├─ db.js                 # SQLite 读写
│  └─ prompts/system-v1.md  # System Prompt
├─ web/index.html           # 单文件前端（含全部 CSS/JS）
├─ data/                    # SQLite 落库目录（运行时生成）
├─ docs/                    # 设计文档 / 数据契约 / 部署指南 / 协作手册
├─ worklog.md               # 开发日志（人机协同证据）
└─ LICENSE
```

## 接入真实模型（可选）
- 界面右上角「⚙ 模型设置」：填 `API Key`（只写后端 `.env`，前端只看到掩码）→「保存并启用真实模型」。
- 或直接改 `.env`：`MOCK=0`、`DEEPSEEK_API_KEY=sk-...`、`MODEL_ID=...`、`DEEPSEEK_BASE_URL=...`。

## 核心功能
| 模块 | 说明 |
|---|---|
| 每日五问 | 一步一问；长期/短期目标、计划、实际、保持/优化、明日计划 |
| 推进度 | 5 档（超额达成 / 按计划达成 / 部分完成 / 偏离目标 / 未推进）+ 0–100 分 |
| 确认与修改 | AI 结论逐条可改，改动记入 `edit_history` |
| 每日复盘卡 | 五问排版 + 推进度 + 鸡汤位；导出 PNG |
| 月热力图 | 每格一天，颜色深浅=推进度；连续天数不清零只降级 |
| 打卡墙 | 全部记录，按推进度筛选 + 搜索 + 回看 + 删除 |

## 数据与隐私
- 数据只存**本机** SQLite 单文件：`data/reviewpal.db`（页脚显示真实路径）。
- 调用 AI 时**只发送本轮填写的文本**；不上传历史库。
- **不对外公开**、无社区功能。

## 自检
- `web/index.html` 内联脚本：`node --check` 通过。
- 页面 `GET /` 返回 200；`/api/health`、`/api/records`、`/api/review/generate` 正常。

## 文档
见 `docs/`：设计文档 V1.18（md + docx）、数据契约 `review-record.schema.json`、公网部署指南、AI 协作手册。

## License
MIT，见 `LICENSE`；第三方许可见 `THIRD_PARTY_LICENSES.md`。