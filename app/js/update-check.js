/* =========================================================
   update-check.js — Cek update aplikasi dari GitHub
   Catatan: aplikasi web/PWA TIDAK BISA memaksa uninstall dirinya
   sendiri dari perangkat pengguna — itu di luar kemampuan apa pun
   yang berjalan di browser/PWA demi alasan keamanan. Yang dilakukan
   di sini: bandingkan versi lokal dengan version.json di repo GitHub,
   lalu tampilkan popup non-blocking berisi info update + tombol
   buka link unduh versi terbaru (situs TabungKu).
   ========================================================= */

const UpdateCheck = (() => {

  const KEY_LAST_SEEN_VERSION = 'tk_app_version_seen';

  // GANTI dua URL di bawah ini sesuai repo & situs TabungKu Anda:
  const VERSION_JSON_URL = 'https://raw.githubusercontent.com/USERNAME/REPO/main/version.json';
  const DEFAULT_DOWNLOAD_URL = 'https://tabungku.example.com/download'; // placeholder — ganti dengan link resmi

  const CURRENT_VERSION = '1.0.0'; // versi build ini, samakan dengan manifest/version.json saat rilis

  async function check(){
    try{
      if (!navigator.onLine) return;
      const res = await fetch(VERSION_JSON_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const info = await res.json(); // { version, downloadUrl, notes }
      if (!info || !info.version) return;

      const lastSeen = localStorage.getItem(KEY_LAST_SEEN_VERSION);
      const isNewer = compareVersions(info.version, CURRENT_VERSION) > 0;
      const alreadyNotified = lastSeen === info.version;

      if (isNewer && !alreadyNotified){
        showUpdatePopup(info);
      }
    }catch(e){
      console.warn('Cek update gagal (aman diabaikan):', e.message);
    }
  }

  function compareVersions(a, b){
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++){
      const na = pa[i] || 0, nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  function showUpdatePopup(info){
    Utils.modal({
      title: 'Update Tersedia',
      message: `Versi baru TabungKu (${info.version}) sudah tersedia.${info.notes ? ' ' + info.notes : ''} Unduh dan pasang ulang aplikasi untuk mendapatkan fitur terbaru. Data kamu (transaksi, streak, riwayat scan) tetap aman dan tidak akan hilang.`,
      type: 'warn',
      confirmText: 'Buka Halaman Unduh',
      cancelText: 'Nanti Saja',
      onConfirm: () => {
        window.open(info.downloadUrl || DEFAULT_DOWNLOAD_URL, '_blank');
        localStorage.setItem(KEY_LAST_SEEN_VERSION, info.version);
      },
      onCancel: () => {
        localStorage.setItem(KEY_LAST_SEEN_VERSION, info.version);
      }
    });
  }

  function init(){
    // Jalankan setelah app selesai load supaya tidak mengganggu render awal
    setTimeout(check, 2500);
  }

  return { init, check, CURRENT_VERSION };
})();
