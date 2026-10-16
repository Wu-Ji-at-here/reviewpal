/**
 * 复盘通 ReviewPal · 后端（零依赖）
 * 定位：**目标复盘打卡工具**。不做任何心理判断、不做情绪疏导、不做危机干预。
 * 对应文档：§5 技术架构 · §11 字段映射 · §2.5 展示墙
 *
 * 接口：
 *   GET  /api/config            当前模式 / 模型 / Key 掩码 / 接口地址
 *   POST /api/config/key        写入 Key（只存后端 .env，前端只拿掩码）
 *   DEL  /api/config/key        清除 Key，切回 Mock
 *   POST /api/config/mock       只切模式
 *   POST /api/model/selftest    让 AI 跑一条真实记录（分诊→模型→校验）
 *   POST /api/review/generate   { answers } 五问 → 结构化草稿（不入库）
 *   POST /api/review/commit     人工确认后入库
 *   GET  /api/records?date=     按日期查回
 *   GET  /api/wall              展示墙：**只返回用户同意公开的记录**
 *   POST /api/wall/publish      { id, on } 发布 / 撤下
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { inferProgress } = require('./classify');
const { validate } = require('./schema');
const store = require('./db');

/* ---------- .env ---------- */
function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const PORT = Number(process.env.PORT || 8787);
let MOCK = process.env.MOCK !== '0';
let MODEL_ID = process.env.MODEL_ID || 'deepseek-v4-flash';
let API_KEY = process.env.DEEPSEEK_API_KEY || '';
let BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const ENV_PATH = path.join(__dirname, '..', '.env');
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'prompts', 'system-v1.md'), 'utf8');
const WEB_DIR = path.join(__dirname, '..', 'web');

function maskKey(k){ return k ? (k.slice(0, 3) + '••••••' + k.slice(-4)) : null; }
function writeEnv(updates){
  let lines = [];
  if (fs.existsSync(ENV_PATH)) lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  const keys = Object.keys(updates), seen = {};
  const out = lines.map(function(l){
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m && keys.indexOf(m[1]) >= 0){ seen[m[1]] = true; return m[1] + '=' + updates[m[1]]; }
    return l;
  });
  keys.forEach(function(k){ if(!seen[k]) out.push(k + '=' + updates[k]); });
  fs.writeFileSync(ENV_PATH, out.join('\r\n'), 'utf8');
}
function configSnapshot(){
  return { mock: MOCK, model: MOCK ? null : MODEL_ID, hasKey: Boolean(API_KEY), keyMask: maskKey(API_KEY), baseUrl: BASE_URL, port: PORT };
}

const today = store.today;

/** 剥代码围栏 → 解析 JSON */
function safeParse(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

/* ---------- 五问 → 给模型看的用户消息 ---------- */
function buildUserPrompt(a) {
  const L = [];
  L.push('以下是用户今天的复盘五问作答：');
  L.push('1) 我的目标（长期）：' + (a.goal_long || '（未填）'));
  L.push('   我的目标（短期）：' + (a.goal_short || '（未填）'));
  L.push('2) 今天原本的计划：' + (a.plan || '（未填）'));
  L.push('3) 今天实际做了什么：' + (a.actual || '（未填）'));
  L.push('   今天的行为是否有助于目标实现：' + ({ yes: '有助于', partial: '部分有助于', no: '无助于' }[a.alignment] || '未选择'));
  L.push('4) 做得比较好、可以保持的：' + (a.keep || '（未填）'));
  L.push('   做得不够好、需要优化的：' + (a.improve || '（未填）'));
  L.push('5) 明天的任务和计划：' + (a.tomorrow || '（未填）'));
  return L.join('\n');
}

/* ---------- Mock 草稿（无 Key 时保证动线可跑） ---------- */
function splitList(s, fallback) {
  const arr = String(s || '').split(/[，,、;；\n]/).map(function(x){ return x.trim(); }).filter(Boolean).slice(0, 3);
  return arr.length ? arr : fallback;
}
function mockDraft(a, prog) {
  const actual = String(a.actual || '').trim();
  const goal = String(a.goal_short || a.goal_long || '既定目标').trim();
  const insight = {
    advance:  '今天不只是完成任务，还超出了原计划——说明你的排期偏保守，明天可以把量再上调一点。',
    on_track: '计划与实际基本对齐，这是你当前能稳定复制的节奏，先别急着加量。',
    partial:  '计划量和实际产出之间有缺口。明天试着把计划砍掉一半，先保证"完成"这件事本身。',
    off_track:'今天做的事和目标关系不大。明天开工前先花 2 分钟，把目标拆成一件具体的事。',
    stalled:  '今天没有推进。不用纠结原因，明天只做一件事：把最小的那一步写下来，然后做完它。'
  }[prog.status];
  return {
    summary: '今天围绕「' + goal + '」推进：' + (actual ? actual.slice(0, 40) : '暂无填写') + '。',
    key_insight: insight,
    keep: splitList(a.keep, ['按计划开工（哪怕只做了一小段）', '把任务写下来再动手']),
    improve: splitList(a.improve, ['计划留白太多，被打断后收不回来', '收尾前 5 分钟不做新事，只做记录']),
    tomorrow_focus: String(a.tomorrow || '').trim() || '明天第一件事：把最重要的任务拆成 25 分钟能做完的一步，先做完它。',
    tags: ['复盘', '目标'],
    progress: prog
  };
}

/* ---------- 真实模型调用 ---------- */
async function callModelRaw(userPrompt, prog) {
  if (!API_KEY) {
    const err = new Error('尚未配置 API Key：请在页面右上角「模型设置」里填入');
    err.code = 'NO_KEY';
    throw err;
  }
  const body = {
    model: MODEL_ID,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n【本地推断的推进度】' + prog.status + '（' + prog.label + '）请以此为参考，若不认同可在输出中修正 progress.status。' },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6
  };
  const res = await fetch(BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API_KEY },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('模型接口返回 ' + res.status + '：' + t.slice(0, 300));
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return { raw: String(content || ''), parsed: safeParse(content), usage: data.usage || null };
}

/* ---------- 业务：五问 → 草稿 ---------- */
async function generate(answers) {
  const prog = inferProgress(answers);
  let draft, mode;

  if (MOCK) { mode = 'mock'; draft = mockDraft(answers, prog); }
  else {
    mode = 'model';
    try { draft = await callModelRaw(buildUserPrompt(answers), prog).then(function(r){ return r.parsed; }); }
    catch (e) {
      if (e.code === 'NO_KEY') return { ok: false, mode: 'model', error: e.message, hint: '把 .env 的 MOCK 保持为 1 即可先用 Mock 跑通' };
      try { draft = await callModelRaw(buildUserPrompt(answers), prog).then(function(r){ return r.parsed; }); }
      catch (e2) { const _c = (e2 && e2.cause) ? ('（' + (e2.cause.code || e2.cause.message || String(e2.cause)) + '）') : ''; return { ok: false, mode: 'model', error: '两次调用都失败：' + e2.message + _c, hint: '若出现 fetch failed，通常是本机无外网 / DNS 不通；可先用 Mock 演示' }; }
    }
  }

  const merged = Object.assign({ progress: prog }, draft);
  if (!merged.progress || !merged.progress.status) merged.progress = prog;

  const validation = validate(merged, 'ai');
  if (!validation.ok) {
    const fb = mockDraft(answers, prog);
    return { ok: true, mode: mode + '+fallback', progress: prog, draft: fb,
             validation: validate(Object.assign({ progress: prog }, fb), 'ai'),
             note: '模型输出未通过契约校验，已改用兜底模板：' + validation.errors.join('；') };
  }
  return { ok: true, mode: mode, progress: merged.progress, draft: merged, validation: validation };
}
/* ---------------- HTTP 工具 ---------------- */
function send(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
  });
  res.end(body);
}
function readBody(req) {
  return new Promise(function (resolve) {
    let s = '';
    req.on('data', function (c) { s += c; if (s.length > 2e6) req.destroy(); });
    req.on('end', function () { try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); } });
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.join(WEB_DIR, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 未找到：' + urlPath);
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

/* ---------------- 路由 ---------------- */
const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const p = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' });
    return res.end();
  }

  try {
    if (p === '/api/config') return send(res, 200, configSnapshot());
    if (p === '/api/health') {
      return send(res, 200, { ok: true, mock: MOCK, modelId: MODEL_ID, hasKey: Boolean(API_KEY), db: store.DB_FILE, time: new Date().toISOString() });
    }

    /* ---- 模型设置 ---- */
    if (p === '/api/config/key' && req.method === 'POST') {
      const body = await readBody(req);
      const k = String(body.key || '').trim();
      if (!/^sk-[A-Za-z0-9_\-]{6,}$/.test(k)) return send(res, 400, { ok: false, error: 'Key 格式看起来不对（应以 sk- 开头）' });
      API_KEY = k;
      MODEL_ID = String(body.model || '').trim() || MODEL_ID;
      if (String(body.baseUrl || '').trim()) BASE_URL = String(body.baseUrl).trim().replace(/\/+$/, '');
      MOCK = false;
      writeEnv({ DEEPSEEK_API_KEY: k, MODEL_ID: MODEL_ID, MOCK: '0' });
      return send(res, 200, Object.assign({ ok: true }, configSnapshot(), { note: '已写入后端 .env 并切换为真实模型（Key 不会回传前端）' }));
    }
    if (p === '/api/config/key' && req.method === 'DELETE') {
      API_KEY = ''; MOCK = true;
      writeEnv({ DEEPSEEK_API_KEY: '', MOCK: '1' });
      return send(res, 200, Object.assign({ ok: true }, configSnapshot(), { note: '已清除 Key 并切回 Mock 模式' }));
    }
    if (p === '/api/config/mock' && req.method === 'POST') {
      const body = await readBody(req);
      MOCK = !!body.mock;
      writeEnv({ MOCK: MOCK ? '1' : '0' });
      return send(res, 200, Object.assign({ ok: true }, configSnapshot()));
    }

    /* ---- 让 AI 跑一条真实记录自测 ---- */
    if (p === '/api/model/selftest' && req.method === 'POST') {
      const body = await readBody(req);
      const answers = body.answers || {
        goal_short: '把方案初稿写完',
        plan: '上午写方案框架，下午补内容和图表',
        actual: '上午被打断三次，只写完框架；晚上加了两小时把内容补齐了',
        alignment: 'partial',
        keep: '被打断后还能回到任务上',
        improve: '没有给方案留出整块时间',
        tomorrow: '上午先写最难的第三章，手机静音 90 分钟'
      };
      const prog = inferProgress(answers);
      if (!API_KEY) return send(res, 200, { ok: false, needKey: true, error: '尚未配置 API Key：请在页面右上角「模型设置」里填入', progress: prog });
      const t0 = Date.now();
      try {
        const r = await callModelRaw(buildUserPrompt(answers), prog);
        const merged = Object.assign({ progress: prog }, r.parsed);
        return send(res, 200, {
          ok: true, model: MODEL_ID, baseUrl: BASE_URL, latencyMs: Date.now() - t0,
          progress: merged.progress, parsed: merged, validation: validate(merged, 'ai'),
          usage: r.usage, rawPreview: r.raw.slice(0, 500)
        });
      } catch (e) {
        return send(res, 200, { ok: false, error: String(e.message || e), latencyMs: Date.now() - t0 });
      }
    }

    /* ---- 五问 → 草稿 ---- */
    if (p === '/api/review/generate' && req.method === 'POST') {
      const body = await readBody(req);
      const answers = body.answers || {};
      const filled = ['goal_short','goal_long','plan','actual','tomorrow'].filter(function(k){ return String(answers[k] || '').trim(); });
      if (!filled.length) return send(res, 400, { ok: false, error: '至少填写一项（建议填第 3 问"今天实际做了什么"）' });
      const out = await generate(answers);
      return send(res, out.ok ? 200 : 500, out);
    }

    /* ---- 人工确认后入库 ---- */
    if (p === '/api/review/commit' && req.method === 'POST') {
      const body = await readBody(req);
      const draft = body.draft || {};
      const date = body.date || today();
      const rec = Object.assign({}, draft, {
        date: date,
        answers: body.answers || {},
        quote: (body.draft && typeof body.draft.quote === 'string' && body.draft.quote.trim()) ? body.draft.quote.trim().slice(0, 160) : null,  /* 鸡汤：前端「今日一句」随机句 */
        user_raw_input: String(body.answers && body.answers.actual || ''),
        user_edited: (body.edit_history || []).length > 0,
        edit_history: body.edit_history || [],
        public: false,
        owner: String(body.visitor || '').trim() || null,
        owner_name: String(body.owner_name || '').trim().slice(0, 20) || null
      });
      if (!rec.id) rec.id = store.nextId(date);
      const v = validate(rec);
      if (!v.ok) return send(res, 400, { ok: false, error: '入库前校验未通过', errors: v.errors });
      return send(res, 200, { ok: true, record: store.insert(rec) });
    }

    /* ---- 记录 ---- */
    /* ---- 示例卡片：把展示墙填满（演示用，带 demo 标记） ---- */
    if (p === '/api/wall/seed' && req.method === 'POST') {
      const body = await readBody(req);
      return send(res, 200, Object.assign({ ok: true }, store.seedWall(body.visitor, body.owner_name)));
    }
    if (p === '/api/wall/seed' && req.method === 'DELETE') {
      return send(res, 200, Object.assign({ ok: true }, store.clearSeed()));
    }

    if (p === '/api/records') {
      const date = url.searchParams.get('date');
      return send(res, 200, { ok: true, date: date || null, records: date ? store.listByDate(date) : store.listRecent(Math.min(200, Number(url.searchParams.get('limit')) || 62)) });
    }

    /* ---- 展示墙：只返回用户同意公开的记录 ---- */
    /* ---- 展示墙（V1.8：只展示"本人"的卡片；陌生网友社区列入发展前景） ---- */
    if (p === '/api/wall') {
      const mine = url.searchParams.get('mine');
      if (!mine) return send(res, 200, { ok: true, records: [], note: '本期展示墙仅展示本人卡片（需带 mine 参数）' });
      return send(res, 200, { ok: true, records: store.listPublicByOwner(mine, 60), note: '仅展示本人的卡片；陌生网友社区列入发展前景' });
    }
    if (p === '/api/wall/publish' && req.method === 'POST') {
      const body = await readBody(req);
      const id = String(body.id || '').trim();
      if (!id) return send(res, 400, { ok: false, error: '缺少 id' });
      const own = store.getOwner(id);
      const visitor = String(body.visitor || '').trim();
      if (own && own.owner && visitor && own.owner !== visitor) {
        return send(res, 403, { ok: false, error: '只能撤下自己发布的卡片（这张属于 ' + (own.owner_name || '其他访客') + '）' });
      }
      const rec = store.setPublic(id, body.on !== false);
      if (!rec) return send(res, 404, { ok: false, error: '没有这条记录：' + id });
      return send(res, 200, { ok: true, record: rec, note: body.on !== false ? '已发布到展示墙' : '已从展示墙撤下' });
    }

    /* ---- 删除记录（打卡墙卡片上的「删除」） ---- */
    if (p === '/api/records/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const id = String(body.id || '').trim();
      if (!id) return send(res, 400, { ok: false, error: '缺少 id' });
      const own = store.getOwner(id);
      const visitor = String(body.visitor || '').trim();
      if (own && own.owner && visitor && own.owner !== visitor) {
        return send(res, 403, { ok: false, error: '只能删除自己的记录' });
      }
      const del = store.deleteRecord(id);
      if (!del) return send(res, 404, { ok: false, error: '没有这条记录：' + id });
      return send(res, 200, { ok: true, deleted: id, note: '已删除' });
    }

    return serveStatic(req, res, p);
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e && e.message || e) });
  }
});

server.listen(PORT, function () {
  console.log('====================================================');
  console.log(' 复盘通后端已启动（目标复盘打卡工具，无心理相关功能）');
  console.log(' 地址：http://localhost:' + PORT);
  console.log(' 模式：' + (MOCK ? 'Mock（未调用真实模型）' : '真实模型 ' + MODEL_ID + (API_KEY ? '' : ' ⚠ 但缺少 API Key')));
  console.log(' 数据库：' + store.DB_FILE);
  console.log('====================================================');
});