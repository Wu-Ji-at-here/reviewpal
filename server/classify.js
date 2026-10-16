/**
 * 推进度推断（Progress Inference）
 * 对应文档：§2.1 五问引导输入 · §2.4 推进度
 *
 * 【这是什么】
 *   在调用模型之前，先用本地规则从"五问"的填写情况，粗略判断今天的**目标推进度**。
 *   它是"打卡可视化 + 界面配色"的依据。
 *
 * 【重要边界】
 *   本产品不做任何心理判断。这里判断的是"目标推进情况"，不是情绪、不是心理状态。
 *   第 3 问的"今天的行为是否有助于目标实现"由用户自己选，本地规则只做兜底。
 */

const STALLED  = ['没做', '没开始', '摆了', '拖延', '忘了', '没推进', '荒废', '啥也没', '没动'];
const OFFTRACK = ['跑偏', '偏离', '做错', '返工', '白忙', '不在计划', '走错方向'];
const ADVANCE  = ['超额', '提前完成', '超预期', '连做', '比计划多', '一举', '顺带做完'];
const PARTIAL  = ['一半', '部分完成', '来不及', '只做了', '没做完', '差一点', '开了个头'];
const ONTRACK  = ['完成', '做完', '搞定', '按计划', '达成', '推进', '打卡'];

/** 推进度档位（5 档）与基础分 */
const LEVELS = {
  advance:  { label: '超额达成', score: 92 },
  on_track: { label: '按计划达成', score: 78 },
  partial:  { label: '部分完成', score: 58 },
  off_track:{ label: '偏离目标', score: 34 },
  stalled:  { label: '未推进', score: 16 }
};

function hit(list, text) { return list.filter(function(w){ return text.indexOf(w) >= 0; }); }

/**
 * @param {object} a 五问的作答 { goal_long, goal_short, plan, actual, alignment, keep, improve, tomorrow }
 * @returns {{status:string, label:string, score:number, hit:string[], reason:string}}
 */
function inferProgress(a) {
  a = a || {};
  const text = [a.goal_long, a.goal_short, a.plan, a.actual, a.keep, a.improve, a.tomorrow]
    .filter(Boolean).join(' ');

  const hs = hit(STALLED, text);
  const ho = hit(OFFTRACK, text);
  const ha = hit(ADVANCE, text);
  const hp = hit(PARTIAL, text);
  const hn = hit(ONTRACK, text);

  let status = 'on_track';
  let reason = '按第 3 问的自评判定';

  /* 用户在第 3 问的直接选择优先级最高 */
  if (a.alignment === 'no') { status = 'stalled'; reason = '第 3 问：今天的行为无助于目标实现'; }
  else if (a.alignment === 'partial') { status = 'partial'; reason = '第 3 问：部分助力目标'; }
  else if (a.alignment === 'yes') {
    status = ha.length ? 'advance' : 'on_track';
    reason = ha.length ? '第 3 问：助力目标，且出现超额信号' : '第 3 问：助力目标';
  } else {
    /* 没选 → 用关键词兜底 */
    if (hs.length) { status = 'stalled'; reason = '命中停滞信号：' + hs.join('、'); }
    else if (ho.length) { status = 'off_track'; reason = '命中偏离信号：' + ho.join('、'); }
    else if (hp.length) { status = 'partial'; reason = '命中部分完成信号：' + hp.join('、'); }
    else if (ha.length) { status = 'advance'; reason = '命中超额信号：' + ha.join('、'); }
    else if (hn.length) { status = 'on_track'; reason = '命中完成信号：' + hn.join('、'); }
    else { status = 'partial'; reason = '信息不足，按"部分完成"处理'; }
  }

  /* 分数微调：填得越完整、有保持项与明日计划，越往上 */
  let score = LEVELS[status].score;
  if (a.keep && String(a.keep).trim()) score += 4;
  if (a.tomorrow && String(a.tomorrow).trim()) score += 4;
  if (!a.actual || !String(a.actual).trim()) score -= 12;
  score = Math.max(0, Math.min(100, score));

  return { status: status, label: LEVELS[status].label, score: score, hit: hs.concat(ho, hp, ha, hn), reason: reason };
}

module.exports = { inferProgress, LEVELS };