/**
 * 数据契约校验（零依赖版）
 * 对应文档：附件 F《统一数据契约 v3》
 *
 * 【V3 主要变化】字段从"情绪/心理"全面改为"目标复盘"：
 *   去掉 mood_score / emotion_* / crisis / router_state / empathy_response / 各类心理专家字段，
 *   新增 goals / plan / actual / alignment / keep / improve / tomorrow / progress / quote / public。
 */

const AI_FIELDS    = ['summary', 'key_insight', 'keep', 'improve', 'tomorrow_focus', 'tags', 'progress'];
const STORE_FIELDS = ['id', 'date'].concat(AI_FIELDS);
const REQUIRED     = STORE_FIELDS;

const PROGRESS = ['advance', 'on_track', 'partial', 'off_track', 'stalled'];
const ALIGNMENT = ['yes', 'partial', 'no', null, undefined, ''];

function validate(rec, stage) {
  stage = stage || 'store';
  const required = stage === 'ai' ? AI_FIELDS : STORE_FIELDS;
  const errors = [];

  for (let i = 0; i < required.length; i++) {
    if (!(required[i] in rec)) errors.push('缺少必填字段：' + required[i]);
  }
  if (rec.progress && !PROGRESS.includes(rec.progress.status)) {
    errors.push('progress.status 取值非法：' + rec.progress.status);
  }
  if (rec.progress && rec.progress.score != null) {
    const s = rec.progress.score;
    if (typeof s !== 'number' || s < 0 || s > 100) errors.push('progress.score 必须是 0-100 的数字');
  }
  if (!Array.isArray(rec.keep))    errors.push('keep 必须是数组');
  if (!Array.isArray(rec.improve)) errors.push('improve 必须是数组');
  if (!Array.isArray(rec.tags))    errors.push('tags 必须是数组');
  if (rec.alignment != null && !ALIGNMENT.includes(rec.alignment)) {
    errors.push('alignment 取值非法：' + rec.alignment);
  }
  return { ok: errors.length === 0, errors: errors };
}

module.exports = { validate, REQUIRED, AI_FIELDS, STORE_FIELDS, PROGRESS };