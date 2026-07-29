/* =========================================================
   expense.js — halaman Uang Keluar
   ========================================================= */

const ExpenseModule = (() => {

  function init(){
    const form = document.getElementById('expenseForm');
    Utils.attachRupiahMask(document.getElementById('expenseHarga'));
    document.getElementById('expenseTanggal').value = Utils.todayISO();

    document.getElementById('expenseHarga').addEventListener('input', updateTotalPreview);
    document.getElementById('expenseJumlah').addEventListener('input', updateTotalPreview);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });

    const list = document.getElementById('expenseList');
    TxRenderer.enableSwipeDelete(list, handleDelete);

    updateTotalPreview();
  }

  function updateTotalPreview(){
    const harga = Utils.parseRupiahInput(document.getElementById('expenseHarga').value);
    const jumlah = Number(document.getElementById('expenseJumlah').value) || 0;
    document.getElementById('expenseTotalPreview').textContent = Utils.formatRupiah(harga * jumlah);
  }

  function submit(){
    const nama = document.getElementById('expenseNama').value.trim();
    const kategori = document.getElementById('expenseKategori').value;
    const harga = Utils.parseRupiahInput(document.getElementById('expenseHarga').value);
    const jumlah = Number(document.getElementById('expenseJumlah').value);
    const tanggal = document.getElementById('expenseTanggal').value;
    const catatan = document.getElementById('expenseCatatan').value.trim();
    const total = harga * jumlah;

    if (!nama){ Utils.toast('Nama pengeluaran wajib diisi', 'error'); return; }
    if (harga < 1){ Utils.toast('Harga minimal Rp1', 'error'); return; }
    if (!jumlah || jumlah < 1){ Utils.toast('Jumlah minimal 1', 'error'); return; }
    if (!tanggal){ Utils.toast('Tanggal wajib diisi', 'error'); return; }

    const balance = Storage.computeBalance();
    if (total > balance){
      Utils.modal({
        title: 'Saldo Tidak Mencukupi',
        message: `Saldo kamu saat ini ${Utils.formatRupiah(balance)}, tidak cukup untuk pengeluaran ${Utils.formatRupiah(total)}.`,
        type: 'error',
        confirmText: 'Mengerti'
      });
      return;
    }

    Storage.addTransaction({
      type: 'expense',
      amount: total,
      unitPrice: harga,
      qty: jumlah,
      name: nama,
      category: kategori,
      date: tanggal,
      note: catatan
    });

    document.getElementById('expenseForm').reset();
    document.getElementById('expenseTanggal').value = Utils.todayISO();
    document.getElementById('expenseJumlah').value = 1;
    updateTotalPreview();

    Utils.modal({
      title: 'Pembayaran Berhasil',
      message: `${nama} sebesar ${Utils.formatRupiah(total)} telah dicatat.`,
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
    Utils.toast('Pengeluaran dihapus', 'default', () => {
      Storage.restoreTransaction(removed);
      render();
      if (window.App) App.refreshGlobalViews();
    });
  }

  function render(){
    const list = Storage.getTransactions().filter(t => t.type === 'expense');
    document.getElementById('expenseList').innerHTML = TxRenderer.renderList(list, { emptyText: 'Belum ada pengeluaran' });
  }

  return { init, render };
})();
