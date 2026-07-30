/* =========================================================
   chart.js — mini charting engine di atas Canvas 2D
   Tanpa library eksternal, ringan untuk WebView/APK.
   ========================================================= */

const MiniChart = (() => {

  function getCssVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function setupCanvas(canvas){
    const parent = canvas.parentElement;
    const cssWidth = Math.max(parent.clientWidth, 120);
    // Tinggi proporsional: lebih landai di layar lebar, tetap terbaca di layar sempit
    const baseHeight = Number(canvas.dataset.baseHeight || canvas.height || 180);
    const ratioHeight = Math.round(Math.min(baseHeight, Math.max(140, cssWidth * 0.42)));
    const cssHeight = ratioHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
    return { ctx, w: cssWidth, h: cssHeight };
  }

  /* Re-render semua chart terdaftar saat ukuran layar berubah (resize/rotate) */
  const registry = [];
  function registerRedraw(fn){ registry.push(fn); }
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => registry.forEach(fn => fn()), 150);
  });

  function emptyState(ctx, w, h, text){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = getCssVar('--text-faint') || '#8CA69A';
    ctx.font = '12px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text || 'Belum ada data', w/2, h/2);
  }

  /* Bar chart: dua series (misal masuk vs keluar) */
  function barChart(canvas, labels, seriesA, seriesB, colorA, colorB){
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0,0,w,h);
    if (!labels.length || (seriesA.every(v=>v===0) && seriesB.every(v=>v===0))){
      emptyState(ctx, w, h, 'Belum ada transaksi');
      return;
    }
    const padding = { top: 14, bottom: 24, left: 8, right: 8 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const maxVal = Math.max(...seriesA, ...seriesB, 1);
    const groupCount = labels.length;
    const groupWidth = chartW / groupCount;
    const barWidth = Math.min(16, groupWidth / 3);

    ctx.font = '10px Poppins, sans-serif';
    ctx.fillStyle = getCssVar('--text-faint') || '#8CA69A';
    ctx.textAlign = 'center';

    labels.forEach((label, i) => {
      const groupX = padding.left + i * groupWidth + groupWidth/2;
      const barAHeight = (seriesA[i] / maxVal) * chartH;
      const barBHeight = (seriesB[i] / maxVal) * chartH;

      ctx.fillStyle = colorA;
      roundRectTop(ctx, groupX - barWidth - 2, padding.top + chartH - barAHeight, barWidth, barAHeight, 4);
      ctx.fill();

      ctx.fillStyle = colorB;
      roundRectTop(ctx, groupX + 2, padding.top + chartH - barBHeight, barWidth, barBHeight, 4);
      ctx.fill();

      ctx.fillStyle = getCssVar('--text-faint') || '#8CA69A';
      ctx.fillText(label, groupX, h - 6);
    });
  }

  function roundRectTop(ctx, x, y, w, h, r){
    if (h < 1) h = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }

  /* Line chart: satu series (misal perkembangan tabungan) */
  function lineChart(canvas, labels, series, color){
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0,0,w,h);
    if (!labels.length || series.every(v => v === 0)){
      emptyState(ctx, w, h, 'Belum ada data tabungan');
      return;
    }
    const padding = { top: 16, bottom: 24, left: 10, right: 10 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const maxVal = Math.max(...series, 1);
    const minVal = Math.min(...series, 0);
    const range = (maxVal - minVal) || 1;
    const stepX = chartW / Math.max(labels.length - 1, 1);

    const points = series.map((v, i) => ({
      x: padding.left + i * stepX,
      y: padding.top + chartH - ((v - minVal) / range) * chartH
    }));

    // Area fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length-1].x, padding.top + chartH);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, color + '55');
    gradient.addColorStop(1, color + '05');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // Labels
    ctx.font = '10px Poppins, sans-serif';
    ctx.fillStyle = getCssVar('--text-faint') || '#8CA69A';
    ctx.textAlign = 'center';
    labels.forEach((label, i) => {
      if (labels.length > 8 && i % 2 !== 0) return;
      ctx.fillText(label, points[i].x, h - 6);
    });
  }

  return { barChart, lineChart, setupCanvas, emptyState, registerRedraw };
})();
