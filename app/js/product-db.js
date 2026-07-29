/* =========================================================
   product-db.js — Database lokal produk barcode + cache + riwayat scan
   Catatan penting: semua key di sini SENGAJA terpisah dari
   Storage.KEYS (tk_transactions/tk_targets/tk_settings) supaya
   "Reset Seluruh Data" TIDAK ikut menghapus database produk,
   cache, riwayat scan, dan statistik scan. Sama seperti tk_streak,
   data ini dianggap "aset jangka panjang" milik pengguna.
   ========================================================= */

const ProductDB = (() => {

  const KEYS = {
    LOCAL_DB: 'tk_product_db',      // { [barcode]: productObject }
    CACHE: 'tk_scan_cache',         // { [barcode]: { data, fetchedAt, source } }
    HISTORY: 'tk_scan_history',     // [{ id, barcode, name, photo, source, scannedAt, expenseId }]
    STATS: 'tk_scan_stats'          // { totalScans, byProduct:{}, byCategory:{}, byBrand:{} }
  };

  const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari — setelah ini, refresh di background jika online

  function _get(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      console.error('ProductDB read error', key, e);
      return fallback;
    }
  }

  function _set(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      console.error('ProductDB write error', key, e);
      return false;
    }
  }

  /* ---------- Database Lokal (produk yang pernah discan/diisi manual) ---------- */
  function getLocalProduct(barcode){
    const db = _get(KEYS.LOCAL_DB, {});
    return db[barcode] || null;
  }

  function saveLocalProduct(barcode, product){
    const db = _get(KEYS.LOCAL_DB, {});
    db[barcode] = { ...product, barcode, savedAt: Date.now() };
    _set(KEYS.LOCAL_DB, db);
    return db[barcode];
  }

  function getAllLocalProducts(){
    return _get(KEYS.LOCAL_DB, {});
  }

  /* ---------- Cache hasil pencarian API (biar tidak fetch ulang tiap scan) ---------- */
  function getCached(barcode){
    const cache = _get(KEYS.CACHE, {});
    const entry = cache[barcode];
    if (!entry) return null;
    entry.isStale = (Date.now() - entry.fetchedAt) > CACHE_TTL_MS;
    return entry;
  }

  function setCached(barcode, data, source){
    const cache = _get(KEYS.CACHE, {});
    cache[barcode] = { data, source, fetchedAt: Date.now() };
    _set(KEYS.CACHE, cache);
  }

  /* ---------- Riwayat Scan ---------- */
  function addScanHistory(entry){
    const list = _get(KEYS.HISTORY, []);
    const record = {
      id: Utils.uid(),
      barcode: entry.barcode,
      name: entry.name || '(Tidak diketahui)',
      photo: entry.photo || '',
      source: entry.source || 'manual',
      scannedAt: Date.now(),
      expenseId: entry.expenseId || null,
      price: entry.price || 0,
      qty: entry.qty || 0,
      total: entry.total || 0
    };
    list.unshift(record);
    _set(KEYS.HISTORY, list.slice(0, 500)); // batasi 500 riwayat scan terakhir
    return record;
  }

  function getScanHistory(){
    return _get(KEYS.HISTORY, []);
  }

  function linkHistoryToExpense(scanHistoryId, expenseId){
    const list = _get(KEYS.HISTORY, []);
    const item = list.find(h => h.id === scanHistoryId);
    if (item) { item.expenseId = expenseId; _set(KEYS.HISTORY, list); }
  }

  /* ---------- Statistik Scan ---------- */
  function recordStat(product, total){
    const stats = _get(KEYS.STATS, { totalScans: 0, byProduct: {}, byCategory: {}, byBrand: {} });
    stats.totalScans += 1;

    const nameKey = product.name || '(Tidak diketahui)';
    if (!stats.byProduct[nameKey]) stats.byProduct[nameKey] = { count: 0, total: 0 };
    stats.byProduct[nameKey].count += 1;
    stats.byProduct[nameKey].total += (total || 0);

    if (product.category){
      if (!stats.byCategory[product.category]) stats.byCategory[product.category] = { count: 0, total: 0 };
      stats.byCategory[product.category].count += 1;
      stats.byCategory[product.category].total += (total || 0);
    }

    if (product.brand){
      if (!stats.byBrand[product.brand]) stats.byBrand[product.brand] = { count: 0, total: 0 };
      stats.byBrand[product.brand].count += 1;
      stats.byBrand[product.brand].total += (total || 0);
    }

    _set(KEYS.STATS, stats);
    return stats;
  }

  function getStats(){
    return _get(KEYS.STATS, { totalScans: 0, byProduct: {}, byCategory: {}, byBrand: {} });
  }

  function topEntries(map, limit = 5){
    return Object.entries(map || {})
      .sort((a,b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([name, v]) => ({ name, ...v }));
  }

  return {
    getLocalProduct, saveLocalProduct, getAllLocalProducts,
    getCached, setCached,
    addScanHistory, getScanHistory, linkHistoryToExpense,
    recordStat, getStats, topEntries
  };
})();
