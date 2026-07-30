/* =========================================================
   utils.js — helper murni, dipakai semua modul lain
   ========================================================= */

const Utils = (() => {

  function formatRupiah(num){
    num = Math.round(Number(num) || 0);
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  function formatRupiahShort(num){
    num = Number(num) || 0;
    const abs = Math.abs(num);
    let str;
    if (abs >= 1000000000) str = (num/1000000000).toFixed(1).replace(/\.0$/,'') + 'M';
    else if (abs >= 1000000) str = (num/1000000).toFixed(1).replace(/\.0$/,'') + 'jt';
    else if (abs >= 1000) str = (num/1000).toFixed(0) + 'rb';
    else str = String(num);
    return str;
  }

  function parseRupiahInput(str){
    if (!str) return 0;
    const digits = String(str).replace(/[^0-9]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  function attachRupiahMask(input){
    input.addEventListener('input', () => {
      const raw = parseRupiahInput(input.value);
      input.value = raw ? raw.toLocaleString('id-ID') : '';
    });
  }

  function todayISO(){
    const d = new Date();
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0,10);
  }

  function formatDate(iso){
    if(!iso) return '-';
    const d = new Date(iso + 'T00:00:00');
    const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateLong(iso){
    if(!iso) return '-';
    const d = new Date(iso + 'T00:00:00');
    const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateShort(iso){
    if(!iso) return '-';
    const d = new Date(iso + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  function pad6(n){
    return String(n).padStart(6, '0');
  }

  /* ---------- Toast / Snackbar ---------- */
  function toast(message, type = 'default', withUndo = null){
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${message}</span>`;
    if (withUndo){
      const btn = document.createElement('button');
      btn.textContent = 'Urungkan';
      btn.style.cssText = 'background:none;border:none;color:#8CFFC2;font-weight:700;cursor:pointer;font-size:13px;';
      btn.onclick = () => { withUndo(); el.remove(); };
      el.appendChild(btn);
    }
    container.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, withUndo ? 4000 : 2400);
  }

  /* ---------- Modal dialog ---------- */
  function modal({ title, message, type = 'success', confirmText = 'OK', cancelText = null, onConfirm = null, onCancel = null }){
    const overlay = document.getElementById('modalOverlay');
    const icon = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');
    const actions = document.getElementById('modalActions');

    const icons = {
      success: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
      warn: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none"><path d="M12 9v4M12 17h.01M10.3 3.9L2.5 17a1.6 1.6 0 001.4 2.4h16.2a1.6 1.6 0 001.4-2.4L13.7 3.9a1.6 1.6 0 00-2.8 0z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
    };

    icon.className = `modal-icon ${type}`;
    icon.innerHTML = icons[type] || icons.success;
    titleEl.textContent = title;
    msgEl.textContent = message;
    actions.innerHTML = '';

    if (cancelText){
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-outline ripple';
      cancelBtn.textContent = cancelText;
      cancelBtn.onclick = () => { close(); if (onCancel) onCancel(); };
      actions.appendChild(cancelBtn);
    }
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-primary ripple';
    confirmBtn.textContent = confirmText;
    confirmBtn.onclick = () => { close(); if (onConfirm) onConfirm(); };
    actions.appendChild(confirmBtn);

    function close(){ overlay.classList.remove('open'); }
    overlay.classList.add('open');
  }

  /* ---------- Ripple effect ---------- */
  function initRipple(){
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.ripple');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const circle = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      circle.className = 'ripple-circle';
      circle.style.width = circle.style.height = size + 'px';
      circle.style.left = (e.clientX - rect.left - size/2) + 'px';
      circle.style.top = (e.clientY - rect.top - size/2) + 'px';
      btn.appendChild(circle);
      setTimeout(() => circle.remove(), 550);
    });
  }

  /* ---------- Confetti ---------- */
  function confetti(){
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const colors = ['#12B76A','#0E8F55','#FFD166','#F04438','#3B82F6'];
    const pieces = Array.from({length: 120}, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: colors[Math.floor(Math.random()*colors.length)],
      speed: 2 + Math.random() * 3,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10
    }));
    let frame = 0;
    function draw(){
      frame++;
      ctx.clearRect(0,0,canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.speed;
        p.rot += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI/180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      if (frame < 130) requestAnimationFrame(draw);
      else { canvas.style.display = 'none'; ctx.clearRect(0,0,canvas.width,canvas.height); }
    }
    draw();
  }

  /* ---------- Debounce ---------- */
  function debounce(fn, delay = 250){
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  return {
    formatRupiah, formatRupiahShort, parseRupiahInput, attachRupiahMask,
    todayISO, formatDate, formatDateShort, formatDateLong,
    uid, pad6,
    toast, modal, initRipple, confetti, debounce, escapeHtml
  };
})();

/* =========================================================
   TxRenderer — shared renderer untuk daftar transaksi
   (dipakai Dashboard, Income, Expense, Saving, History)
   ========================================================= */
const TxRenderer = (() => {

  const TYPE_META = {
    income:     { icon: 'in',  sign: '+', label: 'Uang Masuk' },
    expense:    { icon: 'out', sign: '-', label: 'Uang Keluar' },
    saving_in:  { icon: 'sv',  sign: '⇄', label: 'Menabung' },
    saving_out: { icon: 'sv',  sign: '⇄', label: 'Tarik Tabungan' }
  };

  const ICONS = {
    in: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    out: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sv: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M12 21c-4.5-2.3-8-5.7-8-10a8 8 0 1116 0c0 4.3-3.5 7.7-8 10z" stroke="currentColor" stroke-width="1.8"/></svg>'
  };

  function emptyStateHtml(text){
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none"><path d="M4 19V6a2 2 0 012-2h9l5 5v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" stroke="currentColor" stroke-width="1.4"/></svg>
        <p>${text}</p>
      </div>
    `;
  }

  function renderList(list, opts = {}){
    if (!list.length) return emptyStateHtml(opts.emptyText || 'Belum ada transaksi');

    return list.map(t => {
      const meta = TYPE_META[t.type] || { icon:'sv', sign:'', label:t.type };
      const title = t.name || t.source || meta.label;
      const sub = opts.compact
        ? `${Utils.formatDate(t.date)} · ${meta.label}`
        : `${Utils.formatDate(t.date)}${t.category ? ' · ' + t.category : ''}${t.source ? ' · ' + t.source : ''}`;

      const swipeHtml = opts.swipe === false ? '' : `
        <div class="tx-swipe-delete" data-delete-id="${t.id}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      `;

      return `
        <div class="tx-item" data-tx-id="${t.id}" data-tx-type="${t.type}">
          <div class="tx-icon ${meta.icon}">${ICONS[meta.icon]}</div>
          <div class="tx-body">
            <p class="tx-title">${Utils.escapeHtml(title)}</p>
            <p class="tx-sub">${sub}</p>
          </div>
          <div class="tx-amount ${meta.sign === '+' ? 'in' : (meta.sign === '-' ? 'out' : 'transfer')}">${meta.sign}${Utils.formatRupiah(t.amount)}</div>
          ${swipeHtml}
        </div>
      `;
    }).join('');
  }

  function lastNMonths(n){
    const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const now = new Date();
    const result = [];
    for (let i = n - 1; i >= 0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      result.push({ key, label: bulan[d.getMonth()] });
    }
    return result;
  }

  /* Swipe-to-delete gesture, dipasang per container */
  function enableSwipeDelete(container, onDelete){
    let startX = 0, currentItem = null, currentDx = 0;

    container.addEventListener('touchstart', (e) => {
      const item = e.target.closest('.tx-item');
      if (!item) return;
      document.querySelectorAll('.tx-item.swiped').forEach(el => { if (el !== item) el.classList.remove('swiped'); });
      currentItem = item;
      startX = e.touches[0].clientX;
      currentDx = 0;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!currentItem) return;
      currentDx = e.touches[0].clientX - startX;
    }, { passive: true });

    container.addEventListener('touchend', () => {
      if (!currentItem) return;
      if (currentDx < -40) currentItem.classList.add('swiped');
      else currentItem.classList.remove('swiped');
      currentItem = null;
    });

    container.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-delete-id]');
      if (delBtn && onDelete) onDelete(delBtn.dataset.deleteId);
    });
  }

  return { renderList, lastNMonths, enableSwipeDelete, TYPE_META, ICONS };
})();
