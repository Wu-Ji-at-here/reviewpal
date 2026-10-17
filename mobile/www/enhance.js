/* 复盘通 · V1.19 移动端体验增强层（enhance.js）
   与 local.js 无关：本层只增强交互与视觉，网页版 / App 通用。 */
(function () {
  if (window.__rp_enh) return; window.__rp_enh = true;
  function LSK() { return 'reviewpal-theme'; }
  function ls(k, d) { try { var x = localStorage.getItem(k); return x == null ? d : x; } catch (e) { return d; } }
  function lss(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var SYM = { advance: '▲', on_track: '●', partial: '◐', off_track: '▼', stalled: '○' };

  /* ---- 1) 新样式 ---- */
  try {
    var css = [
      '.rp-ring{width:74px;height:74px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;',
      'background:conic-gradient(var(--mood) calc(var(--rp-v,0) * 1%), var(--bg-2) 0);position:relative}',
      '.rp-ring::after{content:"";position:absolute;inset:8px;border-radius:50%;background:var(--panel)}',
      '.rp-ring b{position:relative;font-size:19px;font-weight:800}',
      '.rp-prog{display:flex;align-items:center;gap:12px;margin:8px 0 10px;flex-wrap:wrap}',
      '.rp-prog .lbl{font-size:12.5px;color:var(--muted)}',
      '.rp-wk{grid-column:1/-1;display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--muted);',
      'background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:9px 13px;margin-bottom:2px}',
      '.rp-wk b{color:var(--ink)}',
      '.rp-guide{grid-column:1/-1;background:var(--info-soft);color:var(--info);border:1px dashed currentColor;border-radius:14px;padding:16px;font-size:13px;line-height:1.75}',
      '.rp-guide b{display:block;font-size:14px;margin-bottom:4px}',
      '.moodchip .rp-sym{font-style:normal}',
      '.hd{cursor:pointer}',
      '@media (max-width:980px){ .rp-ring{width:62px;height:62px} .rp-prog .lbl{font-size:12px} }'
    ].join('');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  } catch (e) {}

  /* ---- 2) 推进度圆环 + 档位符号 ---- */
  function ensureRing() {
    if (document.getElementById('rpRingHost')) return;
    var sc = document.getElementById('cardProgScore'); if (!sc) return;
    var sec = sc.closest('.gsec') || sc.parentNode;
    var host = document.createElement('div'); host.id = 'rpRingHost'; host.className = 'rp-prog';
    host.innerHTML = '<div class="rp-ring" id="rpRing" style="--rp-v:0"><b id="rpRingNum">0</b></div><div class="lbl" id="rpRingLbl">推进度</div>';
    try { sec.parentNode.insertBefore(host, sec); } catch (e) { try { sc.parentNode.insertBefore(host, sc); } catch (e2) {} }
  }
  function paintRing() {
    var r = document.getElementById('rpRing'); if (!r) return;
    var score = parseInt(((document.getElementById('cardProgScore') || {}).textContent || '0'), 10) || 0;
    var lbl = (((document.getElementById('cardProgLabel') || {}).textContent) || '').trim();
    var st = document.body.getAttribute('data-mood') || '';
    r.style.setProperty('--rp-v', Math.max(0, Math.min(100, score)));
    var n = document.getElementById('rpRingNum'); if (n) n.textContent = score;
    var l = document.getElementById('rpRingLbl');
    if (l) l.innerHTML = (SYM[st] ? '<span class="rp-sym">' + SYM[st] + '</span> ' : '') + (lbl || '推进度') + '　·　' + score + ' 分';
  }
  ['fillFields', 'applyMood'].forEach(function (fn) {
    var orig = window[fn]; if (typeof orig !== 'function') return;
    window[fn] = function () { var r = orig.apply(this, arguments); try { ensureRing(); paintRing(); } catch (e) {} return r; };
  });

  /* ---- 3) 打卡墙：本周摘要 + 首屏空态引导 ---- */
  function weekSummary() {
    var recs = window.__records || []; if (!recs.length) return '';
    var set = {}; recs.forEach(function (r) { if (r && r.date) set[r.date] = 1; });
    var today = new Date(), cnt = 0;
    for (var i = 0; i < 7; i++) { var d = new Date(today.getTime() - i * 864e5); var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (set[k]) cnt++; }
    var streak = 0, j = set[toYmd(today)] ? 0 : 1;
    for (; j < 400; j++) { var dd = new Date(today.getTime() - j * 864e5); if (set[toYmd(dd)]) streak++; else break; }
    return '<div class="rp-wk">本周已打卡 <b>' + cnt + '/7</b><span>·</span> 连续 <b>' + streak + ' 天</b><span>·</span> 累计 <b>' + recs.length + ' 张</b></div>';
  }
  function toYmd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var _renderWall = window.renderWall;
  if (typeof _renderWall === 'function') {
    window.renderWall = function () {
      var r = _renderWall.apply(this, arguments);
      try {
        var box = document.getElementById('wallGrid'); if (!box) return r;
        var empty = box.querySelector('.wallempty');
        if (empty) {
          box.innerHTML = '<div class="rp-guide"><b>👋 还没有任何复盘卡</b>每天睡前花 2 分钟，回答「每日进步五问」，就能生成一张复盘卡。<br>想先看看效果？点下面的按钮灌入 10 张示例数据。</div>' +
            '<div class="wallempty" style="border:0;padding:10px"><span class="btn mini" onclick="seedWall()">填充我的示例数据</span></div>';
          return r;
        }
        box.insertAdjacentHTML('afterbegin', weekSummary());
      } catch (e) {}
      return r;
    };
  }

  /* ---- 4) 热力图：点击格子跳到那天的卡片 ---- */
  var _renderHeat = window.renderHeatmap;
  if (typeof _renderHeat === 'function') {
    window.renderHeatmap = function (records) {
      var r = _renderHeat.apply(this, arguments);
      try {
        var grid = document.getElementById('heatGrid'); if (!grid) return r;
        var recs = window.__records || [];
        [].slice.call(grid.querySelectorAll('.hd[title]')).forEach(function (cell) {
          var date = (cell.getAttribute('title') || '').split(' ')[0];
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
          cell.addEventListener('click', function () {
            var idx = recs.findIndex(function (x) { return x && x.date === date; });
            if (idx >= 0) { replayRecord(idx); } else { toast(date + ' 还没有记录'); }
          });
        });
      } catch (e) {}
      return r;
    };
  }

  /* ---- 5) 主题：加「跟随系统」 ---- */
  var sw = document.getElementById('themSw');
  if (sw && !sw.querySelector('[data-t="auto"]')) {
    var b = document.createElement('button'); b.setAttribute('data-t', 'auto');
    b.setAttribute('onclick', "setTheme('auto')"); b.textContent = '跟随系统';
    sw.appendChild(b);
  }
  var _applyTheme = window.applyTheme;
  if (typeof _applyTheme === 'function') {
    window.applyTheme = function (mode) {
      var m = mode || ls(LSK(), 'warm');
      var resolved = m;
      if (m === 'auto') resolved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'cyber' : 'warm';
      if (resolved !== 'cyber' && resolved !== 'warm') resolved = 'warm';
      document.body.classList.toggle('theme-cyber', resolved === 'cyber');
      document.documentElement.style.colorScheme = resolved === 'cyber' ? 'dark' : 'light';
      document.querySelectorAll('#themSw button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === m); });
      lss(LSK(), m); window.__theme = m;
      try { paintRing(); } catch (e) {}
    };
    try { window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (window.__theme === 'auto') window.applyTheme('auto'); }); } catch (e) {}
  }

  /* ---- 6) 复盘卡导出：2 倍高清 + iOS 长按保存兜底 ---- */
  window.exportCard = function () {
    var S = 2, W = 720, H = 1240;
    var cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    var x = cv.getContext('2d'); x.scale(S, S);
    var stt = document.body.getAttribute('data-mood');
    var mood = (stt && moodColor(stt)) || getComputedStyle(document.body).getPropertyValue('--mood').trim() || '#E8756B';
    var t = function (id, fb) { var e = document.getElementById(id); return (e && e.textContent.trim()) || fb; };
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
    x.fillStyle = mood; x.fillRect(48, 52, W - 96, 10);
    x.fillStyle = '#8A817C'; x.font = '600 19px "Microsoft YaHei",sans-serif'; x.fillText('复盘通 · 每日复盘卡', 48, 104);
    x.fillStyle = '#1D1D1F'; x.font = '700 34px "Microsoft YaHei",sans-serif'; x.fillText(t('cardDate', '') + ' · 每日进步', 48, 156);
    var yy = 214;
    var section = function (label, text, lines) { x.fillStyle = mood; x.font = '700 19px "Microsoft YaHei",sans-serif'; x.fillText(label, 48, yy); yy += 30; x.fillStyle = '#1D1D1F'; x.font = '22px "Microsoft YaHei",sans-serif'; yy = __wrapText(x, text, 48, yy, W - 96, 32, lines || 3) + 22; };
    section('① 我的目标', t('cardGoal', '（未填）'), 2);
    section('② 原本的计划', t('cardPlan', '（未填）'), 2);
    section('③ 实际做了什么', t('cardActual', '（未填）'), 3);
    section('④ 保持 / 优化', t('cardReview', '（未填）'), 3);
    section('⑤ 明天的计划', t('cardTomorrow', '（未填）'), 2);
    x.fillStyle = mood; x.font = '700 19px "Microsoft YaHei",sans-serif'; x.fillText('推进度', 48, yy); yy += 28;
    var score = parseInt(t('cardProgScore', '0'), 10) || 0;
    yy += 40;
    x.fillStyle = '#1D1D1F'; x.font = '20px "Microsoft YaHei",sans-serif'; x.fillText(t('cardProgLabel', '--') + '　' + score + ' 分', 48, yy); yy += 46;
    x.strokeStyle = '#DCD5CF'; x.setLineDash([6, 6]); x.strokeRect(48, yy - 14, W - 96, 96); x.setLineDash([]);
    x.fillStyle = '#8A817C'; x.font = '600 16px "Microsoft YaHei",sans-serif'; x.fillText('今日一句', 64, yy + 10);
    x.fillStyle = '#4A4A4A'; x.font = 'italic 18px "Microsoft YaHei",sans-serif'; __wrapText(x, t('cardQuote', ''), 64, yy + 38, W - 128, 26, 2);
    x.fillStyle = '#C9C2BC'; x.font = '16px "Microsoft YaHei",sans-serif'; x.fillText('复盘通 · 目标复盘与每日打卡工具', 48, H - 52);
    var url = cv.toDataURL('image/png'), name = '复盘通_每日复盘卡_' + toYmd(new Date()) + '.png';
    var Cap = window.Capacitor;
    var P = Cap ? Cap.Plugins : null;
    var native = false;
    if (Cap) { if (typeof Cap.isNativePlatform === 'function') { native = Cap.isNativePlatform(); } else if (Cap.platform === 'android') { native = true; } else if (Cap.platform === 'ios') { native = true; } }
    if (native) {
      if (P) {
        try {
          P.SaveImage.saveBase64({ dataUrl: url, fileName: name }).then(function () {
            toast('已保存到系统相册（相册 › ReviewPal）');
          }).catch(function (err) {
            var m = '';
            if (err) { m = err.message ? err.message : String(err); }
            try { var a2 = document.createElement('a'); a2.download = name; a2.href = url; document.body.appendChild(a2); a2.click(); document.body.removeChild(a2); } catch (e2) {}
            toast('保存到相册失败，已改为下载：' + m);
          });
          return;
        } catch (e3) {}
      }
    }
    var ios = /iP(hone|ad|od)/.test(navigator.userAgent);
    try {
      var a = document.createElement('a'); a.download = name; a.href = url; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast(ios ? '已生成 PNG：若没弹出下载，长按图片「存储到照片」' : '已导出高清 PNG（2 倍图）');
    } catch (e) {}
    if (ios) { var w = window.open(); if (w) w.document.write('<img src="' + url + '" style="width:100%">'); }
  };

  /* ---- 7) 向导：Enter 下一步 / Ctrl+Enter 开始 / 1-5 跳步 / 草稿自动保存 ---- */
  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey) { if (e.key === 'Enter') { e.preventDefault(); try { runReal(); } catch (x) {} } return; }
      var el = e.target;
      var inField = el && el.closest && el.closest('input,textarea,select,[contenteditable]');
      if (inField) {
        if (e.key === 'Enter' && !e.shiftKey && inField.tagName === 'TEXTAREA') { e.preventDefault(); stepGo(1); }
        return;
      }
      if (/^[1-5]$/.test(e.key)) { e.preventDefault(); goStep(Number(e.key)); }
    });
  }
  function bindDraft() {
    var KEY = 'reviewpal.draft'; function _today(){ var n=new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0'); }
    try { var d0 = JSON.parse(ls(KEY, 'null')); var d = (d0 && d0.__date === _today() && d0.v) ? d0.v : null; if (d) { var any = false; Object.keys(d).forEach(function (k) { var el = document.getElementById('q_' + k); if (el && !el.value && d[k]) { el.value = d[k]; any = true; } }); if (d.alignment) { document.querySelectorAll('#q_align .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.a === d.alignment); }); } if (any) setTimeout(function () { try { growVisible(); } catch (e) {} }, 60); } } catch (e) {}
    var save = function () { try { lss(KEY, JSON.stringify({ __date: _today(), v: collectAnswers() })); } catch (e) {} };
    [].slice.call(document.querySelectorAll('#qForms input,#qForms textarea,#q_align .chip')).forEach(function (el) { el.addEventListener('change', save); el.addEventListener('blur', save); });
  }

  /* ---- 8) 移动端：卡片左右滑动切换 ---- */
  function bindSwipe() {
    var deck = document.getElementById('deck'); if (!deck) return;
    var x0 = 0, y0 = 0;
    deck.addEventListener('touchstart', function (e) { var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
    deck.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; var dx = t.clientX - x0, dy = t.clientY - y0; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) { slideGo(dx < 0 ? 1 : -1); } }, { passive: true });
  }

  function boot() {
    try { bindKeys(); } catch (e) {}
    try { bindDraft(); } catch (e) {}
    try { bindSwipe(); } catch (e) {}
    try { window.applyTheme(window.__theme || ls(LSK(), 'warm')); } catch (e) {}
    try { ensureRing(); paintRing(); } catch (e) {}
    try { if (window.__records) renderWall(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  try { console.log('[ReviewPal] V1.19 体验增强层已加载'); } catch (e) {}
})();
/* ============ V1.21 移动端：微信式顶栏 · 设置整页 · 扁平化 · 淡入淡出 ============ */
(function () {
  if (window.__rp_mob) return; window.__rp_mob = true;
  var MOB = '(max-width:980px)';
  try {
    var css = [
      '@media (max-width:980px){',
      'body{padding-top:calc(54px + env(safe-area-inset-top,0px));padding-bottom:0}',
      '.wrap{padding:8px 14px 104px;max-width:none}',
      '.topbar{position:fixed;top:0;left:0;right:0;z-index:90;margin:0;border:0;border-bottom:1px solid var(--hairline);',
      'border-radius:0;box-shadow:none;background:var(--panel);-webkit-backdrop-filter:none;backdrop-filter:none;',
      'padding:calc(env(safe-area-inset-top,0px) + 9px) 14px 9px;gap:8px;flex-wrap:nowrap;align-items:center}',
      '.topbar .grow{flex:1 1 auto;min-width:0}',
      '.brand{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.brand small{display:none}',
      '.topbar #themSw,.topbar [onclick*="toggleLabels"],.topbar [onclick*="showSettings"]{display:none!important}',
      '.topbar .pill{font-size:11px;padding:3px 8px;white-space:nowrap}',
      '.block,.legal{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:2px 0!important}',
      '.block{overflow:visible!important}',
      '#qList,.deckhint,.decknav{display:none!important}',
      '.deck{margin-top:8px}',
      '.heatgrid{width:100%!important;max-width:100%!important;gap:5px!important}',
      '.hd{max-height:none!important;border-radius:7px;font-size:10px}',
      '#wallSection{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:2px 0!important}',
      '.wallgrid{grid-template-columns:1fr 1fr!important;gap:10px!important}',
      '.wallcard{padding:10px 11px}',
      '#settingsOverlay{align-items:stretch;justify-content:flex-start;padding:0;background:var(--bg)}',
      '#settingsOverlay .box{width:100%;max-width:none;max-height:none;min-height:100vh;height:auto;border:0;border-radius:0;',
      'box-shadow:none;background:var(--bg);transform:none;',
      'padding:calc(env(safe-area-inset-top,0px) + 64px) 16px calc(env(safe-area-inset-bottom,0px) + 104px)}',
      '#settingsOverlay.show .box{transform:none}',
      '#settingsOverlay .row button[onclick="hideSettings()"]{display:none!important}',
      '.rp-sethead{display:flex;position:fixed;top:0;left:0;right:0;z-index:210;align-items:center;justify-content:space-between;',
      'padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 10px;background:var(--panel);border-bottom:1px solid var(--hairline)}',
      '.rp-sethead b{font-size:16px}',
      '.rp-sethead button{background:transparent;border:0;color:var(--accent);font:inherit;font-size:14px;font-weight:600;cursor:pointer;padding:4px 2px}',
      '}',
      '#rpTabs{display:none}',
      '.rp-sethead{display:none}','@media (max-width:980px){.rp-sethead{display:flex!important}}',
      '@media (max-width:980px){',
      '#rpTabs{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:320;',
      'background:color-mix(in srgb,var(--panel) 93%,transparent);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);',
      'border-top:1px solid var(--hairline);padding:6px 4px calc(6px + env(safe-area-inset-bottom));gap:2px}',
      '#rpTabs button{flex:1;background:transparent;border:0;color:var(--muted);font:inherit;font-size:11px;',
      'display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;border-radius:12px;cursor:pointer}',
      '#rpTabs button .ic{font-size:0;line-height:0}',
      '#rpTabs button .ic svg{width:22px;height:22px;display:block}',
      '#rpTabs button.on{color:var(--accent)}',
      '}',
      '@keyframes rpFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
      '.slide.active{animation:rpFade .26s ease both}',
      '#settingsOverlay.show .box{animation:rpFade .24s ease both}',
      '@media (prefers-reduced-motion: reduce){.slide.active,#settingsOverlay.show .box{animation:none!important}}'
    ].join('');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  } catch (e) {}

  function renameBtns() {
    try { [].slice.call(document.querySelectorAll('button')).forEach(function (b) { var oc = b.getAttribute('onclick') || ''; if (oc.indexOf('stepGo(-1)') >= 0) b.textContent = '上一问'; else if (oc.indexOf('stepGo(1)') >= 0) b.textContent = '下一问'; }); } catch (e) {}
  }
  function swapText(pairs) {
    try { var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n; while ((n = w.nextNode())) { var val = n.nodeValue; for (var i = 0; i < pairs.length; i++) { if (val.indexOf(pairs[i][0]) >= 0) val = val.split(pairs[i][0]).join(pairs[i][1]); } if (val !== n.nodeValue) n.nodeValue = val; } } catch (e) {}
  }

    var _U = window.__RP_ICONS || {};
  function _fb(k){ var s = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'; return s + (k === 'five' ? '<path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>' : k === 'card' ? '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7.5 9.5h5"/><path d="M7.5 13.5h9"/>' : k === 'wall' ? '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18"/><path d="M8 3v4M16 3v4"/><path d="M8.5 15l2 2 4-4.5"/>' : '<path d="M4 8h9"/><path d="M18 8h2"/><circle cx="15" cy="8" r="2.2"/><path d="M4 16h3"/><path d="M12 16h8"/><circle cx="9" cy="16" r="2.2"/>') + '</svg>'; }
  var IC = {
    five: _U.five || _fb('five'),
    card: _U.card || _fb('card'),
    wall: _U.wall || _fb('wall'),
    gear: _U.gear || _fb('gear')
  };

  var TABS = [
    { ic: IC.five, label: '每日五问', go: function () { try { slideTo(0); window.scrollTo(0, 0); } catch (e) {} } },
    { ic: IC.card, label: '复盘卡', go: function () { try { slideTo(1); window.scrollTo(0, 0); } catch (e) {} } },
    { ic: IC.wall, label: '打卡墙', go: function () { try { slideTo(2); window.scrollTo(0, 0); } catch (e) {} } },
    { ic: IC.gear, label: '设置', settings: true, go: function () {} }
  ];
  function buildTabs() {
    if (document.getElementById('rpTabs')) return;
    var nav = document.createElement('nav'); nav.id = 'rpTabs';
    nav.innerHTML = TABS.map(function (t, i) { return '<button data-i="' + i + '"><span class="ic">' + t.ic + '</span><span>' + t.label + '</span></button>'; }).join('');
    document.body.appendChild(nav);
    nav.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        nav.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
        var t = TABS[Number(b.dataset.i)];
        try { if (t.settings) { showSettings(); } else { hideSettings(); t.go(); } } catch (e) {}
      });
    });
    try { nav.querySelector('button').classList.add('on'); } catch (e) {}
  }
  function syncTab(idx) { try { var nav = document.getElementById('rpTabs'); if (!nav) return; var map = { 0: 0, 1: 1, 2: 2 }; var want = map[idx]; if (want == null) return; nav.querySelectorAll('button').forEach(function (x, i) { x.classList.toggle('on', i === want); }); } catch (e) {} }
  var _slideTo = window.slideTo;
  if (typeof _slideTo === 'function') { window.slideTo = function (n) { var r = _slideTo.apply(this, arguments); try { syncTab(Math.max(0, Math.min(3, Number(n) || 0))); } catch (e) {} return r; }; }

  function moveTheme() {
    try {
      if (!window.matchMedia(MOB).matches) return;
      var box = document.querySelector('#settingsOverlay .box'); var sw = document.getElementById('themSw'); if (!box || !sw) return;
      var lab = document.getElementById('rpThemeLab');
      if (!lab) { lab = document.createElement('label'); lab.id = 'rpThemeLab'; lab.textContent = '主题'; }
      box.insertBefore(lab, box.firstChild); box.insertBefore(sw, lab.nextSibling);
    } catch (e) {}
  }
  function buildSettingsHeader() {
    try {
      var ov = document.getElementById('settingsOverlay'); if (!ov || ov.querySelector('.rp-sethead')) return;
      var box = ov.querySelector('.box'); if (!box) return;
      var h = document.createElement('div'); h.className = 'rp-sethead';
      h.innerHTML = '<b>设置</b>';
      var hb = h.querySelector('button'); if (hb) hb.addEventListener('click', function () { try { hideSettings(); } catch (e) {} });
      ov.insertBefore(h, box);
    } catch (e) {}
  }

  function boot() {
    renameBtns();
    swapText([['越红', '越深'], ['颜色从无色渐变到红', '颜色由浅到深'], ['鼠标停上去看日期与分数', '点格子看日期与分数'], ['鼠标停上去', '点格子']]);
    buildTabs(); moveTheme(); buildSettingsHeader(); try { syncTab(0); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  try { console.log('[ReviewPal] V1.21 移动端导航层已加载'); } catch (e) {}
})();
/* ============ V1.22 原生化：当前页标题 · 返回键 · 删除确认 · 打卡墙整页 · Toast 归位 ============ */
(function () {
  if (window.__rp_app2) return; window.__rp_app2 = true;
  var MOB = '(max-width:980px)';
  var myIdx = 0;
  try {
    var css = [
      '@media (max-width:980px){',
      '#toast{bottom:calc(84px + env(safe-area-inset-bottom,0px))!important;z-index:340!important}',
      '.topbar .pill{font-size:0!important;padding:7px 9px!important;gap:0!important}',
      '.topbar .pill .dot{width:9px;height:9px}',
      '}',
      '.rp-step{font-size:12.5px;color:var(--muted);margin:0 8px 0 0;white-space:nowrap}',
      '.rp-setstat{font-size:12.5px;color:var(--muted);margin:0 0 10px;line-height:1.6}',
      '.overlay.rp-confirm{z-index:400}',
      '.overlay.rp-confirm .box{max-width:360px}',
      '.rp-confirm .rp-msg{font-size:15px;margin-bottom:16px;line-height:1.6}',
      '.rp-confirm .row{justify-content:flex-end;gap:10px}'
    ].join('');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  } catch (e) {}
  var TITLES = { 0: '每日五问', 1: '复盘卡', 2: '打卡墙' };
  function isMob() { try { return window.matchMedia(MOB).matches; } catch (e) { return false; } }
  function setTitle(txt) { try { if (!isMob() || !txt) return; var t = document.getElementById('rpBrandTitle'); if (t) t.textContent = txt; } catch (e) {} }
  var _st = window.slideTo;
  if (typeof _st === 'function') {
    window.slideTo = function (n) {
      try { myIdx = Math.max(0, Math.min(2, Number(n) || 0)); } catch (e) {}
      var r = _st.apply(this, arguments);
      try { window.scrollTo(0, 0); } catch (e) {}
      try { setTitle(TITLES[myIdx]); } catch (e) {}
      return r;
    };
  }
  function paintSetStat() {
    try {
      if (!isMob()) return;
      var box = document.querySelector('#settingsOverlay .box'); if (!box) return;
      var pill = document.getElementById('serverPill');
      var d = box.querySelector('.rp-setstat');
      if (!d) { d = document.createElement('div'); d.className = 'rp-setstat'; box.insertBefore(d, box.firstChild); }
      d.textContent = '服务状态 · ' + (pill ? pill.textContent.replace(/\s+/g, ' ').trim() : '—');
    } catch (e) {}
  }
  var _show = window.showSettings;
  if (typeof _show === 'function') { window.showSettings = function () { var r = _show.apply(this, arguments); try { setTitle('设置'); } catch (e) {} try { paintSetStat(); } catch (e) {} return r; }; }
  var _hide = window.hideSettings;
  if (typeof _hide === 'function') { window.hideSettings = function () { var r = _hide.apply(this, arguments); try { setTitle(TITLES[myIdx]); } catch (e) {} return r; }; }
  function paintStep() {
    try {
      var el = document.getElementById('rpStepCount'); if (!el) return;
      var on = document.querySelector('#qForms .qcard.on');
      var q = (on && on.dataset && on.dataset.q) ? on.dataset.q : '1';
      el.textContent = '第 ' + q + ' / 5 题';
    } catch (e) {}
  }
  var _ss = window.stepShow;
  if (typeof _ss === 'function') { window.stepShow = function (n) { var r = _ss.apply(this, arguments); try { paintStep(); } catch (e) {} return r; }; }
  function rpConfirm(msg, onOk, okText, noText) {
    try {
      var ov = document.createElement('div'); ov.className = 'overlay rp-confirm';
      ov.innerHTML = '<div class="box"><div class="rp-msg"></div><div class="row"><button class="btn ghost" data-no>' + (noText || '取消') + '</button><button class="btn" data-ok>' + (okText || '删除') + '</button></div></div>';
      ov.querySelector('.rp-msg').textContent = msg;
      document.body.appendChild(ov);
      setTimeout(function () { ov.classList.add('show'); }, 10);
      function close() { ov.classList.remove('show'); setTimeout(function () { try { ov.remove(); } catch (e) {} }, 280); }
      ov.querySelector('[data-no]').addEventListener('click', close);
      ov.querySelector('[data-ok]').addEventListener('click', function () { close(); try { onOk(); } catch (e) {} });
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    } catch (e) { try { onOk(); } catch (e2) {} }
  }
  try { window.__rpConfirm = rpConfirm; } catch (e) {}
  var _del = window.deleteCard;
  if (typeof _del === 'function') { window.deleteCard = function (id) { rpConfirm('删除这张复盘卡？删除后无法恢复。', function () { try { _del(id); } catch (e) {} }); }; }
  function mergeWall() {
    try {
      if (!isMob()) return;
      var all = document.querySelectorAll('#deck .slide'); if (all.length < 3) return;
      var slide = all[2]; var wall = document.getElementById('wallSection'); if (!slide || !wall) return;
      if (wall.parentNode === slide) return;
      slide.appendChild(wall);
    } catch (e) {}
  }
  function initBack() {
    try {
      var App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (!App || !App.addListener) { try { console.log('[ReviewPal] 返回键插件未就绪'); } catch (e) {} return; }
      App.addListener('backButton', function () {
        var ov = document.getElementById('settingsOverlay');
        if (ov && ov.classList.contains('show')) { try { window.hideSettings(); } catch (e) {} try { window.slideTo(0); } catch (e) {} return; }
        if (myIdx > 0) { try { window.slideTo(0); } catch (e) {} return; }
        try { App.exitApp(); } catch (e) {}
      });
    } catch (e) {}
  }
  function boot() {
    try { mergeWall(); } catch (e) {}
    try {
      var bar = document.querySelector('.stepsbar');
      if (bar && !document.getElementById('rpStepCount')) { var s = document.createElement('span'); s.id = 'rpStepCount'; s.className = 'rp-step'; bar.insertBefore(s, bar.firstChild); }
      paintStep();
    } catch (e) {}
    try { setTitle(TITLES[myIdx]); } catch (e) {}
    try { initBack(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  try { console.log('[ReviewPal] V1.22 原生化层已加载'); } catch (e) {}
})();
/* ============ V1.23 草稿按天：保存成功后清除今日草稿 ============ */
(function () {
  if (window.__rp_draftclear) return; window.__rp_draftclear = true;
  var cs = window.confirmSave;
  if (typeof cs === 'function') {
    window.confirmSave = async function () {
      var r = await cs.apply(this, arguments);
      try { var sh = document.getElementById('saveHint'); if (sh && /已存入复盘库/.test(sh.textContent)) localStorage.removeItem('reviewpal.draft'); } catch (e) {}
      return r;
    };
  }
  try { console.log('[ReviewPal] V1.23 草稿按天已加载'); } catch (e) {}
})();
/* ============ V1.24 视觉 V2 · 晴空蓝调主题 · 设置分组 · 安全确认 ============ */
(function () {
  if (window.__rp_v124) return; window.__rp_v124 = true;
  var MOB = '(max-width:980px)';
  function isMob() { try { return window.matchMedia(MOB).matches; } catch (e) { return false; } }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function copyText(t) { try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); } else { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } if (typeof toast === 'function') toast('已复制到剪贴板'); } catch (e) {} }
  function bindCopy(el) { try { if (!el || el.__cp) return; el.__cp = 1; var th = null; el.addEventListener('touchstart', function () { th = setTimeout(function () { copyText(el.textContent); }, 600); }, { passive: true }); ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { el.addEventListener(ev, function () { if (th) { clearTimeout(th); th = null; } }, { passive: true }); }); el.addEventListener('dblclick', function () { copyText(el.textContent); }); } catch (e) {} }
  function classifyErr(t) { try { if (/401|403|鉴权|unauthor|invalid[\s\S]{0,12}key|key[\s\S]{0,12}(invalid|错误)/i.test(t)) return '【鉴权失败】API Key 不正确或没有权限'; if (/429|限流|rate.?limit|too many/i.test(t)) return '【被限流】请求过快，稍后再试'; if (/ENOTFOUND|EAI_AGAIN|fetch failed|network|无法连接|ECONN|DNS/i.test(t)) return '【网络不可达】检查网络或接口地址'; if (/timeout|超时|ETIMEDOUT|aborted/i.test(t)) return '【请求超时】'; if (/JSON|parse|Unexpected token|格式/i.test(t)) return '【返回格式异常】模型未按要求返回 JSON'; } catch (e) {} return ''; }
  var PRESETS = { 'DeepSeek': ['https://api.deepseek.com', 'deepseek-v4-flash'], '智谱 GLM': ['https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash'], 'Kimi': ['https://api.moonshot.cn/v1', 'moonshot-v1-8k'], 'OpenAI': ['https://api.openai.com/v1', 'gpt-4o-mini'] };
  try {
    var css = [
      'body.theme-ios{--bg:#F2F2F7;--bg-2:#E9E9EE;--panel:#FFFFFF;--panel-2:#F2F2F7;',
      '--ink:#000000;--muted:rgba(60,60,67,.60);--muted-2:rgba(60,60,67,.45);',
      '--line:rgba(60,60,67,.18);--line-strong:rgba(60,60,67,.29);--hairline:rgba(60,60,67,.14);',
      '--coral:#007AFF;--coral-2:#0A84FF;--accent:#007AFF;',
      '--p-advance:#FF9F0A;--p-ontrack:#34C759;--p-partial:#007AFF;--p-off:#FF3B30;--p-stalled:#8E8E93;',
      '--ok:#34C759;--ok-soft:rgba(52,199,89,.14);--bad:#FF3B30;--bad-soft:rgba(255,59,48,.12);',
      '--info:#007AFF;--info-soft:rgba(0,122,255,.12);--shadow:none;--shadow-2:none;',
      '--mood:#007AFF;--mood-rgb:0,122,255;background-image:none}',
      '.hd.lv2{background:linear-gradient(135deg,color-mix(in srgb,var(--coral) 46%,var(--panel)),color-mix(in srgb,var(--coral) 62%,var(--panel)))!important}',
      '.hd.lv3{background:linear-gradient(135deg,color-mix(in srgb,var(--coral) 72%,var(--panel)),var(--coral))!important}',
      '.hd.lv4{background:linear-gradient(135deg,var(--coral),var(--coral-2))!important}',
      '.hd.today{outline:2.5px solid var(--accent)!important;outline-offset:2px!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 20%,transparent)}',
      '@keyframes rpHd{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:none}}',
      '.hd{animation:rpHd .45s ease both}',
      '.rp-wkhead{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;max-width:400px;font-size:10px;color:var(--muted-2);text-align:center;margin:0 0 4px}',
      '@media(max-width:980px){.rp-wkhead{max-width:none;gap:5px}}',
      '.rp-ring{background:conic-gradient(from -90deg,color-mix(in srgb,var(--accent) 58%,#fff) 0,var(--accent) calc(var(--rp-v,0) * 1%),var(--bg-2) 0)!important}',
      'body.theme-cyber .rp-ring{background:conic-gradient(from -90deg,color-mix(in srgb,var(--accent) 72%,#000) 0,var(--accent) calc(var(--rp-v,0) * 1%),var(--bg-2) 0)!important}',
      '.rp-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;background:color-mix(in srgb,var(--mood) 16%,transparent);color:var(--mood);vertical-align:middle;margin-left:6px}',
      '.rp-mr{width:30px;height:30px;border-radius:50%;position:relative;flex:0 0 auto;background:conic-gradient(var(--mood) calc(var(--m,0) * 1%),var(--bg-2) 0)}',
      '.rp-mr::after{content:"";position:absolute;inset:4px;border-radius:50%;background:var(--panel)}',
      '.rp-mr b{position:absolute;inset:0;display:grid;place-items:center;font-size:8.5px;font-weight:700;color:var(--ink);z-index:1}',
      '.wp.rp-hasring{display:flex;align-items:center;gap:8px}',
      '#settingsOverlay .rp-grp{margin:0 0 18px}',
      '#settingsOverlay .rp-grp > .rp-gh{font-size:12px;color:var(--muted-2);margin:0 0 7px 14px}',
      '#settingsOverlay .rp-list{background:var(--panel);border-radius:12px;overflow:hidden;border:1px solid var(--line)}',
      '#settingsOverlay .rp-li{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--line)}',
      '#settingsOverlay .rp-li:last-child{border-bottom:0}',
      '#settingsOverlay .rp-li .rp-k{font-size:14.5px;color:var(--ink);white-space:nowrap}',
      '#settingsOverlay .rp-li input,#settingsOverlay .rp-li select{margin-left:auto;width:auto;max-width:58%;border:0;background:transparent;text-align:right;padding:4px 0;font-size:13.5px;color:var(--muted)}',
      '#settingsOverlay .rp-li input:focus{box-shadow:none;border:0}',
      '#settingsOverlay .rp-li.stack{display:block}',
      '#settingsOverlay .rp-li.stack input{width:100%;max-width:none;text-align:left;margin-top:6px;background:var(--panel-2);border-radius:8px;padding:8px 10px}',
      '#settingsOverlay .rp-li .rp-act{margin-left:auto;color:var(--accent);font-size:14px;cursor:pointer;background:transparent;border:0;font-family:inherit;padding:4px 0}',
      '#settingsOverlay .rp-note{font-size:11.5px;color:var(--muted-2);margin:8px 14px 0;line-height:1.6}',
      '#settingsOverlay .rp-li .status{margin-left:auto;border:0;background:transparent;padding:0;font-size:12.5px}',
      '#settingsOverlay #testOut{margin:10px 0 0}'
    ].join('');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  } catch (e) {}

  var _apply = window.applyTheme;
  if (typeof _apply === 'function') {
    window.applyTheme = function (mode) {
      var m = mode || 'warm';
      if (m === 'ios') {
        try {
          document.body.classList.remove('theme-cyber'); document.body.classList.add('theme-ios');
          document.documentElement.style.colorScheme = 'light';
          var sw = document.querySelectorAll('#themSw button'); for (var i = 0; i < sw.length; i++) { sw[i].classList.toggle('on', sw[i].dataset.t === 'ios'); }
          try { localStorage.setItem('reviewpal-theme', 'ios'); } catch (e) {}
          window.__theme = 'ios';
        } catch (e) {}
        return;
      }
      var r = _apply.apply(this, arguments);
      try { document.body.classList.remove('theme-ios'); } catch (e) {}
      return r;
    };
  }

  function animateNum() {
    try {
      var el = document.getElementById('rpRingNum'); if (!el) return;
      var target = parseInt(el.textContent, 10) || 0; if (target <= 0) return;
      var t0 = null, dur = 520;
      function step(ts) { if (t0 === null) t0 = ts; var k = Math.min(1, (ts - t0) / dur); el.textContent = Math.round(target * k); if (k < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    } catch (e) {}
  }
  function decorateCard() {
    try {
      var d = document.getElementById('cardDate'); if (!d) return;
      var lbl = ((document.getElementById('cardProgLabel') || {}).textContent || '').trim();
      var b = d.querySelector('.rp-badge');
      if (!b) { b = document.createElement('span'); b.className = 'rp-badge'; d.appendChild(b); }
      var ok = lbl && lbl !== '--';
      b.textContent = ok ? lbl : '';
      b.style.display = ok ? '' : 'none';
    } catch (e) {}
  }
  ['fillFields', 'applyMood'].forEach(function (fn) {
    var o = window[fn]; if (typeof o !== 'function') return;
    window[fn] = function () { var r = o.apply(this, arguments); try { setTimeout(function () { animateNum(); decorateCard(); }, 30); } catch (e) {} return r; };
  });

  function decorateWall() {
    try {
      var box = document.getElementById('wallGrid'); if (!box) return;
      var cards = box.querySelectorAll('.wp[data-score]');
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i]; if (c.querySelector('.rp-mr')) continue;
        var wp = c;
        var sc = parseInt(c.getAttribute('data-score'), 10); if (!(sc >= 0)) continue;
        var ring = document.createElement('span'); ring.className = 'rp-mr'; ring.style.setProperty('--m', String(Math.max(0, Math.min(100, sc))));
        ring.innerHTML = '<b>' + sc + '</b>';
        wp.classList.add('rp-hasring'); wp.insertBefore(ring, wp.firstChild);
      }
    } catch (e) {}
  }
  var _rw = window.renderWall;
  if (typeof _rw === 'function') { window.renderWall = function () { var r = _rw.apply(this, arguments); try { decorateWall(); } catch (e) {} return r; }; }

  function decorateHeat() {
    try {
      var grid = document.getElementById('heatGrid'); if (!grid) return;
      var cells = grid.querySelectorAll('.hd'); for (var i = 0; i < cells.length; i++) { cells[i].style.animationDelay = (i * 12) + 'ms'; }
      var host = grid.parentNode;
      if (host && !host.querySelector('.rp-wkhead')) { var h = document.createElement('div'); h.className = 'rp-wkhead'; h.innerHTML = '<span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>'; host.insertBefore(h, grid); }
    } catch (e) {}
  }
  var _rh = window.renderHeatmap;
  if (typeof _rh === 'function') { window.renderHeatmap = function () { var r = _rh.apply(this, arguments); try { decorateHeat(); } catch (e) {} return r; }; }

  var _rms = window.refreshModelStatus;
  if (typeof _rms === 'function') { window.refreshModelStatus = function () { try { fetch('/api/config').then(function (r) { return r.json(); }).then(function (c) { window.__cfg = c; }).catch(function () {}); } catch (e) {} return _rms.apply(this, arguments); }; }
  var _sk = window.saveKey;
  if (typeof _sk === 'function') {
    window.saveKey = function () {
      var args = arguments;
      try {
        var base = (document.getElementById('baseInput') || {}).value || '';
        var cur = (window.__cfg && window.__cfg.baseUrl) || '';
        var nb = String(base).trim(), cb = String(cur).trim();
        if (nb && nb !== cb) {
          var insecure = /^http:\/\//i.test(nb) && !/localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./i.test(nb);
          var msg = '接口地址将从「' + (cb || '官方默认') + '」改为「' + nb + '」——你的 API Key 会发送到这个新地址。' + (insecure ? '\n⚠ 这是明文 HTTP，Key 可能被窃听。' : '') + '\n\n确认继续保存吗？';
          return rpConfirm(msg, function () { _sk.apply(null, args); }, '继续', '取消');
        }
      } catch (e) {}
      return _sk.apply(this, arguments);
    };
  }
  var _tm = window.testModel;
  if (typeof _tm === 'function') {
    window.testModel = async function () {
      var r = await _tm.apply(this, arguments);
      try { var o = document.getElementById('testOut'); if (o && o.textContent.indexOf('✕') >= 0) { var c = classifyErr(o.textContent); if (c && o.textContent.indexOf(c) !== 0) o.textContent = c + '\n' + o.textContent; } bindCopy(o); } catch (e) {}
      return r;
    };
  }

  function buildGroups() {
    try {
      if (!isMob()) return;
      var box = document.querySelector('#settingsOverlay .box'); if (!box) return;
      if (box.getAttribute('data-grp') === '1') return;
      var key = document.getElementById('keyInput'), model = document.getElementById('modelInput'), base = document.getElementById('baseInput');
      var st = document.getElementById('modelStatus'), pre = document.getElementById('testOut');
      var themSw = document.getElementById('themSw');
      var saveBtn = null, testBtn = null, clearBtn = null, closeBtn = null;
      [].slice.call(box.querySelectorAll('.row button')).forEach(function (b) { var oc = b.getAttribute('onclick') || ''; if (oc.indexOf('saveKey') >= 0) saveBtn = b; else if (oc.indexOf('testModel') >= 0) testBtn = b; else if (oc.indexOf('clearKey') >= 0) clearBtn = b; else if (oc.indexOf('hideSettings') >= 0) closeBtn = b; });
      box.innerHTML = '';
      box.setAttribute('data-grp', '1');
      var wrap = document.createElement('div');
      wrap.innerHTML =
        '<div class="rp-grp"><div class="rp-gh">外观</div><div class="rp-list"><div class="rp-li stack" id="rpThemeRow"><div class="rp-k">主题</div></div></div></div>' +
        '<div class="rp-grp"><div class="rp-gh">模型服务</div><div class="rp-list" id="rpModelList">' +
        '<div class="rp-li"><span class="rp-k">服务商</span></div>' +
        '<div class="rp-li stack"><div class="rp-k">API Key</div></div>' +
        '<div class="rp-li"><span class="rp-k">模型 id</span></div>' +
        '<div class="rp-li stack"><div class="rp-k">接口地址</div></div>' +
        '<div class="rp-li"><span class="rp-k">状态</span></div>' +
        '</div><div class="rp-note">Key 只存本机加密存储；更换接口地址前会二次确认，防止 Key 被发到陌生地址。</div></div>' +
        '<div class="rp-grp"><div class="rp-gh">操作</div><div class="rp-list" id="rpActList"></div><pre id="testOut" style="display:none"></pre></div>';
      box.appendChild(wrap);
      var themeRow = box.querySelector('#rpThemeRow');
      if (themeRow && themSw) { themSw.style.display = ''; themeRow.appendChild(themSw); }
      var rows = box.querySelectorAll('#rpModelList .rp-li');
      var sel = document.createElement('select'); sel.id = 'rpPreset';
      ['自定义', 'DeepSeek', '智谱 GLM', 'Kimi', 'OpenAI'].forEach(function (o) { var op = document.createElement('option'); op.value = o; op.textContent = o; sel.appendChild(op); });
      sel.addEventListener('change', function () { var pv = PRESETS[sel.value]; if (pv) { if (model) model.value = pv[1]; if (base) base.value = pv[0]; if (typeof toast === 'function') toast('已填入「' + sel.value + '」预设，记得点保存'); } });
      if (rows[0]) rows[0].appendChild(sel);
      if (rows[1] && key) rows[1].appendChild(key);
      if (rows[2] && model) rows[2].appendChild(model);
      if (rows[3] && base) rows[3].appendChild(base);
      if (rows[4] && st) rows[4].appendChild(st);
      var act = box.querySelector('#rpActList');
      var addAct = function (btn) { if (!btn) return; var row = document.createElement('div'); row.className = 'rp-li'; btn.className = 'rp-act'; row.appendChild(btn); act.appendChild(row); };
      addAct(saveBtn); addAct(testBtn); addAct(clearBtn);
      if (closeBtn) closeBtn.style.display = 'none';
      var newPre = box.querySelector('#testOut'); if (newPre && pre && pre !== newPre) { newPre.parentNode.replaceChild(pre, newPre); }
    } catch (e) {}
  }
  var _show = window.showSettings;
  if (typeof _show === 'function') { window.showSettings = function () { var r = _show.apply(this, arguments); try { buildGroups(); } catch (e) {} return r; }; }

  function boot() {
    try { buildGroups(); } catch (e) {}
    try { decorateWall(); } catch (e) {}
    try { decorateHeat(); } catch (e) {}
    try { bindCopy(document.getElementById('testOut')); } catch (e) {}
    try { var cur = window.__theme; if (!cur) { try { cur = localStorage.getItem('reviewpal-theme'); } catch (e) {} } if (cur === 'ios') window.applyTheme('ios'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  try { console.log('[ReviewPal] V1.24 视觉V2层已加载'); } catch (e) {}
})();
/* ============ V1.25 布局修复：隐藏重复标题 · 步骤条两行 · 防横向溢出 ============ */
(function () {
  if (window.__rp_v125) return; window.__rp_v125 = true;
  try {
    var css = [
      '@media (max-width:980px){',
      '#deck .slide > .panelgrid > .block:first-child > .btitle{display:none}',
      '.stepsbar{flex-wrap:wrap;row-gap:10px}',
      '.stepsbar .stepdots{order:1}',
      '.stepsbar #rpStepCount{order:2;margin-left:auto;margin-right:0}',
      '.stepsbar .row{order:3;width:100%;justify-content:space-between;gap:10px;flex-wrap:nowrap}',
      '.stepsbar .row .btn{flex:1;text-align:center;padding-left:8px;padding-right:8px;min-width:0}',
      'body{overflow-x:hidden}',
      '.deck{height:auto!important;max-height:none!important;min-height:0!important}',
      '.rp-wkhead,.heatgrid{max-width:100%!important}',
      '}',
      '.rp-step{margin:0}'
    ].join('');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  } catch (e) {}
  try { console.log('[ReviewPal] V1.25 布局修复已加载'); } catch (e) {}
})();
/* ============ V1.26 每日提醒（本地通知） ============ */
(function () {
  if (window.__rp_v126) return; window.__rp_v126 = true;
  var MOB = '(max-width:980px)';
  function isMob() { try { return window.matchMedia(MOB).matches; } catch (e) { return false; } }
  var KEY = 'reviewpal.reminder', ID = 1001, CH = 'rp-daily';
  function rmGet() { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); return (o && typeof o === 'object') ? o : { on: false, time: '21:30' }; } catch (e) { return { on: false, time: '21:30' }; } }
  function rmSet(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function LN() { try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null; } catch (e) { return null; } }
  function tst(m) { try { toast(m); } catch (e) {} }
  async function chan(P) { try { if (P.createChannel) await P.createChannel({ id: CH, name: '每日复盘提醒', description: '每日五问打卡提醒', importance: 4 }); } catch (e) {} }
  async function sched(P, notif) {
    try { await P.schedule({ notifications: [notif] }); return true; }
    catch (e) { try { if (notif.schedule) { notif.schedule.allowWhileIdle = false; } await P.schedule({ notifications: [notif] }); return true; } catch (e2) { throw e2; } }
  }
  async function rmSchedule(askPerm) {
    var P = LN(); if (!P) return false;
    try { if (askPerm && P.requestPermissions) { var pr = await P.requestPermissions(); if (pr && pr.display && pr.display !== 'granted') tst('未授予通知权限，提醒可能不会出现（可在系统设置里开启）'); } } catch (e) {}
    await chan(P);
    try { await P.cancel({ notifications: [{ id: ID }] }); } catch (e) {}
    var o = rmGet(); var t = String(o.time || '21:30').split(':'); var h = parseInt(t[0], 10), mi = parseInt(t[1], 10);
    if (!(h >= 0 && h <= 23)) h = 21; if (!(mi >= 0 && mi <= 59)) mi = 30;
    try { await sched(P, { id: ID, title: '复盘通 · 今天还没复盘', body: '花 2 分钟回答「每日五问」，别断掉连续打卡。', channelId: CH, schedule: { on: { hour: h, minute: mi }, repeats: true, allowWhileIdle: true } }); return true; }
    catch (e) { tst('设置提醒失败：' + ((e && e.message) || e)); return false; }
  }
  async function rmCancel() { var P = LN(); if (!P) return; try { await P.cancel({ notifications: [{ id: ID }] }); } catch (e) {} }
  async function rmTest() {
    var P = LN(); if (!P) { tst('当前环境不支持本地通知'); return; }
    try { if (P.requestPermissions) await P.requestPermissions(); } catch (e) {}
    await chan(P);
    try { await sched(P, { id: 1002, title: '复盘通 · 测试提醒', body: '看到这条，说明提醒功能是通的 👍', channelId: CH, schedule: { at: new Date(Date.now() + 5000) } }); tst('5 秒后会来一条测试提醒'); }
    catch (e) { tst('测试失败：' + ((e && e.message) || e)); }
  }
  try {
    var css = [
      '.rp-sw{width:48px;height:29px;border-radius:999px;background:var(--line-strong);position:relative;margin-left:auto;flex:0 0 auto;cursor:pointer;transition:background .2s}',
      '.rp-sw::after{content:"";position:absolute;left:2px;top:2px;width:25px;height:25px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s}',
      '.rp-sw.on{background:#34C759}',
      '.rp-sw.on::after{left:21px}',
      '#settingsOverlay .rp-li input[type=time]{border:0;background:transparent;color:var(--muted);text-align:right;font-size:14px;margin-left:auto;width:auto}',
      '#settingsOverlay .rp-li input[type=time]:focus{box-shadow:none}'
    ].join('');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  } catch (e) {}
  function paint() {
    try { var o = rmGet();
      var sw = document.getElementById('rpRemindSw'); if (sw) sw.className = 'rp-sw' + (o.on ? ' on' : '');
      var ti = document.getElementById('rpRemindTime'); if (ti && o.time && ti.value !== o.time) ti.value = o.time;
    } catch (e) {}
  }
  function ensureGroup() {
    if (!isMob()) return;
    var box = document.querySelector('#settingsOverlay .box'); if (!box) return;
    if (document.getElementById('rpRemindList')) { paint(); return; }
    var grp = document.createElement('div'); grp.className = 'rp-grp';
    grp.innerHTML = '<div class="rp-gh">提醒</div><div class="rp-list" id="rpRemindList">' +
      '<div class="rp-li"><span class="rp-k">每日复盘提醒</span><span class="rp-sw" id="rpRemindSw"></span></div>' +
      '<div class="rp-li"><span class="rp-k">提醒时间</span><input type="time" id="rpRemindTime" value="21:30"></div>' +
      '<div class="rp-li"><span class="rp-k">发一条测试提醒</span><button class="rp-act" id="rpRemindTest">测试</button></div>' +
      '</div>';
    var first = box.querySelector('.rp-grp');
    if (first && first.parentNode) first.parentNode.insertBefore(grp, first.nextSibling); else box.appendChild(grp);
    var sw = document.getElementById('rpRemindSw');
    if (sw) sw.addEventListener('click', async function () {
      var o = rmGet(); o.on = !o.on; rmSet(o); paint();
      if (o.on) {
        if (!LN()) { tst('当前环境不支持本地通知（仅 App 内可用）'); o.on = false; rmSet(o); paint(); return; }
        var ok = await rmSchedule(true);
        if (!ok) { o.on = false; rmSet(o); paint(); } else { tst('已开启每日提醒 ' + o.time); }
      } else { await rmCancel(); tst('已关闭每日提醒'); }
    });
    var ti = document.getElementById('rpRemindTime');
    if (ti) ti.addEventListener('change', async function () { var o = rmGet(); o.time = ti.value || '21:30'; rmSet(o); if (o.on) await rmSchedule(false); tst('提醒时间已设为 ' + o.time); });
    var tb = document.getElementById('rpRemindTest');
    if (tb) tb.addEventListener('click', function () { rmTest(); });
    paint();
  }
  var _show = window.showSettings;
  if (typeof _show === 'function') { window.showSettings = function () { var r = _show.apply(this, arguments); try { setTimeout(ensureGroup, 0); } catch (e) {} return r; }; }
  function boot() {
    try { if (rmGet().on && LN()) rmSchedule(false); } catch (e) {}
    try { ensureGroup(); } catch (e) {}
    try { console.log('[ReviewPal] V1.26 每日提醒已加载'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
/* ============ V1.27 闹钟式时间滚轮 · 设置页高亮 · 提醒可靠性 ============ */
(function () {
  if (window.__rp_v127) return; window.__rp_v127 = true;
  var MOB = '(max-width:980px)';
  function isMob() { try { return window.matchMedia(MOB).matches; } catch (e) { return false; } }
  var KEY = 'reviewpal.reminder', ID = 1001, CH = 'rp-daily';
  function rmGet() { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); return (o && typeof o === 'object') ? o : { on: false, time: '21:30' }; } catch (e) { return { on: false, time: '21:30' }; } }
  function rmSet(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function LN() { try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null; } catch (e) { return null; } }
  function tst(m) { try { toast(m); } catch (e) {} }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function nextAt(h, m) { var d = new Date(); d.setHours(h, m, 0, 0); if (d.getTime() <= Date.now() + 2000) d.setDate(d.getDate() + 1); return d; }
  async function chan(P) { try { if (P.createChannel) await P.createChannel({ id: CH, name: '每日复盘提醒', description: '每日五问打卡提醒', importance: 5, vibration: true }); } catch (e) {} }
  async function one(P, n) { try { await P.schedule({ notifications: [n] }); return true; } catch (e) { return false; } }
  async function rmSchedule(askPerm) {
    var P = LN(); if (!P) { tst('当前环境不支持本地通知（仅 App 内可用）'); return false; }
    var perm = '';
    try { if (askPerm && P.requestPermissions) { var r = await P.requestPermissions(); perm = (r && r.display) || ''; } else if (P.checkPermissions) { var r2 = await P.checkPermissions(); perm = (r2 && r2.display) || ''; } } catch (e) {}
    await chan(P);
    try { await P.cancel({ notifications: [{ id: ID }] }); } catch (e) {}
    var o = rmGet(), t = String(o.time || '21:30').split(':'), h = parseInt(t[0], 10), mi = parseInt(t[1], 10);
    if (!(h >= 0 && h <= 23)) h = 21; if (!(mi >= 0 && mi <= 59)) mi = 30;
    var base = { id: ID, title: '复盘通 · 今天还没复盘', body: '花 2 分钟回答「每日五问」，别断掉连续打卡。', channelId: CH };
    var ok = false;
    ok = await one(P, Object.assign({}, base, { schedule: { at: nextAt(h, mi), repeats: true, every: 'day', allowWhileIdle: true } }));
    if (!ok) ok = await one(P, Object.assign({}, base, { schedule: { on: { hour: h, minute: mi }, repeats: true, allowWhileIdle: true } }));
    if (!ok) ok = await one(P, Object.assign({}, base, { schedule: { at: nextAt(h, mi), repeats: true, every: 'day' } }));
    var pend = -1; try { if (P.getPending) { var gp = await P.getPending(); pend = (gp && gp.notifications) ? gp.notifications.length : -1; } } catch (e) {}
    if (!ok) { tst('登记提醒失败：请检查「通知」与「闹钟/精确提醒」权限'); return false; }
    var hint = (perm && perm !== 'granted') ? '（通知未授权，请到系统设置里允许）' : '';
    tst('已登记每日 ' + pad2(h) + ':' + pad2(mi) + '，系统待触发 ' + pend + ' 条 ' + hint);
    return true;
  }
  async function rmCancel() { var P = LN(); if (!P) return; try { await P.cancel({ notifications: [{ id: ID }] }); } catch (e) {} }
  async function rmTest() {
    var P = LN(); if (!P) { tst('当前环境不支持本地通知（仅 App 内可用）'); return; }
    try { if (P.requestPermissions) await P.requestPermissions(); } catch (e) {}
    await chan(P);
    var d = new Date(Date.now() + 6000);
    var ok = await one(P, { id: 1002, title: '复盘通 · 测试提醒', body: '看到这条，说明提醒功能是通的 👍', channelId: CH, schedule: { at: d } });
    tst(ok ? '6 秒后会来一条测试提醒' : '测试登记失败：检查通知权限');
  }
  function setTab(i) { try { var bs = document.querySelectorAll('#rpTabs button'); for (var k = 0; k < bs.length; k++) bs[k].classList.toggle('on', k === i); } catch (e) {} }
  try {
    var css = [
      '#qList{display:none}',
      '@media (max-width:980px){',
      '#quoteOverlay .box{max-height:86vh;padding-top:10px}',
      '#quoteOverlay #quoteSearch{position:sticky;top:0;z-index:2}',
      '#quoteList li{font-size:14px;padding:11px 13px}',
      '}',
      '.overlay.rp-tp{align-items:flex-end;justify-content:center;padding:0;background:rgba(0,0,0,.45)}',
      '.overlay.rp-tp .tp-sheet{width:100%;max-width:520px;background:var(--panel);border-radius:20px 20px 0 0;padding:12px 16px calc(16px + env(safe-area-inset-bottom));transform:translateY(14px);transition:transform .26s cubic-bezier(.22,.9,.28,1)}',
      '.overlay.rp-tp.show .tp-sheet{transform:none}',
      '.rp-tp .tp-head{display:flex;align-items:center;justify-content:space-between}',
      '.rp-tp .tp-head b{font-size:16px}',
      '.rp-tp .tp-b{background:transparent;border:0;font:inherit;font-size:14.5px;color:var(--muted);cursor:pointer;padding:6px 2px}',
      '.rp-tp .tp-b.strong{color:var(--accent);font-weight:700}',
      '.rp-tp .tp-wheels{position:relative;display:flex;justify-content:center;gap:30px;height:220px;margin-top:4px}',
      '.rp-tp .tp-col{position:relative;z-index:1;width:86px;height:220px;overflow-y:scroll;scroll-snap-type:y mandatory;padding:88px 0;scrollbar-width:none}',
      '.rp-tp .tp-col::-webkit-scrollbar{display:none}',
      '.rp-tp .tp-col i{display:block;height:44px;line-height:44px;text-align:center;font-style:normal;font-size:22px;font-variant-numeric:tabular-nums;color:var(--muted-2);scroll-snap-align:center}',
      '.rp-tp .tp-col i.sel{color:var(--ink);font-weight:700}',
      '.rp-tp .tp-hi{position:absolute;z-index:0;left:50%;transform:translateX(-50%);width:202px;top:88px;height:44px;background:var(--panel-2);border-radius:10px;pointer-events:none}',
      '.rp-tp .tp-labels{display:flex;justify-content:center;gap:30px;font-size:12px;color:var(--muted-2)}',
      '.rp-tp .tp-labels span{width:86px;text-align:center}',
      '.rp-tp .tp-note{margin-top:10px;text-align:center;font-size:12.5px;color:var(--muted)}',
      '#settingsOverlay .rp-v{margin-left:auto;color:var(--muted);font-size:14px}',
      '#settingsOverlay .rp-ch{color:var(--muted-2);font-size:16px;margin-left:4px}'
    ].join('');
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  } catch (e) {}
  function ensurePick() {
    if (document.getElementById('rpTimePick')) return;
    var ov = document.createElement('div'); ov.className = 'overlay rp-tp'; ov.id = 'rpTimePick';
    ov.innerHTML = '<div class="tp-sheet"><div class="tp-head"><button class="tp-b" id="rpTpCancel">取消</button><b>提醒时间</b><button class="tp-b strong" id="rpTpOk">确定</button></div>' +
      '<div class="tp-wheels"><div class="tp-col" id="rpTpHour"></div><div class="tp-col" id="rpTpMin"></div><div class="tp-hi"></div></div>' +
      '<div class="tp-labels"><span>时</span><span>分</span></div><div class="tp-note">重复：每天 · 到点推送到手机通知</div></div>';
    document.body.appendChild(ov);
    document.getElementById('rpTpCancel').addEventListener('click', function () { ov.classList.remove('show'); });
    document.getElementById('rpTpOk').addEventListener('click', okTimePick);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('show'); });
  }
  function markSel(col) { var idx = Math.max(0, Math.min(col.children.length - 1, Math.round(col.scrollTop / 44))); for (var i = 0; i < col.children.length; i++) col.children[i].classList.toggle('sel', i === idx); }
  function fillCol(col, n, val) { col.innerHTML = ''; for (var i = 0; i < n; i++) { var b = document.createElement('i'); b.textContent = pad2(i); b.setAttribute('data-v', i); col.appendChild(b); } col.onscroll = function () { markSel(col); }; col.scrollTop = val * 44; markSel(col); }
  function openTimePick() {
    if (!isMob()) return;
    ensurePick();
    var o = rmGet(), t = String(o.time || '21:30').split(':');
    fillCol(document.getElementById('rpTpHour'), 24, parseInt(t[0], 10) || 0);
    fillCol(document.getElementById('rpTpMin'), 60, parseInt(t[1], 10) || 0);
    document.getElementById('rpTimePick').classList.add('show');
  }
  function okTimePick() {
    var hc = document.getElementById('rpTpHour'), mc = document.getElementById('rpTpMin'); if (!hc || !mc) return;
    var h = Math.max(0, Math.min(23, Math.round(hc.scrollTop / 44))), m = Math.max(0, Math.min(59, Math.round(mc.scrollTop / 44)));
    var o = rmGet(); o.time = pad2(h) + ':' + pad2(m); rmSet(o);
    document.getElementById('rpTimePick').classList.remove('show');
    paintTime();
    if (o.on) rmSchedule(false); else tst('提醒时间已设为 ' + o.time);
  }
  function paintTime() { var el = document.getElementById('rpRemindTime'); if (el && el.tagName !== 'INPUT') el.textContent = rmGet().time || '21:30'; }
  function upgradeTimeRow() {
    var el = document.getElementById('rpRemindTime'); if (!el || el.tagName !== 'INPUT') { paintTime(); return; }
    var row = el.closest('.rp-li'); if (!row) return;
    row.innerHTML = '<span class="rp-k">提醒时间</span><span class="rp-v" id="rpRemindTime"></span><span class="rp-ch">›</span>';
    row.style.cursor = 'pointer';
    row.addEventListener('click', openTimePick);
    paintTime();
  }
  var _show = window.showSettings;
  if (typeof _show === 'function') { window.showSettings = function () { var r = _show.apply(this, arguments); try { setTab(3); } catch (e) {} try { setTimeout(function () { upgradeTimeRow(); }, 0); } catch (e) {} return r; }; }
  function boot() {
    try { if (rmGet().on && LN()) rmSchedule(false); } catch (e) {}
    try { upgradeTimeRow(); } catch (e) {}
    try { console.log('[ReviewPal] V1.27 闹钟式时间/设置高亮已加载'); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();


/* ============ V1.28 Token 用量（手机设置页 · 模型服务分组） ============ */
(function () {
  if (window.__rp_v128) return; window.__rp_v128 = true;
  var MOB = '(max-width:980px)';
  function isMob() { try { return window.matchMedia(MOB).matches; } catch (e) { return false; } }
  function row() {
    var list = document.querySelector('#rpModelList'); if (!list) return null;
    var el = list.querySelector('#rpUsage');
    if (!el) {
      var li = document.createElement('div'); li.className = 'rp-li';
      li.innerHTML = '<span class="rp-k">Token 用量</span><span class="rp-v" id="rpUsage">—</span>';
      list.appendChild(li); el = li.querySelector('#rpUsage');
    }
    return el;
  }
  function fmt(u) {
    if (!u || !u.ok) return '读取失败';
    var t = function (x) { return (x && x.total) || 0; };
    if (u.mock) return 'Mock 模式无用量';
    return '今日 ' + t(u.today) + ' · 本月 ' + t(u.thisMonth) + ' · 累计 ' + t(u.total);
  }
  function load(el) {
    if (!el) return;
    try {
      fetch('/api/usage').then(function (r) { return r.json(); }).then(function (u) { el.textContent = fmt(u); })
        .catch(function () { el.textContent = '读取失败'; });
    } catch (e) { el.textContent = '读取失败'; }
  }
  function tick() {
    try {
      if (!isMob()) return;
      var ov = document.getElementById('settingsOverlay'); if (!ov || !ov.classList.contains('show')) return;
      load(row());
    } catch (e) {}
  }
  var _s = window.showSettings;
  if (typeof _s === 'function') { window.showSettings = function () { var r = _s.apply(this, arguments); try { setTimeout(tick, 0); } catch (e) {} return r; }; }
  try { console.log('[ReviewPal] V1.28 Token 用量已加载'); } catch (e) {}
})();