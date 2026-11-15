/* =========================================================
   Expense Tracker — vanilla JS, data stored in localStorage
   ========================================================= */
(() => {
  'use strict';

  const KEY = 'expenseTracker.v1';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const VIEWS = ['dashboard', 'transactions', 'analytics', 'categories', 'settings'];
  const DEFAULT_CATS = [
    { name: 'Food', color: '#3b82f6' },
    { name: 'Transport', color: '#22b58a' },
    { name: 'Shopping', color: '#f4a340' },
    { name: 'Bills', color: '#a67cf0' },
    { name: 'Health', color: '#22d3ee' },
    { name: 'Entertainment', color: '#facc15' },
    { name: 'Other', color: '#ef6a8a' },
  ];

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthKey = s => s.slice(0, 7);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  function fmtDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
  function monthLabelLong(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }
  function money(n) {
    const v = Number(n) || 0;
    const sign = v < 0 ? '-' : '';
    return `${sign}${state.settings.currency} ${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  /* ---------- state ---------- */
  let state = load();
  const ui = { view: 'dashboard', query: '', type: 'all', category: 'all', month: 'all', sort: 'date-desc', donutScope: 'month', editId: null, formType: 'expense' };

  function defaultSettings() { return { name: '', budget: 8000, currency: '₹' }; }

  function sampleTransactions() {
    const now = new Date();
    const day = off => { const x = new Date(now); x.setDate(x.getDate() - off); return iso(x); };
    const past = (monthsBack, dd) => iso(new Date(now.getFullYear(), now.getMonth() - monthsBack, dd));
    const t = (desc, category, date, amount, type) => ({ id: uid(), desc, category, date, amount, type });
    const list = [
      t('Groceries', 'Food', day(1), 850, 'expense'),
      t('Pocket money', 'Income', day(2), 25000, 'income'),
      t('Bus pass', 'Transport', day(3), 600, 'expense'),
      t('Movie night', 'Entertainment', day(5), 450, 'expense'),
      t('Electricity bill', 'Bills', day(6), 1200, 'expense'),
      t('Books', 'Shopping', day(8), 2100, 'expense'),
      t('Pharmacy', 'Health', day(9), 380, 'expense'),
    ];
    const hist = [[3100, 1200, 800], [4500, 900, 1500], [3700, 1000, 700], [5800, 1400, 2200], [4700, 800, 1900]];
    hist.forEach((h, i) => {
      const m = i + 1;
      list.push(t('Food & dining', 'Food', past(m, 6), h[0], 'expense'));
      list.push(t('Transport', 'Transport', past(m, 12), h[1] * 0.6 + 200, 'expense'));
      list.push(t('Shopping', 'Shopping', past(m, 18), h[2], 'expense'));
      list.push(t('Monthly allowance', 'Income', past(m, 1), 20000 + i * 1000, 'income'));
    });
    return list;
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && Array.isArray(raw.transactions)) {
        return {
          transactions: raw.transactions,
          categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : DEFAULT_CATS.slice(),
          settings: Object.assign(defaultSettings(), raw.settings || {}),
        };
      }
    } catch (e) { /* ignore */ }
    const fresh = { transactions: [], categories: DEFAULT_CATS.slice(), settings: defaultSettings() };
    fresh.transactions = sampleTransactions();
    return fresh;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save — browser storage is full or blocked.'); }
  }

  /* ---------- derived data ---------- */
  const catColor = name => (state.categories.find(c => c.name === name) || {}).color || '#94a3b8';
  const expenses = list => list.filter(t => t.type === 'expense');
  const incomes = list => list.filter(t => t.type === 'income');
  const inMonth = (list, key) => list.filter(t => monthKey(t.date) === key);
  const curKey = () => monthKey(iso(new Date()));
  const prevKey = () => { const d = new Date(); return monthKey(iso(new Date(d.getFullYear(), d.getMonth() - 1, 1))); };
  const total = list => sum(list.map(t => Number(t.amount)));

  function lastMonths(n) {
    const now = new Date(), out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: monthKey(iso(d)), label: MONTHS[d.getMonth()] });
    }
    return out;
  }
  function sorted(list) {
    return list.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }
  function pctChange(cur, prev) {
    if (!prev) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- charts ---------- */
  function niceMax(v) {
    if (v <= 0) return { max: 1000, step: 250 };
    const raw = v / 4, pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw);
    return { max: step * 4, step };
  }
  const axisLabel = v => v >= 1000 ? `${+(v / 1000).toFixed(2)}k` : String(v);

  function barChart(labels, series) {
    const W = 620, H = 270, L = 46, R = 10, T = 14, B = 30;
    const pw = W - L - R, ph = H - T - B;
    const maxVal = Math.max(0, ...series.flatMap(s => s.values));
    const { max, step } = niceMax(maxVal);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">`;
    for (let i = 0; i <= 4; i++) {
      const y = T + ph - (ph * i) / 4;
      svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>`;
      svg += `<text x="${L - 8}" y="${y + 4}" text-anchor="end">${axisLabel(step * i)}</text>`;
    }
    const gw = pw / labels.length, ns = series.length, gap = 4;
    const bw = Math.min(36, (gw * 0.62 - gap * (ns - 1)) / ns);
    labels.forEach((lab, i) => {
      const groupW = bw * ns + gap * (ns - 1);
      const x0 = L + i * gw + (gw - groupW) / 2;
      series.forEach((s, j) => {
        const v = s.values[i];
        let h = (v / max) * ph;
        if (v > 0 && h < 3) h = 3;
        const x = x0 + j * (bw + gap), y = T + ph - h;
        if (v > 0) svg += `<rect class="bar" x="${x}" y="${y}" width="${bw}" height="${h}" rx="${Math.min(7, h / 2)}" fill="${s.color}"><title>${esc(lab)} — ${esc(s.name)}: ${esc(money(v))}</title></rect>`;
      });
      svg += `<text x="${L + i * gw + gw / 2}" y="${H - 8}" text-anchor="middle">${esc(lab)}</text>`;
    });
    return svg + '</svg>';
  }

  function donutChart(data) {
    const totalVal = sum(data.map(d => d.value));
    if (!totalVal) return '<p class="empty">No expenses to show yet.</p>';
    const r = 78, C = 2 * Math.PI * r;
    let offset = 0, circles = '';
    data.forEach(d => {
      const len = (d.value / totalVal) * C;
      circles += `<circle cx="105" cy="105" r="${r}" fill="none" stroke="${d.color}" stroke-width="32" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 105 105)"><title>${esc(d.name)}: ${esc(money(d.value))}</title></circle>`;
      offset += len;
    });
    const svg = `<svg class="donut" viewBox="0 0 210 210" role="img" aria-label="Expenses by category">
      <circle cx="105" cy="105" r="${r}" fill="none" stroke="#0e1626" stroke-width="32"/>${circles}
      <text class="center-val" x="105" y="104" text-anchor="middle">${esc(money(totalVal))}</text>
      <text class="center-sub" x="105" y="122" text-anchor="middle">spent</text></svg>`;
    const legend = '<div class="legend"><ul>' + data.map(d =>
      `<li><span class="dot" style="background:${d.color}"></span>${esc(d.name)}<span class="pct">${Math.round((d.value / totalVal) * 100)}%</span></li>`).join('') + '</ul></div>';
    return svg + legend;
  }

  /* ---------- tables ---------- */
  const ICON_EDIT = '✎', ICON_DEL = '🗑';

  function txRows(list, withActions) {
    if (!list.length) return '<p class="empty">No transactions found.</p>';
    const head = `<thead><tr><th>DESCRIPTION</th><th>CATEGORY</th><th>DATE</th><th>AMOUNT</th><th>TYPE</th>${withActions ? '<th></th>' : ''}</tr></thead>`;
    const body = list.map(t => {
      const exp = t.type === 'expense';
      return `<tr>
        <td>${esc(t.desc)}</td>
        <td class="muted"><span class="cat-chip"><i style="background:${exp ? catColor(t.category) : 'var(--green)'}"></i>${esc(t.category)}</span></td>
        <td class="muted">${fmtDate(t.date)}</td>
        <td class="amt ${exp ? 'exp' : 'inc'}">${exp ? '-' : '+'} ${esc(money(t.amount))}</td>
        <td><span class="badge ${exp ? 'exp' : 'inc'}">${exp ? 'Expense' : 'Income'}</span></td>
        ${withActions ? `<td><div class="row-actions"><button data-edit="${t.id}" title="Edit" aria-label="Edit">${ICON_EDIT}</button><button class="del" data-del="${t.id}" title="Delete" aria-label="Delete">${ICON_DEL}</button></div></td>` : ''}
      </tr>`;
    }).join('');
    return `<table>${head}<tbody>${body}</tbody></table>`;
  }

  /* ---------- renderers ---------- */
  function setChange(el, pct, goodWhenUp) {
    if (pct === null) { el.textContent = 'No data for last month'; el.className = 'stat-change'; return; }
    const up = pct >= 0;
    const good = goodWhenUp ? up : !up;
    el.textContent = `${up ? '↗ +' : '↘ '}${pct.toFixed(1)}% this month`;
    el.className = 'stat-change ' + (good ? 'good' : 'bad');
  }

  function renderSidebar() {
    const spent = total(expenses(inMonth(state.transactions, curKey())));
    const budget = Number(state.settings.budget) || 0;
    $('#budgetAmount').textContent = money(budget);
    const bar = $('#budgetBar');
    const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
    bar.style.width = pct + '%';
    bar.className = 'progress-bar' + (pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '');
    $('#budgetNote').textContent = budget
      ? (spent > budget ? `Over budget by ${money(spent - budget)}` : `${money(spent)} spent • ${money(budget - spent)} left`)
      : 'Set a budget in Settings';
  }

  function renderHeader() {
    const h = new Date().getHours();
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const n = state.settings.name.trim();
    $('#greeting').textContent = `${g}${n ? ', ' + n : ''}!`;
    $('#profileName').textContent = n || 'Profile';
    $('#avatar').textContent = (n || 'U').charAt(0).toUpperCase();
  }

  function renderDashboard() {
    const all = state.transactions;
    const inc = total(incomes(all)), exp = total(expenses(all));
    $('#statBalance').textContent = money(inc - exp);
    $('#statIncome').textContent = money(inc);
    $('#statExpense').textContent = money(exp);

    const cur = inMonth(all, curKey()), prev = inMonth(all, prevKey());
    const curInc = total(incomes(cur)), prevInc = total(incomes(prev));
    const curExp = total(expenses(cur)), prevExp = total(expenses(prev));
    const netNow = curInc - curExp;
    const balBefore = (inc - exp) - netNow;
    setChange($('#chgBalance'), pctChange(inc - exp, balBefore), true);
    setChange($('#chgIncome'), pctChange(curInc, prevInc), true);
    setChange($('#chgExpense'), pctChange(curExp, prevExp), false);

    const months = lastMonths(6);
    $('#barChart').innerHTML = barChart(months.map(m => m.label), [{
      name: 'Expenses', color: 'var(--blue)',
      values: months.map(m => total(expenses(inMonth(all, m.key)))),
    }]);

    ui.donutScope === 'all' ? $('#donutSub').textContent = 'All time' : $('#donutSub').textContent = monthLabelLong(curKey());
    $('#donutScope').value = ui.donutScope;
    const pool = expenses(ui.donutScope === 'all' ? all : cur);
    const byCat = {};
    pool.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount); });
    const data = Object.entries(byCat).map(([name, value]) => ({ name, value, color: catColor(name) })).sort((a, b) => b.value - a.value);
    $('#donutChart').innerHTML = donutChart(data);

    $('#recentTable').innerHTML = txRows(sorted(all).slice(0, 5), false);
  }

  function filteredTx() {
    const q = ui.query.trim().toLowerCase();
    let list = state.transactions.filter(t =>
      (ui.type === 'all' || t.type === ui.type) &&
      (ui.category === 'all' || t.category === ui.category) &&
      (ui.month === 'all' || monthKey(t.date) === ui.month) &&
      (!q || t.desc.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || String(t.amount).includes(q))
    );
    const [field, dir] = ui.sort.split('-');
    list.sort((a, b) => {
      const r = field === 'amount' ? a.amount - b.amount : a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      return dir === 'asc' ? r : -r;
    });
    return list;
  }

  function renderTransactions() {
    const cats = ['all', ...new Set([...state.categories.map(c => c.name), 'Income', ...state.transactions.map(t => t.category)])];
    $('#fCategory').innerHTML = cats.map(c => `<option value="${esc(c)}">${c === 'all' ? 'All categories' : esc(c)}</option>`).join('');
    if (!cats.includes(ui.category)) ui.category = 'all';
    $('#fCategory').value = ui.category;

    const months = [...new Set(state.transactions.map(t => monthKey(t.date)))].sort().reverse();
    $('#fMonth').innerHTML = '<option value="all">All months</option>' + months.map(m => `<option value="${m}">${monthLabelLong(m)}</option>`).join('');
    if (ui.month !== 'all' && !months.includes(ui.month)) ui.month = 'all';
    $('#fMonth').value = ui.month;
    $('#fType').value = ui.type;
    $('#fSort').value = ui.sort;

    const list = filteredTx();
    const inc = total(incomes(list)), exp = total(expenses(list));
    $('#txSummary').textContent = `${list.length} transaction${list.length === 1 ? '' : 's'} • Income ${money(inc)} • Expenses ${money(exp)}` + (ui.query ? ` • matching “${ui.query}”` : '');
    $('#txTable').innerHTML = txRows(list, true);
  }

  function renderAnalytics() {
    const all = state.transactions, cur = inMonth(all, curKey());
    const inc = total(incomes(cur)), exp = total(expenses(cur));
    const now = new Date();
    const daysElapsed = now.getDate();
    const biggest = expenses(cur).sort((a, b) => b.amount - a.amount)[0];
    const rate = inc ? ((inc - exp) / inc) * 100 : null;
    $('#kpis').innerHTML = [
      ['SAVINGS RATE', rate === null ? '—' : rate.toFixed(0) + '%', 'Of income saved this month'],
      ['AVG DAILY SPEND', money(Math.round(exp / daysElapsed)), `Over ${daysElapsed} day${daysElapsed > 1 ? 's' : ''}`],
      ['BIGGEST EXPENSE', biggest ? money(biggest.amount) : '—', biggest ? biggest.desc : 'Nothing spent yet'],
      ['TRANSACTIONS', String(cur.length), 'Recorded this month'],
    ].map(k => `<article class="card kpi"><p class="stat-label">${k[0]}</p><h3 class="stat-value">${esc(k[1])}</h3><p class="stat-change">${esc(k[2])}</p></article>`).join('');

    const months = lastMonths(6);
    $('#compareChart').innerHTML = barChart(months.map(m => m.label), [
      { name: 'Income', color: 'var(--green)', values: months.map(m => total(incomes(inMonth(all, m.key)))) },
      { name: 'Expenses', color: 'var(--blue)', values: months.map(m => total(expenses(inMonth(all, m.key)))) },
    ]);

    const byCat = {};
    expenses(cur).forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount); });
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    $('#topCats').innerHTML = rows.length ? rows.map(([name, v]) => `
      <div class="top-row"><div class="meta"><span>${esc(name)}</span><span>${esc(money(v))} • ${Math.round((v / exp) * 100)}%</span></div>
      <div class="progress"><div class="progress-bar" style="width:${(v / exp) * 100}%;background:${catColor(name)}"></div></div></div>`).join('')
      : '<p class="empty">No expenses this month.</p>';
  }

  function renderCategories() {
    const cur = expenses(inMonth(state.transactions, curKey()));
    $('#catGrid').innerHTML = state.categories.map(c => {
      const mine = cur.filter(t => t.category === c.name);
      return `<div class="cat-card">
        <div class="cat-top"><i style="background:${c.color}"></i>${esc(c.name)}<button data-delcat="${esc(c.name)}" title="Delete category" aria-label="Delete ${esc(c.name)}">✕</button></div>
        <div class="cat-amt">${esc(money(total(mine)))}</div>
        <div class="cat-meta">${mine.length} transaction${mine.length === 1 ? '' : 's'} this month</div></div>`;
    }).join('');
  }

  function renderSettings() {
    $('#setName').value = state.settings.name;
    $('#setBudget').value = state.settings.budget;
    $('#setCurrency').value = state.settings.currency;
  }

  function renderAll() {
    renderHeader();
    renderSidebar();
    ({ dashboard: renderDashboard, transactions: renderTransactions, analytics: renderAnalytics, categories: renderCategories, settings: renderSettings })[ui.view]();
  }

  /* ---------- routing ---------- */
  function route() {
    const v = location.hash.replace('#', '');
    ui.view = VIEWS.includes(v) ? v : 'dashboard';
    VIEWS.forEach(name => { $('#view-' + name).hidden = name !== ui.view; });
    document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.view === ui.view));
    closeMenu();
    renderAll();
    window.scrollTo({ top: 0 });
  }
  function closeMenu() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }

  /* ---------- modal / form ---------- */
  function setFormType(type) {
    ui.formType = type;
    document.querySelectorAll('#typeToggle button').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    $('#catLabel').hidden = type === 'income';
  }
  function openModal(id) {
    ui.editId = id || null;
    const t = id ? state.transactions.find(x => x.id === id) : null;
    $('#modalTitle').textContent = t ? 'Edit transaction' : 'Add transaction';
    $('#txSubmit').textContent = t ? 'Save changes' : 'Add transaction';
    $('#txCategory').innerHTML = state.categories.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    setFormType(t ? t.type : 'expense');
    $('#txDesc').value = t ? t.desc : '';
    $('#txAmount').value = t ? t.amount : '';
    $('#txDate').value = t ? t.date : iso(new Date());
    if (t && t.type === 'expense') {
      if (![...$('#txCategory').options].some(o => o.value === t.category)) $('#txCategory').insertAdjacentHTML('beforeend', `<option value="${esc(t.category)}">${esc(t.category)}</option>`);
      $('#txCategory').value = t.category;
    }
    $('#txError').textContent = '';
    $('#modal').hidden = false;
    setTimeout(() => $('#txDesc').focus(), 30);
  }
  function closeModal() { $('#modal').hidden = true; ui.editId = null; }

  function submitTx(e) {
    e.preventDefault();
    const desc = $('#txDesc').value.trim();
    const amount = Math.round(parseFloat($('#txAmount').value) * 100) / 100;
    const date = $('#txDate').value;
    const err = $('#txError');
    if (!desc) return (err.textContent = 'Please enter a description.');
    if (!(amount > 0)) return (err.textContent = 'Amount must be greater than 0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return (err.textContent = 'Please choose a valid date.');
    const type = ui.formType;
    const category = type === 'income' ? 'Income' : $('#txCategory').value;
    if (ui.editId) {
      const t = state.transactions.find(x => x.id === ui.editId);
      Object.assign(t, { desc, amount, date, type, category });
      toast('Transaction updated');
    } else {
      state.transactions.push({ id: uid(), desc, category, date, amount, type });
      toast('Transaction added');
    }
    save(); closeModal(); renderAll();
  }

  function deleteTx(id) {
    const t = state.transactions.find(x => x.id === id);
    if (!t || !confirm(`Delete “${t.desc}”?`)) return;
    state.transactions = state.transactions.filter(x => x.id !== id);
    save(); renderAll(); toast('Transaction deleted');
  }

  /* ---------- profile ---------- */
  function fillProfile() {
    const n = state.settings.name.trim();
    const all = state.transactions, cur = inMonth(all, curKey());
    const inc = total(incomes(cur)), exp = total(expenses(cur));
    const budget = Number(state.settings.budget) || 0;
    $('#profileAvatar').textContent = (n || 'U').charAt(0).toUpperCase();
    $('#profileFullName').textContent = n || 'Guest';
    $('#profileInput').value = n;
    const first = all.length ? all.map(t => t.date).sort()[0] : null;
    $('#profileSince').textContent = first ? `Tracking since ${fmtDate(first)}` : 'No transactions yet';
    $('#profileStats').innerHTML = [
      ['Transactions', String(all.length)],
      ['Balance', money(total(incomes(all)) - total(expenses(all)))],
      ['Saved this month', money(inc - exp)],
      ['Budget used', budget ? Math.round((exp / budget) * 100) + '%' : '—'],
    ].map(s => `<div class="pstat"><span>${esc(s[0])}</span><strong>${esc(s[1])}</strong></div>`).join('');
  }
  function openProfile() { fillProfile(); $('#profileModal').hidden = false; setTimeout(() => $('#profileInput').focus(), 30); }
  function closeProfile() { $('#profileModal').hidden = true; }

  /* ---------- import / export ---------- */
  function download(name, text, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }
  function exportCsv() {
    const q = s => `"${String(s).replace(/"/g, '""')}"`;
    const rows = filteredTx().map(t => [t.date, q(t.desc), q(t.category), t.type, t.amount].join(','));
    download(`expenses-${iso(new Date())}.csv`, ['Date,Description,Category,Type,Amount', ...rows].join('\n'), 'text/csv');
    toast('CSV exported');
  }
  function exportJson() {
    download(`expense-tracker-backup-${iso(new Date())}.json`, JSON.stringify(state, null, 2), 'application/json');
    toast('Backup downloaded');
  }
  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        if (!raw || !Array.isArray(raw.transactions)) throw new Error('bad');
        const txs = raw.transactions.filter(t => t && t.desc && t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number(t.amount) > 0 && (t.type === 'expense' || t.type === 'income'))
          .map(t => ({ id: String(t.id || uid()), desc: String(t.desc).slice(0, 60), category: String(t.category || 'Other'), date: t.date, amount: Number(t.amount), type: t.type }));
        if (!confirm(`Replace current data with ${txs.length} transactions from this backup?`)) return;
        state = {
          transactions: txs,
          categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories.filter(c => c && c.name).map(c => ({ name: String(c.name), color: String(c.color || '#94a3b8') })) : DEFAULT_CATS.slice(),
          settings: Object.assign(defaultSettings(), raw.settings || {}),
        };
        save(); renderAll(); toast('Backup restored');
      } catch (e) { toast('That file is not a valid backup.'); }
    };
    reader.readAsText(file);
  }

  /* ---------- events ---------- */
  function bind() {
    window.addEventListener('hashchange', route);
    $('#menuBtn').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); });
    $('#scrim').addEventListener('click', closeMenu);
    $('#addBtn').addEventListener('click', () => openModal());
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalCancel').addEventListener('click', closeModal);
    $('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('#modal').hidden) closeModal();
      if (!$('#profileModal').hidden) closeProfile();
    });

    // profile
    $('#profileBtn').addEventListener('click', openProfile);
    $('#profileClose').addEventListener('click', closeProfile);
    $('#profileSettings').addEventListener('click', closeProfile);
    $('#profileModal').addEventListener('mousedown', e => { if (e.target.id === 'profileModal') closeProfile(); });
    $('#profileForm').addEventListener('submit', e => {
      e.preventDefault();
      state.settings.name = $('#profileInput').value.trim();
      save(); renderAll(); fillProfile(); toast('Name updated');
    });
    $('#typeToggle').addEventListener('click', e => { const b = e.target.closest('button[data-type]'); if (b) setFormType(b.dataset.type); });
    $('#txForm').addEventListener('submit', submitTx);

    // edit / delete (event delegation)
    $('#txTable').addEventListener('click', e => {
      const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
      if (ed) openModal(ed.dataset.edit);
      if (del) deleteTx(del.dataset.del);
    });

    // search
    $('#searchInput').addEventListener('input', e => {
      ui.query = e.target.value;
      if (ui.view !== 'transactions') location.hash = '#transactions'; else renderTransactions();
    });

    // filters
    [['#fType', 'type'], ['#fCategory', 'category'], ['#fMonth', 'month'], ['#fSort', 'sort']].forEach(([sel, key]) =>
      $(sel).addEventListener('change', e => { ui[key] = e.target.value; renderTransactions(); }));
    $('#exportCsv').addEventListener('click', exportCsv);
    $('#donutScope').addEventListener('change', e => { ui.donutScope = e.target.value; renderDashboard(); });

    // categories
    $('#catForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#catName').value.trim();
      if (!name) return;
      if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase()) || name.toLowerCase() === 'income') return toast('That category already exists.');
      state.categories.push({ name, color: $('#catColor').value });
      save(); $('#catName').value = ''; renderAll(); toast('Category added');
    });
    $('#catGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-delcat]');
      if (!b) return;
      const name = b.dataset.delcat;
      if (state.transactions.some(t => t.category === name)) return toast('This category is used by transactions — edit or delete them first.');
      if (state.categories.length <= 1) return toast('Keep at least one category.');
      if (!confirm(`Delete category “${name}”?`)) return;
      state.categories = state.categories.filter(c => c.name !== name);
      save(); renderAll();
    });

    // settings
    $('#settingsForm').addEventListener('submit', e => {
      e.preventDefault();
      const budget = parseFloat($('#setBudget').value);
      state.settings.name = $('#setName').value.trim();
      state.settings.budget = budget >= 0 ? budget : 0;
      state.settings.currency = $('#setCurrency').value.trim() || '₹';
      save(); renderAll(); toast('Settings saved');
    });
    $('#exportJson').addEventListener('click', exportJson);
    $('#importJson').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
    $('#loadSample').addEventListener('click', () => {
      if (!confirm('Replace your current transactions with sample data?')) return;
      state.transactions = sampleTransactions();
      save(); renderAll(); toast('Sample data loaded');
    });
    $('#clearAll').addEventListener('click', () => {
      if (!confirm('Delete ALL transactions? This cannot be undone.')) return;
      state.transactions = [];
      save(); renderAll(); toast('All data deleted');
    });
  }

  /* ---------- init ---------- */
  bind();
  save();
  route();
})();
