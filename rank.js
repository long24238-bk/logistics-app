// 대시보드 보강 (admin.js는 그대로 두고 화면만 고칩니다)
// 1) '기사님별 정산' 표에 [순위] · [1회 평균](운행비 ÷ 횟수) 칸 추가
// 2) '담당자별' 카드 숨김
// 3) '이번 달 미입력 기사님' → '일별 미입력 기사님' (1일~오늘, 일요일 제외, 최근 날짜부터)
// 대시보드가 다시 그려질 때마다(월 변경, 새로고침 등) 자동으로 다시 적용됩니다.
(function () {
  var MARK = 'data-rk';
  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  var css = [
    'table[' + MARK + '] .rk-no{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-weight:700;font-size:12px;background:rgba(255,255,255,.08)}',
    'table[' + MARK + '] .rk-1{background:#d4a72c;color:#1b1b1b}',
    'table[' + MARK + '] .rk-2{background:#b8c0c8;color:#1b1b1b}',
    'table[' + MARK + '] .rk-3{background:#b0714a;color:#fff}',
    'table[' + MARK + '] .rk-none{background:none;opacity:.5}',
    'table[' + MARK + '] th.rk-c,table[' + MARK + '] td.rk-c{text-align:center;width:44px}',
    '.rk-days{display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto}',
    '.rk-day{display:grid;grid-template-columns:104px 1fr;gap:8px;align-items:start;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.04)}',
    '.rk-day b{font-size:13px;white-space:nowrap}',
    '.rk-day .rk-today{color:var(--accent,#e50049);font-size:11px;margin-left:3px}',
    '.rk-names{display:flex;flex-wrap:wrap;gap:4px}',
    '.rk-names span{font-size:12px;padding:2px 8px;border-radius:999px;background:rgba(217,138,0,.18);color:#f0b54a}',
    // 왼쪽 '기사님별 정산' 카드와 오른쪽 칸 높이 맞추기, 표가 카드 높이를 채우게
    '.dash-grid{align-items:stretch!important}',
    '.dash-grid>section.card:first-child{align-self:stretch!important}',
    '.dash-grid>section.card:first-child .tbl-wrap{flex:1 1 auto;display:flex;overflow-x:visible}',
    '.dash-grid>section.card:first-child .tbl-wrap>table{height:100%}',
    '.dash-grid>.stack{display:flex;flex-direction:column}',
    '.dash-grid>.stack>section.card:last-child{flex:1 1 auto}'
  ].join('\n');

  function addStyle() {
    if (document.getElementById('rkStyle')) return;
    var s = document.createElement('style');
    s.id = 'rkStyle';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function num(t) {
    var n = parseInt(String(t || '').replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }
  function won(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function cardByTitle(title) {
    var heads = document.querySelectorAll('.dash-grid h2');
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].textContent.trim() === title) return heads[i].closest('section') || heads[i].parentElement;
    }
    return null;
  }

  /* ---------- 1) 순위 · 1회 평균 ---------- */
  // 원래 열 순서: 기사님, 담당, 건수, 횟수, 운행비, 유류비, 야간, 정산액, (막대)
  var C_TRIPS = 3, C_RUN = 4, C_AMT = 7;

  function cell(tag, cls, html) {
    var c = document.createElement(tag);
    if (cls) c.className = cls;
    c.innerHTML = html;
    return c;
  }

  function addRank() {
    var sec = cardByTitle('기사님별 정산');
    var table = sec && sec.querySelector('table');
    if (!table || table.hasAttribute(MARK)) return;

    var headRow = table.querySelector('thead tr');
    var drivers = [], totals = [];
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr, tfoot tr'), function (tr) {
      if (tr.children.length < 8) return;
      if (tr.children[0].textContent.trim() === '합계') totals.push(tr); else drivers.push(tr);
    });
    if (!drivers.length) return;

    var list = drivers.map(function (tr) {
      return { tr: tr, amt: num(tr.children[C_AMT].textContent) };
    });
    var prevAmt = null, prevRank = 0;
    list.filter(function (d) { return d.amt > 0; })
      .sort(function (a, b) { return b.amt - a.amt; })
      .forEach(function (d, i) {
        d.rank = d.amt === prevAmt ? prevRank : i + 1; // 같은 금액은 같은 순위
        prevAmt = d.amt; prevRank = d.rank;
      });

    table.setAttribute(MARK, '1');

    // 오른쪽 끝 막대그래프 칸과 범례(운행비·유류비·야간) 삭제 → 가로 스크롤 없이 한 화면에
    var legend = sec.querySelector('.legend');
    if (legend) legend.remove();
    drivers.forEach(function (tr) {
      var last = tr.lastElementChild;
      if (last && last.querySelector('.minibar')) last.remove();
    });
    if (headRow && headRow.children.length > 8 && headRow.lastElementChild.textContent.trim() === '') headRow.lastElementChild.remove();
    totals.forEach(function (tr) {
      if (headRow && tr.children.length > headRow.children.length && tr.lastElementChild.textContent.trim() === '') tr.lastElementChild.remove();
    });

    if (headRow && headRow.children.length >= 8) {
      var runTh = headRow.children[C_RUN];
      var avgTh = cell('th', 'n', '1회 평균');
      avgTh.title = '운행비 ÷ 횟수';
      runTh.parentNode.insertBefore(avgTh, runTh.nextSibling);
      headRow.insertBefore(cell('th', 'rk-c', '순위'), headRow.firstChild);
    }

    function addCells(tr, rankHtml) {
      var trips = num(tr.children[C_TRIPS].textContent);
      var run = num(tr.children[C_RUN].textContent);
      var runTd = tr.children[C_RUN];
      runTd.parentNode.insertBefore(cell('td', 'n', trips > 0 ? won(run / trips) : '-'), runTd.nextSibling);
      tr.insertBefore(cell('td', 'rk-c', rankHtml), tr.firstChild);
    }

    list.forEach(function (d) {
      var r = d.rank;
      addCells(d.tr, r ? '<span class="rk-no' + (r <= 3 ? ' rk-' + r : '') + '">' + r + '</span>'
                       : '<span class="rk-no rk-none">-</span>');
    });
    totals.forEach(function (tr) { addCells(tr, ''); });
  }

  /* ---------- 2) 담당자별 숨김 ---------- */
  function hideManagers() {
    var sec = cardByTitle('담당자별');
    if (sec && sec.style.display !== 'none') sec.style.display = 'none';
  }

  /* ---------- 3) 일별 미입력 기사님 ---------- */
  var cache = {}; // month -> { at, trips, drivers }

  function currentMonth() {
    var bar = document.querySelector('.monthbar');
    var m = bar && bar.textContent.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
    if (m) return m[1] + '-' + pad(+m[2]);
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function token() {
    try { return JSON.parse(localStorage.getItem('lg_session') || '{}').token || null; } catch (e) { return null; }
  }

  function loadMonth(month) {
    var c = cache[month];
    if (c && (c.data || c.loading) && Date.now() - c.at < 60000) return c;
    c = cache[month] = { at: Date.now(), loading: true, data: null };
    var tk = token();
    if (!tk || typeof window.rpc !== 'function') { c.loading = false; c.error = true; return c; }
    Promise.all([window.rpc('lg_trips', { p_token: tk, p_month: month }), window.rpc('lg_drivers_list', { p_token: tk })])
      .then(function (r) { c.data = { trips: r[0] || [], drivers: r[1] || [] }; })
      .catch(function () { c.error = true; })
      .then(function () { c.loading = false; c.at = Date.now(); schedule(true); });
    return c;
  }

  function dailyHtml(month, data) {
    var y = +month.slice(0, 4), m = +month.slice(5, 7);
    var now = new Date();
    var todayKey = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    var last = new Date(y, m, 0).getDate();
    if (y === now.getFullYear() && m === now.getMonth() + 1) last = now.getDate();
    else if (new Date(y, m - 1, 1) > now) last = 0; // 미래 달

    var active = data.drivers.filter(function (d) { return d.active; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name), 'ko'); });
    var entered = {};
    data.trips.forEach(function (t) { entered[t.trip_date + '|' + t.driver_id] = true; });

    var rows = [];
    for (var day = last; day >= 1; day--) {
      var dt = new Date(y, m - 1, day);
      if (dt.getDay() === 0) continue; // 일요일 제외
      var key = month + '-' + pad(day);
      var miss = active.filter(function (d) { return !entered[key + '|' + d.id]; });
      if (!miss.length) continue;
      rows.push('<div class="rk-day"><b>' + m + '/' + day + ' (' + DAYS[dt.getDay()] + ')' +
        (key === todayKey ? '<span class="rk-today">오늘</span>' : '') + '</b>' +
        '<div class="rk-names">' + miss.map(function (d) { return '<span>' + esc(d.name) + '</span>'; }).join('') + '</div></div>');
    }
    if (!rows.length) return '<span class="muted">모든 날짜에 모든 기사님이 입력했습니다. (일요일 제외)</span>';
    return '<div class="rk-days">' + rows.join('') + '</div>' +
      '<span class="muted" style="font-size:12px">일요일 제외 · 사용 중인 기사님 기준</span>';
  }

  function updateMissing(force) {
    var sec = cardByTitle('이번 달 미입력 기사님') || cardByTitle('일별 미입력 기사님');
    if (!sec) return;
    var month = currentMonth();
    var c = loadMonth(month);
    var state = month + ':' + (c.data ? 'ok' + c.at : c.error ? 'err' : 'loading');
    if (!force && sec.getAttribute('data-rk-state') === state) return;
    var body;
    if (c.data) body = dailyHtml(month, c.data);
    else if (c.error) return; // 불러오지 못하면 원래 내용 그대로 둠
    else body = '<span class="muted">불러오는 중…</span>';
    sec.setAttribute('data-rk-state', state);
    sec.innerHTML = '<h2>일별 미입력 기사님</h2>' + body;
  }

  /* ---------- 실행 ---------- */
  function build(force) {
    if (!document.querySelector('.dash-grid')) return;
    addRank();
    hideManagers();
    updateMissing(force);
  }

  var queued = false, forceNext = false;
  function schedule(force) {
    if (force) forceNext = true;
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var f = forceNext; forceNext = false;
      build(f);
    });
  }

  function start() {
    addStyle();
    build(false);
    new MutationObserver(function () { schedule(false); })
      .observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
