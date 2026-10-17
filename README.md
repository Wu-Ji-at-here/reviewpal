# 复盘通 ReviewPal · 目标复盘打卡工具

> OPC 黑客松参赛作品 ｜ 版本 **V2.1**（2026-10）｜ **本地优先**：可安装 Android App + 桌面网页版

**一句话**：把「每日进步五问」变成打卡卡片的工具 —— 填五问 → 自动判定**推进度** → 生成可导出 PNG 的复盘卡 → 沉淀成打卡墙（热力图 + 连续天数）。

**项目方向（报备口径）**：解决「**长期目标立好了，日常却被琐事占满，说不清今天有没有推进目标**」的问题 —— 每天 2 分钟答「每日进步五问」，系统判出 5 档**推进度**（含 0-100 分与判定依据），生成可导出 PNG 的复盘卡，沉淀成打卡墙与月热力图。
**主产品**：**Android App**（本地优先 / 离线可用 / API Key 入 Android Keystore / 含每日提醒）；**次产品**：**电脑网页版**（零依赖 Node，双击 `start.bat` 即开）。
**不含任何心理 / 情绪功能**（唯一例外：卡片末尾一句可更换的鸡汤，内置 100 句可随机 / 手动挑选）。

---

## 亮点

- **本地优先的 Android App**（Capacitor 7）：数据存在手机本地（IndexedDB），**离线可用**，**只在调模型时联网**；**API Key 存 Android Keystore**，明文不落盘。
- **每日提醒**：本地通知，可开关 / 可设时间（闹钟式滚轮）/ 可发测试提醒。
- **零依赖 + 零构建**：后端只用 Node 内置能力（`node:http` / `node:sqlite` / `fetch`），**不需要 `npm install`**；前端是原生 JS，无框架、无打包步骤。
- **推进度体系**：**用户自评优先、关键词兜底** → 5 档（超额达成 / 按计划达成 / 部分完成 / 偏离目标 / 未推进）+ 0-100 分 + 判定依据。
- **人机协同可视化**：AI 思考流；结论逐条可改，并记入 `edit_history`（人在回路）。
- **坚持可视化**：月热力图（跟随主题色）+ 连续天数；打卡墙按推进度筛选。
- **产出可带走**：复盘卡一键导出 PNG（App 内直接保存到手机相册）。
- **双轨运行**：真实模型（DeepSeek / 智谱 / Kimi / OpenAI / 自定义）/ **Mock 兜底**。
- **Token 用量**：设置页可看「今日 / 本月 / 累计」token 消耗（真实调用后自动累计；Mock 模式显示"无用量"）。
- **三套主题**：暖色极简 / 赛博朋克 / 晴空蓝调（可跟随系统）。

---

## 三种用法

### 1) 装到手机上（推荐 · 本地优先）
直接安装随包的 `dist/ReviewPal-debug.apk`（安卓侧载）→ 详见 **`如何运行.md`**。
App 内：底部 4 个标签（每日五问 / 复盘卡 / 打卡墙 / 设置）；设置页可切主题、开每日提醒、填模型服务。

### 2) 电脑上跑网页版（无需装 App）
1. 准备 Node（**建议 v24，最低 v22.5**，项目用了内置 `node:sqlite`）
2. 双击 **`start.bat`**（没有 `.env` 会自动用 `.env.example` 生成，默认 **Mock** 模式）
3. 浏览器打开 **http://localhost:8787** ← 从这里的地址打开，**不要**双击 `web/index.html`

> 网页版是**竖向单列**页面：一屏一屏往下看，**不需要左右翻卡**；顶栏不悬浮。
>
> 端口默认 8787，可用环境变量 `PORT` 覆盖。真实模型需在 `.env` 填 Key（Key 只在后端，前端只拿掩码）。

### 3) 自己打包 Android App（开发者）
需要 JDK 21 + Android SDK。流程：
```
# 1. 前端 → 壳：改完 web/* 后拷进 mobile/www
copy web\*.js  mobile\www\
copy web\index.html mobile\www\
# 2. 同步原生工程（改前端后必须做，否则包内还是旧前端）
cd mobile && npx cap sync android
# 3. 出包
cd android && gradlew.bat assembleDebug
# 4. 产物
#    mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 目录结构

```
reviewpal/
├─ README.md                  本文件
├─ 如何运行.md                 运行 + 安装说明（含 APK 侧载）
├─ start.bat / start.sh       一键启动（后端）
├─ .env.example               复制成 .env 再填（真实模型的 Key）
├─ package.json               没有依赖
├─ web/                       桌面 / 网页前端（原生 JS，零构建）
│  ├─ index.html              入口（引用下面 4 个 js）
│  ├─ rp-core.js              护栏纯函数（推进度推断 / 契约校验）
│  ├─ local.js                本地优先存储层（App 内走 IndexedDB）
│  ├─ icons.js                底部图标（可整体替换）
│  └─ enhance.js              分层增强（移动端导航 / 提醒 / 主题 / 视觉）
├─ server/                    零依赖 Node 后端
│  ├─ index.js                路由 + 调模型（网页版 Key 只在后端）
│  ├─ classify.js             推进度判定（用户自评优先、关键词兜底）
│  ├─ schema.js               数据契约校验
│  ├─ db.js                   SQLite 读写
│  └─ prompts/system-v1.md    System Prompt
├─ tests/rp-core.test.js      核心用例（15 条）
├─ mobile/                    Capacitor 7 工程（Android App）
│  ├─ capacitor.config.json   appId / appName / webDir
│  ├─ www/                    ← web 的构建产物（index/local/enhance/icons/rp-core + prompts）
│  └─ android/                原生工程（Manifest 权限、通知、Keystore 插件）
└─ data/reviewpal.db          网页版数据库（跑起来后自动生成）
```

---

## 测试

```
node tests/rp-core.test.js
# => 15 passed, 0 failed
```

覆盖 `rp-core.js` 的推进度推断与契约校验（`inferProgress` / `validate`）；`web/local.js` 与后端 `server/*` 都委托同一套护栏。

---

## 版本

| 版本 | 要点 |
|---|---|
| V1.18 | 网页版单文件前端 + 零依赖 Node 后端（OPC 初版） |
| **V2.0** | **新增可安装 Android App（Capacitor 7）**：本地优先 IndexedDB、Key 入 Android Keystore、每日提醒、移动端导航与视觉改版、三套主题、核心护栏用例；网页版改**竖向单列**（去轮播）、翻页按钮下移 + **重置**按钮、生成后自动跳到「人在回路」、设置页可看 **Token 用量** |
| **V2.1** | 界面精简与交互修复：删横向进度条（圆环改为显示实际分数）、删「近 7 天」折线图、「换一句鸡汤」→「换一句」；修复打卡墙筛选卡底部留白（class 撞名）；人在回路英文标注改为隐藏；搜索回车收键盘；第三问对齐按钮补点选（仅描边高亮、不收起键盘）；点卡片/日历还原当天五问 + 复盘卡；**复盘卡 PNG 保存到手机相册**（自研原生插件 SaveImage） |

## 许可

见 `LICENSE` 与 `THIRD_PARTY_LICENSES.md`。