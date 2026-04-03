'use strict';

const TICK = { color: '#555', font: { family: 'DM Mono', size: 9 } };
const GRID = { color: '#1a1a1a' };

function destroyC(k) {
  if (charts[k]) { try { charts[k].destroy(); } catch(e) {} charts[k] = null; }
}

function buildPie(canvasId, cats) {
  destroyC('pie');
  if (!cats.length) return;
  charts.pie = new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: cats.map(c => c[0]),
      datasets: [{ data: cats.map(c => c[1]), backgroundColor: cats.map(c => cOf(c[0]).color), borderWidth: 0, hoverOffset: 8 }]
    },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } } }, cutout: '60%', responsive: true, maintainAspectRatio: false }
  });
}

function buildBar(canvasId, darr) {
  destroyC('bar');
  if (!darr.length) return;
  charts.bar = new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'bar',
    data: { labels: darr.map(d => `${d[0]}`), datasets: [{ data: darr.map(d => d[1]), backgroundColor: '#f97316', borderRadius: 4, borderSkipped: false }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } } }, scales: { x: { grid: GRID, ticks: TICK }, y: { grid: GRID, ticks: { ...TICK, callback: v => '₹' + v } } }, responsive: true, maintainAspectRatio: false }
  });
}

function buildMonthChart(canvasId, data) {
  destroyC('month');
  if (!data.length) return;
  charts.month = new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'bar',
    data: { labels: data.map(d => d.label.slice(0, 3)), datasets: [{ data: data.map(d => d.total), backgroundColor: '#f97316', borderRadius: 5, borderSkipped: false }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } } }, scales: { x: { grid: GRID, ticks: TICK }, y: { grid: GRID, ticks: { ...TICK, callback: v => '₹' + v } } }, responsive: true, maintainAspectRatio: false }
  });
}

function buildBudgetChart(canvasId, bCats, cmap) {
  destroyC('budget');
  if (!bCats.length) return;
  charts.budget = new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'bar',
    data: {
      labels: bCats.map(c => c.split(' ')[0]),
      datasets: [
        { label: 'Spent',  data: bCats.map(c => cmap[c] || 0), backgroundColor: '#f97316', borderRadius: [4,4,0,0], borderSkipped: false },
        { label: 'Budget', data: bCats.map(c => budgets[c] || 0), backgroundColor: 'rgba(255,255,255,.08)', borderRadius: [4,4,0,0], borderSkipped: false }
      ]
    },
    options: {
      plugins: { legend: { display: true, labels: { color: '#555', font: { family: 'DM Mono', size: 9 }, boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } } },
      scales: { x: { grid: GRID, ticks: TICK }, y: { grid: GRID, ticks: { ...TICK, callback: v => '₹' + v } } },
      responsive: true, maintainAspectRatio: false
    }
  });
}
