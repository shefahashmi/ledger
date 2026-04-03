'use strict';

// ── Text import parser ────────────────────────────────────────────────────────
function parseImport(text) {
  const lines = text.trim().split('\n'), mmap = {};
  MLONG.forEach((m, i) => { mmap[m.toLowerCase()] = i + 1; mmap[m.slice(0,3).toLowerCase()] = i + 1; });
  let curDate = null;
  const entries = [];
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    const dp = line.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dp) { let d = +dp[1], mo = +dp[2], y = +dp[3]; if (y < 100) y += 2000; curDate = `${y}-${pad(mo)}-${pad(d)}`; continue; }
    const ep = line.match(/^([\d,]+(?:\.\d+)?)\s*\/\-\s*(.+)$/);
    if (ep && curDate) entries.push({ id: uid(), date: curDate, label: ep[2].trim(), amount: parseFloat(ep[1].replace(/,/g,'')), cat: autoCat(ep[2].trim()) });
  }
  return entries;
}

// ── Wire up text import ───────────────────────────────────────────────────────
document.getElementById('import-run').addEventListener('click', () => {
  const text = document.getElementById('import-ta').value, msg = document.getElementById('import-msg');
  msg.innerHTML = '';
  if (!text.trim()) { msg.innerHTML = '<div class="import-err">⚠ Paste your expense log first.</div>'; return; }
  const entries = parseImport(text);
  if (!entries.length) { msg.innerHTML = '<div class="import-err">⚠ No expenses found. Dates like <strong>2/4/2026 - Mon</strong>, amounts like <strong>25/- Parking</strong></div>'; return; }
  const importDates = new Set(entries.map(e => e.date));
  expenses = expenses.filter(e => !importDates.has(e.date));
  expenses = [...expenses, ...entries]; save();
  curMonth = entries[0].date.slice(0, 7);
  msg.innerHTML = `<div class="import-ok">✓ Imported ${entries.length} expenses into ${ymFmt(curMonth)}</div>`;
  document.getElementById('import-ta').value = '';
  toast(`✓ Imported ${entries.length} expenses`, 'ok');
  setTimeout(() => goScreen('overview'), 1200);
});

document.getElementById('import-clear').addEventListener('click', () => {
  document.getElementById('import-ta').value = '';
  document.getElementById('import-msg').innerHTML = '';
});

// ── Export JSON ───────────────────────────────────────────────────────────────
document.getElementById('export-json-btn').addEventListener('click', () => {
  try {
    const blob = new Blob([JSON.stringify({ version: 2, exported: new Date().toISOString(), count: expenses.length, budgets, expenses }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `ledger-backup-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url);
    document.getElementById('backup-msg').innerHTML = `<div class="import-ok" style="margin-top:10px">✓ Exported ${expenses.length} expenses</div>`;
    toast('✓ JSON backup downloaded', 'ok');
  } catch(e) { document.getElementById('backup-msg').innerHTML = `<div class="import-err" style="margin-top:10px">⚠ Export failed</div>`; }
});

// ── Export CSV ────────────────────────────────────────────────────────────────
document.getElementById('export-csv-btn').addEventListener('click', () => {
  try {
    const hdr = ['Date','Description','Amount','Category','Recurring','Month'];
    const rows = expenses.slice().sort((a,b) => a.date.localeCompare(b.date))
      .map(e => [e.date, `"${e.label.replace(/"/g,'""')}"`, e.amount.toFixed(2), e.cat, e.recurring ? 'Yes' : 'No', ymFmt(e.date.slice(0,7))]);
    const csv = [hdr, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `ledger-expenses-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(url);
    document.getElementById('backup-msg').innerHTML = `<div class="import-ok" style="margin-top:10px">✓ CSV exported — open in Excel or Google Sheets</div>`;
    toast('✓ CSV downloaded', 'ok');
  } catch(e) { document.getElementById('backup-msg').innerHTML = `<div class="import-err" style="margin-top:10px">⚠ Export failed</div>`; }
});

// ── Restore JSON ──────────────────────────────────────────────────────────────
document.getElementById('json-import-card').addEventListener('click', () => {
  document.getElementById('json-file-input').value = '';
  document.getElementById('json-file-input').click();
});

document.getElementById('json-file-input').addEventListener('change', function() {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const raw = JSON.parse(ev.target.result);
      const arr = raw.expenses || raw;
      if (!Array.isArray(arr)) throw new Error('Invalid format');
      const valid = arr.filter(e => e.id && e.date && typeof e.amount === 'number' && e.label && e.cat);
      if (!valid.length) throw new Error('No valid entries');
      pendingJson = { expenses: valid, budgets: raw.budgets || null };
      document.getElementById('json-confirm-sub').textContent = `Found ${valid.length} expense entries.`;
      document.getElementById('json-confirm-overlay').classList.add('open');
    } catch(e) { document.getElementById('backup-msg').innerHTML = `<div class="import-err" style="margin-top:10px">⚠ ${e.message}</div>`; }
  };
  reader.readAsText(file);
});

document.getElementById('json-merge-btn').addEventListener('click', () => {
  if (!pendingJson) return;
  const ids = new Set(expenses.map(e => e.id));
  const newI = pendingJson.expenses.filter(e => !ids.has(e.id));
  expenses = [...expenses, ...newI]; save();
  if (pendingJson.budgets) { Object.assign(budgets, pendingJson.budgets); saveBudgets(); }
  const ms = allM(); if (ms.length) curMonth = ms[ms.length - 1];
  document.getElementById('json-confirm-overlay').classList.remove('open');
  document.getElementById('backup-msg').innerHTML = `<div class="import-ok" style="margin-top:10px">✓ Merged ${newI.length} new entries</div>`;
  pendingJson = null; toast(`✓ Merged ${newI.length} entries`, 'ok'); render();
});

document.getElementById('json-replace-btn').addEventListener('click', () => {
  if (!pendingJson) return;
  expenses = [...pendingJson.expenses]; save();
  if (pendingJson.budgets) { budgets = pendingJson.budgets; saveBudgets(); }
  const ms = allM(); if (ms.length) curMonth = ms[ms.length - 1];
  document.getElementById('json-confirm-overlay').classList.remove('open');
  document.getElementById('backup-msg').innerHTML = `<div class="import-ok" style="margin-top:10px">✓ Replaced with ${expenses.length} entries</div>`;
  pendingJson = null; toast(`✓ Restored ${expenses.length} expenses`, 'ok'); render();
});

document.getElementById('json-cancel-btn').addEventListener('click', () => { document.getElementById('json-confirm-overlay').classList.remove('open'); pendingJson = null; });
document.getElementById('json-confirm-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) { document.getElementById('json-confirm-overlay').classList.remove('open'); pendingJson = null; } });
