/* =========================================================
   settings.js — halaman Pengaturan + tema + PWA install
   ========================================================= */

const SettingsModule = (() => {

  let deferredInstallPrompt = null;

  function init(){
    const settings = Storage.getSettings();
    document.getElementById('settingUsername').value = settings.username || '';
    document.getElementById('settingInitialBalance').value = settings.initialBalance ? Number(settings.initialBalance).toLocaleString('id-ID') : '';
    Utils.attachRupiahMask(document.getElementById('settingInitialBalance'));

    applyTheme(settings.theme);
    highlightThemeButton(settings.theme);

    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);

    document.querySelectorAll('.theme-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        Storage.saveSettings({ theme });
        applyTheme(theme);
        highlightThemeButton(theme);
      });
    });

    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      const current = Storage.getSettings().theme;
      const resolved = resolveTheme(current);
      const next = resolved === 'dark' ? 'light' : 'dark';
      Storage.saveSettings({ theme: next });
      applyTheme(next);
      highlightThemeButton(next);
    });

    document.getElementById('backupBtn').addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `tabungku-backup-${Utils.todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      Utils.toast('Backup berhasil diunduh', 'success');
    });

    document.getElementById('restoreInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try{
          const data = JSON.parse(reader.result);
          Utils.modal({
            title: 'Restore Data?',
            message: 'Semua data saat ini akan digantikan oleh data backup ini. Lanjutkan?',
            type: 'warn', confirmText: 'Restore', cancelText: 'Batal',
            onConfirm: () => {
              Storage.importAll(data);
              Utils.toast('Data berhasil direstore', 'success');
              if (window.App) App.refreshGlobalViews();
              init();
            }
          });
        }catch(err){ Utils.toast('File backup tidak valid', 'error'); }
        e.target.value = '';
      };
      reader.readAsText(file);
    });

    document.getElementById('resetAllBtn').addEventListener('click', () => {
      Utils.modal({
        title: 'Reset Seluruh Data?',
        message: 'Semua transaksi, tabungan, dan target akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.',
        type: 'error', confirmText: 'Ya, Reset', cancelText: 'Batal',
        onConfirm: () => {
          Storage.resetAll();
          Utils.toast('Seluruh data telah direset', 'success');
          if (window.App) App.refreshGlobalViews();
          init();
        }
      });
    });

    setupInstallPrompt();
  }

  function saveProfile(){
    const username = document.getElementById('settingUsername').value.trim();
    const initialBalance = Utils.parseRupiahInput(document.getElementById('settingInitialBalance').value);
    Storage.saveSettings({ username, initialBalance });
    Utils.toast('Profil disimpan', 'success');
    if (window.App) App.refreshGlobalViews();
  }

  function resolveTheme(theme){
    if (theme === 'system'){
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }

  function applyTheme(theme){
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute('data-theme', resolved);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', resolved === 'dark' ? '#0A1712' : '#F4FAF7');
  }

  function highlightThemeButton(theme){
    document.querySelectorAll('.theme-opt-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === theme);
    });
  }

  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function setupInstallPrompt(){
    const wrap = document.getElementById('installPromptWrap');
    if (!wrap) return;

    if (isStandalone()){
      wrap.innerHTML = '';
      return;
    }

    deferredInstallPrompt = window.__installPromptEvent || null;
    renderInstallCard(wrap);

    window.addEventListener('installpromptready', () => {
      deferredInstallPrompt = window.__installPromptEvent || null;
      renderInstallCard(wrap);
    });
  }

  function renderInstallCard(wrap){
    if (isStandalone()){ wrap.innerHTML = ''; return; }

    if (deferredInstallPrompt){
      wrap.innerHTML = `
        <div class="card install-card">
          <p class="section-label">Install Aplikasi</p>
          <p>Pasang TabungKu di layar utama untuk akses lebih cepat, seperti aplikasi Android.</p>
          <button class="btn-primary full ripple" id="installAppBtn">Install Aplikasi</button>
        </div>
      `;
      document.getElementById('installAppBtn').addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') Utils.toast('Aplikasi berhasil dipasang', 'success');
        deferredInstallPrompt = null;
        window.__installPromptEvent = null;
        wrap.innerHTML = '';
      });
    } else {
      wrap.innerHTML = `
        <div class="card install-card">
          <p class="section-label">Install Aplikasi</p>
          <p>Browser ini belum mendukung install otomatis. Ketuk tombol di bawah untuk lihat caranya.</p>
          <button class="btn-outline full ripple" id="installAppBtn">Cara Install</button>
        </div>
      `;
      document.getElementById('installAppBtn').addEventListener('click', () => {
        Utils.modal({
          title: 'Cara Install TabungKu',
          message: 'Buka link ini di browser Chrome (bukan di dalam aplikasi lain seperti TikTok/Instagram), lalu ketuk menu titik tiga di pojok kanan atas dan pilih "Tambahkan ke Layar Utama" atau "Install aplikasi". Untuk iPhone, gunakan Safari lalu ketuk ikon Bagikan dan pilih "Tambah ke Layar Utama".',
          type: 'warn', confirmText: 'Mengerti'
        });
      });
    }
  }

  return { init, applyTheme, resolveTheme };
})();
