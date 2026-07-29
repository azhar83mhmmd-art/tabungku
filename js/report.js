/* =========================================================
   report.js — export/import laporan
   ========================================================= */

const ReportModule = (() => {

  function init(){
    document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('importJsonInput').addEventListener('change', handleImport);
  }

  function downloadFile(filename, content, mime){
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson(){
    const data = Storage.exportAll();
    downloadFile(`tabungku-backup-${Utils.todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
    Utils.toast('Data JSON berhasil diexport', 'success');
  }

  function exportCsv(){
    const list = Storage.getTransactions();
    const header = ['No Transaksi','Tanggal','Jenis','Nama/Sumber','Kategori','Nominal','Catatan'];
    const rows = list.map(t => [
      t.trxNumber, t.date, TxRenderer.TYPE_META[t.type]?.label || t.type,
      t.name || t.source || '', t.category || '', t.amount, (t.note||'').replace(/[\n,]/g,' ')
    ]);
    const csv = [header, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadFile(`tabungku-laporan-${Utils.todayISO()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
    Utils.toast('Data CSV berhasil diexport', 'success');
  }

  function exportPdf(){
    const list = Storage.getTransactions();
    const totals = Storage.computeTotals();
    const balance = Storage.computeBalance();

    const win = window.open('', '_blank');
    const rows = list.map(t => `
      <tr>
        <td>${t.trxNumber}</td>
        <td>${Utils.formatDate(t.date)}</td>
        <td>${TxRenderer.TYPE_META[t.type]?.label || t.type}</td>
        <td>${Utils.escapeHtml(t.name || t.source || '-')}</td>
        <td style="text-align:right;">${Utils.formatRupiah(t.amount)}</td>
      </tr>
    `).join('');

    win.document.write(`
      <html><head><title>Laporan TabungKu</title>
      <style>
        body{ font-family: Arial, sans-serif; padding: 24px; color:#10241C; }
        h1{ color:#0E8F55; }
        table{ width:100%; border-collapse: collapse; margin-top:20px; }
        th, td{ border:1px solid #ddd; padding:8px 10px; font-size:12px; }
        th{ background:#EFF7F3; text-align:left; }
        .summary{ display:flex; gap:20px; margin-top:10px; }
        .summary div{ background:#EFF7F3; padding:10px 16px; border-radius:8px; font-size:13px; }
      </style>
      </head><body>
        <h1>Laporan Keuangan — TabungKu</h1>
        <p>Dicetak pada ${Utils.formatDateLong(Utils.todayISO())}</p>
        <div class="summary">
          <div>Saldo: <b>${Utils.formatRupiah(balance)}</b></div>
          <div>Total Masuk: <b>${Utils.formatRupiah(totals.income)}</b></div>
          <div>Total Keluar: <b>${Utils.formatRupiah(totals.expense)}</b></div>
          <div>Total Tabungan: <b>${Utils.formatRupiah(totals.savingTotal)}</b></div>
        </div>
        <table>
          <thead><tr><th>No</th><th>Tanggal</th><th>Jenis</th><th>Nama</th><th>Nominal</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    win.document.close();
  }

  function handleImport(e){
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        Utils.modal({
          title: 'Import Data?',
          message: 'Data yang diimport akan digabungkan menggantikan data saat ini pada kategori yang sama. Lanjutkan?',
          type: 'warn',
          confirmText: 'Import',
          cancelText: 'Batal',
          onConfirm: () => {
            Storage.importAll(data);
            Utils.toast('Data berhasil diimport', 'success');
            if (window.App) App.refreshGlobalViews();
          }
        });
      }catch(err){
        Utils.toast('File JSON tidak valid', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  return { init };
})();
