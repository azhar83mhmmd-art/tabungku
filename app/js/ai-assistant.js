/* =========================================================
   ai-assistant.js — "AI Keuangan" LOKAL, tanpa API key/internet
   Menggunakan analisis rule-based + NLP sederhana (keyword
   matching) atas data transaksi yang sudah ada di Local Storage.
   ========================================================= */

const AIAssistant = (() => {

  let panelOpen = false;

  /* ---------- Setup UI ---------- */
  function init(){
    injectUI();
    document.getElementById('aiFab').addEventListener('click', togglePanel);
    document.getElementById('aiCloseBtn').addEventListener('click', togglePanel);
    document.getElementById('aiSendBtn').addEventListener('click', handleSend);
    document.getElementById('aiInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){ e.preventDefault(); handleSend(); }
    });
    document.getElementById('aiSuggestions').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-ai-q]');
      if (chip){
        document.getElementById('aiInput').value = chip.dataset.aiQ;
        handleSend();
      }
    });
    greet();
  }

  function injectUI(){
    const fab = document.createElement('button');
    fab.id = 'aiFab';
    fab.className = 'ai-fab ripple';
    fab.setAttribute('aria-label', 'Asisten AI Keuangan');
    fab.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M12 2a4 4 0 014 4v1a4 4 0 01-8 0V6a4 4 0 014-4z" stroke="currentColor" stroke-width="1.6"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.5" cy="6.5" r=".9" fill="currentColor"/><circle cx="14.5" cy="6.5" r=".9" fill="currentColor"/></svg>`;
    document.body.appendChild(fab);

    const panel = document.createElement('div');
    panel.id = 'aiPanel';
    panel.className = 'ai-panel';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <div class="ai-panel-title">
          <span class="ai-avatar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 2a4 4 0 014 4v1a4 4 0 01-8 0V6a4 4 0 014-4z" stroke="currentColor" stroke-width="1.6"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></span>
          </span>
          <div>
            <p class="ai-name">Asisten TabungKu</p>
            <p class="ai-status">Analisis lokal · Privat &amp; offline</p>
          </div>
        </div>
        <button class="icon-btn small" id="aiCloseBtn" aria-label="Tutup">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="ai-messages" id="aiMessages"></div>
      <div class="ai-suggestions" id="aiSuggestions">
        <button class="ai-chip" data-ai-q="Bagaimana kondisi keuanganku bulan ini?">Kondisi bulan ini</button>
        <button class="ai-chip" data-ai-q="Apa pengeluaran terbesarku?">Pengeluaran terbesar</button>
        <button class="ai-chip" data-ai-q="Berikan tips hemat">Tips hemat</button>
        <button class="ai-chip" data-ai-q="Berapa saldo saya?">Cek saldo</button>
      </div>
      <div class="ai-input-row">
        <input type="text" id="aiInput" placeholder="Tanya soal keuanganmu...">
        <button class="ai-send-btn ripple" id="aiSendBtn" aria-label="Kirim">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M4 12l16-8-6 8 6 8-16-8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    const overlay = document.createElement('div');
    overlay.id = 'aiOverlay';
    overlay.className = 'ai-overlay';
    overlay.addEventListener('click', togglePanel);
    document.body.appendChild(overlay);
  }

  function togglePanel(){
    panelOpen = !panelOpen;
    document.getElementById('aiPanel').classList.toggle('open', panelOpen);
    document.getElementById('aiOverlay').classList.toggle('open', panelOpen);
    document.getElementById('aiFab').classList.toggle('open', panelOpen);
    if (panelOpen) document.getElementById('aiInput').focus();
  }

  function greet(){
    const settings = Storage.getSettings();
    const name = settings.username ? `, ${settings.username}` : '';
    addMessage('ai', `Halo${name}! Saya asisten keuangan lokal kamu. Saya bisa membantu analisis pemasukan, pengeluaran, tabungan, dan kasih tips — semua diproses langsung di HP kamu tanpa internet.`);
  }

  function addMessage(role, text){
    const wrap = document.getElementById('aiMessages');
    const el = document.createElement('div');
    el.className = `ai-msg ${role}`;
    el.innerHTML = `<div class="ai-bubble">${text}</div>`;
    wrap.appendChild(el);
    wrap.scrollTop = wrap.scrollHeight;
  }

  function handleSend(){
    const input = document.getElementById('aiInput');
    const q = input.value.trim();
    if (!q) return;
    addMessage('user', Utils.escapeHtml(q));
    input.value = '';

    const typingEl = showTyping();
    setTimeout(() => {
      typingEl.remove();
      const answer = generateAnswer(q);
      addMessage('ai', answer);
    }, 450 + Math.random()*350);
  }

  function showTyping(){
    const wrap = document.getElementById('aiMessages');
    const el = document.createElement('div');
    el.className = 'ai-msg ai';
    el.innerHTML = `<div class="ai-bubble ai-typing"><span></span><span></span><span></span></div>`;
    wrap.appendChild(el);
    wrap.scrollTop = wrap.scrollHeight;
    return el;
  }

  /* ---------- "Otak" AI: rule-based NLP sederhana ---------- */
  function generateAnswer(question){
    const q = question.toLowerCase();

    const totals = Storage.computeTotals();
    const balance = Storage.computeBalance();
    const list = Storage.getTransactions();
    const expenses = list.filter(t => t.type === 'expense');
    const incomes = list.filter(t => t.type === 'income');

    const thisMonthKey = new Date().toISOString().slice(0,7);
    const monthExpenses = expenses.filter(t => t.date && t.date.startsWith(thisMonthKey));
    const monthIncomes = incomes.filter(t => t.date && t.date.startsWith(thisMonthKey));
    const monthExpenseTotal = monthExpenses.reduce((s,t) => s+t.amount, 0);
    const monthIncomeTotal = monthIncomes.reduce((s,t) => s+t.amount, 0);

    // 1. Saldo
    if (/(saldo|uang saya|uang saat ini|sisa uang)/.test(q)){
      return `Saldo kamu saat ini adalah <b>${Utils.formatRupiah(balance)}</b>.`;
    }

    // 2. Kondisi bulan ini
    if (/(kondisi|bagaimana|gimana).*(bulan ini|sekarang)|ringkasan bulan/.test(q)){
      const selisih = monthIncomeTotal - monthExpenseTotal;
      const statusText = selisih >= 0
        ? `Bagus, pemasukan bulan ini masih lebih besar dari pengeluaran sebesar <b>${Utils.formatRupiah(selisih)}</b>.`
        : `Perlu diwaspadai, pengeluaran bulan ini lebih besar dari pemasukan sebesar <b>${Utils.formatRupiah(Math.abs(selisih))}</b>.`;
      return `Bulan ini kamu sudah mencatat pemasukan <b>${Utils.formatRupiah(monthIncomeTotal)}</b> dan pengeluaran <b>${Utils.formatRupiah(monthExpenseTotal)}</b>. ${statusText}`;
    }

    // 3. Pengeluaran terbesar
    if (/(pengeluaran|belanja).*(terbesar|paling besar|paling banyak)/.test(q)){
      if (!expenses.length) return 'Belum ada data pengeluaran yang bisa dianalisis.';
      const biggest = expenses.reduce((a,b) => a.amount > b.amount ? a : b);
      return `Pengeluaran terbesarmu adalah <b>${Utils.escapeHtml(biggest.name)}</b> (${biggest.category}) sebesar <b>${Utils.formatRupiah(biggest.amount)}</b> pada ${Utils.formatDate(biggest.date)}.`;
    }

    // 4. Kategori boros
    if (/(kategori|jenis pengeluaran).*(banyak|boros|sering)/.test(q)){
      if (!expenses.length) return 'Belum ada data pengeluaran.';
      const catTotal = {};
      expenses.forEach(t => { catTotal[t.category] = (catTotal[t.category]||0) + t.amount; });
      const top = Object.entries(catTotal).sort((a,b)=>b[1]-a[1])[0];
      return `Kategori pengeluaran terbesarmu adalah <b>${top[0]}</b> dengan total <b>${Utils.formatRupiah(top[1])}</b>. Coba tinjau ulang pengeluaran di kategori ini jika ingin lebih hemat.`;
    }

    // 5. Tips hemat
    if (/(tips|saran|cara).*(hemat|nabung|menabung|irit)/.test(q) || /hemat/.test(q)){
      return generateSavingTips(expenses, balance, totals);
    }

    // 6. Progress target
    if (/(target|goal)/.test(q)){
      const targets = Storage.getTargets().filter(t => !t.achieved);
      if (!targets.length) return 'Kamu belum punya target tabungan aktif. Yuk buat target baru di menu Target Tabungan!';
      const lines = targets.map(t => {
        const pct = Math.min(100, Math.round((t.saved/t.nominal)*100));
        return `• <b>${Utils.escapeHtml(t.name)}</b>: ${pct}% (${Utils.formatRupiah(t.saved)} dari ${Utils.formatRupiah(t.nominal)})`;
      }).join('<br>');
      return `Progress target tabunganmu:<br>${lines}`;
    }

    // 7. Prediksi / proyeksi
    if (/(prediksi|proyeksi|perkiraan|kapan).*(target|tabungan|cukup)/.test(q)){
      return generateProjection();
    }

    // 8. Rata-rata
    if (/rata.rata/.test(q)){
      const avgExp = expenses.length ? totals.expense/expenses.length : 0;
      const avgInc = incomes.length ? totals.income/incomes.length : 0;
      return `Rata-rata pengeluaran per transaksi: <b>${Utils.formatRupiah(avgExp)}</b>. Rata-rata pemasukan per transaksi: <b>${Utils.formatRupiah(avgInc)}</b>.`;
    }

    // 9. Total tabungan
    if (/(total|jumlah).*(tabungan)/.test(q)){
      return `Total tabunganmu saat ini adalah <b>${Utils.formatRupiah(totals.savingTotal)}</b>.`;
    }

    // 10. Sapaan
    if (/(halo|hai|hi|hello|pagi|siang|malam)/.test(q)){
      return 'Halo! Ada yang bisa saya bantu soal keuanganmu? Kamu bisa tanya soal saldo, pengeluaran, tips hemat, atau progress target tabungan.';
    }

    // 11. Terima kasih
    if (/(terima kasih|makasih|thanks)/.test(q)){
      return 'Sama-sama! Semangat terus mengelola keuanganmu 💪';
    }

    // Default fallback — beri ringkasan umum + arahkan
    return `Maaf, saya belum paham pertanyaan itu. Tapi ini ringkasan singkat keuanganmu: saldo <b>${Utils.formatRupiah(balance)}</b>, total tabungan <b>${Utils.formatRupiah(totals.savingTotal)}</b>. Coba tanya soal "saldo", "pengeluaran terbesar", "tips hemat", atau "target tabungan".`;
  }

  function generateSavingTips(expenses, balance, totals){
    const tips = [];
    const catTotal = {};
    expenses.forEach(t => { catTotal[t.category] = (catTotal[t.category]||0) + t.amount; });
    const sorted = Object.entries(catTotal).sort((a,b)=>b[1]-a[1]);

    if (sorted.length){
      const [topCat, topAmount] = sorted[0];
      tips.push(`Kategori <b>${topCat}</b> adalah pengeluaran terbesarmu (${Utils.formatRupiah(topAmount)}). Coba kurangi 10-20% di kategori ini bulan depan.`);
    }
    if (totals.expense > totals.income && totals.income > 0){
      tips.push('Pengeluaran totalmu melebihi pemasukan. Pertimbangkan menunda pembelian non-esensial.');
    }
    if (balance > 0){
      const suggestedSaving = Math.round(balance * 0.1 / 1000) * 1000;
      tips.push(`Coba sisihkan sekitar <b>${Utils.formatRupiah(suggestedSaving)}</b> (10% dari saldo) untuk ditabung minggu ini.`);
    }
    tips.push('Gunakan aturan 50/30/20: 50% kebutuhan, 30% keinginan, 20% tabungan/investasi.');
    tips.push('Catat setiap pengeluaran sekecil apapun — kebiasaan kecil ini membantu kamu lebih sadar soal uang.');

    return tips.map(t => `• ${t}`).join('<br>');
  }

  function generateProjection(){
    const targets = Storage.getTargets().filter(t => !t.achieved);
    if (!targets.length) return 'Kamu belum punya target aktif untuk diproyeksikan.';

    const list = Storage.getTransactions();
    const savingIns = list.filter(t => t.type === 'saving_in');
    if (savingIns.length < 2){
      return 'Data tabunganmu masih sedikit, tambahkan beberapa transaksi menabung lagi supaya saya bisa memproyeksikan waktu pencapaian target dengan akurat.';
    }

    // Rata-rata menabung per bulan (6 bulan terakhir)
    const months = TxRenderer.lastNMonths(6);
    const perMonth = months.map(m => savingIns.filter(t => t.date.startsWith(m.key)).reduce((s,t)=>s+t.amount,0));
    const avgMonthly = perMonth.reduce((a,b)=>a+b,0) / perMonth.length;

    if (avgMonthly <= 0){
      return 'Belum ada aktivitas menabung rutin dalam 6 bulan terakhir, sehingga proyeksi belum bisa dihitung. Coba mulai menabung rutin tiap bulan.';
    }

    const lines = targets.map(t => {
      const sisa = Math.max(0, t.nominal - t.saved);
      const bulanLagi = Math.ceil(sisa / avgMonthly);
      return `• <b>${Utils.escapeHtml(t.name)}</b>: dengan rata-rata menabung ${Utils.formatRupiah(avgMonthly)}/bulan, diperkirakan tercapai dalam ~${bulanLagi} bulan lagi.`;
    }).join('<br>');

    return `Proyeksi target tabungan (berdasarkan rata-rata 6 bulan terakhir):<br>${lines}`;
  }

  return { init };
})();
