/* =========================================================
   cycle.js — Siklus Keuangan Bulanan TabungKu
   - Ringkasan siklus bulan berjalan (surplus/defisit, hari tersisa)
   - Kalkulator "berapa harus ditabung per hari" untuk capai target
   - Auto-kategori pengeluaran berdasarkan kata kunci nama
   ========================================================= */

const CycleModule = (() => {

  const CATEGORY_KEYWORDS = {
    'Makanan': ['makan','nasi','ayam','soto','bakso','mie','warteg','resto','restoran','sarapan','catering'],
    'Minuman': ['kopi','teh','boba','jus','minum','kafe','cafe','starbucks'],
    'Belanja': ['belanja','baju','sepatu','tas','mall','supermarket','indomaret','alfamart'],
    'Transportasi': ['bensin','ojek','gojek','grab','parkir','tol','angkot','bus','kereta','pertamax','pertalite'],
    'Internet': ['wifi','internet','indihome','paket data'],
    'Pulsa': ['pulsa','kuota'],
    'Listrik': ['listrik','pln','token'],
    'Air': ['pdam','air'],
    'Kesehatan': ['obat','dokter','klinik','rumah sakit','apotek','vitamin'],
    'Pendidikan': ['buku','kursus','sekolah','kuliah','les','spp'],
    'Hiburan': ['nonton','bioskop','game','netflix','spotify','konser'],
    'Perawatan': ['salon','skincare','potong rambut','laundry'],
    'Investasi': ['saham','reksadana','emas','crypto','investasi']
  };

  function guessCategory(name){
    const lower = (name || '').toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)){
      if (keywords.some(k => lower.includes(k))) return cat;
    }
    return null;
  }

  function init(){
    const nameInput = document.getElementById('expenseNama');
    const catSelect = document.getElementById('expenseKategori');
    if (nameInput && catSelect){
      let userTouchedCategory = false;
      catSelect.addEventListener('change', () => { userTouchedCategory = true; });
      nameInput.addEventListener('input', Utils.debounce(() => {
        if (userTouchedCategory) return;
        const guess = guessCategory(nameInput.value);
        if (guess){
          catSelect.value = guess;
          catSelect.classList.add('auto-filled');
          setTimeout(() => catSelect.classList.remove('auto-filled'), 900);
        }
      }, 300));
      // reset flag tiap form baru dibuka/disubmit
      document.getElementById('expenseForm').addEventListener('submit', () => { userTouchedCategory = false; });
    }

    renderCycleCard();
  }

  function daysInMonth(year, month){
    return new Date(year, month + 1, 0).getDate();
  }

  function renderCycleCard(){
    const wrap = document.getElementById('cycleCard');
    if (!wrap) return;

    const now = new Date();
    const monthKey = now.toISOString().slice(0,7);
    const totalDays = daysInMonth(now.getFullYear(), now.getMonth());
    const dayOfMonth = now.getDate();
    const daysLeft = totalDays - dayOfMonth;

    const list = Storage.getTransactions();
    const monthIncome = list.filter(t => t.type === 'income' && t.date.startsWith(monthKey)).reduce((s,t)=>s+t.amount,0);
    const monthExpense = list.filter(t => t.type === 'expense' && t.date.startsWith(monthKey)).reduce((s,t)=>s+t.amount,0);
    const monthSaving = list.filter(t => t.type === 'saving_in' && t.date.startsWith(monthKey)).reduce((s,t)=>s+t.amount,0)
                       - list.filter(t => t.type === 'saving_out' && t.date.startsWith(monthKey)).reduce((s,t)=>s+t.amount,0);

    const net = monthIncome - monthExpense - monthSaving;
    const isSurplus = net >= 0;
    const avgDailyExpense = dayOfMonth > 0 ? monthExpense / dayOfMonth : 0;
    const projectedExpense = avgDailyExpense * totalDays;

    const balance = Storage.computeBalance();
    const safeDailyBudget = daysLeft > 0 ? Math.max(0, balance / (daysLeft + 1)) : balance;

    wrap.innerHTML = `
      <div class="card cycle-card">
        <div class="cycle-head">
          <p class="section-label" style="margin:0;">Siklus Bulan Ini</p>
          <span class="cycle-badge ${isSurplus ? 'good' : 'bad'}">${isSurplus ? 'Surplus' : 'Defisit'}</span>
        </div>
        <div class="cycle-progress-row">
          <span>Hari ke-${dayOfMonth} dari ${totalDays}</span>
          <span>${daysLeft} hari tersisa</span>
        </div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.round(dayOfMonth/totalDays*100)}%"></div></div>

        <div class="cycle-stats">
          <div>
            <p class="cycle-stat-label">Net Bulan Ini</p>
            <p class="cycle-stat-value ${isSurplus ? 'good' : 'bad'}">${isSurplus ? '+' : ''}${Utils.formatRupiah(net)}</p>
          </div>
          <div>
            <p class="cycle-stat-label">Proyeksi Pengeluaran</p>
            <p class="cycle-stat-value">${Utils.formatRupiah(Math.round(projectedExpense))}</p>
          </div>
        </div>

        <div class="cycle-tip">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" style="flex-shrink:0;margin-top:1px;"><path d="M12 9v4M12 17h.01M12 22a10 10 0 100-20 10 10 0 000 20z" stroke="currentColor" stroke-width="1.6"/></svg>
          <span>Sisa saldo aman dipakai sekitar <b>${Utils.formatRupiah(Math.round(safeDailyBudget))}</b>/hari hingga akhir bulan.</span>
        </div>
      </div>
    `;
  }

  return { init, renderCycleCard, guessCategory };
})();
