/* =========================================================
   dashboard.js — render halaman Dashboard
   ========================================================= */

const Dashboard = (() => {

  function render(){
    const totals = Storage.computeTotals();
    const balance = Storage.computeBalance();

    document.getElementById('dbSaldo').textContent = Utils.formatRupiah(balance);
    document.getElementById('dbMasuk').textContent = Utils.formatRupiah(totals.income);
    document.getElementById('dbKeluar').textContent = Utils.formatRupiah(totals.expense);
    document.getElementById('dbTabungan').textContent = Utils.formatRupiah(totals.savingTotal);
    document.getElementById('dbTransaksi').textContent = totals.count;

    renderReminderBanner();
    renderTargetPreview();
    if (typeof CycleModule !== 'undefined') CycleModule.renderCycleCard();
    if (typeof StreakModule !== 'undefined') StreakModule.init();
    renderRecentTransactions();
    renderCharts();
  }

  function renderReminderBanner(){
    const banner = document.getElementById('reminderBanner');
    if (!banner || typeof ReminderModule === 'undefined') return;
    const count = ReminderModule.countDueSoon();
    if (!count){ banner.innerHTML = ''; return; }
    banner.innerHTML = `
      <button class="card" data-nav="reminder" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid var(--danger);background:var(--danger-light);cursor:pointer;">
        <span class="reminder-icon" style="background:#FBD5D0;color:var(--danger);">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 9v4M12 17h.01M10.3 3.9L2.5 17a1.6 1.6 0 001.4 2.4h16.2a1.6 1.6 0 001.4-2.4L13.7 3.9a1.6 1.6 0 00-2.8 0z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </span>
        <span style="font-size:13px;font-weight:600;color:var(--danger);">${count} tagihan segera jatuh tempo — ketuk untuk lihat</span>
      </button>
    `;
  }

  function renderTargetPreview(){
    const targets = Storage.getTargets().filter(t => !t.achieved).slice(0, 2);
    const wrap = document.getElementById('targetPreviewCard');
    const list = document.getElementById('targetPreviewList');
    if (!targets.length){
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';
    list.innerHTML = targets.map(t => {
      const pct = Math.min(100, Math.round((t.saved / t.nominal) * 100));
      return `
        <div class="target-mini">
          <div class="target-mini-top">
            <span>${Utils.escapeHtml(t.name)}</span>
            <b>${pct}%</b>
          </div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
  }

  function renderRecentTransactions(){
    const list = Storage.getTransactions().slice(0, 5);
    const container = document.getElementById('recentTransactions');
    container.innerHTML = TxRenderer.renderList(list, { compact: true, swipe: false });
  }

  function renderCharts(){
    const list = Storage.getTransactions();
    const months = TxRenderer.lastNMonths(6);

    const incomeSeries = months.map(m => sumByMonth(list, m.key, 'income'));
    const expenseSeries = months.map(m => sumByMonth(list, m.key, 'expense'));
    const labels = months.map(m => m.label);

    MiniChart.barChart(
      document.getElementById('chartIncomeExpense'),
      labels, incomeSeries, expenseSeries,
      '#12B76A', '#F04438'
    );

    MiniChart.barChart(
      document.getElementById('chartMonthly'),
      labels, incomeSeries, expenseSeries,
      '#0E8F55', '#F79009'
    );

    let running = 0;
    const savingSeries = months.map(m => {
      running += sumByMonth(list, m.key, 'saving_in') - sumByMonth(list, m.key, 'saving_out');
      return running;
    });
    MiniChart.lineChart(
      document.getElementById('chartSavings'),
      labels, savingSeries, '#12B76A'
    );
  }

  function sumByMonth(list, monthKey, type){
    return list
      .filter(t => t.type === type && t.date && t.date.startsWith(monthKey))
      .reduce((sum, t) => sum + t.amount, 0);
  }

  MiniChart.registerRedraw(() => {
    if (document.getElementById('page-dashboard').classList.contains('active')) renderCharts();
  });

  return { render };
})();
