# 测试数据（脱敏示例）

本目录的 `demo-records.json` 是**合成脱敏数据**（不含任何真实用户内容），用于演示与验收：

- **10 条**复盘记录，覆盖全部 **5 档推进度**（超额达成 / 按计划达成 / 部分完成 / 偏离目标 / 未推进）；
- 日期从 **2026-09-21 到 2026-10-16**，便于查看月热力图与近 7 天走势；
- 每条记录的 `progress`（状态 / 档位名 / 分数 / 判定依据）由 `web/rp-core.js` 的 `inferProgress()` 生成，并通过 `validate()` 契约校验 → **数据与产品护栏逻辑严格一致**。

## 字段

与 `docs/review-record.schema.json`（统一数据契约 v3）一致：
`id / date / created_at / answers / summary / key_insight / keep / improve / tomorrow_focus / tags / progress / quote / public / user_edited / edit_history`

## 怎么用

- **看结构**：直接打开 JSON。
- **要复现卡面效果**：在 App 里按同样内容填一遍五问即可（App 数据存在本机，没有导入接口，以免误覆盖你的真实记录）。
- **要验推进度判定**：`node tests/rp-core.test.js`（15 条用例），或参考 `demo-records.json` 里 `answers → progress` 的对应关系。