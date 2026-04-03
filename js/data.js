'use strict';

// ── Categories ────────────────────────────────────────────────────────────────
const CATS = {
  'Food & Snacks':  { color: '#f97316', icon: '🍜' },
  'Transport':      { color: '#3b82f6', icon: '🚇' },
  'Personal Care':  { color: '#a855f7', icon: '✂️'  },
  'Shopping':       { color: '#ec4899', icon: '🛍️' },
  'Subscriptions':  { color: '#14b8a6', icon: '💳' },
  'Utilities':      { color: '#eab308', icon: '📱' },
  'Health':         { color: '#22c55e', icon: '💊' },
  'Entertainment':  { color: '#f43f5e', icon: '🎬' },
  'Other':          { color: '#94a3b8', icon: '📦' },
};
const CKEYS = Object.keys(CATS);
const MLONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SK = 'ledger_v3';
const SK_B = 'ledger_budgets';

// ── State ─────────────────────────────────────────────────────────────────────
let expenses = [];
let budgets  = {};
let curMonth = new Date().toISOString().slice(0, 7);
let filter   = 'ALL';
let screen   = 'overview';
let editingId = null, delId = null, pendingJson = null, budgetCat = null;
let undoItem = null, undoTimer = null, charts = {};
let searchQ = '', addRecur = false, editRecur = false, isDark = true;

// ── Utilities ─────────────────────────────────────────────────────────────────
const uid     = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmt     = n  => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad     = n  => String(n).padStart(2, '0');
const ymFmt   = ym => { const [y, m] = ym.split('-'); return MLONG[+m - 1] + ' ' + y; };
const mOf     = e  => e.date.slice(0, 7);
const allM    = () => [...new Set(expenses.map(mOf))].sort();
const mExp    = () => expenses.filter(e => mOf(e) === curMonth);
const cOf     = k  => CATS[k] || CATS['Other'];
const todayStr= () => new Date().toISOString().slice(0, 10);
const isFuture= d  => d > todayStr();
const esc     = s  => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Auto-categorise ───────────────────────────────────────────────────────────
function autoCat(l) {
  const lc = l.toLowerCase();
  if (/parking|metro|auto|cab|bus|train|uber|ola|rickshaw|fuel|petrol/.test(lc))    return 'Transport';
  if (/airtel|jio|vi|recharge|broadband|internet|electric|water|gas|bill/.test(lc)) return 'Utilities';
  if (/netflix|spotify|claude|prime|hotstar|subscription|membership|adobe/.test(lc)) return 'Subscriptions';
  if (/haircut|salon|spa|grooming|barber|parlour/.test(lc))                          return 'Personal Care';
  if (/amazon|flipkart|cover|tempered|wallet|cloth|shirt|shoe|bag|shop|myntra/.test(lc)) return 'Shopping';
  if (/doctor|medicine|hospital|pharmacy|clinic|chemist/.test(lc))                  return 'Health';
  if (/movie|cinema|concert|theatre/.test(lc))                                      return 'Entertainment';
  if (/pizza|chicken|burger|biryani|food|bhujia|zeera|momos|fries|muri|jhalmuri|banana|fruit|snack|roll|cake|coffee|chai|tea|dosa|kebab|tikka|popcorn|sweet/.test(lc)) return 'Food & Snacks';
  return 'Other';
}

// ── Storage ───────────────────────────────────────────────────────────────────
function save()        { try { localStorage.setItem(SK,   JSON.stringify(expenses)); } catch(e) {} }
function saveBudgets() { try { localStorage.setItem(SK_B, JSON.stringify(budgets));  } catch(e) {} }

function load() {
  try {
    const d = localStorage.getItem(SK);
    if (d) { expenses = JSON.parse(d); return; }
  } catch(e) {}
  expenses = [];
}

function loadBudgets() {
  try {
    const d = localStorage.getItem(SK_B);
    if (d) { budgets = JSON.parse(d); return; }
  } catch(e) {}
  budgets = {};
}

// ── Weekly helpers ────────────────────────────────────────────────────────────
function wkBounds(off = 0) {
  const n = new Date(), d = n.getDay() || 7;
  const m = new Date(n); m.setDate(n.getDate() - (d - 1) + off * 7);
  const s = new Date(m); s.setDate(m.getDate() + 6);
  const f = x => x.toISOString().slice(0, 10);
  return { s: f(m), e: f(s) };
}
function wkTotal(s, e) {
  return expenses.filter(x => x.date >= s && x.date <= e).reduce((a, b) => a + b.amount, 0);
}
