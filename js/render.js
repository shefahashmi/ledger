'use strict';

// ── Highlight helper ──────────────────────────────────────────────────────────
function hlText(text, q) {
  if (!q) return esc(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return esc(text).replace(re, '<span class="hl">$1</span>');
}

// ── Main render dispatcher ────────────────────────────────────────────────────
function render() {
  const me = mExp(), total = me.reduce((s, e) => s + e.amount, 0), lbl = ymFmt(curMonth);
  ['sd-month','mh-month'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = lbl; });
  ['sd-total','mh-total'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = fmt(total); });
  if (screen === 'overview') renderOv(me, total);
  if (screen === 'log')      renderLog(me);
  if (screen === 'months')   renderMonths();
  if (screen === 'budget')   renderBudget();
}

// ── Overview ──────────────────────────────────────────────────────────────────
function renderOv(me, total) {
  const big  = me.length ? me.reduce((a, b) => b.amount > a.amount ? b : a) : null;
  const days = new Date(+curMonth.slice(0,4), +curMonth.slice(5,7), 0).getDate();

  document.getElementById('kpi-grid').innerHTML =
    `<div class="kpi"><div class="kpi-lbl">Total</div><div class="kpi-val">${fmt(total)}</div><div class="kpi-sub">${me.length} entries</div></div>` +
    `<div class="kpi"><div class="kpi-lbl">Daily Avg</div><div class="kpi-val" style="font-size:13px">${fmt(total / days)}</div><div class="kpi-sub">per day</div></div>` +
    `<div class="kpi"><div class="kpi-lbl">Biggest</div><div class="kpi-val" style="font-size:13px">${big ? fmt(big.amount) : '—'}</div><div class="kpi-sub">${big ? esc(big.label) : ''}</div></div>`;

  // Weekly
  const tw = wkBounds(0), lw = wkBounds(-1);
  const thisW = wkTotal(tw.s, tw.e), lastW = wkTotal(lw.s, lw.e);
  const diff = thisW - lastW, pct = lastW > 0 ? Math.abs(diff / lastW * 100).toFixed(0) : '—';
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
  const dirTxt = dir === 'up' ? `▲ +${pct}% more than last week` : dir === 'down' ? `▼ ${pct}% less than last week` : 'Same as last week';
  document.getElementById('week-grid').innerHTML =
    `<div class="week-card"><div class="week-lbl">This Week</div><div class="week-val">${fmt(thisW)}</div><div class="week-delta ${dir}">${dirTxt}</div></div>` +
    `<div class="week-card"><div class="week-lbl">Last Week</div><div class="week-val">${fmt(lastW)}</div><div class="week-delta same">${lw.s.slice(8)} – ${lw.e.slice(8)} / ${lw.s.slice(5,7)}</div></div>`;

  // Category breakdown
  const cmap = {}; me.forEach(e => { cmap[e.cat] = (cmap[e.cat] || 0) + e.amount; });
  const cats = Object.entries(cmap).sort((a, b) => b[1] - a[1]), maxC = cats[0]?.[1] || 1;
  document.getElementById('cat-list').innerHTML = cats.length
    ? cats.map(([cat, amt]) => {
        const pct = total ? (amt / total * 100).toFixed(1) : 0, c = cOf(cat);
        return `<div class="cat-row"><div class="cat-left"><div class="cat-dot" style="background:${c.color}"></div><div class="cat-info"><div class="cat-name">${c.icon} ${cat}</div><div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(amt/maxC*100).toFixed(1)}%;background:${c.color}"></div></div></div></div><div class="cat-right"><div class="cat-amt" style="color:${c.color}">${fmt(amt)}</div><div class="cat-pct">${pct}%</div></div></div>`;
      }).join('')
    : '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No expenses yet</div></div>';

  buildPie('pie-chart', cats);

  const dmap = {}; me.forEach(e => { const d = +e.date.slice(8,10); dmap[d] = (dmap[d] || 0) + e.amount; });
  buildBar('bar-chart', Object.entries(dmap).sort((a, b) => +a[0] - +b[0]));
}

// ── Quick Add ─────────────────────────────────────────────────────────────────
function renderQuickAdd() {
  const seen = new Set(), recent = [];
  for (let i = expenses.length - 1; i >= 0 && recent.length < 5; i--) {
    const e = expenses[i], k = `${e.label}|${e.cat}|${e.amount}`;
    if (!seen.has(k)) { seen.add(k); recent.push(e); }
  }
  const el = document.getElementById('quick-add-row');
  if (!recent.length) { el.innerHTML = ''; return; }
  el.innerHTML =
    `<div style="font-family:var(--mono);font-size:9px;letter-spacing:2px;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Quick Add</div>` +
    `<div class="quick-strip">${recent.map(e =>
      `<div class="quick-chip" data-label="${esc(e.label)}" data-cat="${e.cat}" data-amt="${e.amount}">` +
      `<div class="quick-chip-lbl">${cOf(e.cat).icon} ${esc(e.label)}</div>` +
      `<div class="quick-chip-sub">${fmt(e.amount)} · ${e.cat}</div></div>`
    ).join('')}</div>`;
  el.querySelectorAll('.quick-chip').forEach(chip => chip.addEventListener('click', () => {
    expenses.push({ id: uid(), date: todayStr(), label: chip.dataset.label, amount: parseFloat(chip.dataset.amt), cat: chip.dataset.cat });
    save(); curMonth = todayStr().slice(0, 7); toast(`✓ Added ${chip.dataset.label}`, 'ok'); render();
  }));
}

// ── Log ───────────────────────────────────────────────────────────────────────
function renderLog(me) {
  renderQuickAdd();
  const used = [...new Set(me.map(e => e.cat))];
  document.getElementById('filter-strip').innerHTML =
    `<button class="fchip ${filter === 'ALL' ? 'active' : ''}" data-f="ALL">ALL</button>` +
    used.map(c => `<button class="fchip ${filter === c ? 'active' : ''}" data-f="${c}">${cOf(c).icon} ${c}</button>`).join('');
  document.querySelectorAll('.fchip').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; renderLog(me); }));

  let fil = filter === 'ALL' ? me : me.filter(e => e.cat === filter);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    fil = (filter === 'ALL' ? expenses : expenses.filter(e => e.cat === filter)).filter(e => e.label.toLowerCase().includes(q));
  }

  const grp = {}; fil.forEach(e => { if (!grp[e.date]) grp[e.date] = []; grp[e.date].push(e); });
  const dates = Object.keys(grp).sort().reverse();
  const logEl = document.getElementById('log-list');

  if (!dates.length) {
    logEl.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">${searchQ ? 'No results found' : 'No expenses'}</div></div>`;
    return;
  }

  let html = searchQ ? `<div class="search-results-lbl">${fil.length} result${fil.length !== 1 ? 's' : ''} for "${esc(searchQ)}"</div>` : '';
  html += dates.map(date => {
    const items = grp[date], dt = items.reduce((s, e) => s + e.amount, 0);
    const dl = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
    return `<div class="day-group"><div class="day-hdr"><span class="day-date-lbl">${dl}</span><span class="day-total-lbl">${fmt(dt)}</span></div>${
      items.map(e => {
        const c = cOf(e.cat), rb = e.recurring ? '<span class="recur-badge">RECUR</span>' : '';
        return `<div class="swipe-container"><div class="swipe-bg" data-del="${e.id}">🗑️</div>` +
          `<div class="exp-row" data-id="${e.id}"><div class="exp-left"><span class="exp-icon">${c.icon}</span>` +
          `<div class="exp-info"><div class="exp-lbl">${hlText(e.label, searchQ)}${rb}</div><div class="exp-cat-tag">${e.cat}</div></div></div>` +
          `<span class="exp-amt" style="color:${c.color}">${fmt(e.amount)}</span>` +
          `<div class="exp-actions"><button class="edit-btn" data-id="${e.id}" title="Edit">✏️</button><button class="del-btn" data-id="${e.id}" title="Delete">✕</button></div>` +
          `</div></div>`;
      }).join('')
    }</div>`;
  }).join('');

  logEl.innerHTML = html;
  document.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); openEdit(b.dataset.id); }));
  document.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); delId = b.dataset.id; document.getElementById('del-overlay').classList.add('open'); }));
  attachSwipe();
}

// ── Swipe to delete ───────────────────────────────────────────────────────────
function attachSwipe() {
  document.querySelectorAll('.swipe-container').forEach(con => {
    const row = con.querySelector('.exp-row'), bg = con.querySelector('.swipe-bg');
    let sx = 0, dx = 0, active = false;
    const MAX = 72;
    function start(e) { const t = e.touches ? e.touches[0] : e; sx = t.clientX; dx = 0; active = true; }
    function move(e)  { if (!active) return; const t = e.touches ? e.touches[0] : e; dx = Math.min(0, Math.max(-MAX, t.clientX - sx)); row.style.transform = `translateX(${dx}px)`; bg.style.opacity = String(Math.abs(dx) / MAX); if (Math.abs(dx) > 5 && e.cancelable) e.preventDefault(); }
    function end()    { if (!active) return; active = false; if (dx < -MAX * .6) { row.style.transform = `translateX(-${MAX}px)`; const id = bg.dataset.del; setTimeout(() => { delId = id; document.getElementById('del-overlay').classList.add('open'); row.style.transform = ''; bg.style.opacity = '0'; }, 200); } else { row.style.transform = ''; bg.style.opacity = '0'; } dx = 0; }
    row.addEventListener('touchstart', start, { passive: true });
    row.addEventListener('touchmove',  move,  { passive: false });
    row.addEventListener('touchend',   end);
  });
}

// ── Months ────────────────────────────────────────────────────────────────────
function renderMonths() {
  const ms = allM();
  const data = ms.map(m => ({
    m,
    label: ymFmt(m),
    year: m.slice(0, 4),
    total: expenses.filter(e => mOf(e) === m).reduce((s, e) => s + e.amount, 0),
    count: expenses.filter(e => mOf(e) === m).length
  }));
  const maxT = Math.max(...data.map(d => d.total), 1);
  buildMonthChart('month-chart', data);

  // Group by year
  const byYear = {};
  [...data].reverse().forEach(d => {
    if (!byYear[d.year]) byYear[d.year] = [];
    byYear[d.year].push(d);
  });

  let html = `<div class="card-title">All Months</div>`;
  Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).forEach(([year, months]) => {
    const yearTotal = months.reduce((s, d) => s + d.total, 0);
    const yearCount = months.reduce((s, d) => s + d.count, 0);
    html += `<div class="year-hdr">
      <div class="year-hdr-left">
        <span class="year-hdr-label">${year}</span>
        <span class="year-hdr-sub">${yearCount} entries · ${fmt(yearTotal)}</span>
      </div>
      <button class="del-year-btn" data-year="${year}" title="Delete all ${year} data">🗑 Delete ${year}</button>
    </div>`;
    html += months.map(d =>
      `<div class="month-row ${d.m === curMonth ? 'cur' : ''}" data-month="${d.m}">` +
      `<div style="flex:1;min-width:0"><div class="month-row-name">${d.label}</div><div class="month-mini-bar"><div class="month-mini-fill" style="width:${(d.total/maxT*100).toFixed(1)}%"></div></div></div>` +
      `<div style="text-align:right;flex-shrink:0;margin-left:10px"><div class="month-row-val">${fmt(d.total)}</div><div class="month-row-ct">${d.count} entries</div></div>` +
      `<button class="del-month-btn" data-month="${d.m}" title="Delete ${d.label}">🗑</button>` +
      `</div>`
    ).join('');
  });

  document.getElementById('month-list').innerHTML = html;

  // Navigate to month on row click (not on delete button)
  document.querySelectorAll('.month-row').forEach(r => r.addEventListener('click', ev => {
    if (ev.target.closest('.del-month-btn')) return;
    curMonth = r.dataset.month; goScreen('overview');
  }));

  // Delete single month
  document.querySelectorAll('.del-month-btn').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    deleteMonth(b.dataset.month);
  }));

  // Delete whole year
  document.querySelectorAll('.del-year-btn').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    deleteYear(b.dataset.year);
  }));
}

// ── Budget ────────────────────────────────────────────────────────────────────
function renderBudget() {
  const me = mExp(), cmap = {}; me.forEach(e => { cmap[e.cat] = (cmap[e.cat] || 0) + e.amount; });
  document.getElementById('budget-list').innerHTML = CKEYS.map(cat => {
    const spent = cmap[cat] || 0, limit = budgets[cat] || 0, pct = limit > 0 ? Math.min(spent / limit * 100, 100) : 0;
    const cls = pct >= 100 ? 'budget-over' : pct >= 75 ? 'budget-warn' : 'budget-ok', c = cOf(cat);
    return `<div class="budget-row"><div class="budget-top"><div class="budget-name">${c.icon} ${cat}</div>` +
      `<div style="display:flex;align-items:center;gap:8px"><div class="budget-nums">${fmt(spent)}${limit > 0 ? ' / ' + fmt(limit) : ''}</div>` +
      `<button class="budget-set-btn" data-cat="${cat}">${limit > 0 ? 'Edit' : 'Set'}</button></div></div>` +
      (limit > 0 ? `<div class="budget-track"><div class="budget-fill ${cls}" style="width:${pct.toFixed(1)}%"></div></div>` : '<div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:4px">No budget set</div>') +
      '</div>';
  }).join('');
  document.querySelectorAll('.budget-set-btn[data-cat]').forEach(b => b.addEventListener('click', () => openBudget(b.dataset.cat)));
  const bCats = CKEYS.filter(c => budgets[c] || cmap[c]);
  buildBudgetChart('budget-chart', bCats, cmap);
}
