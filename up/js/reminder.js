/* =========================================================
   reminder.js — Pengingat Pembayaran (tagihan/cicilan)
   ========================================================= */

const ReminderModule = (() => {

  const KEY = 'tk_reminders';

  function getAll(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || []; }catch(e){ return []; }
  }
  function saveAll(list){
    try{ localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch(e){ Utils.toast('Gagal menyimpan pengingat', 'error'); return false; }
  }

  function init(){
    const form = document.getElementById('reminderForm');
    if (!form) return;
    document.getElementById('reminderTanggal').value = Utils.todayISO();
    Utils.attachRupiahMask(document.getElementById('reminderNominal'));
    requestNotifPermission();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });

    document.getElementById('reminderList').addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-reminder]');
      const payBtn = e.target.closest('[data-pay-reminder]');
      if (delBtn) remove(delBtn.dataset.delReminder);
      if (payBtn) markPaid(payBtn.dataset.payReminder);
    });

    render();
    checkDueSoon();
    startNotifWatcher();
  }

  /* Minta izin notifikasi browser sekali saat halaman pengingat dibuka. */
  function requestNotifPermission(){
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default'){
      Notification.requestPermission();
    }
  }

  function submit(){
    const nama = document.getElementById('reminderNama').value.trim();
    const nominal = Utils.parseRupiahInput(document.getElementById('reminderNominal').value);
    const tanggal = document.getElementById('reminderTanggal').value;
    const jam = document.getElementById('reminderJam').value || '08:00';
    const ulang = document.getElementById('reminderUlang').value;

    if (!nama){ Utils.toast('Nama tagihan wajib diisi', 'error'); return; }
    if (nominal <= 0){ Utils.toast('Nominal harus lebih dari 0', 'error'); return; }
    if (!tanggal){ Utils.toast('Tanggal jatuh tempo wajib diisi', 'error'); return; }

    const list = getAll();
    list.unshift({
      id: Utils.uid(),
      name: nama,
      amount: nominal,
      dueDate: tanggal,
      time: jam, // 'HH:MM' — jam notifikasi dikirim pada hari jatuh tempo
      repeat: ulang, // 'none' | 'monthly'
      paid: false,
      notifiedFor: null, // 'YYYY-MM-DD' terakhir kali notifikasi ditembakkan, cegah duplikat
      createdAt: Date.now()
    });
    saveAll(list);

    document.getElementById('reminderForm').reset();
    document.getElementById('reminderTanggal').value = Utils.todayISO();
    document.getElementById('reminderJam').value = '08:00';
    Utils.toast('Pengingat ditambahkan', 'success');
    render();
  }

  function markPaid(id){
    const list = getAll();
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return;
    const item = list[idx];

    Utils.modal({
      title: 'Tandai Sudah Dibayar?',
      message: `Ini akan mencatat "${item.name}" sebagai pengeluaran sebesar ${Utils.formatRupiah(item.amount)}.`,
      type: 'warn',
      confirmText: 'Ya, Bayar',
      cancelText: 'Batal',
      onConfirm: () => {
        const balance = Storage.computeBalance();
        if (item.amount > balance){
          Utils.modal({ title: 'Saldo Tidak Mencukupi', message: `Saldo kamu ${Utils.formatRupiah(balance)}, kurang untuk membayar ${Utils.formatRupiah(item.amount)}.`, type: 'error' });
          return;
        }
        Storage.addTransaction({
          type: 'expense', amount: item.amount, unitPrice: item.amount, qty: 1,
          name: item.name, category: 'Tagihan', date: Utils.todayISO(), note: 'Dari Pengingat Pembayaran'
        });

        if (item.repeat === 'monthly'){
          const next = new Date(item.dueDate + 'T00:00:00');
          next.setMonth(next.getMonth() + 1);
          list[idx] = { ...item, dueDate: next.toISOString().slice(0,10), paid: false };
        } else {
          list.splice(idx, 1);
        }
        saveAll(list);
        render();
        if (window.App) App.refreshGlobalViews();
        Utils.toast('Pembayaran dicatat', 'success');
      }
    });
  }

  function remove(id){
    const list = getAll().filter(r => r.id !== id);
    saveAll(list);
    render();
    Utils.toast('Pengingat dihapus', 'default');
  }

  function daysUntil(dateStr){
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0,0,0,0);
    return Math.round((d - now) / 86400000);
  }

  function render(){
    const wrap = document.getElementById('reminderList');
    if (!wrap) return;
    const list = getAll().slice().sort((a,b) => a.dueDate < b.dueDate ? -1 : 1);

    if (!list.length){
      wrap.innerHTML = `<div class="empty-state"><p>Belum ada pengingat pembayaran</p></div>`;
      return;
    }

    wrap.innerHTML = list.map(r => {
      const diff = daysUntil(r.dueDate);
      const overdue = diff < 0;
      const dueSoon = diff >= 0 && diff <= 3;
      let subText = `Jatuh tempo ${Utils.formatDate(r.dueDate)}`;
      if (overdue) subText = `Terlambat ${Math.abs(diff)} hari`;
      else if (diff === 0) subText = 'Jatuh tempo hari ini';
      else if (dueSoon) subText = `${diff} hari lagi`;
      if (r.repeat === 'monthly') subText += ' · Bulanan';

      return `
        <div class="reminder-item ${overdue ? 'overdue' : ''}">
          <div class="reminder-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 7v5l3 3M12 22a10 10 0 100-20 10 10 0 000 20z" stroke="currentColor" stroke-width="1.7"/></svg>
          </div>
          <div class="reminder-body">
            <p class="reminder-title">${Utils.escapeHtml(r.name)}</p>
            <p class="reminder-sub">${subText}</p>
          </div>
          <div class="reminder-amount">${Utils.formatRupiah(r.amount)}</div>
          <button class="icon-btn small ripple" data-pay-reminder="${r.id}" title="Tandai dibayar" style="color:var(--brand-dark);">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
          <button class="reminder-del ripple" data-del-reminder="${r.id}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      `;
    }).join('');
  }

  function checkDueSoon(){
    const list = getAll();
    const urgent = list.filter(r => {
      const diff = daysUntil(r.dueDate);
      return diff <= 1;
    });
    if (urgent.length){
      const names = urgent.map(r => r.name).join(', ');
      Utils.toast(`Ada ${urgent.length} tagihan segera jatuh tempo: ${names}`, 'error');
    }
  }

  function countDueSoon(){
    return getAll().filter(r => daysUntil(r.dueDate) <= 1).length;
  }

  /* Kirim notifikasi asli (Notification API), jatuh kembali ke toast
     kalau notifikasi tidak diizinkan / tidak didukung browser. */
  function fireNotification(item){
    const title = `Pengingat: ${item.name}`;
    const body = `Jatuh tempo hari ini · ${Utils.formatRupiah(item.amount)}`;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted'){
      try{
        new Notification(title, {
          body,
          icon: 'assets/icons/icon-192.png',
          tag: 'tk-reminder-' + item.id
        });
      }catch(e){
        Utils.toast(`${title} — ${body}`, 'error');
      }
    } else {
      Utils.toast(`${title} — ${body}`, 'error');
    }
  }

  /* Cek setiap menit: apakah ada tagihan yang jatuh tempo HARI INI dan
     jam saat ini sudah melewati/menyamai jam yang diset user, serta
     belum pernah dinotifikasi untuk tanggal ini. */
  function checkNotifTimes(){
    const list = getAll();
    const today = Utils.todayISO();
    const now = new Date();
    const nowHM = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    let changed = false;

    list.forEach(item => {
      if (item.paid) return;
      if (item.dueDate !== today) return;
      const targetTime = item.time || '08:00';
      if (nowHM >= targetTime && item.notifiedFor !== today){
        fireNotification(item);
        item.notifiedFor = today;
        changed = true;
      }
    });

    if (changed) saveAll(list);
  }

  let notifTimer = null;
  function startNotifWatcher(){
    if (notifTimer) clearInterval(notifTimer);
    checkNotifTimes();
    notifTimer = setInterval(checkNotifTimes, 60000); // cek tiap 1 menit
  }

  return { init, render, countDueSoon, checkNotifTimes, startNotifWatcher };
})();
