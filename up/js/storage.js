/* =========================================================
   storage.js — semua akses Local Storage terpusat di sini
   ========================================================= */

const Storage = (() => {

  const KEYS = {
    TRANSACTIONS: 'tk_transactions',
    TARGETS: 'tk_targets',
    SETTINGS: 'tk_settings',
    TRX_COUNTER: 'tk_trx_counter'
  };

  const DEFAULT_SETTINGS = {
    username: '',
    initialBalance: 0,
    theme: 'system',
    barcodeLookupApiKey: '', // opsional — untuk fallback pencarian produk barcode
    customBg: { enabled: false, color1: '#0B2A1F', color2: '#12B76A', direction: '135deg' }
  };

  function _get(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      console.error('Storage read error', key, e);
      return fallback;
    }
  }

  function _set(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      console.error('Storage write error', key, e);
      Utils.toast('Gagal menyimpan data (storage penuh?)', 'error');
      return false;
    }
  }

  /* ---------- Transactions ---------- */
  function getTransactions(){
    return _get(KEYS.TRANSACTIONS, []);
  }

  function saveTransactions(list){
    return _set(KEYS.TRANSACTIONS, list);
  }

  function nextTrxNumber(){
    let counter = _get(KEYS.TRX_COUNTER, 0);
    counter += 1;
    _set(KEYS.TRX_COUNTER, counter);
    return 'TRX-' + Utils.pad6(counter);
  }

  function addTransaction(trx){
    const list = getTransactions();
    trx.id = Utils.uid();
    trx.trxNumber = nextTrxNumber();
    trx.createdAt = Date.now();
    list.unshift(trx);
    saveTransactions(list);
    return trx;
  }

  function deleteTransaction(id){
    const list = getTransactions();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const [removed] = list.splice(idx, 1);
    saveTransactions(list);
    return removed;
  }

  function restoreTransaction(trx){
    const list = getTransactions();
    list.unshift(trx);
    saveTransactions(list);
  }

  function updateTransaction(id, patch){
    const list = getTransactions();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    saveTransactions(list);
    return list[idx];
  }

  /* ---------- Targets ---------- */
  function getTargets(){
    return _get(KEYS.TARGETS, []);
  }
  function saveTargets(list){
    return _set(KEYS.TARGETS, list);
  }
  function addTarget(target){
    const list = getTargets();
    target.id = Utils.uid();
    target.createdAt = Date.now();
    target.achieved = false;
    list.unshift(target);
    saveTargets(list);
    return target;
  }
  function updateTarget(id, patch){
    const list = getTargets();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    saveTargets(list);
    return list[idx];
  }
  function deleteTarget(id){
    const list = getTargets().filter(t => t.id !== id);
    saveTargets(list);
  }

  /* ---------- Settings ---------- */
  function getSettings(){
    return { ...DEFAULT_SETTINGS, ..._get(KEYS.SETTINGS, {}) };
  }
  function saveSettings(patch){
    const current = getSettings();
    const updated = { ...current, ...patch };
    _set(KEYS.SETTINGS, updated);
    return updated;
  }

  /* ---------- Derived calculations ---------- */
  function computeBalance(){
    const settings = getSettings();
    const list = getTransactions();
    let balance = Number(settings.initialBalance) || 0;
    list.forEach(t => {
      if (t.type === 'income') balance += t.amount;
      else if (t.type === 'expense') balance -= t.amount;
      else if (t.type === 'saving_in') balance -= t.amount;
      else if (t.type === 'saving_out') balance += t.amount;
    });
    return balance;
  }

  function computeTotals(){
    const list = getTransactions();
    let income = 0, expense = 0, savingTotal = 0;
    list.forEach(t => {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
      else if (t.type === 'saving_in') savingTotal += t.amount;
      else if (t.type === 'saving_out') savingTotal -= t.amount;
    });
    return { income, expense, savingTotal, count: list.length };
  }

  /* ---------- Backup / Restore / Reset ---------- */
  function exportAll(){
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: getTransactions(),
      targets: getTargets(),
      settings: getSettings(),
      trxCounter: _get(KEYS.TRX_COUNTER, 0)
    };
  }

  function importAll(data){
    if (!data || typeof data !== 'object') throw new Error('Format data tidak valid');
    if (Array.isArray(data.transactions)) saveTransactions(data.transactions);
    if (Array.isArray(data.targets)) saveTargets(data.targets);
    if (data.settings) _set(KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...data.settings });
    if (typeof data.trxCounter === 'number') _set(KEYS.TRX_COUNTER, data.trxCounter);
  }

  function resetAll(){
    localStorage.removeItem(KEYS.TRANSACTIONS);
    localStorage.removeItem(KEYS.TARGETS);
    localStorage.removeItem(KEYS.SETTINGS);
    localStorage.removeItem(KEYS.TRX_COUNTER);
  }

  return {
    KEYS,
    getTransactions, saveTransactions, addTransaction, deleteTransaction, restoreTransaction, updateTransaction,
    getTargets, saveTargets, addTarget, updateTarget, deleteTarget,
    getSettings, saveSettings,
    computeBalance, computeTotals,
    exportAll, importAll, resetAll
  };
})();
