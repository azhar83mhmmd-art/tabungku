/* =========================================================
   income.js — halaman Uang Masuk
   ========================================================= */

const IncomeModule = (() => {

  function init(){
    const form = document.getElementById('incomeForm');
    const nominalInput = document.getElementById('incomeNominal');
    Utils.attachRupiahMask(nominalInput);
    document.getElementById('incomeTanggal').value = Utils.todayISO();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });

    const list = document.getElementById('incomeList');
    TxRenderer.enableSwipeDelete(list, handleDelete);
  }

  function submit(){
    const nominal = Utils.parseRupiahInput(document.getElementById('incomeNominal').value);
    const tanggal = document.getElementById('incomeTanggal').value;
    const sumber = document.getElementById('incomeSumber').value;
    const catatan = document.getElementById('incomeCatatan').value.trim();

    if (nominal <= 0){
      Utils.toast('Nominal harus lebih dari 0', 'error');
      return;
    }
    if (!tanggal){
      Utils.toast('Tanggal wajib diisi', 'error');
      return;
    }

    Storage.addTransaction({
      type: 'income',
      amount: nominal,
      date: tanggal,
      source: sumber,
      note: catatan
    });

    document.getElementById('incomeForm').reset();
    document.getElementById('incomeTanggal').value = Utils.todayISO();

    Utils.modal({
      title: 'Berhasil!',
      message: `Pemasukan ${Utils.formatRupiah(nominal)} telah dicatat.`,
      type: 'success',
      confirmText: 'OK'
    });

    render();
    if (window.App) App.refreshGlobalViews();
  }

  function handleDelete(id){
    const removed = Storage.deleteTransaction(id);
    if (!removed) return;
    render();
    if (window.App) App.refreshGlobalViews();
    Utils.toast('Pemasukan dihapus', 'default', () => {
      Storage.restoreTransaction(removed);
      render();
      if (window.App) App.refreshGlobalViews();
    });
  }

  function render(){
    const list = Storage.getTransactions().filter(t => t.type === 'income');
    document.getElementById('incomeList').innerHTML = TxRenderer.renderList(list, { emptyText: 'Belum ada pemasukan' });
  }

  return { init, render };
})();
