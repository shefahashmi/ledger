'use strict';

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(dark) {
  isDark = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('theme-color-meta').content = dark ? '#0a0a0a' : '#f5f4f0';
  const ico = dark ? '🌙' : '☀️';
  document.getElementById('sd-theme').textContent = ico;
  document.getElementById('mh-theme').textContent = ico;
  try { localStorage.setItem('ledger_theme', dark ? 'dark' : 'light'); } catch(e) {}
}
document.getElementById('sd-theme').addEventListener('click', () => applyTheme(!isDark));
document.getElementById('mh-theme').addEventListener('click', () => applyTheme(!isDark));

// ── Toast ─────────────────────────────────────────────────────────────────────
let tT;
function toast(msg, type = '', undoable = false) {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  document.getElementById('toast-undo-btn').style.display = undoable ? 'inline-block' : 'none';
  clearTimeout(tT);
  tT = setTimeout(() => { el.className = 'toast'; }, undoable ? 5500 : 2400);
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goScreen(name) {
  screen = name; searchQ = '';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('[data-screen]').forEach(el => el.classList.toggle('active', el.dataset.screen === name));
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'add')    initAdd();
  if (name === 'budget') renderBudget();
  render();
}

function chMonth(dir) {
  const ms = allM(), i = ms.indexOf(curMonth) + dir;
  if (i >= 0 && i < ms.length) { curMonth = ms[i]; render(); }
}

['sd-prev','mh-prev'].forEach(id => document.getElementById(id)?.addEventListener('click', () => chMonth(-1)));
['sd-next','mh-next'].forEach(id => document.getElementById(id)?.addEventListener('click', () => chMonth(1)));
document.querySelectorAll('[data-screen]').forEach(el => el.addEventListener('click', () => goScreen(el.dataset.screen)));

// ── Delete + Undo ─────────────────────────────────────────────────────────────
document.getElementById('del-cancel').addEventListener('click', () => { document.getElementById('del-overlay').classList.remove('open'); delId = null; });
document.getElementById('del-confirm').addEventListener('click', () => {
  if (!delId) return;
  const item = expenses.find(e => e.id === delId);
  if (!item) { document.getElementById('del-overlay').classList.remove('open'); delId = null; return; }
  undoItem = { ...item }; expenses = expenses.filter(e => e.id !== delId); save(); delId = null;
  document.getElementById('del-overlay').classList.remove('open'); render();
  toast(`Deleted "${undoItem.label}" — Undo?`, 'err', true);
  clearTimeout(undoTimer); undoTimer = setTimeout(() => { undoItem = null; }, 5000);
});
document.getElementById('del-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) { document.getElementById('del-overlay').classList.remove('open'); delId = null; } });
document.getElementById('toast-undo-btn').addEventListener('click', () => {
  if (!undoItem) return;
  const m = undoItem.date.slice(0, 7);
  expenses.push(undoItem); expenses.sort((a, b) => a.date.localeCompare(b.date)); save(); undoItem = null; clearTimeout(undoTimer); curMonth = m;
  document.getElementById('toast').className = 'toast'; render(); toast('✓ Restored', 'ok');
});

// ── Toggle helper ─────────────────────────────────────────────────────────────
function setToggle(el, state) { el.classList.toggle('on', state); }
document.getElementById('add-recur-row').addEventListener('click', () => { addRecur = !addRecur; setToggle(document.getElementById('add-recur-toggle'), addRecur); });
document.getElementById('edit-recur-toggle').parentElement.addEventListener('click', () => { editRecur = !editRecur; setToggle(document.getElementById('edit-recur-toggle'), editRecur); });

// ── Edit ──────────────────────────────────────────────────────────────────────
function openEdit(id) {
  const e = expenses.find(x => x.id === id); if (!e) return; editingId = id;
  const sel = document.getElementById('edit-cat');
  if (!sel.options.length) CKEYS.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = cOf(k).icon + ' ' + k; sel.appendChild(o); });
  document.getElementById('edit-date').value = e.date;
  document.getElementById('edit-amt').value  = e.amount;
  document.getElementById('edit-desc').value = e.label;
  sel.value = e.cat;
  editRecur = !!e.recurring; setToggle(document.getElementById('edit-recur-toggle'), editRecur);
  ['edit-date-err','edit-date-warn','edit-amt-err','edit-desc-err'].forEach(i => document.getElementById(i).textContent = '');
  ['edit-date','edit-amt','edit-desc'].forEach(i => document.getElementById(i).classList.remove('err-input'));
  document.getElementById('edit-overlay').classList.add('open');
  setTimeout(() => document.getElementById('edit-desc').focus(), 100);
}
document.getElementById('edit-cancel').addEventListener('click', () => { document.getElementById('edit-overlay').classList.remove('open'); editingId = null; });
document.getElementById('edit-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) { document.getElementById('edit-overlay').classList.remove('open'); editingId = null; } });
document.getElementById('edit-save').addEventListener('click', () => {
  if (!editingId) return;
  const ok = vDate('edit-date','edit-date-err','edit-date-warn') & vAmt('edit-amt','edit-amt-err') & vDesc('edit-desc','edit-desc-err');
  if (!ok) return;
  const idx = expenses.findIndex(x => x.id === editingId); if (idx === -1) return;
  expenses[idx] = { ...expenses[idx], date: document.getElementById('edit-date').value, amount: parseFloat(document.getElementById('edit-amt').value), label: document.getElementById('edit-desc').value.trim(), cat: document.getElementById('edit-cat').value, recurring: editRecur };
  save(); curMonth = expenses[idx].date.slice(0, 7);
  document.getElementById('edit-overlay').classList.remove('open'); editingId = null; render(); toast('✓ Updated', 'ok');
});

// ── Budget modal ──────────────────────────────────────────────────────────────
function openBudget(cat) {
  budgetCat = cat;
  document.getElementById('budget-modal-title').textContent = `Budget: ${cat}`;
  document.getElementById('budget-input').value = budgets[cat] || '';
  document.getElementById('budget-overlay').classList.add('open');
  setTimeout(() => document.getElementById('budget-input').focus(), 100);
}
document.getElementById('budget-cancel').addEventListener('click', () => { document.getElementById('budget-overlay').classList.remove('open'); budgetCat = null; });
document.getElementById('budget-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) { document.getElementById('budget-overlay').classList.remove('open'); budgetCat = null; } });
document.getElementById('budget-save').addEventListener('click', () => {
  if (!budgetCat) return;
  const val = parseFloat(document.getElementById('budget-input').value);
  if (val <= 0 || isNaN(val)) delete budgets[budgetCat]; else budgets[budgetCat] = val;
  saveBudgets(); document.getElementById('budget-overlay').classList.remove('open'); budgetCat = null; renderBudget(); toast('✓ Budget updated', 'ok');
});
document.getElementById('reset-budgets-btn').addEventListener('click', () => {
  if (!confirm('Reset all budgets?')) return;
  budgets = {}; saveBudgets(); renderBudget(); toast('Budgets cleared', '');
});

// ── Validation ────────────────────────────────────────────────────────────────
function vDate(inputId, errId, warnId) {
  const v = document.getElementById(inputId).value, eEl = document.getElementById(errId), wEl = warnId ? document.getElementById(warnId) : null, inp = document.getElementById(inputId);
  eEl.textContent = ''; if (wEl) wEl.textContent = ''; inp.classList.remove('err-input');
  if (!v) { eEl.textContent = 'Date is required.'; inp.classList.add('err-input'); return false; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { eEl.textContent = 'Invalid date.'; inp.classList.add('err-input'); return false; }
  if (isFuture(v) && wEl) wEl.textContent = '⚠ This date is in the future.';
  return true;
}
function vAmt(inputId, errId) {
  const v = parseFloat(document.getElementById(inputId).value), eEl = document.getElementById(errId), inp = document.getElementById(inputId);
  eEl.textContent = ''; inp.classList.remove('err-input');
  if (isNaN(v) || v <= 0) { eEl.textContent = 'Enter a valid amount > 0.'; inp.classList.add('err-input'); return false; }
  return true;
}
function vDesc(inputId, errId) {
  const v = document.getElementById(inputId).value.trim(), eEl = document.getElementById(errId), inp = document.getElementById(inputId);
  eEl.textContent = ''; inp.classList.remove('err-input');
  if (!v) { eEl.textContent = 'Description cannot be empty.'; inp.classList.add('err-input'); return false; }
  return true;
}

// ── Add ───────────────────────────────────────────────────────────────────────
function initAdd() {
  const sel = document.getElementById('add-cat');
  if (!sel.options.length) CKEYS.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = cOf(k).icon + ' ' + k; sel.appendChild(o); });
  const di = document.getElementById('add-date'); if (!di.value) di.value = todayStr();
  addRecur = false; setToggle(document.getElementById('add-recur-toggle'), false);
  ['add-date-err','add-date-warn','add-amt-err','add-desc-err'].forEach(id => document.getElementById(id).textContent = '');
  ['add-date','add-amt','add-desc'].forEach(id => document.getElementById(id).classList.remove('err-input'));
}
document.getElementById('add-save').addEventListener('click', () => {
  const ok = vDate('add-date','add-date-err','add-date-warn') & vAmt('add-amt','add-amt-err') & vDesc('add-desc','add-desc-err');
  if (!ok) return;
  const date = document.getElementById('add-date').value, amt = parseFloat(document.getElementById('add-amt').value), desc = document.getElementById('add-desc').value.trim(), cat = document.getElementById('add-cat').value;
  expenses.push({ id: uid(), date, label: desc, amount: amt, cat, recurring: addRecur }); save();
  document.getElementById('add-desc').value = ''; document.getElementById('add-amt').value = ''; addRecur = false; setToggle(document.getElementById('add-recur-toggle'), false);
  curMonth = date.slice(0, 7); toast('✓ Saved!', 'ok'); goScreen('log');
});

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById('search-input').addEventListener('input', function() { searchQ = this.value.trim(); render(); });
document.getElementById('search-clear').addEventListener('click', () => { document.getElementById('search-input').value = ''; searchQ = ''; render(); });

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const active = document.activeElement, typing = active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
  if (typing) return;
  if (e.key === 'Escape') { document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open')); return; }
  if (e.key === 'n' || e.key === 'N') { goScreen('add'); return; }
  if (e.key === '/') { e.preventDefault(); goScreen('log'); setTimeout(() => document.getElementById('search-input').focus(), 120); return; }
  if (e.key === 'o' || e.key === 'O') { goScreen('overview'); return; }
});

// ── Delete Month / Year ───────────────────────────────────────────────────────
function deleteMonth(ym) {
  const count = expenses.filter(e => mOf(e) === ym).length;
  if (!count) return;
  const label = ymFmt(ym);
  if (!confirm(`Delete all ${count} expenses from ${label}?\n\nThis cannot be undone.`)) return;
  expenses = expenses.filter(e => mOf(e) !== ym);
  save();
  // Move to nearest remaining month
  const ms = allM();
  if (ms.length) curMonth = ms[ms.length - 1];
  else curMonth = new Date().toISOString().slice(0, 7);
  toast(`✓ Deleted all ${count} entries from ${label}`, 'ok');
  renderMonths();
  render();
}

function deleteYear(year) {
  const count = expenses.filter(e => e.date.startsWith(year)).length;
  if (!count) return;
  if (!confirm(`Delete ALL ${count} expenses from the entire year ${year}?\n\nThis cannot be undone.`)) return;
  expenses = expenses.filter(e => !e.date.startsWith(year));
  save();
  const ms = allM();
  if (ms.length) curMonth = ms[ms.length - 1];
  else curMonth = new Date().toISOString().slice(0, 7);
  toast(`✓ Deleted all ${count} entries from ${year}`, 'ok');
  renderMonths();
  render();
}

// ── iOS install hint ──────────────────────────────────────────────────────────
(function() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone === true, dismissed = localStorage.getItem('ios_dismissed');
  if (isIOS && !standalone && !dismissed) document.getElementById('ios-hint').classList.add('show');
  document.getElementById('ios-close').addEventListener('click', () => { document.getElementById('ios-hint').classList.remove('show'); localStorage.setItem('ios_dismissed', '1'); });
})();

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Boot ──────────────────────────────────────────────────────────────────────
load(); loadBudgets();
try { const t = localStorage.getItem('ledger_theme'); applyTheme(t !== 'light'); } catch(e) { applyTheme(true); }
const _ms = allM(); if (_ms.length) curMonth = _ms[_ms.length - 1];
goScreen('overview');
