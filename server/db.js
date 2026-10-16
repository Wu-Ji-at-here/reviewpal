/**
 * 数据访问层（SQLite · 零依赖）
 * 对应文档：§4 数据结构 · §11 字段映射 · §2.5 展示墙
 *
 * 【存法】索引列 + payload 整条 JSON。契约加字段时不用改表结构，黑客松阶段最省事。
 * 【迁移】老库（V1.x 的情绪字段）不删数据：新列用 ALTER 补上，老记录只是没有新字段。
 */
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'reviewpal.db');

const db = new DatabaseSync(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS review_records (
    id              TEXT PRIMARY KEY,
    date            TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    progress_status TEXT,
    progress_score  INTEGER,
    is_public       INTEGER DEFAULT 0,
    published_at    TEXT,
    payload         TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_date ON review_records(date);
`);

/* 老库迁移：把新列补上（已存在则忽略） */
const NEW_COLS = [
  ['progress_status', 'TEXT'], ['progress_score', 'INTEGER'],
  ['is_public', 'INTEGER DEFAULT 0'], ['published_at', 'TEXT']
];
for (const [name, type] of NEW_COLS) {
  try { db.exec('ALTER TABLE review_records ADD COLUMN ' + name + ' ' + type); } catch (e) { /* 已存在 */ }
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** 生成 id：r_YYYYMMDD_NNN（当天第几条） */
function nextId(dateStr) {
  /* V1.8 修正：原来用"当天记录条数+1"，删除记录后会和已存在的 id 撞车（UNIQUE 冲突）。
     改成取当天后缀最大值 +1，删了也不会重复。 */
  const compact = String(dateStr).replace(/-/g, '');
  const row = db.prepare("SELECT MAX(CAST(substr(id, -3) AS INTEGER)) AS m FROM review_records WHERE date = ?").get(dateStr);
  const n = Number(row && row.m ? row.m : 0) + 1;
  return 'r_' + compact + '_' + String(n).padStart(3, '0');
}

function insert(rec) {
  const date = rec.date || today();
  const row = {
    id: rec.id || nextId(date),
    date: date,
    created_at: new Date().toISOString(),
    progress_status: (rec.progress && rec.progress.status) || null,
    progress_score: (rec.progress && typeof rec.progress.score === 'number') ? rec.progress.score : null,
    is_public: rec.public ? 1 : 0,
    published_at: rec.public ? new Date().toISOString() : null,
    payload: JSON.stringify(rec)
  };
  db.prepare(`INSERT INTO review_records
      (id, date, created_at, progress_status, progress_score, is_public, published_at, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.id, row.date, row.created_at, row.progress_status, row.progress_score, row.is_public, row.published_at, row.payload);
  return Object.assign({}, JSON.parse(row.payload), {
    id: row.id, date: row.date, created_at: row.created_at,
    public: row.is_public === 1, published_at: row.published_at
  });
}

function listByDate(date) {
  return db.prepare('SELECT payload FROM review_records WHERE date = ? ORDER BY created_at DESC').all(date)
    .map(function (r) { return JSON.parse(r.payload); });
}
function listRecent(limit) {
  return db.prepare('SELECT payload FROM review_records ORDER BY created_at DESC LIMIT ?').all(limit || 10)
    .map(function (r) { return JSON.parse(r.payload); });
}

/* ---- 展示墙（§2.5）：只返回用户明确同意公开的记录 ---- */
function listPublic(limit) {
  return db.prepare(`SELECT payload, published_at FROM review_records
      WHERE is_public = 1 ORDER BY published_at DESC LIMIT ?`).all(limit || 24)
    .map(function (r) { const p = JSON.parse(r.payload); p.published_at = r.published_at; return p; });
}
function setPublic(id, on) {
  const row = db.prepare('SELECT payload FROM review_records WHERE id = ?').get(id);
  if (!row) return null;
  const p = JSON.parse(row.payload);
  p.public = !!on;
  const at = on ? new Date().toISOString() : null;
  db.prepare('UPDATE review_records SET is_public = ?, published_at = ?, payload = ? WHERE id = ?')
    .run(on ? 1 : 0, at, JSON.stringify(p), id);
  p.published_at = at;
  return p;
}

/* ---- 展示墙互动：点赞 + 评论（V1.7 新增） ---- */
db.exec(`
  CREATE TABLE IF NOT EXISTS wall_likes (
    record_id  TEXT NOT NULL,
    visitor    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (record_id, visitor)
  );
  CREATE TABLE IF NOT EXISTS wall_comments (
    cid        INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id  TEXT NOT NULL,
    author     TEXT,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

function __stats(table){
  const rows = db.prepare('SELECT record_id, COUNT(*) AS c FROM ' + table + ' GROUP BY record_id').all();
  const m = {}; rows.forEach(function(r){ m[r.record_id] = Number(r.c); });
  return m;
}

/** 覆盖上面的 listPublic：附带点赞数与评论数 */
function listPublic(limit){
  const rows = db.prepare('SELECT id, payload, published_at FROM review_records WHERE is_public = 1 ORDER BY published_at DESC LIMIT ?').all(limit || 30);
  const L = __stats('wall_likes'), C = __stats('wall_comments');
  return rows.map(function(r){
    const p = JSON.parse(r.payload);
    p.published_at = r.published_at;
    p.likes = L[r.id] || 0;
    p.comments = C[r.id] || 0;
    return p;
  });
}

/** 切换点赞（同一访问者只算一次） */
function toggleLike(id, visitor){
  const v = String(visitor || 'anonymous');
  const has = db.prepare('SELECT 1 FROM wall_likes WHERE record_id = ? AND visitor = ?').get(id, v);
  if(has){ db.prepare('DELETE FROM wall_likes WHERE record_id = ? AND visitor = ?').run(id, v); }
  else { db.prepare('INSERT INTO wall_likes (record_id, visitor, created_at) VALUES (?, ?, ?)').run(id, v, new Date().toISOString()); }
  const c = db.prepare('SELECT COUNT(*) AS c FROM wall_likes WHERE record_id = ?').get(id);
  return { liked: !has, likes: Number(c.c) };
}
function listComments(id){
  return db.prepare('SELECT cid, author, text, created_at FROM wall_comments WHERE record_id = ? ORDER BY cid ASC').all(id)
    .map(function(r){ return { cid: Number(r.cid), author: r.author, text: r.text, created_at: r.created_at }; });
}
function addComment(id, author, text){
  const t = String(text || '').trim().slice(0, 300);
  if(!t) return null;
  const a = String(author || '匿名同学').trim().slice(0, 20) || '匿名同学';
  const at = new Date().toISOString();
  const info = db.prepare('INSERT INTO wall_comments (record_id, author, text, created_at) VALUES (?, ?, ?, ?)').run(id, a, t, at);
  return { cid: Number(info.lastInsertRowid), author: a, text: t, created_at: at };
}

/* ---- 示例卡片灌入（演示用，带 demo:true 标记） ---- */
const SEED = [
  { d:0,  goal:'把产品文档写完', plan:'上午写大纲，下午填内容', actual:'上午写完大纲，下午把内容补齐了', a:'yes',     st:'advance',  sc:92, sum:'不仅按计划完成，还多写了两节，进度超前。', ti:'明天先把图表补上，再通读一遍', tags:['写作','产品'] },
  { d:1,  goal:'这周把方案初稿写完', plan:'上午写框架，下午补内容', actual:'上午被打断三次只写完框架，晚上加两小时补齐', a:'partial', st:'partial', sc:66, sum:'计划与实际有缺口，靠加班补回来了。', ti:'上午 9:00-10:30 手机静音，只写第三章', tags:['工作','写作'] },
  { d:2,  goal:'每天刷 30 分钟英语', plan:'早饭后背 20 个单词', actual:'背了 20 个，还听了 10 分钟播客', a:'yes',     st:'on_track', sc:80, sum:'按计划达成，多听了一段播客。', ti:'明天把这 20 个词用在两句造句里', tags:['学习','英语'] },
  { d:3,  goal:'把跑步练起来', plan:'下班后跑 3 公里', actual:'加班到九点，没跑，回家就躺下了', a:'no',      st:'stalled', sc:16, sum:'今天没有推进，任务被加班吃掉了。', ti:'明天把跑鞋放到门口，只跑 1 公里就算完成', tags:['运动','时间管理'] },
  { d:4,  goal:'把简历更新完', plan:'晚上改两段经历', actual:'改了开头的经历，但一直在调格式，正文没动', a:'partial', st:'off_track', sc:34, sum:'做的事和目标关系不大，时间花在排版上。', ti:'明天先写正文两段，格式最后再调', tags:['求职','写作'] },
  { d:5,  goal:'把周报模板搭好', plan:'整理本周数据，写一版模板', actual:'数据整理完，模板写了一半', a:'partial', st:'partial', sc:58, sum:'数据部分完成，模板还差一半。', ti:'明天花 25 分钟把模板剩下的表格补完', tags:['工作','效率'] },
  { d:6,  goal:'把客厅收拾出来', plan:'周末大扫除', actual:'清了书桌和衣柜，地板拖了', a:'yes',     st:'on_track', sc:78, sum:'按计划达成，两处主要区域都清完了。', ti:'明天把阳台的箱子分类，只处理 5 个', tags:['生活','整理'] },
  { d:7,  goal:'这个月读完一本书', plan:'睡前读 20 页', actual:'读了 35 页，超了 15 页', a:'yes',     st:'advance', sc:90, sum:'超额完成，说明睡前这块时间比想象中松。', ti:'明天把书放到床头，睡前先读再刷手机', tags:['阅读','习惯'] },
  { d:8,  goal:'把日报坚持下来', plan:'下班前 10 分钟写日报', actual:'开了个长会，忘了写', a:'no',      st:'stalled', sc:18, sum:'今天没有推进，复盘这件事本身被挤掉了。', ti:'明天把日报提醒设成 17:50 的闹钟', tags:['工作','习惯'] },
  { d:9,  goal:'把三份简历投出去', plan:'筛选岗位并投递', actual:'筛了 5 个岗位，投了 3 家', a:'yes',     st:'on_track', sc:82, sum:'按计划达成，投递量正好。', ti:'明天跟进已投的三家，只做一件事：发一条询问消息', tags:['求职','行动'] }
];

/** 只取"某个访客自己"的公开卡片（V1.8：展示墙仅展示本人卡片，社区功能列入发展前景） */
function listPublicByOwner(owner, limit){
  const rows = db.prepare('SELECT id, payload, published_at FROM review_records WHERE is_public = 1 ORDER BY published_at DESC LIMIT ?').all(200);
  return rows.map(function(r){
    const p = JSON.parse(r.payload);
    p.published_at = r.published_at;
    p.likes = 0; p.comments = 0; p.reports = 0;
    p.owner = p.owner || null; p.owner_name = p.owner_name || null;
    return p;
  }).filter(function(p){ return !owner || p.owner === owner; }).slice(0, limit || 60);
}

function seedWall(owner, ownerName){
  const existing = db.prepare("SELECT COUNT(*) AS c FROM review_records WHERE payload LIKE '%\"demo\":true%'").get();
  if(Number(existing.c) >= SEED.length) return { inserted: 0, total: Number(existing.c), note: '示例卡片已存在，跳过' };
  let n = 0;
  SEED.forEach(function(item){
    const dt = new Date(); dt.setDate(dt.getDate() - item.d);
    const date = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
    const id = nextId(date);
    const rec = {
      id: id, date: date, created_at: new Date().toISOString(),
      progress: { status: item.st, label: ({ advance:'超额达成', on_track:'按计划达成', partial:'部分完成', off_track:'偏离目标', stalled:'未推进' })[item.st], score: item.sc, reason: '示例数据' },
      summary: item.sum,
      key_insight: '示例卡片：用来把展示墙填满，方便看效果。',
      keep: ['示例：保持项'], improve: ['示例：优化项'],
      tomorrow_focus: item.ti,
      tags: item.tags,
      answers: { goal_short: item.goal, plan: item.plan, actual: item.actual, alignment: item.a },
      quote: null, public: true, published_at: new Date().toISOString(),
      owner: owner || null, owner_name: ownerName || '我自己（示例）',
      demo: true, user_edited: false, edit_history: []
    };
    db.prepare(`INSERT INTO review_records (id, date, created_at, progress_status, progress_score, is_public, published_at, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, date, rec.created_at, item.st, item.sc, 1, rec.published_at, JSON.stringify(rec));
    n++;
  });
  return { inserted: n, note: '已灌入示例卡片（带 demo 标记，可在展示墙上一键清空）' };
}
function clearSeed(){
  const rows = db.prepare("SELECT id FROM review_records WHERE payload LIKE '%\"demo\":true%'").all();
  rows.forEach(function(r){
    db.prepare('DELETE FROM wall_likes WHERE record_id = ?').run(r.id);
    db.prepare('DELETE FROM wall_comments WHERE record_id = ?').run(r.id);
    db.prepare('DELETE FROM review_records WHERE id = ?').run(r.id);
  });
  return { removed: rows.length };
}

/* ================================================================
   社区化（V1.7 · 陌生网友互看）：
   ① 记录归属 owner（谁发的）② 举报 → 累计 3 次自动下墙 ③ 评论限流
   ================================================================ */
db.exec(`
  CREATE TABLE IF NOT EXISTS wall_reports (
    record_id  TEXT NOT NULL,
    visitor    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (record_id, visitor)
  );
`);
const REPORT_HIDE_THRESHOLD = 3;   /* 被 3 个不同访客举报 → 自动下墙 */

/** 举报：同一访客只算一次；达到阈值自动把卡片从展示墙撤下 */
function reportWall(id, visitor){
  const v = String(visitor || 'anonymous').slice(0, 40);
  const has = db.prepare('SELECT 1 FROM wall_reports WHERE record_id = ? AND visitor = ?').get(id, v);
  if(!has) db.prepare('INSERT INTO wall_reports (record_id, visitor, created_at) VALUES (?, ?, ?)').run(id, v, new Date().toISOString());
  const c = db.prepare('SELECT COUNT(*) AS c FROM wall_reports WHERE record_id = ?').get(id);
  const reports = Number(c.c);
  let hidden = false;
  if(reports >= REPORT_HIDE_THRESHOLD){ setPublic(id, false); hidden = true; }
  return { reported: true, reports: reports, hidden: hidden, threshold: REPORT_HIDE_THRESHOLD };
}

/** 覆盖 listPublic：带上归属、举报数与"我的"判断所需信息 */
function listPublic(limit){
  const rows = db.prepare('SELECT id, payload, published_at FROM review_records WHERE is_public = 1 ORDER BY published_at DESC LIMIT ?').all(limit || 60);
  const L = __stats('wall_likes'), C = __stats('wall_comments'), R = __stats('wall_reports');
  return rows.map(function(r){
    const p = JSON.parse(r.payload);
    p.published_at = r.published_at;
    p.likes = L[r.id] || 0;
    p.comments = C[r.id] || 0;
    p.reports = R[r.id] || 0;
    p.owner = p.owner || null;          /* 发布者标识（本地随机 id） */
    p.owner_name = p.owner_name || null;/* 发布者昵称 */
    return p;
  });
}

/** 取一条记录的归属信息（用于校验"只能撤下自己的"） */
function getOwner(id){
  const row = db.prepare('SELECT payload FROM review_records WHERE id = ?').get(id);
  if(!row) return null;
  const p = JSON.parse(row.payload);
  return { owner: p.owner || null, owner_name: p.owner_name || null, date: p.date };
}

/** 评价次数（用于简单限流）：某访客最近 60 秒评论了几条 */
function recentCommentCount(visitor, seconds){
  const since = new Date(Date.now() - (seconds || 60) * 1000).toISOString();
  const rows = db.prepare('SELECT text FROM wall_comments WHERE created_at >= ?').all(since);
  return rows.length;   /* 单机演示：全局窗口即可，够用且简单 */
}

/** 删除一条记录（连同它的点赞/评论/举报） */
function deleteRecord(id){
  const row = db.prepare('SELECT id FROM review_records WHERE id = ?').get(id);
  if(!row) return null;
  db.prepare('DELETE FROM wall_likes WHERE record_id = ?').run(id);
  db.prepare('DELETE FROM wall_comments WHERE record_id = ?').run(id);
  db.prepare('DELETE FROM wall_reports WHERE record_id = ?').run(id);
  db.prepare('DELETE FROM review_records WHERE id = ?').run(id);
  return { id: id };
}

module.exports = { db, insert, listByDate, listRecent, listPublic, listPublicByOwner, setPublic, nextId, today, DB_FILE,
                   toggleLike, listComments, addComment, seedWall, clearSeed, deleteRecord,
                   reportWall, getOwner, recentCommentCount, REPORT_HIDE_THRESHOLD };