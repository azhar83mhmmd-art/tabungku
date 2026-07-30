/* =========================================================
   target.js — halaman Target Tabungan
   ========================================================= */

const TargetModule = (() => {

  let photoDataUrl = null;

  function init(){
    const form = document.getElementById('targetForm');
    Utils.attachRupiahMask(document.getElementById('targetNominal'));

    document.getElementById('openTargetFormBtn').addEventListener('click', () => {
      form.style.display = 'flex';
      document.getElementById('openTargetFormBtn').style.display = 'none';
    });
    document.getElementById('cancelTargetBtn').addEventListener('click', () => {
      form.style.display = 'none';
      document.getElementById('openTargetFormBtn').style.display = 'block';
      form.reset();
      photoDataUrl = null;
    });

    document.getElementById('targetFoto').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { photoDataUrl = reader.result; };
      reader.readAsDataURL(file);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });

    document.getElementById('targetListWrap').addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add-saving]');
      const delBtn = e.target.closest('[data-delete-target]');
      if (addBtn) promptAddSaving(addBtn.dataset.addSaving);
      if (delBtn) confirmDeleteTarget(delBtn.dataset.deleteTarget);
    });
  }

  function submit(){
    const name = document.getElementById('targetNama').value.trim();
    const nominal = Utils.parseRupiahInput(document.getElementById('targetNominal').value);
    const deadline = document.getElementById('targetDeadline').value;

    if (!name){ Utils.toast('Nama target wajib diisi', 'error'); return; }
    if (nominal <= 0){ Utils.toast('Nominal target harus lebih dari 0', 'error'); return; }
    if (!deadline){ Utils.toast('Deadline wajib diisi', 'error'); return; }

    Storage.addTarget({
      name, nominal, deadline,
      saved: 0,
      photo: photoDataUrl
    });

    document.getElementById('targetForm').reset();
    document.getElementById('targetForm').style.display = 'none';
    document.getElementById('openTargetFormBtn').style.display = 'block';
    photoDataUrl = null;

    Utils.toast('Target baru dibuat', 'success');
    render();
    if (window.App) App.refreshGlobalViews();
  }

  function promptAddSaving(targetId){
    const target = Storage.getTargets().find(t => t.id === targetId);
    if (!target) return;
    const balance = Storage.computeBalance();

    const input = prompt(`Nominal yang ingin ditambahkan ke target "${target.name}" (saldo tersedia: ${Utils.formatRupiah(balance)})`, '');
    if (input === null) return;
    const nominal = Utils.parseRupiahInput(input);
    if (nominal <= 0){ Utils.toast('Nominal tidak valid', 'error'); return; }
    if (nominal > balance){
      Utils.modal({ title: 'Saldo Tidak Mencukupi', message: `Saldo kamu ${Utils.formatRupiah(balance)}, kurang untuk menambah ${Utils.formatRupiah(nominal)}.`, type: 'error' });
      return;
    }

    const newSaved = target.saved + nominal;
    Storage.updateTarget(targetId, { saved: newSaved });
    Storage.addTransaction({
      type: 'saving_in', amount: nominal, date: Utils.todayISO(),
      note: `Target: ${target.name}`, name: `Menabung untuk ${target.name}`
    });
    if (typeof StreakModule !== 'undefined') StreakModule.onSavingAdded(Utils.todayISO());

    if (newSaved >= target.nominal && !target.achieved){
      Storage.updateTarget(targetId, { achieved: true });
      Utils.confetti();
      Utils.modal({
        title: 'Selamat!',
        message: `Target Tabungan "${target.name}" Berhasil Tercapai!`,
        type: 'success'
      });
    } else {
      Utils.toast('Berhasil menambah tabungan target', 'success');
    }

    render();
    if (window.App) App.refreshGlobalViews();
  }

  function confirmDeleteTarget(targetId){
    Utils.modal({
      title: 'Hapus Target?',
      message: 'Target ini akan dihapus permanen. Dana yang sudah ditabung tetap ada di total tabungan kamu.',
      type: 'warn',
      confirmText: 'Hapus',
      cancelText: 'Batal',
      onConfirm: () => {
        Storage.deleteTarget(targetId);
        render();
        if (window.App) App.refreshGlobalViews();
        Utils.toast('Target dihapus', 'default');
      }
    });
  }

  function render(){
    const targets = Storage.getTargets();
    const wrap = document.getElementById('targetListWrap');

    if (!targets.length){
      wrap.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" width="42" height="42" fill="none"><path d="M12 21c-4.5-2.3-8-5.7-8-10a8 8 0 1116 0c0 4.3-3.5 7.7-8 10z" stroke="currentColor" stroke-width="1.4"/></svg>
            <p>Belum ada target tabungan. Buat target pertamamu!</p>
          </div>
        </div>
      `;
      return;
    }

    wrap.innerHTML = targets.map(t => {
      const pct = Math.min(100, Math.round((t.saved / t.nominal) * 100));
      const sisa = Math.max(0, t.nominal - t.saved);
      const daysLeft = Math.ceil((new Date(t.deadline) - new Date()) / 86400000);
      return `
        <div class="card target-card">
          <div class="target-card-top">
            ${t.photo ? `<img src="${t.photo}" class="target-photo" alt="">` : `<div class="target-photo" style="display:flex;align-items:center;justify-content:center;color:var(--brand);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 21c-4.5-2.3-8-5.7-8-10a8 8 0 1116 0c0 4.3-3.5 7.7-8 10z" stroke="currentColor" stroke-width="1.6"/></svg></div>`}
            <div>
              <p class="target-name">${Utils.escapeHtml(t.name)} ${t.achieved ? '✅' : ''}</p>
              <p class="target-deadline">Deadline: ${Utils.formatDate(t.deadline)}</p>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
          <div class="target-nums">
            <span>${pct}% tercapai</span>
            <b>${Utils.formatRupiah(t.saved)} / ${Utils.formatRupiah(t.nominal)}</b>
          </div>
          <div class="target-meta">
            <span>Sisa: ${Utils.formatRupiah(sisa)}</span>
            <span>${daysLeft > 0 ? daysLeft + ' hari lagi' : (t.achieved ? 'Tercapai' : 'Lewat deadline')}</span>
          </div>
          ${!t.achieved ? `
          <div class="target-actions">
            <button class="btn-outline ripple" data-delete-target="${t.id}">Hapus</button>
            <button class="btn-primary ripple" data-add-saving="${t.id}">+ Tambah Tabungan</button>
          </div>` : `
          <div class="target-actions">
            <button class="btn-outline full ripple" data-delete-target="${t.id}">Hapus dari daftar</button>
          </div>`}
        </div>
      `;
    }).join('');
  }

  return { init, render };
})();
