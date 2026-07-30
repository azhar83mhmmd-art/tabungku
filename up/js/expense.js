/* =========================================================
   expense.js — halaman Uang Keluar
   ========================================================= */

const ExpenseModule = (() => {

  let scanMeta = null; // { barcode, photo, brand, category, country, source } dari hasil scan terakhir

  function init(){
    const form = document.getElementById('expenseForm');
    Utils.attachRupiahMask(document.getElementById('expenseHarga'));
    document.getElementById('expenseTanggal').value = Utils.todayISO();

    document.getElementById('expenseHarga').addEventListener('input', updateTotalPreview);
    document.getElementById('expenseJumlah').addEventListener('input', updateTotalPreview);

    const scanBtn = document.getElementById('openScannerBtn');
    if (scanBtn) scanBtn.addEventListener('click', () => {
      if (typeof BarcodeScanner === 'undefined'){ Utils.toast('Fitur scanner belum siap', 'error'); return; }
      BarcodeScanner.open(handleScanResult);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });

    const list = document.getElementById('expenseList');
    TxRenderer.enableSwipeDelete(list, handleDelete);

    updateTotalPreview();
  }

  /* Dipanggil BarcodeScanner setelah pengguna memilih produk hasil scan.
     Mengisi otomatis: nama, kategori (kalau cocok dengan opsi yang ada),
     dan catatan produk (merek/negara asal/dsb) — harga, jumlah, tanggal,
     toko, dan metode pembayaran tetap harus diisi pengguna sendiri. */
  function handleScanResult(product, barcode){
    scanMeta = {
      barcode,
      photo: product.photo || '',
      brand: product.brand || '',
      category: product.category || '',
      country: product.country || '',
      source: product.source || ''
    };

    document.getElementById('expenseNama').value = product.name || '';

    const kategoriSelect = document.getElementById('expenseKategori');
    const matchedOption = Array.from(kategoriSelect.options).find(o =>
      o.value.toLowerCase() === (product.category || '').toLowerCase()
    );
    if (matchedOption) kategoriSelect.value = matchedOption.value;

    const catatanParts = [];
    if (product.brand) catatanParts.push(`Merek: ${product.brand}`);
    if (product.country) catatanParts.push(`Asal: ${product.country}`);
    if (product.weight) catatanParts.push(`Isi: ${product.weight}`);
    catatanParts.push(`(Scan barcode ${barcode} · ${product.source || 'sumber tidak diketahui'})`);
    document.getElementById('expenseCatatan').value = catatanParts.join(' · ');

    renderScanPrefillCard(product);
    Utils.toast('Data produk berhasil diisi otomatis', 'success');
  }

  function renderScanPrefillCard(product){
    const wrap = document.getElementById('expenseScanPrefillWrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="scanner-prefill-card">
        ${product.photo ? `<img src="${Utils.escapeHtml(product.photo)}" alt="">` : ''}
        <div class="txt">
          <p class="name">${Utils.escapeHtml(product.name || '(Tanpa nama)')}</p>
          <p class="src">Diisi dari ${Utils.escapeHtml(product.source || 'scan barcode')}</p>
        </div>
        <button type="button" class="scanner-prefill-clear" id="clearScanPrefillBtn" title="Batalkan data scan">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
    `;
    document.getElementById('clearScanPrefillBtn').addEventListener('click', () => {
      scanMeta = null;
      wrap.innerHTML = '';
      if (typeof BarcodeScanner !== 'undefined') BarcodeScanner.clearPendingScan();
    });
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

    const trxData = {
      type: 'expense',
      amount: total,
      unitPrice: harga,
      qty: jumlah,
      name: nama,
      category: kategori,
      date: tanggal,
      note: catatan
    };

    // Sisipkan metadata scan barcode kalau transaksi ini berasal dari hasil scan
    if (scanMeta){
      trxData.barcode = scanMeta.barcode;
      trxData.photo = scanMeta.photo;
      trxData.brand = scanMeta.brand;
      trxData.dataSource = scanMeta.source;
    }

    Storage.addTransaction(trxData);

    // Catat ke riwayat scan + statistik (hanya kalau transaksi ini hasil scan)
    if (scanMeta && typeof BarcodeScanner !== 'undefined'){
      BarcodeScanner.commitPendingScan(trxData.id, harga, jumlah, total);
    }
    scanMeta = null;
    const prefillWrap = document.getElementById('expenseScanPrefillWrap');
    if (prefillWrap) prefillWrap.innerHTML = '';

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
