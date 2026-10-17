/* 复盘通 ReviewPal · 核心护栏（纯函数 · 零依赖 · 浏览器/Node 通用）
   单一事实来源：推进度判定 inferProgress、契约校验 validate。
   配套用例：tests/rp-core.test.js（golden fixtures）。 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.RP = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  var LEVELS = { advance: { label: '超额达成', score: 92 }, on_track: { label: '按计划达成', score: 78 }, partial: { label: '部分完成', score: 58 }, off_track: { label: '偏离目标', score: 34 }, stalled: { label: '未推进', score: 16 } };
  var STALLED = ['没做','没开始','摆了','拖延','忘了','没推进','荒废','啥也没','没动'];
  var OFFTRACK = ['跑偏','偏离','做错','返工','白忙','不在计划','走错方向'];
  var ADVANCE = ['超额','提前完成','超预期','连做','比计划多','一举','顺带做完'];
  var PARTIAL = ['一半','部分完成','来不及','只做了','没做完','差一点','开了个头'];
  var ONTRACK = ['完成','做完','搞定','按计划','达成','推进','打卡'];
  function hit(list, text) { return list.filter(function (w) { return text.indexOf(w) >= 0; }); }
  function clampScore(n) { n = Number(n); if (!isFinite(n)) return 0; return Math.max(0, Math.min(100, Math.round(n))); }
  function inferProgress(a) {
    a = a || {};
    var text = [a.goal_long, a.goal_short, a.plan, a.actual, a.keep, a.improve, a.tomorrow].filter(Boolean).join(' ');
    var hs = hit(STALLED, text), ho = hit(OFFTRACK, text), ha = hit(ADVANCE, text), hp = hit(PARTIAL, text), hn = hit(ONTRACK, text);
    var status = 'on_track', reason = '按第 3 问的自评判定';
    if (a.alignment === 'no') { status = 'stalled'; reason = '第 3 问：今天的行为无助于目标实现'; }
    else if (a.alignment === 'partial') { status = 'partial'; reason = '第 3 问：部分助力目标'; }
    else if (a.alignment === 'yes') { status = ha.length ? 'advance' : 'on_track'; reason = ha.length ? '第 3 问：助力目标，且出现超额信号' : '第 3 问：助力目标'; }
    else { if (hs.length) { status = 'stalled'; reason = '命中停滞信号：' + hs.join('、'); } else if (ho.length) { status = 'off_track'; reason = '命中偏离信号：' + ho.join('、'); } else if (hp.length) { status = 'partial'; reason = '命中部分完成信号：' + hp.join('、'); } else if (ha.length) { status = 'advance'; reason = '命中超额信号：' + ha.join('、'); } else if (hn.length) { status = 'on_track'; reason = '命中完成信号：' + hn.join('、'); } else { status = 'partial'; reason = '信息不足，按部分完成处理'; } }
    var score = LEVELS[status].score;
    if (a.keep && String(a.keep).trim()) score += 4;
    if (a.tomorrow && String(a.tomorrow).trim()) score += 4;
    if (!a.actual || !String(a.actual).trim()) score -= 12;
    score = clampScore(score);
    return { status: status, label: LEVELS[status].label, score: score, hit: hs.concat(ho, hp, ha, hn), reason: reason };
  }
  var AI_FIELDS = ['summary','key_insight','keep','improve','tomorrow_focus','tags','progress'];
  var STORE_FIELDS = ['id','date'].concat(AI_FIELDS);
  var PROGRESS = ['advance','on_track','partial','off_track','stalled'];
  var ALIGNMENT = ['yes','partial','no',null,undefined,''];
  function validate(rec, stage) {
    rec = rec || {};
    var required = (stage === 'ai') ? AI_FIELDS : STORE_FIELDS, errors = [];
    required.forEach(function (k) { if (!(k in rec)) errors.push('缺少必填字段：' + k); });
    if (rec.progress && PROGRESS.indexOf(rec.progress.status) < 0) errors.push('progress.status 取值非法：' + rec.progress.status);
    return { ok: errors.length === 0, errors: errors };
  }
  function validateSchema(rec, stage) {
    rec = rec || {}; stage = stage || 'store';
    var required = (stage === 'ai') ? AI_FIELDS : STORE_FIELDS, errors = [];
    for (var i = 0; i < required.length; i++) { if (!(required[i] in rec)) errors.push('缺少必填字段：' + required[i]); }
    if (rec.progress && PROGRESS.indexOf(rec.progress.status) < 0) errors.push('progress.status 取值非法：' + rec.progress.status);
    if (rec.progress && rec.progress.score != null) { var s = rec.progress.score; if (typeof s !== 'number' || s < 0 || s > 100) errors.push('progress.score 必须是 0-100 的数字'); }
    if (!Array.isArray(rec.keep)) errors.push('keep 必须是数组');
    if (!Array.isArray(rec.improve)) errors.push('improve 必须是数组');
    if (!Array.isArray(rec.tags)) errors.push('tags 必须是数组');
    if (rec.alignment != null && ALIGNMENT.indexOf(rec.alignment) < 0) errors.push('alignment 取值非法：' + rec.alignment);
    return { ok: errors.length === 0, errors: errors };
  }
  return { LEVELS: LEVELS, inferProgress: inferProgress, clampScore: clampScore, validate: validate, validateSchema: validateSchema, AI_FIELDS: AI_FIELDS, STORE_FIELDS: STORE_FIELDS, PROGRESS: PROGRESS, ALIGNMENT: ALIGNMENT, hit: hit };
});