/* 复盘通 ReviewPal · 核心护栏用例（golden fixtures）。运行： node tests/rp-core.test.js */
const RP = require('../web/rp-core.js');
let pass = 0, fail = 0;
function eq(name, got, want) { const a = JSON.stringify(got), b = JSON.stringify(want); if (a === b) { pass++; } else { fail++; console.log('FAIL ' + name + '\n  got  ' + a + '\n  want ' + b); } }
function picks(p) { return { status: p.status, score: p.score }; }
eq('yes+完成->on_track 78', picks(RP.inferProgress({ alignment: 'yes', actual: '写完了方案' })), { status: 'on_track', score: 78 });
eq('yes+超额->advance 92', picks(RP.inferProgress({ alignment: 'yes', actual: '超额完成' })), { status: 'advance', score: 92 });
eq('no->stalled 16', picks(RP.inferProgress({ alignment: 'no', actual: '没做' })), { status: 'stalled', score: 16 });
eq('partial->partial 58', picks(RP.inferProgress({ alignment: 'partial', actual: '只做了一半' })), { status: 'partial', score: 58 });
eq('无alignment+没做->stalled 16', picks(RP.inferProgress({ actual: '今天什么都没做' })), { status: 'stalled', score: 16 });
eq('空->partial 46(缺actual-12)', picks(RP.inferProgress({})), { status: 'partial', score: 46 });
eq('keep/tomorrow 加成', picks(RP.inferProgress({ alignment: 'yes', actual: '完成', keep: 'x', tomorrow: 'y' })), { status: 'on_track', score: 86 });
eq('clampScore 上界', RP.clampScore(150), 100);
eq('clampScore 下界', RP.clampScore(-5), 0);
eq('clampScore 非数', RP.clampScore('abc'), 0);
const okRec = { id: '1', date: '2026-10-17', summary: 'a', key_insight: 'b', keep: [], improve: [], tomorrow_focus: 'c', tags: [], progress: { status: 'on_track', score: 78 } };
eq('validate 合法', RP.validate(okRec, 'store'), { ok: true, errors: [] });
eq('validate 缺字段', RP.validate({}, 'store').ok, false);
eq('validate 非法status', RP.validate(Object.assign({}, okRec, { progress: { status: 'xx', score: 1 } })).ok, false);
eq('validateSchema keep非数组', RP.validateSchema(Object.assign({}, okRec, { keep: 'x' })).ok, false);
eq('validateSchema 合法', RP.validateSchema(okRec, 'store'), { ok: true, errors: [] });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);