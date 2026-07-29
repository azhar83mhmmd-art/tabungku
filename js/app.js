/* =========================================================
   app.js — orkestrasi: navigasi, search, riwayat, statistik
   ========================================================= */

const App = (() => {

  function init(){
    // Theme diterapkan paling awal supaya tidak flash
    const settings = Storage.getSettings();
    SettingsModule.applyTheme(settings.theme);

    Utils.initRipple();
    setupNav();
    setupFab();
    setupSearch();
    setupHistoryFilter();

    IncomeModule.init();
    ExpenseModule.init();
    SavingModule.init();
    TargetModule.init();
    ReminderModule.init();
    CycleModule.init();
    ReportModule.init();
    SettingsModule.init();
    AIAssistant.init();
    setupQuickAmounts();

    refreshGlobalViews();
    registerServiceWorker();

    setTimeout(() => {
      document.getElementById('loadingOverlay').classList.add('hide');
    }, 350);
  }

  /* ---------- Navigation ---------- */
  function setupNav(){
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-nav]');
      if (!el) return;
      e.preventDefault();
      navigateTo(el.dataset.nav);
    });
    window.addEventListener('resize', () => moveNavIndicator());
    // Posisikan indikator setelah layout pertama kali siap
    requestAnimationFrame(() => requestAnimationFrame(() => moveNavIndicator()));
  }

  function moveNavIndicator(){
    const nav = document.getElementById('bottomNav');
    const indicator = document.getElementById('navIndicator');
    const activeItem = nav ? nav.querySelector('.nav-item.active') : null;
    if (!nav || !indicator || !activeItem) return;

    const navRect = nav.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const width = itemRect.width - 8;
    const x = (itemRect.left - navRect.left) + 4;

    indicator.style.width = `${width}px`;
    indicator.style.height = `${itemRect.height - 12}px`;
    indicator.style.transform = `translateX(${x}px)`;
    indicator.classList.add('ready');
  }

  function navigateTo(pageId){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(`page-${pageId}`);
    if (!page) return;
    page.classList.add('active');
    document.getElementById('pageTitle').textContent = page.dataset.title || 'TabungKu';

    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === pageId);
    });
    moveNavIndicator();

    document.getElementById('mainContent').scrollTo({ top: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });

    closeFabMenu();
    closeSearch();

    // Re-render halaman yang butuh data segar
    if (pageId === 'dashboard') Dashboard.render();
    if (pageId === 'income') IncomeModule.render();
    if (pageId === 'expense') ExpenseModule.render();
    if (pageId === 'saving') SavingModule.render();
    if (pageId === 'target') TargetModule.render();
    if (pageId === 'reminder') ReminderModule.render();
    if (pageId === 'history') renderHistory();
    if (pageId === 'stats') renderStats();
  }

  /* ---------- Quick Amount Chips ---------- */
  function setupQuickAmounts(){
    document.querySelectorAll('.quick-amounts').forEach(wrap => {
      wrap.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-amount]');
        if (!chip) return;
        const targetInput = wrap.previousElementSibling;
        if (targetInput && targetInput.tagName === 'INPUT'){
          targetInput.value = Number(chip.dataset.amount).toLocaleString('id-ID');
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });
  }

  /* ---------- FAB ---------- */
  function setupFab(){
    const fab = document.getElementById('fabBtn');
    const menu = document.getElementById('fabMenu');
    const overlay = document.getElementById('fabOverlay');

    fab.addEventListener('click', () => {
      const isOpen = menu.classList.contains('open');
      if (isOpen) closeFabMenu(); else openFabMenu();
    });
    overlay.addEventListener('click', closeFabMenu);
  }
  function openFabMenu(){
    document.getElementById('fabMenu').classList.add('open');
    document.getElementById('fabOverlay').classList.add('open');
    document.getElementById('fabBtn').classList.add('open');
  }
  function closeFabMenu(){
    document.getElementById('fabMenu').classList.remove('open');
    document.getElementById('fabOverlay').classList.remove('open');
    document.getElementById('fabBtn').classList.remove('open');
  }

  /* ---------- Search ---------- */
  function setupSearch(){
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    const searchBar = document.getElementById('searchBar');
    const input = document.getElementById('searchInput');
    const closeBtn = document.getElementById('searchCloseBtn');
    const resultsWrap = document.getElementById('searchResults');

    searchToggleBtn.addEventListener('click', () => {
      searchBar.classList.toggle('open');
      if (searchBar.classList.contains('open')) input.focus();
      else closeSearch();
    });
    closeBtn.addEventListener('click', closeSearch);

    input.addEventListener('input', Utils.debounce(() => {
      const q = input.value.trim().toLowerCase();
      if (!q){ resultsWrap.classList.remove('open'); resultsWrap.innerHTML=''; return; }

      const all = Storage.getTransactions();
      const filtered = all.filter(t => {
        const haystack = [
          t.name, t.source, t.category, t.note, String(t.amount), t.date
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });

      resultsWrap.classList.add('open');
      resultsWrap.innerHTML = filtered.length
        ? `<div class="tx-list">${TxRenderer.renderList(filtered.slice(0,20), { swipe:false })}</div>`
        : `<p style="text-align:center;font-size:13px;color:var(--text-faint);padding:14px 0;">Tidak ada hasil untuk "${Utils.escapeHtml(input.value)}"</p>`;
    }, 200));
  }

  function closeSearch(){
    document.getElementById('searchBar').classList.remove('open');
    document.getElementById('searchResults').classList.remove('open');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
  }

  /* ---------- Riwayat / History with filter ---------- */
  function setupHistoryFilter(){
    document.getElementById('filterType').addEventListener('change', renderHistory);
    document.getElementById('filterPeriod').addEventListener('change', (e) => {
      document.getElementById('customDateRow').style.display = e.target.value === 'custom' ? 'flex' : 'none';
      renderHistory();
    });
    document.getElementById('customDateStart').addEventListener('change', renderHistory);
    document.getElementById('customDateEnd').addEventListener('change', renderHistory);
    if (typeof HistoryModule !== 'undefined'){
      HistoryModule.setupSearch();
      HistoryModule.setupListEvents();
    }
  }

  function inPeriod(dateStr, period){
    if (period === 'all') return true;
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();

    if (period === 'day'){
      return d.toDateString() === now.toDateString();
    }
    if (period === 'week'){
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0,0,0,0);
      return d >= start;
    }
    if (period === 'month'){
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === 'year'){
      return d.getFullYear() === now.getFullYear();
    }
    if (period === 'custom'){
      const start = document.getElementById('customDateStart').value;
      const end = document.getElementById('customDateEnd').value;
      if (!start || !end) return true;
      return dateStr >= start && dateStr <= end;
    }
    return true;
  }

  function renderHistory(){
    if (typeof HistoryModule !== 'undefined'){
      HistoryModule.render({ inPeriod });
    }
  }

  /* ---------- Statistik ---------- */
  function renderStats(){
    const list = Storage.getTransactions();
    const totals = Storage.computeTotals();
    const balance = Storage.computeBalance();

    document.getElementById('stMasuk').textContent = Utils.formatRupiah(totals.income);
    document.getElementById('stKeluar').textContent = Utils.formatRupiah(totals.expense);
    document.getElementById('stSaldo').textContent = Utils.formatRupiah(balance);
    document.getElementById('stTabungan').textContent = Utils.formatRupiah(totals.savingTotal);

    const expenses = list.filter(t => t.type === 'expense');

    // Pengeluaran terbesar
    if (expenses.length){
      const biggest = expenses.reduce((a,b) => a.amount > b.amount ? a : b);
      document.getElementById('stTerbesar').textContent = `${biggest.name} (${Utils.formatRupiah(biggest.amount)})`;
    } else {
      document.getElementById('stTerbesar').textContent = '-';
    }

    // Kategori terbanyak
    const catCount = {};
    expenses.forEach(t => { catCount[t.category] = (catCount[t.category]||0) + 1; });
    const topCat = Object.entries(catCount).sort((a,b) => b[1]-a[1])[0];
    document.getElementById('stKategori').textContent = topCat ? `${topCat[0]} (${topCat[1]}x)` : '-';

    // Hari paling boros / hemat (berdasar total pengeluaran per tanggal)
    const perDay = {};
    expenses.forEach(t => { perDay[t.date] = (perDay[t.date]||0) + t.amount; });
    const dayEntries = Object.entries(perDay);
    if (dayEntries.length){
      const boros = dayEntries.reduce((a,b) => b[1] > a[1] ? b : a);
      const hemat = dayEntries.reduce((a,b) => b[1] < a[1] ? b : a);
      document.getElementById('stBoros').textContent = `${Utils.formatDate(boros[0])} (${Utils.formatRupiah(boros[1])})`;
      document.getElementById('stHemat').textContent = `${Utils.formatDate(hemat[0])} (${Utils.formatRupiah(hemat[1])})`;
    } else {
      document.getElementById('stBoros').textContent = '-';
      document.getElementById('stHemat').textContent = '-';
    }

    // Rata-rata
    const incomes = list.filter(t => t.type === 'income');
    const avgExpense = expenses.length ? totals.expense / expenses.length : 0;
    const avgIncome = incomes.length ? totals.income / incomes.length : 0;
    document.getElementById('stRataKeluar').textContent = Utils.formatRupiah(avgExpense);
    document.getElementById('stRataMasuk').textContent = Utils.formatRupiah(avgIncome);

    // Grafik bulanan gabungan
    const months = TxRenderer.lastNMonths(6);
    const incomeSeries = months.map(m => list.filter(t => t.type==='income' && t.date.startsWith(m.key)).reduce((s,t)=>s+t.amount,0));
    const expenseSeries = months.map(m => list.filter(t => t.type==='expense' && t.date.startsWith(m.key)).reduce((s,t)=>s+t.amount,0));
    MiniChart.barChart(document.getElementById('chartStats'), months.map(m=>m.label), incomeSeries, expenseSeries, '#12B76A', '#F04438');
  }

  MiniChart.registerRedraw(() => {
    const active = document.querySelector('.page.active');
    if (active && active.id === 'page-stats') renderStats();
  });

  /* ---------- Refresh semua view yang bergantung pada data global ---------- */
  function refreshGlobalViews(){
    const activePage = document.querySelector('.page.active');
    Dashboard.render();
    if (activePage){
      const id = activePage.id.replace('page-', '');
      if (id === 'income') IncomeModule.render();
      if (id === 'expense') ExpenseModule.render();
      if (id === 'saving') SavingModule.render();
      if (id === 'target') TargetModule.render();
      if (id === 'reminder') ReminderModule.render();
      if (id === 'history') renderHistory();
      if (id === 'stats') renderStats();
    }
  }

  /* ---------- Service Worker (PWA) ---------- */
  function registerServiceWorker(){
    if ('serviceWorker' in navigator){
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {
          // Diam-diam gagal jika tidak didukung (misal file:// atau WebView tanpa https)
        });
      });
    }
  }

  return { init, navigateTo, refreshGlobalViews };
})();

document.addEventListener('DOMContentLoaded', App.init);
