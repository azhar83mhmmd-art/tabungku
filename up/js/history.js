/* =========================================================
   history.js — render halaman Riwayat versi modern
   (search realtime, ringkasan, grouping timeline, empty state)
   ========================================================= */

const HistoryModule = (() => {

  let searchQuery = '';

  function setupSearch(){
    const input = document.getElementById('histSearchInput');
    const clearBtn = document.getElementById('histSearchClear');
    if (!input || input.dataset.bound) return;
    input.dataset.bound = '1';

    const onInput = Utils.debounce(() => {
      searchQuery = input.value.trim().toLowerCase();
      clearBtn.style.display = searchQuery ? 'flex' : 'none';
      render();
    }, 150);

    input.addEventListener('input', onInput);
    clearBtn.addEventListener('click', () => {
      input.value = '';
      searchQuery = '';
      clearBtn.style.display = 'none';
      render();
      input.focus();
    });
  }

  function matchesSearch(t, fullName){
    if (!searchQuery) return true;
    const haystack = [
      fullName,
      t.category || '',
      t.note || '',
      t.source || '',
      String(t.amount || '')
    ].join(' ').toLowerCase();
    return haystack.includes(searchQuery);
  }

  function groupLabel(dateStr){
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const todayStr = now.toDateString();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);

    if (d.toDateString() === todayStr) return 'Hari Ini';
    if (d.toDateString() === yest.toDateString()) return 'Kemarin';

    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
    if (d >= startOfWeek) return 'Minggu Ini';

    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'Bulan Ini';

    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    if (d.getFullYear() === now.getFullYear()) return bulan[d.getMonth()];
    return `${bulan[d.getMonth()]} ${d.getFullYear()}`;
  }

  function emptyStateHtml(){
    return `
      <div class="hist-empty">
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
          <rect x="20" y="18" width="80" height="66" rx="12" fill="var(--surface-2)" stroke="var(--border)" stroke-width="2"/>
          <rect x="32" y="34" width="56" height="6" rx="3" fill="var(--border)"/>
          <rect x="32" y="46" width="40" height="6" rx="3" fill="var(--border)"/>
          <rect x="32" y="58" width="48" height="6" rx="3" fill="var(--border)"/>
          <circle cx="86" cy="70" r="20" fill="var(--brand-light)"/>
          <path d="M86 61v18M77 70h18" stroke="var(--brand-dark)" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <p class="hist-empty-title">Belum ada transaksi</p>
        <p class="hist-empty-desc">Mulai catat pemasukan atau pengeluaran pertamamu agar riwayat transaksi muncul di sini.</p>
        <button type="button" class="hist-empty-btn ripple" id="histEmptyAddBtn">Tambah Transaksi</button>
      </div>
    `;
  }

  function noResultHtml(){
    return `
      <div class="hist-empty">
        <svg width="100" height="90" viewBox="0 0 100 90" fill="none">
          <circle cx="42" cy="38" r="24" stroke="var(--border)" stroke-width="4"/>
          <path d="M60 56l18 18" stroke="var(--border)" stroke-width="4" stroke-linecap="round"/>
        </svg>
        <p class="hist-empty-title">Tidak ditemukan</p>
        <p class="hist-empty-desc">Tidak ada transaksi yang cocok dengan filter atau pencarian saat ini.</p>
      </div>
    `;
  }

  function skeletonHtml(){
    const row = `
      <div class="hist-skeleton-item">
        <div class="hist-skel-circle"></div>
        <div class="hist-skel-lines">
          <div class="hist-skel-line w60"></div>
          <div class="hist-skel-line w35"></div>
        </div>
      </div>`;
    return row.repeat(4);
  }

  function renderSummary(list){
    let income = 0, expense = 0;
    list.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
      // saving_in/saving_out sengaja TIDAK dihitung di sini — itu perpindahan
      // internal (saldo <-> tabungan), bukan pemasukan/pengeluaran sungguhan.
    });
    const balance = Storage.computeBalance();

    const elIncome = document.getElementById('histSumIncome');
    const elExpense = document.getElementById('histSumExpense');
    const elBalance = document.getElementById('histSumBalance');
    if (elIncome) elIncome.textContent = Utils.formatRupiah(income);
    if (elExpense) elExpense.textContent = Utils.formatRupiah(expense);
    if (elBalance) elBalance.textContent = Utils.formatRupiah(balance);
  }

  function renderHeaderCounts(){
    const all = Storage.getTransactions();
    const now = new Date();
    const todayStr = now.toDateString();

    const todayCount = all.filter(t => new Date(t.date + 'T00:00:00').toDateString() === todayStr).length;
    const monthCount = all.filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    const elToday = document.getElementById('histTodayCount');
    const elMonth = document.getElementById('histMonthCount');
    if (elToday) elToday.textContent = todayCount;
    if (elMonth) elMonth.textContent = monthCount;
  }

  function render(opts = {}){
    const container = document.getElementById('historyList');
    if (!container) return;

    const type = document.getElementById('filterType').value;
    const period = document.getElementById('filterPeriod').value;
    const inPeriod = opts.inPeriod || (() => true);

    const allTx = Storage.getTransactions();
    renderHeaderCounts();

    let list = allTx.slice().sort((a,b) => (a.date < b.date ? 1 : -1));

    if (type !== 'all'){
      if (type === 'saving') list = list.filter(t => t.type === 'saving_in' || t.type === 'saving_out');
      else list = list.filter(t => t.type === type);
    }
    list = list.filter(t => inPeriod(t.date, period));

    renderSummary(list);

    // Hitung saldo berjalan
    const allSorted = allTx.slice().sort((a,b) => a.createdAt - b.createdAt);
    const initial = Number(Storage.getSettings().initialBalance) || 0;
    let running = initial;
    const balanceMap = {};
    allSorted.forEach(t => {
      if (t.type === 'income') running += t.amount;
      else if (t.type === 'expense') running -= t.amount;
      else if (t.type === 'saving_in') running -= t.amount;
      else if (t.type === 'saving_out') running += t.amount;
      balanceMap[t.id] = running;
    });

    // Filter search
    const filtered = list.filter(t => {
      const meta = TxRenderer.TYPE_META[t.type] || { label: t.type };
      const fullName = t.name || t.source || meta.label;
      return matchesSearch(t, fullName);
    });

    if (!allTx.length){
      container.innerHTML = emptyStateHtml();
      bindEmptyAddBtn();
      return;
    }
    if (!filtered.length){
      container.innerHTML = noResultHtml();
      return;
    }

    // Kelompokkan per label waktu, pertahankan urutan terbaru dulu
    const groups = [];
    const groupIndex = {};
    filtered.forEach(t => {
      const label = groupLabel(t.date);
      if (!(label in groupIndex)){
        groupIndex[label] = groups.length;
        groups.push({ label, items: [] });
      }
      groups[groupIndex[label]].items.push(t);
    });

    container.innerHTML = groups.map(g => {
      const itemsHtml = g.items.map(t => {
        const meta = TxRenderer.TYPE_META[t.type] || { icon:'sv', sign:'', label:t.type };
        const fullName = t.name || t.source || meta.label;
        const balAfter = balanceMap[t.id] ?? 0;
        const subParts = [Utils.formatDateShort(t.date)];
        if (t.category) subParts.push(t.category);
        else if (t.type === 'saving_in' || t.type === 'saving_out') subParts.push(t.target || 'Tabungan');

        return `
          <div class="tx-item" data-tx-id="${t.id}" data-tx-type="${t.type}">
            <div class="tx-icon ${meta.icon}">${TxRenderer.ICONS ? TxRenderer.ICONS[meta.icon] : ''}</div>
            <div class="tx-body">
              <p class="tx-title">${Utils.escapeHtml(fullName)}</p>
              <p class="tx-sub">${subParts.join(' · ')}</p>
              <p class="tx-sub-balance">Saldo: ${Utils.formatRupiah(balAfter)}</p>
            </div>
            <div class="tx-amount ${meta.sign === '+' ? 'in' : (meta.sign === '-' ? 'out' : 'transfer')}">${meta.sign}${Utils.formatRupiah(t.amount)}</div>
            <div class="tx-swipe-delete" data-delete-id="${t.id}">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="hist-group-label"><span>${g.label}</span><span class="hist-group-count">${g.items.length}</span></div>
        ${itemsHtml}
      `;
    }).join('');
  }

  function bindEmptyAddBtn(){
    const btn = document.getElementById('histEmptyAddBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const fabBtn = document.getElementById('fabBtn');
      if (fabBtn) fabBtn.click();
    });
  }

  function handleDelete(id){
    const removed = Storage.deleteTransaction(id);
    if (!removed) return;
    if (window.App) App.navigateTo('history');
    if (window.App) App.refreshGlobalViews();
    Utils.toast('Transaksi dihapus', 'default', () => {
      Storage.restoreTransaction(removed);
      if (window.App) App.navigateTo('history');
      if (window.App) App.refreshGlobalViews();
    });
  }

  function setupListEvents(){
    const container = document.getElementById('historyList');
    if (!container || container.dataset.bound) return;
    container.dataset.bound = '1';

    TxRenderer.enableSwipeDelete(container, handleDelete);

    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-id]')) return;
      const item = e.target.closest('.tx-item');
      if (!item) return;
      if (item.classList.contains('swiped')){
        item.classList.remove('swiped');
        return;
      }
      const id = item.dataset.txId;
      const t = Storage.getTransactions().find(x => x.id === id);
      if (!t) return;
      const meta = TxRenderer.TYPE_META[t.type] || { label: t.type };
      const detailParts = [`${meta.sign}${Utils.formatRupiah(t.amount)}`, Utils.formatDateLong(t.date)];
      if (t.category) detailParts.push(t.category);
      if (t.note) detailParts.push(t.note);
      Utils.modal({
        title: t.name || t.source || meta.label,
        message: detailParts.join(' · '),
        type: 'success',
        confirmText: 'Tutup'
      });
    });
  }

  return { render, setupSearch, setupListEvents };
})();
