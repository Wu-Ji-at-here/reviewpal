/* ============================================================
   复盘通 ReviewPal · App 本地优先层（local.js）
   - 在 Capacitor 原生 App 内：把 fetch('/api/*') 就地用
     手机本地库（IndexedDB）应答，完全不依赖电脑后端；
     只有「调用大模型」时才联网（走原生 HTTP，绕过跨域）。
   - 在网页版里自动不生效（platform=web），保持原样走后端 /api。
   ============================================================ */
(function () {
  var Cap = window.Capacitor || {};
  var platform = Cap.getPlatform ? Cap.getPlatform() : (Cap.platform || 'web');
  if (platform !== 'android' && platform !== 'ios') { try { console.log('[ReviewPal] 网页模式：local.js 不生效，走后端 /api'); } catch (e) {} return; }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  try { window.confirm = function () { return true; }; } catch (e) {}
  var DB_NAME = 'reviewpal', DB_VER = 1, STORE = 'records', DEFAULT_BASE = 'https://api.deepseek.com';
  var LS = {
    get: function (k, d) { try { var x = localStorage.getItem('reviewpal.' + k); return x == null ? d : x; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('reviewpal.' + k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem('reviewpal.' + k); } catch (e) {} }
  };
  function cfg() { return { key: LS.get('key', ''), model: LS.get('model', '') || 'deepseek-v4-flash', baseUrl: (LS.get('baseUrl', '') || DEFAULT_BASE).replace(/\/+$/, '') }; }
  function secPlugin() { var P = window.Capacitor && window.Capacitor.Plugins; return (P && P.SecureStorage) || null; }
  async function secSet(k, v) { var S = secPlugin(); if (!S) return false; try { if (S.setItem) await S.setItem(k, String(v)); else if (S.set) await S.set(k, String(v)); return true; } catch (e) { return false; } }
  async function secGet(k) { var S = secPlugin(); if (!S) return null; try { var v = S.getItem ? await S.getItem(k) : (S.get ? await S.get(k) : null); return (v == null || v === '') ? null : String(v); } catch (e) { return null; } }
  async function secDel(k) { var S = secPlugin(); if (!S) return; try { if (S.removeItem) await S.removeItem(k); else if (S.remove) await S.remove(k); } catch (e) {} }  function maskKey(k) { return k ? (k.slice(0, 3) + '••••••' + k.slice(-4)) : null; }
  function snap() { var c = cfg(), hasKey = !!c.key; return { mock: !hasKey, model: hasKey ? c.model : null, hasKey: hasKey, keyMask: maskKey(c.key), baseUrl: c.baseUrl, port: null, local: true }; }

  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open(DB_NAME, DB_VER); r.onupgradeneeded = function () { var db = r.result; if (!db.objectStoreNames.contains(STORE)) { var s = db.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('created_at', 'created_at'); } }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function dbAll() { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(STORE, 'readonly').objectStore(STORE).getAll(); t.onsuccess = function () { res(t.result || []); }; t.onerror = function () { rej(t.error); }; }); }); }
  function dbPut(rec) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(rec); t.oncomplete = function () { res(rec); }; t.onerror = function () { rej(t.error); }; }); }); }
  function dbDel(id) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(id); t.oncomplete = function () { res(true); }; t.onerror = function () { rej(t.error); }; }); }); }

  function p2(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function nextId(all, date) { var c = date.replace(/-/g, ''), max = 0; all.forEach(function (r) { if (r.date === date && r.id && r.id.indexOf('r_' + c + '_') === 0) { var n = parseInt(r.id.slice(-3), 10); if (n > max) max = n; } }); return 'r_' + c + '_' + String(max + 1).padStart(3, '0'); }
  function listRecent(all, limit) { return all.slice().sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); }).slice(0, limit || 62); }

  var LEVELS = { advance: { label: '超额达成', score: 92 }, on_track: { label: '按计划达成', score: 78 }, partial: { label: '部分完成', score: 58 }, off_track: { label: '偏离目标', score: 34 }, stalled: { label: '未推进', score: 16 } };
  var STALLED = ['没做','没开始','摆了','拖延','忘了','没推进','荒废','啥也没','没动'], OFFTRACK = ['跑偏','偏离','做错','返工','白忙','不在计划','走错方向'], ADVANCE = ['超额','提前完成','超预期','连做','比计划多','一举','顺带做完'], PARTIAL = ['一半','部分完成','来不及','只做了','没做完','差一点','开了个头'], ONTRACK = ['完成','做完','搞定','按计划','达成','推进','打卡'];
  function hit(list, text) { return list.filter(function (w) { return text.indexOf(w) >= 0; }); }
  function inferProgress(a) { if (window.RP && window.RP.inferProgress) return window.RP.inferProgress(a); return _inferProgress(a); }
  function _inferProgress(a) {
    a = a || {};
    var text = [a.goal_long, a.goal_short, a.plan, a.actual, a.keep, a.improve, a.tomorrow].filter(Boolean).join(' ');
    var hs = hit(STALLED, text), ho = hit(OFFTRACK, text), ha = hit(ADVANCE, text), hp = hit(PARTIAL, text), hn = hit(ONTRACK, text);
    var status = 'on_track', reason = '按第 3 问的自评判定';
    if (a.alignment === 'no') { status = 'stalled'; reason = '第 3 问：今天的行为无助于目标实现'; }
    else if (a.alignment === 'partial') { status = 'partial'; reason = '第 3 问：部分助力目标'; }
    else if (a.alignment === 'yes') { status = ha.length ? 'advance' : 'on_track'; reason = ha.length ? '第 3 问：助力目标，且出现超额信号' : '第 3 问：助力目标'; }
    else { if (hs.length) { status = 'stalled'; reason = '命中停滞信号：' + hs.join('、'); } else if (ho.length) { status = 'off_track'; reason = '命中偏离信号：' + ho.join('、'); } else if (hp.length) { status = 'partial'; reason = '命中部分完成信号：' + hp.join('、'); } else if (ha.length) { status = 'advance'; reason = '命中超额信号：' + ha.join('、'); } else if (hn.length) { status = 'on_track'; reason = '命中完成信号：' + hn.join('、'); } else { status = 'partial'; reason = '信息不足，按"部分完成"处理'; } }
    var score = LEVELS[status].score;
    if (a.keep && String(a.keep).trim()) score += 4;
    if (a.tomorrow && String(a.tomorrow).trim()) score += 4;
    if (!a.actual || !String(a.actual).trim()) score -= 12;
    score = Math.max(0, Math.min(100, score));
    return { status: status, label: LEVELS[status].label, score: score, hit: hs.concat(ho, hp, ha, hn), reason: reason };
  }
  function splitList(s, fb) { var arr = String(s || '').split(/[，,、;；\n]/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 3); return arr.length ? arr : fb; }
  function mockDraft(a, prog) {
    var actual = String(a.actual || '').trim(), goal = String(a.goal_short || a.goal_long || '既定目标').trim();
    var insight = { advance: '今天不只是完成任务，还超出了原计划——说明你的排期偏保守，明天可以把量再上调一点。', on_track: '计划与实际基本对齐，这是你当前能稳定复制的节奏，先别急着加量。', partial: '计划量和实际产出之间有缺口。明天试着把计划砍掉一半，先保证"完成"这件事本身。', off_track: '今天做的事和目标关系不大。明天开工前先花 2 分钟，把目标拆成一件具体的事。', stalled: '今天没有推进。不用纠结原因，明天只做一件事：把最小的那一步写下来，然后做完它。' }[prog.status];
    return { summary: '今天围绕「' + goal + '」推进：' + (actual ? actual.slice(0, 40) : '暂无填写') + '。', key_insight: insight, keep: splitList(a.keep, ['按计划开工（哪怕只做了一小段）', '把任务写下来再动手']), improve: splitList(a.improve, ['计划留白太多，被打断后收不回来', '收尾前 5 分钟不做新事，只做记录']), tomorrow_focus: String(a.tomorrow || '').trim() || '明天第一件事：把最重要的任务拆成 25 分钟能做完的一步，先做完它。', tags: ['复盘', '目标'], progress: prog };
  }
  var AI_FIELDS = ['summary','key_insight','keep','improve','tomorrow_focus','tags','progress'], STORE_FIELDS = ['id','date'].concat(AI_FIELDS), PROG = ['advance','on_track','partial','off_track','stalled'];
  function validate(rec, stage) { if (window.RP && window.RP.validate) return window.RP.validate(rec, stage); return _validate(rec, stage); }
  function _validate(rec, stage) { var required = (stage === 'ai') ? AI_FIELDS : STORE_FIELDS, errors = []; required.forEach(function (k) { if (!(k in rec)) errors.push('缺少必填字段：' + k); }); if (rec.progress && PROG.indexOf(rec.progress.status) < 0) errors.push('progress.status 取值非法：' + rec.progress.status); return { ok: errors.length === 0, errors: errors }; }
  function safeParse(text) { var t = String(text || '').trim(); t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim(); var a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) t = t.slice(a, b + 1); return JSON.parse(t); }
  function buildUserPrompt(a) { var L = []; L.push('以下是用户今天的复盘五问作答：'); L.push('1) 我的目标（长期）：' + (a.goal_long || '（未填）')); L.push('   我的目标（短期）：' + (a.goal_short || '（未填）')); L.push('2) 今天原本的计划：' + (a.plan || '（未填）')); L.push('3) 今天实际做了什么：' + (a.actual || '（未填）')); L.push('   今天的行为是否有助于目标实现：' + ({ yes: '有助于', partial: '部分有助于', no: '无助于' }[a.alignment] || '未选择')); L.push('4) 做得比较好、可以保持的：' + (a.keep || '（未填）')); L.push('   做得不够好、需要优化的：' + (a.improve || '（未填）')); L.push('5) 明天的任务和计划：' + (a.tomorrow || '（未填）')); return L.join('\n'); }

  var _sys = null;
  async function systemPrompt() { if (_sys) return _sys; try { var r = await realFetch('prompts/system-v1.md'); _sys = r.ok ? await r.text() : ''; } catch (e) { _sys = ''; } if (!_sys) _sys = '你是一位清晰、务实、不说空话的复盘教练。只输出严格 JSON。'; return _sys; }
  async function modelPost(url, headers, obj) {
    var CH = (window.Capacitor && ((window.Capacitor.Plugins || {}).CapacitorHttp || window.Capacitor.CapacitorHttp)) || null;
    if (CH && CH.post) { var r = await CH.post({ url: url, headers: headers, data: obj, connectTimeout: 60000, readTimeout: 60000 }); return { status: r.status || 0, body: (typeof r.data === 'string') ? r.data : JSON.stringify(r.data) }; }
    var res = await realFetch(url, { method: 'POST', headers: headers, body: JSON.stringify(obj) }); return { status: res.status, body: await res.text() };
  }
  async function callModelRaw(userPrompt, prog) {
    var c = cfg(); if (!c.key) { var e = new Error('尚未配置 API Key：请点右上角「⚙ 模型设置」填入'); e.code = 'NO_KEY'; throw e; }
    var sys = (await systemPrompt()) + '\n\n【本地推断的推进度】' + prog.status + '（' + prog.label + '）请以此为参考，若不认同可在输出中修正 progress.status。';
    var body = { model: c.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: userPrompt }], response_format: { type: 'json_object' }, temperature: 0.6 };
    var resp = await modelPost(c.baseUrl + '/chat/completions', { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.key }, body);
    if (resp.status < 200 || resp.status >= 300) throw new Error('模型接口返回 ' + resp.status + '：' + String(resp.body || '').slice(0, 300));
    var data; try { data = JSON.parse(resp.body); } catch (e2) { throw new Error('模型返回不是合法 JSON'); }
    var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return { raw: String(content || ''), parsed: safeParse(content), usage: data.usage || null };
  }
  async function generate(answers) {
    var prog = inferProgress(answers), draft, mode;
    if (!cfg().key) { mode = 'mock'; draft = mockDraft(answers, prog); }
    else { mode = 'model'; try { draft = (await callModelRaw(buildUserPrompt(answers), prog)).parsed; } catch (e) { if (e.code === 'NO_KEY') return { ok: false, mode: 'model', error: e.message }; try { draft = (await callModelRaw(buildUserPrompt(answers), prog)).parsed; } catch (e2) { return { ok: false, mode: 'model', error: '两次调用都失败：' + e2.message, hint: '检查手机网络 / Key / 接口地址' }; } } }
    var merged = Object.assign({ progress: prog }, draft); if (!merged.progress || !merged.progress.status) merged.progress = prog;
    var v = validate(merged, 'ai');
    if (!v.ok) { var fb = mockDraft(answers, prog); return { ok: true, mode: mode + '+fallback', progress: prog, draft: fb, validation: validate(Object.assign({ progress: prog }, fb), 'ai'), note: '模型输出未通过契约校验，已改用兜底模板：' + v.errors.join('；') }; }
    return { ok: true, mode: mode, progress: merged.progress, draft: merged, validation: v };
  }
  async function commit(body) {
    var draft = body.draft || {}, date = body.date || today(), all = await dbAll();
    var rec = Object.assign({}, draft, { id: draft.id || nextId(all, date), date: date, created_at: new Date().toISOString(), answers: body.answers || {}, quote: (draft.quote && String(draft.quote).trim()) ? String(draft.quote).trim().slice(0, 160) : null, user_raw_input: String((body.answers || {}).actual || ''), user_edited: (body.edit_history || []).length > 0, edit_history: body.edit_history || [], public: false, owner: String(body.visitor || '').trim() || null, owner_name: String(body.owner_name || '').trim().slice(0, 20) || null });
    var v = validate(rec); if (!v.ok) return { status: 400, obj: { ok: false, error: '入库前校验未通过', errors: v.errors } };
    await dbPut(rec); return { status: 200, obj: { ok: true, record: rec } };
  }
  async function seedWall(visitor, ownerName) {
    var demos = [['advance', 94, '超额把方案写完，还顺手补了图表'], ['on_track', 80, '按计划写完方案框架'], ['partial', 58, '只写完框架，内容留到明天'], ['off_track', 34, '临时被拉去开会，目标没动'], ['stalled', 16, '今天没有推进'], ['on_track', 79, '按计划跑完 5 公里'], ['partial', 55, '读了一半文档'], ['advance', 91, '提前完成本周复盘'], ['on_track', 82, '按计划写了两节'], ['partial', 60, '开了个头，被电话打断']];
    var now = Date.now(), n = 0;
    for (var i = 0; i < demos.length; i++) { var dt = new Date(now - (demos.length - 1 - i) * 86400000), ds = p2(dt.getMonth() + 1); var date = dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate()); var st = demos[i][0], sc = demos[i][1], txt = demos[i][2];
      await dbPut({ id: 'r_' + date.replace(/-/g, '') + '_' + String(i + 1).padStart(3, '0'), date: date, created_at: dt.toISOString(), summary: txt, key_insight: '示例数据：用于展示打卡墙与月热力图效果。', keep: ['按计划开工'], improve: ['给任务留整块时间'], tomorrow_focus: '明天第一件事：把最重要的任务拆成 25 分钟能做完的一步。', tags: ['示例'], progress: { status: st, label: LEVELS[st].label, score: sc, reason: '示例数据' }, quote: null, answers: {}, user_edited: false, edit_history: [], public: false, owner: visitor || null, owner_name: ownerName || null, demo: true }); n++;
    }
    return { inserted: n };
  }
  async function clearSeed() { var all = await dbAll(), n = 0; for (var i = 0; i < all.length; i++) { if (all[i].demo) { await dbDel(all[i].id); n++; } } return { removed: n }; }

  var SELFTEST_ANSWERS = { goal_short: '把方案初稿写完', plan: '上午写方案框架，下午补内容和图表', actual: '上午被打断三次，只写完框架；晚上加了两小时把内容补齐了', alignment: 'partial', keep: '被打断后还能回到任务上', improve: '没有给方案留出整块时间', tomorrow: '上午先写最难的第三章，手机静音 90 分钟' };

  async function route(pathname, method, search, body) {
    if (pathname === '/api/config') return { status: 200, obj: snap() };
    if (pathname === '/api/health') return { status: 200, obj: { ok: true, mock: !cfg().key, modelId: cfg().model, hasKey: !!cfg().key, db: '手机本地库 · IndexedDB（reviewpal）', local: true, time: new Date().toISOString() } };
    if (pathname === '/api/config/key' && method === 'POST') {
      var k = String((body || {}).key || '').trim();
      if (!/^sk-[A-Za-z0-9_\-]{6,}$/.test(k)) return { status: 400, obj: { ok: false, error: 'Key 格式看起来不对（应以 sk- 开头）' } };
      LS.set('key', k); await secSet('rp_key', k); var m = String((body || {}).model || '').trim(); if (m) LS.set('model', m); var b = String((body || {}).baseUrl || '').trim(); if (b) LS.set('baseUrl', b.replace(/\/+$/, ''));
      return { status: 200, obj: Object.assign({ ok: true }, snap(), { note: '已保存在本机（Key 只存这台设备，不会上传）' }) };
    }
    if (pathname === '/api/config/key' && method === 'DELETE') { LS.del('key'); await secDel('rp_key'); return { status: 200, obj: Object.assign({ ok: true }, snap(), { note: '已清除 Key，切回 Mock 模式' }) }; }
    if (pathname === '/api/config/mock' && method === 'POST') return { status: 200, obj: Object.assign({ ok: true }, snap()) };
    if (pathname === '/api/model/selftest' && method === 'POST') {
      var ans = (body || {}).answers || SELFTEST_ANSWERS, prog = inferProgress(ans);
      if (!cfg().key) return { status: 200, obj: { ok: false, needKey: true, error: '尚未配置 API Key：请点右上角「⚙ 模型设置」填入', progress: prog } };
      var t0 = Date.now();
      try { var r = await callModelRaw(buildUserPrompt(ans), prog), merged = Object.assign({ progress: prog }, r.parsed); return { status: 200, obj: { ok: true, model: cfg().model, baseUrl: cfg().baseUrl, latencyMs: Date.now() - t0, progress: merged.progress, parsed: merged, validation: validate(merged, 'ai'), usage: r.usage, rawPreview: String(r.raw || '').slice(0, 500) } }; }
      catch (e) { return { status: 200, obj: { ok: false, error: String(e.message || e), latencyMs: Date.now() - t0 } }; }
    }
    if (pathname === '/api/review/generate' && method === 'POST') {
      var answers = (body || {}).answers || {};
      var filled = ['goal_short','goal_long','plan','actual','tomorrow'].filter(function (k) { return String(answers[k] || '').trim(); });
      if (!filled.length) return { status: 400, obj: { ok: false, error: '至少填写一项（建议填第 3 问"今天实际做了什么"）' } };
      var out = await generate(answers); return { status: out.ok ? 200 : 500, obj: out };
    }
    if (pathname === '/api/review/commit' && method === 'POST') return await commit(body || {});
    if (pathname === '/api/records') { var all = await dbAll(); var mq = /limit=(\d+)/.exec(search || ''); return { status: 200, obj: { ok: true, date: null, records: listRecent(all, Math.min(200, mq ? Number(mq[1]) : 62)) } }; }
    if (pathname === '/api/wall') { var all2 = await dbAll(); return { status: 200, obj: { ok: true, records: listRecent(all2, 60), note: '本机数据' } }; }
    if (pathname === '/api/wall/publish' && method === 'POST') return { status: 200, obj: { ok: true, note: '本地版无需发布' } };
    if (pathname === '/api/records/delete' && method === 'POST') {
      var id = String((body || {}).id || '').trim(); if (!id) return { status: 400, obj: { ok: false, error: '缺少 id' } };
      var all3 = await dbAll(); if (!all3.some(function (r) { return r.id === id; })) return { status: 404, obj: { ok: false, error: '没有这条记录：' + id } };
      await dbDel(id); return { status: 200, obj: { ok: true, deleted: id, note: '已删除' } };
    }
    if (pathname === '/api/wall/seed' && method === 'POST') { var a1 = body || {}; return { status: 200, obj: Object.assign({ ok: true }, await seedWall(a1.visitor, a1.owner_name)) }; }
    if (pathname === '/api/wall/seed' && method === 'DELETE') return { status: 200, obj: Object.assign({ ok: true }, await clearSeed()) };
    return { status: 404, obj: { ok: false, error: 'local.js 未处理的路由：' + pathname } };
  }

  window.fetch = async function (input, init) {
    init = init || {};
    var url = (typeof input === 'string') ? input : (input && input.url) || '';
    var u; try { u = new URL(url, location.href); } catch (e) { return realFetch(input, init); }
    if (u.pathname.indexOf('/api/') === 0) {
      var method = String(init.method || (input && input.method) || 'GET').toUpperCase(), body = null;
      if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
      var res = await route(u.pathname, method, u.search, body);
      return new Response(JSON.stringify(res.obj, null, 2), { status: res.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }
    return realFetch(input, init);
  };
  (async function bootSecure() { try { var k = await secGet('rp_key'); if (k && !LS.get('key', '')) { LS.set('key', k); var mo = await secGet('rp_model'); if (mo) LS.set('model', mo); var ba = await secGet('rp_base'); if (ba) LS.set('baseUrl', ba); try { if (typeof refreshModelStatus === 'function') refreshModelStatus(); if (typeof loadConfig === 'function') loadConfig(); } catch (e) {} } } catch (e) {} })();  try { console.log('[ReviewPal] App 本地优先层已启用（数据存本机 IndexedDB）'); } catch (e) {}
})();
/* ============ App 内：初始化修正 + 本地文案 ============ */
(function () {
  var Cap = window.Capacitor || {}; var plat = Cap.getPlatform ? Cap.getPlatform() : (Cap.platform || 'web');
  if (plat !== 'android' && plat !== 'ios') return;
  window.loadConfig = async function () {
    try {
      await (await fetch('/api/config')).json();
      var pill = document.getElementById('serverPill'); if (pill) pill.innerHTML = '<span class="dot green"></span> 本地模式 · 数据存在手机';
    var tb = document.getElementById('topBanner'); if (tb) { tb.className = 'banner'; tb.innerHTML = ''; }
    var fn = document.querySelector('.footnote'); if (fn && !document.getElementById('rpLocalNote')) { var d = document.createElement('div'); d.id = 'rpLocalNote'; d.className = 'rp-localnote'; d.style.marginTop = '8px'; d.textContent = '本地模式：数据保存在这台手机里（离线可用）；填好 API Key 后走真实模型。'; fn.appendChild(d); }
      var bn = document.getElementById('realBanner'); if (bn) { bn.className = 'banner'; bn.innerHTML = ''; }
      var hp = document.getElementById('dbPath'); if (hp) hp.textContent = '手机本地库 · IndexedDB';
    } catch (e) {}
  };
  setTimeout(function () { try { window.loadConfig(); if (typeof window.loadRecords === 'function') window.loadRecords(); } catch (e) {} }, 0);
})();
