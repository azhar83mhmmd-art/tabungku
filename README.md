# TabungKu — Personal Savings Tracker

Aplikasi web pencatat keuangan pribadi (pemasukan, pengeluaran, tabungan, target tabungan).
Dibuat dengan HTML, CSS, dan JavaScript murni (Vanilla JS) — tanpa framework, tanpa backend, tanpa login.
Semua data tersimpan di **Local Storage** browser/WebView.

## Perbaikan Terbaru

- **Bug tampilan tidak responsif diperbaiki**: elemen `fixed` (FAB, tombol AI, bottom nav) sebelumnya bisa bergeser posisi karena tabel Riwayat memaksa lebar minimum yang mendorong body overflow horizontal. Sekarang `overflow-x` dikunci di `html/body/#app`, dan tabel Riwayat memakai grid fleksibel + format angka singkat (rb/jt) alih-alih lebar tetap.
- **Siklus Keuangan Bulanan** — kartu baru di Dashboard: status Surplus/Defisit bulan berjalan, proyeksi pengeluaran akhir bulan, dan saran "budget aman per hari" sisa bulan ini.
- **Auto-kategori pengeluaran** — saat mengetik nama pengeluaran (mis. "nasi goreng"), kategori otomatis terisi cerdas berdasarkan kata kunci (bisa diubah manual kapan saja).

## Fitur Baru

- **Asisten AI Keuangan (lokal, tanpa API key)** — Tombol ungu di kiri bawah. Menganalisis data transaksi kamu secara langsung di perangkat (rule-based NLP, tanpa internet/API) untuk menjawab pertanyaan seperti "berapa saldo saya?", "pengeluaran terbesar?", "tips hemat", "progress target", dan proyeksi kapan target tabungan tercapai.
- **Pengingat Pembayaran** — Kelola tagihan/cicilan (sekali atau bulanan berulang), dapat notifikasi saat mendekati jatuh tempo, dan tandai lunas otomatis tercatat sebagai pengeluaran.
- **Quick Amount Chips** — Tombol nominal cepat (Rp 10rb, 50rb, 100rb, dst.) di form pemasukan & pengeluaran.
- **Responsif penuh** — Layout menyesuaikan dari HP kecil (<340px) hingga tablet & desktop (grid 2 kolom di dashboard), termasuk mode landscape dan orientasi berputar (chart otomatis redraw).

## Menjalankan secara lokal

Karena Service Worker (PWA) butuh HTTP (bukan `file://`), jalankan lewat server statis lokal, contoh:

```bash
cd tabungku
npx serve .
# atau
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080` (atau port dari `serve`).

## Install sebagai PWA

1. Buka website di Chrome/Edge (Android atau desktop).
2. Tunggu tombol **"Install Aplikasi"** muncul di halaman Pengaturan, atau gunakan menu browser "Add to Home Screen".
3. Aplikasi akan terpasang seperti aplikasi Android biasa, bisa dibuka offline setelah pertama kali dimuat.

## Membungkus jadi APK

Website ini kompatibel dengan beberapa metode:

### 1. Capacitor (disarankan)
```bash
npm install @capacitor/core @capacitor/cli
npx cap init TabungKu com.namakamu.tabungku
# salin isi folder tabungku/ ke folder "www" project Capacitor
npx cap add android
npx cap open android
```

### 2. Bubblewrap (Trusted Web Activity)
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://domainkamu.com/manifest.json
bubblewrap build
```

### 3. WebView Android manual / Cordova
Load `index.html` di `WebView` dengan JavaScript & DOM Storage diaktifkan:
```java
webView.getSettings().setJavaScriptEnabled(true);
webView.getSettings().setDomStorageEnabled(true);
```

## Struktur File

```
tabungku/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   ├── style.css
│   ├── responsive.css
│   └── animation.css
├── js/
│   ├── app.js         (orkestrasi & navigasi)
│   ├── storage.js      (Local Storage layer)
│   ├── dashboard.js
│   ├── income.js
│   ├── expense.js
│   ├── saving.js
│   ├── target.js
│   ├── report.js
│   ├── chart.js        (mini chart engine, tanpa library)
│   ├── settings.js
│   └── utils.js         (format, toast, modal, ripple, confetti)
└── assets/icons/         (ikon PWA)
```

## Catatan

- Semua nominal divalidasi (tidak boleh negatif, saldo tidak boleh minus).
- Backup/Restore/Export tersedia di menu Pengaturan & Laporan.
- Tema Dark/Light/System bisa diganti dari Pengaturan atau ikon matahari di header.
