/* =========================================================
   saving.js — halaman Tabungan
   ========================================================= */

const SavingModule = (() => {

  let mode = 'menabung'; // 'menabung' | 'tarik'

  function init(){
    const form = document.getElementById('savingForm');
    Utils.attachRupiahMask(document.getElementById('savingNominal'));
    document.getElementById('savingTanggal').value = Utils.todayISO();

    document.querySelectorAll('.tab-switch .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-switch .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.tab;
        document.getElementById('savingSubmitBtn').textContent = mode === 'menabung' ? 'Menabung' : 'Tarik Tabungan';
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });

    const list = document.getElementById('savingList');
    TxRenderer.enableSwipeDelete(list, handleDelete);
  }

  function submit(){
    const nominal = Utils.parseRupiahInput(document.getElementById('savingNominal').value);
    const tanggal = document.getElementById('savingTanggal').value;
    const catatan = document.getElementById('savingCatatan').value.trim();

    if (nominal <= 0){ Utils.toast('Nominal harus lebih dari 0', 'error'); return; }
    if (!tanggal){ Utils.toast('Tanggal wajib diisi', 'error'); return; }

    if (mode === 'menabung'){
      const balance = Storage.computeBalance();
      if (nominal > balance){
        Utils.modal({
          title: 'Saldo Tidak Mencukupi',
          message: `Saldo kamu ${Utils.formatRupiah(balance)}, tidak cukup untuk menabung ${Utils.formatRupiah(nominal)}.`,
          type: 'error', confirmText: 'Mengerti'
        });
        return;
      }
      Storage.addTransaction({ type: 'saving_in', amount: nominal, date: tanggal, note: catatan, name: 'Menabung' });
      if (typeof StreakModule !== 'undefined') StreakModule.onSavingAdded(tanggal);
      Utils.modal({ title: 'Berhasil Menabung!', message: `${Utils.formatRupiah(nominal)} berhasil ditabung.`, type: 'success' });
    } else {
      const totals = Storage.computeTotals();
      if (nominal > totals.savingTotal){
        Utils.modal({
          title: 'Tabungan Tidak Mencukupi',
          message: `Tabungan kamu ${Utils.formatRupiah(totals.savingTotal)}, tidak cukup untuk ditarik sebesar ${Utils.formatRupiah(nominal)}.`,
          type: 'error', confirmText: 'Mengerti'
        });
        return;
      }
      Storage.addTransaction({ type: 'saving_out', amount: nominal, date: tanggal, note: catatan, name: 'Tarik Tabungan' });
      Utils.modal({ title: 'Berhasil Ditarik!', message: `${Utils.formatRupiah(nominal)} berhasil ditarik ke saldo.`, type: 'success' });
    }

    document.getElementById('savingForm').reset();
    document.getElementById('savingTanggal').value = Utils.todayISO();

    render();
    if (window.App) App.refreshGlobalViews();
  }

  function handleDelete(id){
    const removed = Storage.deleteTransaction(id);
    if (!removed) return;
    render();
    if (window.App) App.refreshGlobalViews();
    Utils.toast('Riwayat tabungan dihapus', 'default', () => {
      Storage.restoreTransaction(removed);
      render();
      if (window.App) App.refreshGlobalViews();
    });
  }

  function render(){
    const totals = Storage.computeTotals();
    document.getElementById('savingTotal').textContent = Utils.formatRupiah(totals.savingTotal);
    const list = Storage.getTransactions().filter(t => t.type === 'saving_in' || t.type === 'saving_out');
    document.getElementById('savingList').innerHTML = TxRenderer.renderList(list, { emptyText: 'Belum ada riwayat tabungan' });
  }

  return { init, render };
})();
