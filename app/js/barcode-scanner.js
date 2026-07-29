/* =========================================================
   barcode-scanner.js — Smart Barcode Scanner TabungKu
   Modal fullscreen dengan 3 metode: Scan Kamera, Upload Foto,
   Input Manual. Hasil pencarian produk dipakai untuk mengisi
   otomatis form Tambah Pengeluaran (nama, merek, kategori, foto,
   catatan, negara asal) — harga/jumlah/tanggal/toko/metode bayar
   tetap diisi manual oleh pengguna.
   ========================================================= */

const BarcodeScanner = (() => {

  let zxingReader = null;
  let currentStream = null;
  let torchOn = false;
  let activeTab = 'camera'; // 'camera' | 'upload' | 'manual'
  let onSelectCallback = null;
  let pendingScan = null; // { barcode, product, source, scanHistoryId }
  let injected = false;
  let zxingLoadPromise = null;

  const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';

  /* ---------- Muat ZXing secara lazy (hanya saat scanner dibuka) ---------- */
  function loadZXing(){
    if (window.ZXing) return Promise.resolve();
    if (zxingLoadPromise) return zxingLoadPromise;
    zxingLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = ZXING_CDN;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Gagal memuat pustaka pemindai barcode. Cek koneksi internet.'));
      document.head.appendChild(script);
    });
    return zxingLoadPromise;
  }

  /* ---------- UI Injection (mengikuti pola AIAssistant: dibuat lewat JS) ---------- */
  function injectUI(){
    if (injected) return;
    injected = true;

    const overlay = document.createElement('div');
    overlay.id = 'scannerOverlay';
    overlay.className = 'scanner-overlay';
    overlay.innerHTML = `
      <div class="scanner-modal">
        <div class="scanner-header">
          <p class="scanner-title">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none"><rect x="3" y="6" width="2" height="12" fill="currentColor"/><rect x="7" y="6" width="1" height="12" fill="currentColor"/><rect x="10" y="6" width="3" height="12" fill="currentColor"/><rect x="15" y="6" width="1" height="12" fill="currentColor"/><rect x="18" y="6" width="3" height="12" fill="currentColor"/></svg>
            Smart Barcode Scanner
          </p>
          <button class="icon-btn small" id="scannerCloseBtn" aria-label="Tutup"><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </div>

        <div class="scanner-tabs" id="scannerTabs">
          <button class="scanner-tab active" data-tab="camera">Scan Kamera</button>
          <button class="scanner-tab" data-tab="upload">Upload Foto</button>
          <button class="scanner-tab" data-tab="manual">Input Manual</button>
        </div>

        <div class="scanner-body" id="scannerBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('scannerCloseBtn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    document.getElementById('scannerTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.scanner-tab');
      if (!btn) return;
      switchTab(btn.dataset.tab);
    });
  }

  /* ---------- Buka / Tutup Modal ---------- */
  function open(onSelect){
    onSelectCallback = onSelect;
    injectUI();
    document.getElementById('scannerOverlay').classList.add('open');
    switchTab('camera');
  }

  function close(){
    stopCamera();
    const overlay = document.getElementById('scannerOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  function switchTab(tab){
    activeTab = tab;
    stopCamera();
    document.querySelectorAll('.scanner-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const body = document.getElementById('scannerBody');
    if (tab === 'camera') renderCameraTab(body);
    else if (tab === 'upload') renderUploadTab(body);
    else renderManualTab(body);
  }

  /* ---------- Tab: Scan Kamera ---------- */
  function renderCameraTab(body){
    body.innerHTML = `
      <div class="scanner-cam-wrap">
        <video id="scannerVideo" playsinline muted></video>
        <div class="scanner-frame">
          <span class="corner tl"></span><span class="corner tr"></span>
          <span class="corner bl"></span><span class="corner br"></span>
          <div class="scanner-laser"></div>
        </div>
        <button class="scanner-flash-btn" id="scannerFlashBtn" title="Nyalakan Flash">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <p class="scanner-hint" id="scannerCamHint">Menyiapkan kamera...</p>
    `;
    startCamera();
  }

  async function startCamera(){
    const hint = document.getElementById('scannerCamHint');
    try{
      await loadZXing();
      const video = document.getElementById('scannerVideo');
      if (!video) return; // user sudah pindah tab sebelum kamera siap

      zxingReader = new ZXing.BrowserMultiFormatReader();
      const devices = await ZXing.BrowserMultiFormatReader.listVideoInputDevices();
      const backCam = devices.find(d => /back|belakang|environment/i.test(d.label)) || devices[devices.length - 1];

      hint.textContent = 'Arahkan kamera ke barcode produk...';

      zxingReader.decodeFromVideoDevice(backCam ? backCam.deviceId : null, video, (result, err) => {
        if (result){
          onBarcodeDetected(result.getText());
        }
      });

      currentStream = video.srcObject;
      setupFlashButton();
    }catch(e){
      if (hint) hint.textContent = 'Kamera tidak dapat diakses. Coba Upload Foto atau Input Manual.';
      console.warn('Camera scan error:', e);
    }
  }

  function setupFlashButton(){
    const btn = document.getElementById('scannerFlashBtn');
    if (!btn || !currentStream) return;
    const track = currentStream.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch){ btn.style.display = 'none'; return; }

    btn.addEventListener('click', async () => {
      torchOn = !torchOn;
      try{
        await track.applyConstraints({ advanced: [{ torch: torchOn }] });
        btn.classList.toggle('on', torchOn);
      }catch(e){ console.warn('Flash tidak didukung:', e); }
    });
  }

  function stopCamera(){
    try{
      if (zxingReader){ zxingReader.reset(); zxingReader = null; }
    }catch(e){ /* aman diabaikan */ }
    if (currentStream){
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
    torchOn = false;
  }

  /* ---------- Tab: Upload Foto ---------- */
  function renderUploadTab(body){
    body.innerHTML = `
      <div class="scanner-upload-wrap">
        <label class="scanner-upload-box" id="scannerUploadBox">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none"><path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          <span>Ketuk untuk pilih foto barcode dari galeri</span>
          <input type="file" accept="image/*" id="scannerUploadInput" hidden>
        </label>
        <img id="scannerUploadPreview" class="scanner-upload-preview" style="display:none;">
        <p class="scanner-hint" id="scannerUploadHint"></p>
      </div>
    `;
    document.getElementById('scannerUploadInput').addEventListener('change', handleUploadFile);
  }

  async function handleUploadFile(e){
    const file = e.target.files[0];
    if (!file) return;
    const hint = document.getElementById('scannerUploadHint');
    const preview = document.getElementById('scannerUploadPreview');
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = 'block';
    hint.textContent = 'Membaca barcode dari foto...';

    try{
      await loadZXing();
      const reader = new ZXing.BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(url);
      hint.textContent = 'Barcode ditemukan: ' + result.getText();
      onBarcodeDetected(result.getText());
    }catch(e){
      hint.textContent = 'Barcode tidak terbaca dari foto ini. Coba foto yang lebih jelas atau gunakan Input Manual.';
    }
  }

  /* ---------- Tab: Input Manual ---------- */
  function renderManualTab(body){
    body.innerHTML = `
      <div class="scanner-manual-wrap">
        <label class="field">
          <span>Nomor Barcode</span>
          <input type="text" inputmode="numeric" id="scannerManualInput" placeholder="Contoh: 8991002100115">
        </label>
        <button class="btn-primary full ripple" id="scannerManualSearchBtn">Cari</button>
      </div>
    `;
    document.getElementById('scannerManualSearchBtn').addEventListener('click', () => {
      const val = document.getElementById('scannerManualInput').value.trim();
      if (!val){ Utils.toast('Masukkan nomor barcode dulu', 'error'); return; }
      onBarcodeDetected(val);
    });
    document.getElementById('scannerManualInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){ e.preventDefault(); document.getElementById('scannerManualSearchBtn').click(); }
    });
  }

  /* ---------- Feedback: getar + beep saat barcode terdeteksi ---------- */
  function successFeedback(){
    if (navigator.vibrate) navigator.vibrate(80);
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1400;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.18);
    }catch(e){ /* audio opsional, aman diabaikan */ }
  }

  /* ---------- Barcode terdeteksi -> jalankan pencarian berlapis ---------- */
  let searching = false;
  async function onBarcodeDetected(barcode){
    if (searching) return;
    searching = true;
    successFeedback();
    stopCamera();
    renderSearchingState(barcode);

    const result = await ProductLookup.lookup(barcode, {
      onSourceTried: (src) => updateSearchingLog(src)
    });
    searching = false;

    if (result.product){
      renderFoundState(barcode, result.product, result.source || result.product.source, result.fromCache);
    }else{
      renderNotFoundState(barcode, result.offline);
    }
  }

  function renderSearchingState(barcode){
    const body = document.getElementById('scannerBody');
    body.innerHTML = `
      <div class="scanner-searching">
        <div class="scanner-skeleton-photo"></div>
        <div class="scanner-skeleton-line w70"></div>
        <div class="scanner-skeleton-line w40"></div>
        <p class="scanner-search-log" id="scannerSearchLog">Mencari data untuk barcode ${Utils.escapeHtml(barcode)}...</p>
      </div>
    `;
  }

  function updateSearchingLog(source){
    const log = document.getElementById('scannerSearchLog');
    if (log) log.textContent = `Mencari di ${source}...`;
  }

  /* ---------- Produk ditemukan ---------- */
  function renderFoundState(barcode, product, source, fromCache){
    const body = document.getElementById('scannerBody');
    const nutri = product.nutrition;

    body.innerHTML = `
      <div class="scanner-result">
        <div class="scanner-result-top">
          ${product.photo
            ? `<img src="${Utils.escapeHtml(product.photo)}" class="scanner-result-photo" alt="${Utils.escapeHtml(product.name)}">`
            : `<div class="scanner-result-photo scanner-result-photo-empty"><svg viewBox="0 0 24 24" width="26" height="26" fill="none"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="13" r="3.2" stroke="currentColor" stroke-width="1.5"/></svg></div>`}
          <div class="scanner-result-info">
            <p class="scanner-result-name">${Utils.escapeHtml(product.name || '(Tanpa nama)')}</p>
            <p class="scanner-result-brand">${Utils.escapeHtml(product.brand || '-')} · ${Utils.escapeHtml(product.category || 'Kategori tidak diketahui')}</p>
            <p class="scanner-result-source">Sumber: ${Utils.escapeHtml(source || '-')}${fromCache ? ' (cache)' : ''}</p>
          </div>
        </div>

        <div class="scanner-result-badges">
          ${product.nutriScore ? `<span class="scanner-badge nutri-${product.nutriScore.toLowerCase()}">Nutri-Score ${product.nutriScore}</span>` : ''}
          ${product.ecoScore ? `<span class="scanner-badge eco-${product.ecoScore.toLowerCase()}">Eco-Score ${product.ecoScore}</span>` : ''}
          ${product.halal ? `<span class="scanner-badge halal">✓ Halal</span>` : ''}
        </div>

        <div class="scanner-result-detail">
          <div class="scanner-detail-row"><span>Barcode</span><b>${Utils.escapeHtml(barcode)}</b></div>
          ${product.country ? `<div class="scanner-detail-row"><span>Negara Asal</span><b>${Utils.escapeHtml(product.country)}</b></div>` : ''}
          ${product.weight ? `<div class="scanner-detail-row"><span>Berat / Isi Bersih</span><b>${Utils.escapeHtml(product.weight)}</b></div>` : ''}
          ${product.allergens ? `<div class="scanner-detail-row"><span>Alergen</span><b>${Utils.escapeHtml(product.allergens)}</b></div>` : ''}
        </div>

        ${product.ingredients ? `
        <details class="scanner-details-toggle">
          <summary>Komposisi / Ingredients</summary>
          <p>${Utils.escapeHtml(product.ingredients)}</p>
        </details>` : ''}

        ${nutri ? `
        <details class="scanner-details-toggle">
          <summary>Informasi Nutrisi (per 100g)</summary>
          <div class="scanner-nutri-grid">
            ${nutri.energy != null ? `<div><span>Energi</span><b>${nutri.energy} kkal</b></div>` : ''}
            ${nutri.protein != null ? `<div><span>Protein</span><b>${nutri.protein} g</b></div>` : ''}
            ${nutri.fat != null ? `<div><span>Lemak</span><b>${nutri.fat} g</b></div>` : ''}
            ${nutri.carbs != null ? `<div><span>Karbohidrat</span><b>${nutri.carbs} g</b></div>` : ''}
            ${nutri.sugar != null ? `<div><span>Gula</span><b>${nutri.sugar} g</b></div>` : ''}
            ${nutri.salt != null ? `<div><span>Garam</span><b>${nutri.salt} g</b></div>` : ''}
          </div>
        </details>` : ''}

        ${product.certifications && product.certifications.length ? `
        <div class="scanner-cert-chips">
          ${product.certifications.slice(0,6).map(c => `<span class="scanner-chip">${Utils.escapeHtml(c)}</span>`).join('')}
        </div>` : ''}

        <div class="scanner-result-actions">
          <button class="btn-outline ripple" id="scannerScanAgainBtn">Scan Lagi</button>
          <button class="btn-primary ripple" id="scannerUseProductBtn">Gunakan Produk Ini</button>
        </div>
      </div>
    `;

    document.getElementById('scannerScanAgainBtn').addEventListener('click', () => switchTab('camera'));
    document.getElementById('scannerUseProductBtn').addEventListener('click', () => selectProduct(barcode, product, source));

    if (fromCache) ProductLookup.refreshInBackground(barcode);
  }

  /* ---------- Produk tidak ditemukan ---------- */
  function renderNotFoundState(barcode, offline){
    const body = document.getElementById('scannerBody');
    body.innerHTML = `
      <div class="scanner-notfound">
        <div class="scanner-notfound-icon">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M21 21l-4.3-4.3M9 9l4 4m0-4l-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </div>
        <p class="scanner-notfound-title">Produk belum tersedia di database.</p>
        <p class="scanner-hint">${offline ? 'Kamu sedang offline dan barcode ini belum ada di database lokal.' : `Barcode ${Utils.escapeHtml(barcode)} tidak ditemukan di semua sumber data.`}</p>
        <div class="scanner-notfound-actions">
          <button class="btn-primary full ripple" id="scannerFillManualBtn">Isi Manual</button>
          <button class="btn-outline full ripple" id="scannerRetryBtn">Scan Lagi</button>
        </div>
      </div>
    `;
    document.getElementById('scannerFillManualBtn').addEventListener('click', () => renderManualFillForm(barcode));
    document.getElementById('scannerRetryBtn').addEventListener('click', () => switchTab('camera'));
  }

  /* ---------- Form isi manual (produk tak ditemukan) -> simpan ke DB lokal ---------- */
  function renderManualFillForm(barcode){
    const body = document.getElementById('scannerBody');
    body.innerHTML = `
      <div class="scanner-manual-fill">
        <p class="scanner-hint">Barcode: <b>${Utils.escapeHtml(barcode)}</b></p>
        <label class="field">
          <span>Nama Produk</span>
          <input type="text" id="scannerFillName" placeholder="Contoh: Kopi Sachet ABC" required>
        </label>
        <label class="field">
          <span>Merek (opsional)</span>
          <input type="text" id="scannerFillBrand" placeholder="Contoh: ABC">
        </label>
        <label class="field">
          <span>Kategori</span>
          <input type="text" id="scannerFillCategory" placeholder="Contoh: Minuman">
        </label>
        <label class="scanner-checkbox-row">
          <input type="checkbox" id="scannerFillSaveDb" checked>
          <span>Simpan ke Database Lokal TabungKu supaya bisa dipakai lagi tanpa internet</span>
        </label>
        <button class="btn-primary full ripple" id="scannerFillSubmitBtn">Gunakan Produk Ini</button>
      </div>
    `;
    document.getElementById('scannerFillSubmitBtn').addEventListener('click', () => {
      const name = document.getElementById('scannerFillName').value.trim();
      if (!name){ Utils.toast('Nama produk wajib diisi', 'error'); return; }
      const product = ProductLookup.emptyProduct(barcode);
      product.name = name;
      product.brand = document.getElementById('scannerFillBrand').value.trim();
      product.category = document.getElementById('scannerFillCategory').value.trim();
      product.source = 'Manual';

      const saveDb = document.getElementById('scannerFillSaveDb').checked;
      if (saveDb) ProductDB.saveLocalProduct(barcode, product);

      selectProduct(barcode, product, 'Manual');
    });
  }

  /* ---------- Produk dipilih -> kirim ke pemanggil (ExpenseModule) ---------- */
  function selectProduct(barcode, product, source){
    pendingScan = { barcode, product, source };
    close();
    if (onSelectCallback) onSelectCallback(product, barcode);
  }

  /* ---------- Dipanggil ExpenseModule setelah transaksi berhasil disimpan ---------- */
  function commitPendingScan(expenseId, price, qty, total){
    if (!pendingScan) return;
    const record = ProductDB.addScanHistory({
      barcode: pendingScan.barcode,
      name: pendingScan.product.name,
      photo: pendingScan.product.photo,
      source: pendingScan.source,
      expenseId, price, qty, total
    });
    ProductDB.recordStat(pendingScan.product, total);
    pendingScan = null;
    return record;
  }

  function getPendingScan(){ return pendingScan; }
  function clearPendingScan(){ pendingScan = null; }

  /* ---------- Statistik Scan (dipanggil dari halaman Statistik) ---------- */
  function renderStatsSection(){
    const grid = document.getElementById('scanStatGrid');
    const listsWrap = document.getElementById('scanTopLists');
    if (!grid || !listsWrap) return;

    const stats = ProductDB.getStats();
    grid.innerHTML = `
      <div class="stat-card card"><p class="stat-label">Total Scan</p><h3 class="stat-value" id="scanStatTotal">${stats.totalScans}</h3></div>
      <div class="stat-card card"><p class="stat-label">Produk Favorit</p><h3 class="stat-value small">${topName(stats.byProduct)}</h3></div>
      <div class="stat-card card"><p class="stat-label">Kategori Favorit</p><h3 class="stat-value small">${topName(stats.byCategory)}</h3></div>
      <div class="stat-card card"><p class="stat-label">Merek Favorit</p><h3 class="stat-value small">${topName(stats.byBrand)}</h3></div>
    `;

    const renderTopList = (title, entries) => entries.length ? `
      <div class="scan-top-list">
        <p class="scan-top-list-title">${title}</p>
        ${entries.map(e => `
          <div class="scan-top-row">
            <span>${Utils.escapeHtml(e.name)}</span>
            <b>${e.count}x · ${Utils.formatRupiah(e.total)}</b>
          </div>
        `).join('')}
      </div>` : '';

    listsWrap.innerHTML = `
      ${renderTopList('Produk Paling Sering Dibeli', ProductDB.topEntries(stats.byProduct, 5))}
      ${renderTopList('Pengeluaran per Kategori (Scan)', ProductDB.topEntries(stats.byCategory, 5))}
      ${renderTopList('Pengeluaran per Merek', ProductDB.topEntries(stats.byBrand, 5))}
      ${renderRecentScans()}
    `;
  }

  function renderRecentScans(){
    const history = ProductDB.getScanHistory().slice(0, 8);
    if (!history.length) return '';
    return `
      <div class="scan-top-list">
        <p class="scan-top-list-title">Riwayat Scan Terbaru</p>
        ${history.map(h => `
          <div class="scan-top-row">
            <span>${Utils.escapeHtml(h.name)} <span style="opacity:.6;">· ${Utils.formatDate(new Date(h.scannedAt).toISOString().slice(0,10))}</span></span>
            <b>${h.total ? Utils.formatRupiah(h.total) : '-'}</b>
          </div>
        `).join('')}
      </div>
    `;
  }

  function topName(map){
    const top = ProductDB.topEntries(map, 1)[0];
    return top ? top.name : '-';
  }

  return { open, close, commitPendingScan, getPendingScan, clearPendingScan, renderStatsSection };
})();
