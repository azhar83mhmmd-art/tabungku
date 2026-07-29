/* =========================================================
   streak.js — Streak Tabungan 8 level dengan efek menyala
   ========================================================= */

const StreakModule = (() => {

  const KEY = 'tk_streak';

  const LEVELS = [
    { min: 1,   max: 7,    id: 1, name: 'Pemula',    icon: 'level1_pemula.png',    xp: 0    },
    { min: 8,   max: 30,   id: 2, name: 'Konsisten',  icon: 'level2_konsisten.png', xp: 100  },
    { min: 31,  max: 90,   id: 3, name: 'Ahli',       icon: 'level3_ahli.png',      xp: 300  },
    { min: 91,  max: 180,  id: 4, name: 'Elite Saver',icon: 'level4_elite.png',     xp: 500  },
    { min: 181, max: 365,  id: 5, name: 'Master Saver',icon:'level5_master.png',    xp: 1000 },
    { min: 366, max: 730,  id: 6, name: 'Legend',     icon: 'level6_legend.png',    xp: 0    },
    { min: 731, max: 1095, id: 7, name: 'Mythic',     icon: 'level7_mythic.png',    xp: 0    },
    { min: 1096,max: Infinity, id: 8, name: 'Immortal Saver', icon: 'level8_immortal.png', xp: 0 }
  ];

  function getData(){
    try{
      return JSON.parse(localStorage.getItem(KEY)) || { current: 0, best: 0, lastDate: null, freezes: 3, history: {}, lastLevelId: 1 };
    }catch(e){
      return { current: 0, best: 0, lastDate: null, freezes: 3, history: {}, lastLevelId: 1 };
    }
  }
  function saveData(d){
    try{ localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch(e){ return false; }
  }

  function levelFor(days){
    return LEVELS.find(l => days >= l.min && days <= l.max) || LEVELS[0];
  }

  function daysBetween(a, b){
    const d1 = new Date(a+'T00:00:00');
    const d2 = new Date(b+'T00:00:00');
    return Math.round((d2-d1)/86400000);
  }

  /* Dipanggil setiap kali ada transaksi saving_in tercatat pada tanggal tertentu */
  function recordSaving(dateStr){
    const data = getData();
    const today = dateStr || Utils.todayISO();
    data.history[today] = true;

    if (!data.lastDate){
      data.current = 1;
    } else {
      const gap = daysBetween(data.lastDate, today);
      if (gap === 0){
        // sudah tercatat hari ini, tidak menambah lagi
      } else if (gap === 1){
        data.current += 1;
      } else if (gap > 1){
        const missedDays = gap - 1;
        if (data.freezes >= missedDays){
          data.freezes -= missedDays;
          data.current += 1;
        } else {
          data.current = 1;
        }
      }
    }
    data.lastDate = today;
    data.best = Math.max(data.best, data.current);

    const newLevel = levelFor(data.current);
    const leveledUp = newLevel.id !== data.lastLevelId;
    data.lastLevelId = newLevel.id;

    saveData(data);
    return { data, leveledUp, newLevel };
  }

  /* Cek apakah streak putus karena lewat hari tanpa menabung & tanpa freeze cukup */
  function checkBreak(){
    const data = getData();
    if (!data.lastDate || data.current === 0) return data;
    const today = Utils.todayISO();
    const gap = daysBetween(data.lastDate, today);
    if (gap > 1){
      const missedDays = gap - 1;
      if (data.freezes >= missedDays){
        // freeze otomatis dipakai saat dicek, tapi current tidak nambah sampai menabung lagi
      } else {
        data.current = 0;
        data.lastLevelId = 1;
        saveData(data);
      }
    }
    return data;
  }

  /* Apakah user sudah menabung hari ini? Dipakai untuk menentukan
     apakah api tampil menyala (sesuai warna level) atau padam/abu-abu. */
  function hasSavedToday(data){
    const today = Utils.todayISO();
    return !!data.history[today];
  }

  function render(){
    const data = checkBreak();
    const wrap = document.getElementById('streakWidget');
    if (!wrap) return;

    const level = levelFor(Math.max(data.current, 1));
    const iconPath = `assets/icons/streak/${level.icon}`;
    const savedToday = hasSavedToday(data);
    // Streak "aktif" (berwarna) hanya kalau sudah menabung hari ini.
    // Kalau belum, ditampilkan padam/abu-abu meski current masih tersisa dari kemarin,
    // dan otomatis balik abu-abu lagi setiap tengah malam sampai user menabung lagi.
    const dormant = data.current > 0 && !savedToday;

    const emberHtml = (level.id >= 4 && !dormant) ? `
      <div class="streak-embers">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>` : '';

    const flameClass = `streak-flame-wrap streak-lv-${level.id}${dormant ? ' streak-dormant' : ''}`;
    const subText = savedToday
      ? `${data.current} hari berturut-turut · terus lanjutkan!`
      : (data.current > 0
          ? `${data.current} hari berturut-turut · belum menabung hari ini`
          : `mulai menabung hari ini`);

    wrap.innerHTML = `
      <div class="card streak-card">
        <div class="streak-top">
          <div class="${flameClass}" id="streakFlameWrap">
            <div class="streak-glow"></div>
            <div class="streak-core"></div>
            ${emberHtml}
            <img src="${iconPath}" class="streak-flame-img" alt="Streak level ${level.name}">
            <span class="streak-day-badge">${data.current}</span>
          </div>
          <div class="streak-info">
            <p class="streak-status">${level.name}</p>
            <p class="streak-sub">${subText}</p>
            <div class="streak-meta-row">
              <span><svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M12 21c-4.5-2.3-8-5.7-8-10a8 8 0 1116 0c0 4.3-3.5 7.7-8 10z" stroke="currentColor" stroke-width="1.6"/></svg> Rekor: ${data.best} hari</span>
              <span><svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg> ${data.freezes} Freeze</span>
            </div>
          </div>
          <button type="button" class="streak-list-btn" id="streakListBtn" title="Lihat daftar streak">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        ${renderMiniCalendar(data)}
      </div>
    `;

    const listBtn = document.getElementById('streakListBtn');
    if (listBtn) listBtn.addEventListener('click', () => openStreakList(level.id));
  }

  /* Jadwalkan render ulang tepat saat jam berganti ke 00:00,
     supaya api otomatis berubah abu-abu tanpa perlu buka ulang app. */
  let midnightTimer = null;
  function scheduleMidnightReset(){
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 1, 0); // 00:00:01 keesokan harinya
    const ms = next.getTime() - now.getTime();
    midnightTimer = setTimeout(() => {
      render();
      scheduleMidnightReset(); // jadwalkan lagi untuk hari berikutnya
    }, ms);
  }

  /* ---------- Daftar Streak: modal menampilkan semua 8 level warna api ---------- */
  function openStreakList(currentLevelId){
    let modal = document.getElementById('streakListModal');
    if (modal) modal.remove();

    const rows = LEVELS.map(l => {
      const active = l.id === currentLevelId;
      return `
        <div class="streak-list-row streak-lv-${l.id} ${active ? 'active' : ''}">
          <div class="streak-list-icon-wrap">
            <div class="streak-glow"></div>
            <div class="streak-core"></div>
            ${l.id >= 4 ? '<div class="streak-embers"><span></span><span></span><span></span><span></span><span></span><span></span></div>' : ''}
            <img src="assets/icons/streak/${l.icon}" class="streak-flame-img" alt="${l.name}">
          </div>
          <div class="streak-list-info">
            <p class="streak-list-name">${l.name}</p>
            <p class="streak-list-range">${l.max === Infinity ? `${l.min}+ hari` : `${l.min}–${l.max} hari`}</p>
          </div>
          ${active ? '<span class="streak-list-current">Level Kamu</span>' : ''}
        </div>`;
    }).join('');

    modal = document.createElement('div');
    modal.id = 'streakListModal';
    modal.className = 'streak-list-overlay';
    modal.innerHTML = `
      <div class="streak-list-panel">
        <div class="streak-list-header">
          <h3>Daftar Level Streak</h3>
          <button type="button" class="streak-list-close" id="streakListClose">&times;</button>
        </div>
        <div class="streak-list-body">${rows}</div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('streakListClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  function renderMiniCalendar(data){
    const days = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--){
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0,10);
      days.push({ key, saved: !!data.history[key] });
    }
    const cells = days.map(d => {
      const cls = d.saved ? 'on' : 'off';
      return `<span class="streak-cal-cell ${cls}" title="${d.key}"></span>`;
    }).join('');
    return `<div class="streak-cal-row">${cells}</div>`;
  }

  function triggerLevelUp(newLevel){
    const wrap = document.getElementById('streakFlameWrap');
    if (!wrap) return;
    const flash = document.createElement('div');
    flash.className = 'level-up-flash';
    wrap.appendChild(flash);
    wrap.classList.add('level-up-burst');
    setTimeout(() => { flash.remove(); wrap.classList.remove('level-up-burst'); }, 700);

    Utils.confetti();
    Utils.modal({
      title: `Naik Level: ${newLevel.name}!`,
      message: `Streak menabungmu mencapai level baru. Terus jaga konsistensi ya!`,
      type: 'success',
      confirmText: 'Mantap!'
    });
  }

  function onSavingAdded(dateStr){
    const wrap = document.getElementById('streakFlameWrap');
    const wasDormant = wrap ? wrap.classList.contains('streak-dormant') : false;
    const { leveledUp, newLevel } = recordSaving(dateStr);
    render();
    if (wasDormant){
      const newWrap = document.getElementById('streakFlameWrap');
      if (newWrap){
        newWrap.classList.add('streak-ignite');
        setTimeout(() => newWrap.classList.remove('streak-ignite'), 900);
      }
    }
    if (leveledUp && newLevel.id > 1){
      setTimeout(() => triggerLevelUp(newLevel), 300);
    }
  }

  function getCurrentStreak(){
    return checkBreak().current;
  }

  function init(){
    render();
    scheduleMidnightReset();
  }

  return { render, onSavingAdded, getCurrentStreak, levelFor, getData, init };
})();
