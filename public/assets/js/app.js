/* ============================================================
   TAZKIAH E-LEARNING — Logika Aplikasi
   ============================================================ */

"use strict";

/* ---------- MODE GELAP / TERANG ---------- */
const THEME_KEY = "tazkiah-theme";
(function () {
  const btn = () => document.getElementById("btn-theme");
  const apply = (dark, persist) => {
    const root = document.documentElement;
    if (dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    const b = btn();
    if (b) {
      b.textContent = dark ? "☀️" : "🌙";
      b.setAttribute("aria-label", dark ? "Mode terang" : "Mode gelap");
      b.title = dark ? "Ganti ke mode terang" : "Ganti ke mode gelap";
    }
    if (persist) {
      try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (e) {}
    }
  };
  const initTheme = () => {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    const dark = saved ? saved === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    apply(dark, false);
    const b = btn();
    if (b) b.addEventListener("click", () => {
      apply(document.documentElement.getAttribute("data-theme") !== "dark", true);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initTheme);
  else initTheme();
})();

/* ---------- STATE & STORAGE ---------- */
const STORE_KEY = "tazkiah-elearning-v1";
const OLD_STORE_KEY = "al-furqan-studio-v1"; // migrasi otomatis data lama saat ganti nama

const defaultStore = {
  points: 0,
  saved: [],
  memorized: [],
  bestQuiz: 0,
  answeredQuiz: 0,
  totalAnswered: 0, // semua soal yang pernah dijawab (dasar tingkat kesulitan)
  totalCorrect: 0,  // jumlah jawaban benar
  quizCount: 0,     // berapa kali kuis diselesaikan
  lastActive: null, // timestamp aktivitas terakhir
  takwin: { done: [] }, // tingkat Latihan Tahsin (Metode Takwin) yang sudah selesai
  login: {
    day: "", streak: 0, best: 0, month: "", days: [], // kalender bulan berjalan
    level: 0,      // tingkat loyalitas: 0=7 hari, 1=14 hari, 2=30 hari, 3=60 hari
    levelDays: 0,  // hari beruntun pada tingkat saat ini
    levelCycles: 0 // berapa kali siklus 7→14→30 selesai
  }
};

function loadStore() {
  try {
    let raw = localStorage.getItem(STORE_KEY);
    if (!raw) raw = localStorage.getItem(OLD_STORE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return { ...defaultStore, ...data };
  } catch (e) {
    return { ...defaultStore };
  }
}

function saveStoreLocal() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {}
}
window.__saveStoreLocal = () => saveStoreLocal();
window.storeReady = (cb) => cb(store);
window.renderAll = () => {
  renderPoints();
  renderHome();
  renderSurahList();
  if (currentSurah) renderVerses();
  renderQuizBest();
  renderLoginMilestone();
  renderLoyaltyPage();
  renderTakwinPicker();
};
window.__afterAuth = () => {};

function saveStore() {
  store.lastActive = Date.now();
  saveStoreLocal();
  if (window.Auth && window.Auth.sync) window.Auth.sync(store);
}

let store = loadStore();

function addPoints(n) {
  store.points += n;
  saveStore();
  renderPoints();
  toast(`+${n} poin! 🌟`, "gold");
}

function renderPoints() {
  document.querySelectorAll("#sidebar-points, #topbar-points").forEach((el) => (el.textContent = store.points));
  const total = SURAHS.length + TAJWID.length + DOAS.length;
  const earned = store.memorized.length + store.answeredQuiz + Math.min(store.points / 10, 10);
  const pct = Math.min(100, Math.round((earned / total) * 100));
  document.getElementById("sidebar-progress-bar").style.width = pct + "%";
  const mot = document.getElementById("sidebar-motivation");
  if (pct === 0) mot.textContent = "Ayo mulai belajar hari ini!";
  else if (pct < 25) mot.textContent = "Bagus! Terus lanjutkan ya! 💪";
  else if (pct < 60) mot.textContent = "Semakin hebat! Jangan berhenti! 🚀";
  else if (pct < 100) mot.textContent = "Luar biasa! Hampir sempurna! 🏆";
  else mot.textContent = "Masya Allah! Kamu juara Qur'an! 👑";
}

/* ---------- NAVIGATION ---------- */
const PAGE_META = {
  beranda: ["Beranda", "Assalamu'alaikum, selamat datang! 🌙"],
  surah: ["Baca Surah", "Pilih surah Juz 'Amma untuk mulai membaca"],
  belajar: ["Belajar Surah", "Baca, pahami, dan hafalkan"],
  tajwid: ["Belajar Tajwid", "Pahami hukum bacaan Al-Qur'an"],
  hijaiyah: ["Hijaiyah", "Kenali huruf-huruf Arab"],
  doa: ["Doa Harian", "Doa pendek untuk kegiatan sehari-hari"],
  kuis: ["Kuis Seru", "Uji pengetahuan Al-Qur'anmu"],
  klasemen: ["Klasemen Kelas", "Lihat peringkatmu dan saling menyemangati! 🏆"],
  loyalitas: ["Login & Loyalitas", "Rajin mampir = poin bonus + tingkat loyalitas 🔥"]
};

function goToPage(page) {
  murStop();
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const target = document.getElementById("page-" + page);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item, #bottom-nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
  });

  document.title = (PAGE_META[page] ? PAGE_META[page][0] : "Cordova E-Learn") + " — Cordova E-Learn";
  if (PAGE_META[page]) {
    document.getElementById("page-title").textContent = PAGE_META[page][0];
    document.getElementById("page-subtitle").textContent = PAGE_META[page][1];
  }

  if (page === "klasemen") renderLeaderboard();

  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("overlay").classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
  document.body.style.overflow = "";
}

/* ---------- HELPERS ---------- */
function toast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.className = "toast " + type), 2600);
}
window.toast = toast;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- TOAST + CONFETTI ---------- */
function confettiBurst() {
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#d4a937", "#10b981", "#059669", "#f0cf6b", "#064e3b", "#e3b94a"];
  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    vy: 2 + Math.random() * 3.5,
    vx: -1.5 + Math.random() * 3,
    rot: Math.random() * Math.PI,
    vr: -0.12 + Math.random() * 0.24,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > canvas.height + 30) p.y = -20;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (++frames < 130) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

/* ============================================================
   LOGIN MILESTONE — rajin mampir = poin bonus + rekor 🔥
   - angka beruntun (streak) dihitung harian & lintas bulan
   - tangga loyalitas: 7 → 14 → 30 → 60 hari beruntun,
     setelah 💎 Platinum tercapai → reset kembali ke 7 (siklus berulang)
   ============================================================ */
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function dayStr(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/* tangga loyalitas: 7 → 14 → 30 → 60 → reset ke 7 (siklus) */
const LOYALTY_TARGETS = [7, 14, 30, 60];
const LOYALTY_REWARDS = [10, 15, 40, 100];
const LOYALTY_META = [
  { name: "Perunggu", emoji: "🥉" },
  { name: "Perak", emoji: "🥈" },
  { name: "Emas", emoji: "🥇" },
  { name: "Platinum", emoji: "💎" }
];

/* dicatat 1x per hari; beri poin login + bonus pencapaian */
function checkDailyLogin() {
  const now = new Date();
  const today = dayStr(now);
  const monthKey = today.slice(0, 7);
  const login = store.login;

  // kompatibilitas data lama: pastikan field loyalitas terisi
  if (typeof login.level !== "number") login.level = 0;
  if (typeof login.levelDays !== "number") login.levelDays = Math.min(login.streak || 0, LOYALTY_TARGETS[login.level] || 7);
  if (typeof login.levelCycles !== "number") login.levelCycles = 0;

  // berganti bulan → mulai hitungan kalender bulan baru (streak 🔥 & tingkat tetap)
  if (login.month !== monthKey) {
    login.month = monthKey;
    login.days = [];
  }

  const awards = [];
  if (!login.days.includes(today)) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    login.streak = login.day === dayStr(y) ? (login.streak || 0) + 1 : 1;
    login.days.push(today);
    login.day = today;
    if (login.streak > login.best) login.best = login.streak;

    awards.push({ n: 3, msg: "+3 poin login hari ini! 🌟" });

    // tangga loyalitas: 7 → 14 → 30 → 60, lalu reset kembali ke 7
    login.levelDays = login.streak === 1 ? 1 : (login.levelDays || 0) + 1;
    while (login.level < LOYALTY_TARGETS.length && login.levelDays >= LOYALTY_TARGETS[login.level]) {
      const meta = LOYALTY_META[login.level];
      const last = login.level === LOYALTY_TARGETS.length - 1;
      const n = LOYALTY_REWARDS[login.level];
      awards.push({
        n,
        level: true,
        big: last,
        msg: last
          ? `+${n} poin — 👑 ${meta.emoji} ${meta.name} (${LOYALTY_TARGETS[login.level]} hari) tercapai! Siklus dimulai ulang ke ${LOYALTY_TARGETS[0]} hari.`
          : `+${n} poin — ${meta.emoji} ${meta.name} tercapai (${LOYALTY_TARGETS[login.level]} hari)! Target naik: ${LOYALTY_TARGETS[login.level + 1]} hari`
      });
      login.levelDays -= LOYALTY_TARGETS[login.level];
      login.level = last ? 0 : login.level + 1;
      if (last) login.levelCycles = (login.levelCycles || 0) + 1;
    }
  }

  if (awards.length) {
    let total = 0;
    awards.forEach((a) => { store.points += a.n; total += a.n; });
    saveStore();
    renderPoints();
    if (awards.some((a) => a.big)) confettiBurst();
    const levelAward = awards.find((a) => a.level);
    if (levelAward) toast(levelAward.msg, "gold");
    else if (awards.length === 1) toast(awards[0].msg, "gold");
    else toast(`+${total} poin! 🔥 ${login.streak} hari beruntun!`, "gold");
  }
  renderLoginMilestone();
  renderLoyaltyPage();
}

/* ============================================================
   LOGIN MILESTONE — ringkasan di Beranda
   (detail lengkap ada di halaman Loyalitas)
   ============================================================ */
function renderLoginMilestone() {
  const card = document.getElementById("login-milestone");
  if (!card) return;
  const login = store.login;
  const levelIdx = Math.min(login.level || 0, LOYALTY_TARGETS.length - 1);
  const meta = LOYALTY_META[levelIdx];
  const target = LOYALTY_TARGETS[levelIdx];
  const levelDays = Math.min(login.levelDays || 0, target);
  const pct = Math.round((levelDays / target) * 100);
  const nextMeta = LOYALTY_META[levelIdx + 1] || LOYALTY_META[0];
  const nextTarget = LOYALTY_TARGETS[levelIdx + 1] || LOYALTY_TARGETS[0];
  const nextReward = LOYALTY_REWARDS[levelIdx + 1] || LOYALTY_REWARDS[0];

  const sub = document.getElementById("login-sub");
  if (sub) sub.textContent = login.best > 0 ? `Rekor terbaik: ${login.best} hari — ayo lampaui!` : "Rekor terbaik: 0 hari — mulai hari ini!";
  const se = document.getElementById("login-streak");
  if (se) se.textContent = login.streak;
  const mt = document.getElementById("login-month-text");
  if (mt) mt.textContent = `${meta.emoji} ${meta.name} · ${levelDays} dari ${target} hari beruntun`;
  const mn = document.getElementById("login-month-next");
  if (mn) {
    mn.textContent = levelIdx === LOYALTY_TARGETS.length - 1
      ? `Selesaikan ${target - levelDays} hari lagi, lalu siklus kembali ke ${nextMeta.emoji} ${nextMeta.name}`
      : `Tingkat berikutnya: ${nextMeta.emoji} ${nextMeta.name} (${nextTarget} hari) — hadiah +${nextReward} poin`;
    mn.classList.remove("done");
  }
  const bar = document.getElementById("login-month-bar");
  if (bar) bar.style.width = pct + "%";
}

/* ============================================================
   HALAMAN LOYALITAS — detail penuh
   ============================================================ */
function fillMiniCalendar(host) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthKey = dayStr(now).slice(0, 7);
  const login = store.login;
  const count = login.month === monthKey ? login.days.length : 0;
  const head = document.createElement("div");
  head.className = "login-mini__head";
  head.innerHTML = `<span>Kalender ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}</span><span class="login-dim">📅 ${count} hari · ⬤ hari ini</span>`;
  host.appendChild(head);
  const grid = document.createElement("div");
  grid.className = "login-mini__grid loy-mini__grid";
  ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].forEach((dn) => {
    const h = document.createElement("div");
    h.className = "login-mini__dow";
    h.textContent = dn;
    grid.appendChild(h);
  });
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement("div");
    e.className = "login-mini__cell empty";
    grid.appendChild(e);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = `${monthKey}-${String(d).padStart(2, "0")}`;
    const logged = login.month === monthKey && login.days.includes(cellDate);
    const cell = document.createElement("div");
    cell.className = "login-mini__cell" + (logged ? " on" : "") + (d === now.getDate() ? " today" : "");
    cell.textContent = d;
    grid.appendChild(cell);
  }
  host.appendChild(grid);
}

function renderLoyaltyPage() {
  const grid = document.getElementById("loy-grid");
  if (!grid) return;
  const login = store.login;
  const levelIdx = Math.min(login.level || 0, LOYALTY_TARGETS.length - 1);
  const meta = LOYALTY_META[levelIdx];
  const target = LOYALTY_TARGETS[levelIdx];
  const levelDays = Math.min(login.levelDays || 0, target);
  const pct = Math.round((levelDays / target) * 100);
  const left = Math.max(0, target - levelDays);
  const isLast = levelIdx === LOYALTY_TARGETS.length - 1;

  // ringkasan: streak, rekor, siklus, progres
  const summary = document.createElement("section");
  summary.className = "card loy-summary";
  summary.innerHTML = `
    <div class="loy-chips">
      <span class="loy-chip">🔥 <strong>${login.streak}</strong>&nbsp;hari beruntun</span>
      <span class="loy-chip">🏅 Rekor terbaik: <strong>${login.best}</strong></span>
      <span class="loy-chip">♻️ Siklus selesai: <strong>${login.levelCycles || 0}</strong></span>
    </div>
    <div class="loy-progress">
      <div class="loy-progress__head">
        <span>${meta.emoji} ${meta.name} — target ${target} hari beruntun</span>
        <strong>${levelDays}/${target}</strong>
      </div>
      <div class="loy-progress__bar"><span style="width:${pct}%"></span></div>
      <p>${left > 0
        ? isLast
          ? `Selesaikan ${left} hari lagi untuk ${meta.emoji} ${meta.name}, lalu siklus dimulai ulang dari ${LOYALTY_META[0].emoji} ${LOYALTY_META[0].name} (${LOYALTY_TARGETS[0]} hari).`
          : `Butuh ${left} hari lagi (${pct}%) untuk naik ke ${LOYALTY_META[levelIdx + 1].emoji} ${LOYALTY_META[levelIdx + 1].name} — hadiah +${LOYALTY_REWARDS[levelIdx + 1]} poin.`
        : "Target tingkat ini sudah tercapai! 🎉"}
      </p>
    </div>`;
  grid.innerHTML = "";
  grid.appendChild(summary);

  // kartu tingkat loyalitas
  const lvWrap = document.createElement("div");
  lvWrap.className = "loy-levels";
  LOYALTY_TARGETS.forEach((t, i) => {
    const m = LOYALTY_META[i];
    const done = i < levelIdx;
    const current = i === levelIdx;
    const status = done
      ? "✔ Selesai"
      : current
        ? (levelDays >= t ? "🎉 Tercapai!" : `🔁 Berjalan ${levelDays}/${t}`)
        : "🔒 Terkunci";
    const statusCls = done ? "ok" : current ? "now" : "locked";
    const lv = document.createElement("article");
    lv.className = "card loy-level" + (done ? " done" : "") + (current ? " current" : "") + (done || current ? "" : " locked");
    lv.innerHTML = `
      <div class="loy-level__head">
        <span class="loy-level__ico">${m.emoji}</span>
        <div class="loy-level__name"><h4>${m.name}</h4><p>${t} hari beruntun</p></div>
      </div>
      <div class="loy-level__bar"><span style="width:${done ? 100 : current ? pct : 0}%"></span></div>
      <div class="loy-level__foot">
        <span class="loy-level__status ${statusCls}">${status}</span>
        <span class="loy-level__reward">Hadiah <strong>+${LOYALTY_REWARDS[i]}</strong></span>
      </div>`;
    lvWrap.appendChild(lv);
  });
  grid.appendChild(lvWrap);

  // kalender bulan berjalan (lebih besar di halaman ini)
  const cal = document.createElement("section");
  cal.className = "card loy-calendar";
  fillMiniCalendar(cal);
  grid.appendChild(cal);
}

/* ============================================================
   BERANDA
   ============================================================ */
const POPULAR_IDS = [78, 80, 87, 88, 93, 94, 96, 97, 98, 99, 103, 108, 112, 113, 114];

function renderHome() {
  const ayatCount = SURAHS.reduce((n, s) => n + s.ayahs.length, 0);
  document.getElementById("stat-surah").textContent = SURAHS.length;
  document.getElementById("stat-ayat").textContent = ayatCount;

  const chipWrap = document.getElementById("home-surah-chips");
  chipWrap.innerHTML = "";
  const popular = POPULAR_IDS.map((id) => SURAHS.find((s) => s.id === id)).filter(Boolean).slice(0, 14);
  popular.forEach((s) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = s.name;
    b.addEventListener("click", () => openSurah(s.id));
    chipWrap.appendChild(b);
  });
}

/* ============================================================
   SURAH LIST
   ============================================================ */
let surahFilter = "semua";
let surahSearch = "";

function renderSurahList() {
  const grid = document.getElementById("surah-grid");
  grid.innerHTML = "";

  let list = SURAHS.filter((s) => {
    const q = surahSearch.toLowerCase().trim();
    const matchQ = !q || s.name.toLowerCase().includes(q) || s.arabicName.includes(q) || s.meaning.toLowerCase().includes(q);
    let matchF = true;
    if (surahFilter === "favorit") matchF = store.saved.includes(s.id);
    if (surahFilter === "sering") matchF = store.memorized.includes(s.id);
    return matchQ && matchF;
  });

  if (!list.length) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-soft)">
      Tidak ada surah yang cocok 🙁<br/><small>coba kata kunci lain atau ubah filter.</small></div>`;
    return;
  }

  list.forEach((s) => {
    const card = document.createElement("article");
    card.className = "card surah-card";
    const isFav = store.saved.includes(s.id);
    const isMem = store.memorized.includes(s.id);
    card.innerHTML = `
      <button class="fav-btn ${isFav ? "on" : ""}" data-id="${s.id}" title="Simpan surah">${isFav ? "⭐" : "☆"}</button>
      <div class="surah-num">${s.id}</div>
      <div class="surah-info">
        <span class="ar-name">${s.arabicName}</span>
        <h4>${s.name}</h4>
        <p>${s.meaning} • ${s.verses} ayat</p>
        <div class="surah-badges">
          <span class="badge">${s.revelation}</span>
          ${isMem ? '<span class="badge gold">🎯 Sudah hafal</span>' : '<span class="badge gold">Baca dulu ✨</span>'}
        </div>
      </div>`;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-btn")) return;
      openSurah(s.id);
    });
    grid.appendChild(card);
  });

  grid.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const idx = store.saved.indexOf(id);
      if (idx >= 0) {
        store.saved.splice(idx, 1);
        toast("Dihapus dari simpanan", "error");
      } else {
        store.saved.push(id);
        toast("Disimpan ke favorit ⭐", "gold");
      }
      saveStore();
      renderSurahList();
    });
  });
}

/* ============================================================
   SURAH DETAIL
   ============================================================ */
let currentSurah = null;
let currentVerse = 0;

/* ============================================================
   MUROTTAL PER-AYAT (butuh internet)
   CDN islamic.network memutar per AYAT dengan NOMOR AYAT GLOBAL
   (1..6236), bukan nomor per-surah.
   ============================================================ */
const RECITER_CDN = "https://cdn.islamic.network/quran/audio/128/ar.alafasy";
// Pengecualian untuk file yang CACAT di CDN utama.
// Kunci = NOMOR AYAT GLOBAL (1..6236), nilai = URL audio lengkap pengganti.
// 5712 = An-Naba' (78) ayat 40: file di CDN utama terpotong ~7 detik di akhir;
//       file everyayah Alafasy_128kbps/078040.mp3 TERVERIFIKASI cocok dengan
//       rekaman resmi Alafasy (korelasi selubung 0.96 thd mp3quran surah utuh).
const RECITER_OVERRIDE = {
  5712: "https://everyayah.com/data/Alafasy_128kbps/078040.mp3",
};
// jumlah ayat 114 surah (urutan mushaf) — untuk menghitung nomor ayat global
const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

let murAudio = null;   // satu pemutar bersama untuk semua ayat
let murIndex = -1;     // indeks ayat yang sedang diputar (0-based)
let murPlaying = false;

function ayahGlobal(surahId, idx) {
  // nomor ayat global (0-based): offset seluruh surah sebelumnya + indeks ayat dalam surah
  const offset = AYAH_COUNTS.slice(0, surahId - 1).reduce((a, b) => a + b, 0);
  return offset + idx;
}

function murStop() {
  if (murAudio) { murAudio.pause(); murAudio.currentTime = 0; }
  murPlaying = false;
  murRefreshUI();
}

function murRefreshUI() {
  const play = document.getElementById("mur-play");
  if (play) play.textContent = murPlaying ? "⏸" : "▶";
  document.querySelectorAll(".verse-item[data-idx]").forEach((it) => {
    it.classList.toggle("playing", murPlaying && Number(it.dataset.idx) === murIndex);
  });
}

function murPlayIndex(idx) {
  if (!currentSurah || idx < 0 || idx >= currentSurah.verses) return;
  murIndex = idx;
  if (!murAudio) {
    murAudio = new Audio();
    murAudio.addEventListener("ended", () => {
      const auto = document.getElementById("mur-auto");
      if (auto && auto.checked && currentSurah && murIndex < currentSurah.verses - 1) {
        murPlayIndex(murIndex + 1);
      } else {
        murPlaying = false;
        murRefreshUI();
      }
    });
    murAudio.addEventListener("error", () => {
      murPlaying = false;
      murRefreshUI();
      toast("Murottal butuh koneksi internet 📶", "error");
    });
  }
  const gAyat = ayahGlobal(currentSurah.id, idx) + 1;
  // pakai file pengganti bila CDN utama punya file cacat (lihat RECITER_OVERRIDE)
  murAudio.src = RECITER_OVERRIDE[gAyat] || `${RECITER_CDN}/${gAyat}.mp3`;
  murAudio.play()
    .then(() => {
      murPlaying = true;
      const st = document.getElementById("mur-status");
      if (st) st.textContent = `Ayat ${idx + 1} / ${currentSurah.verses}`;
      murRefreshUI();
    })
    .catch(() => {
      murPlaying = false;
      murRefreshUI();
      toast("Murottal butuh koneksi internet 📶", "error");
    });
}

function openSurah(id) {
  const surah = SURAHS.find((s) => s.id === id);
  if (!surah) return;
  currentSurah = surah;
  currentVerse = 0;

  // head
  document.getElementById("learn-head").innerHTML = `
    <div class="surah-num">${surah.id}</div>
    <div style="flex:1;min-width:0">
      <p style="font-size:12px;letter-spacing:1.5px;color:var(--gold-300);font-weight:800">SURAH ${surah.revelation.toUpperCase()} • ${surah.verses} AYAT</p>
      <h3>${surah.name} <span style="font-weight:400;opacity:.7">— ${surah.meaning}</span></h3>
      <p>Tekan ▶ pada ayat untuk mendengar murottalnya, atau pakai player di bawah.</p>
    </div>
    <div class="ar-head">${surah.arabicName}</div>`;

  // player murottal per-ayat
  murStop();
  murIndex = -1;
  document.getElementById("player-bar").innerHTML = `
    <span>🎧 Murottal per-ayat (butuh internet)</span>
    <div class="mur-controls">
      <button class="mur-btn" id="mur-prev" title="Ayat sebelumnya">⏮</button>
      <button class="mur-btn mur-play" id="mur-play" title="Putar / jeda ayat">▶</button>
      <button class="mur-btn" id="mur-next" title="Ayat berikutnya">⏭</button>
      <label class="mur-auto" title="Lanjut otomatis ke ayat berikutnya">Lanjut ⏭ <input type="checkbox" id="mur-auto" checked></label>
      <span class="mur-status" id="mur-status">Ayat 1 / ${surah.verses}</span>
    </div>`;
  document.getElementById("mur-prev").addEventListener("click", () => {
    if (murIndex <= 0) { toast("Ini sudah ayat pertama 🎧", "gold"); return; }
    murPlayIndex(murIndex - 1);
  });
  document.getElementById("mur-next").addEventListener("click", () => {
    if (murIndex >= currentSurah.verses - 1) { toast("Ini sudah ayat terakhir 🎧", "gold"); return; }
    murPlayIndex(murIndex + 1);
  });
  document.getElementById("mur-play").addEventListener("click", () => {
    if (murPlaying) { murStop(); return; }
    murPlayIndex(murIndex >= 0 ? murIndex : 0);
  });

  document.getElementById("toggle-arti").checked = true;
  renderVerses();
  goToPage("belajar");
}

function renderVerses() {
  if (!currentSurah) return;
  const list = document.getElementById("verse-list");
  const hide = !document.getElementById("toggle-arti").checked;
  list.innerHTML = "";
  const isMem = store.memorized.includes(currentSurah.id);

  if (currentSurah.id !== 1) {
    const bm = document.createElement("div");
    bm.className = "verse-item card basmalah-item";
    bm.innerHTML = `<div class="v-ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
    list.appendChild(bm);
  }

  currentSurah.ayahs.forEach((v, i) => {
    const item = document.createElement("article");
    item.className = "card verse-item" + (hide ? " lat-hide" : "");
    item.dataset.idx = String(i);
    item.innerHTML = `
      <span class="v-num">${i + 1}</span>
      <div class="v-ar">${v.a}</div>
      <p class="v-lat">${v.t}</p>
      <p class="v-id">${v.i}</p>`;
    const pb = document.createElement("button");
    pb.className = "v-play";
    pb.type = "button";
    pb.title = "Putar murottal ayat ini";
    pb.textContent = "▶";
    pb.addEventListener("click", (e) => {
      e.stopPropagation();
      if (murPlaying && murIndex === i) { murStop(); return; }
      murPlayIndex(i);
    });
    item.appendChild(pb);
    item.addEventListener("click", () => {
      if (murPlaying && murIndex === i) { murStop(); return; }
      murPlayIndex(i);
    });
    list.appendChild(item);
  });

  document.getElementById("btn-mark-hafal").textContent = isMem ? "✅ Sudah Ditandai Hafal" : "🎯 Tandai Hafal";
  murRefreshUI();
}

function toggleMarkHafal() {
  if (!currentSurah) return;
  const idx = store.memorized.indexOf(currentSurah.id);
  if (idx >= 0) {
    store.memorized.splice(idx, 1);
    toast(`"${currentSurah.name}" belum dihafal. Semangat terus! 🤍`);
  } else {
    store.memorized.push(currentSurah.id);
    addPoints(5);
    toast(`Masya Allah! "${currentSurah.name}" ditandai hafal! 🎉`);
    confettiBurst();
  }
  saveStore();
  renderVerses();
  renderSurahList();
  renderPoints();
}

/* ============================================================
   TAJWID
   ============================================================ */
function renderTajwid() {
  const grid = document.getElementById("rules-grid");
  grid.innerHTML = "";
  TAJWID.forEach((r) => {
    const card = document.createElement("article");
    card.className = "card rule-card";
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    const ex = r.examples[0];
    card.innerHTML = `
      <div class="rule-head">
        <span class="rule-ico">${r.icon}</span>
        <div>
          <h4>${r.name}</h4>
          <span class="sub">${r.cat}</span>
        </div>
      </div>
      <p class="rule-desc">${r.desc}</p>
      <div class="rule-example">
        <span class="ex-ar">${ex.ar}</span>
        <span><strong>Contoh:</strong> ${ex.latin}</span>
      </div>
      <span class="rule-more">👆 Tekan — lihat 5 contoh lengkap</span>`;
    const open = () => openTajwid(r);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    grid.appendChild(card);
  });
}

/* ------------------------------------------------------------
   POP-UP CONTOH TAJWID — 5 contoh per hukum
   ------------------------------------------------------------ */
function openTajwid(r) {
  document.getElementById("tjm-ico").textContent = r.icon;
  document.getElementById("tjm-name").textContent = r.name;
  document.getElementById("tjm-cat").textContent = r.cat;
  document.getElementById("tjm-desc").textContent = r.desc;
  const wrap = document.getElementById("tjm-examples");
  wrap.innerHTML = "";
  r.examples.forEach((ex, i) => {
    const row = document.createElement("div");
    row.className = "tjm-ex";
    row.innerHTML = `
      <span class="tjm-n">${i + 1}</span>
      <div class="tjm-txt">
        <span class="tjm-ar">${ex.ar}</span>
        <span class="tjm-lat">${ex.latin}</span>
      </div>`;
    wrap.appendChild(row);
  });
  document.getElementById("tajwid-overlay").classList.add("show");
}

function closeTajwid() {
  document.getElementById("tajwid-overlay").classList.remove("show");
}

/* ============================================================
   HIJAIYAH
   ============================================================ */
function renderHijaiyah() {
  const grid = document.getElementById("hijaiyah-grid");
  grid.innerHTML = "";
  HIJAIYAH.forEach((h) => {
    const card = document.createElement("button");
    card.className = "hijaiyah-card card";
    card.innerHTML = `
      <div class="h-ar">${h.ar}</div>
      <div class="h-name">${h.name}</div>
      <div class="h-example">${h.ex}</div>`;
    card.addEventListener("click", () => {
      card.classList.remove("flash");
      void card.offsetWidth;
      card.classList.add("flash");
    });
    grid.appendChild(card);
  });
}

/* ============================================================
   LATIHAN TAHSIN METODE TAKWIN
   ============================================================ */
const TAKWIN_POIN = 15;         // poin tiap tingkat yang diselesaikan
const TAKWIN_BONUS = 30;        // bonus menuntaskan seluruh 8 tingkat
let takwinStageId = null;

function takwinDone() {
  return Array.isArray(store.takwin && store.takwin.done) ? store.takwin.done : [];
}

/* tingkat pertama yang belum selesai (kunci tingkatan di depannya) */
function takwinCur() {
  const done = takwinDone();
  for (const lv of TAKWIN) if (!done.includes(lv.id)) return lv.id;
  return TAKWIN[TAKWIN.length - 1].id;
}

function takwinSave() {
  store.takwin = { done: takwinDone() };
  saveStore();
}

function renderTakwinPicker() {
  const wrap = document.getElementById("takwin-levels");
  if (!wrap) return;
  const done = takwinDone();
  const cur = takwinCur();
  wrap.innerHTML = "";
  TAKWIN.forEach((lv) => {
    const isDone = done.includes(lv.id);
    const unlocked = lv.id <= cur;
    const el = document.createElement("button");
    el.className = "takwin-level card" + (isDone ? " done" : "") + (unlocked ? "" : " locked");
    el.type = "button";
    el.innerHTML = `
      <div class="tl-top">
        <span class="tl-ico">${lv.icon}</span>
        <h5>Tingkat ${lv.id} — ${lv.title}</h5>
      </div>
      <p class="tl-desc">${lv.desc}</p>
      <div class="tl-status">
        <span>${unlocked ? (isDone ? "✅ Selesai" : "▶️ Lanjutkan") : "🔒 Terkunci"}</span>
        <span>${lv.items.length} item</span>
      </div>`;
    if (unlocked) el.addEventListener("click", () => openTakwinStage(lv.id));
    wrap.appendChild(el);
  });
  const pct = Math.min(100, Math.round((done.length / TAKWIN.length) * 100));
  const lbl = document.getElementById("takwin-progress-txt");
  if (lbl)
    lbl.textContent =
      done.length >= TAKWIN.length
        ? "Semua tingkat selesai! 🏆"
        : done.length + "/" + TAKWIN.length + " tingkat selesai";
}

function openTakwinView() {
  const hero = document.getElementById("takwin-hero");
  const view = document.getElementById("takwin-view");
  if (hero) hero.hidden = true;
  if (view) view.hidden = false;
  const grid = document.getElementById("hijaiyah-grid");
  if (grid) grid.hidden = true;
  showTakwinPicker();
  renderTakwinPicker();
  // langsung tampilkan panggung tingkat aktif agar murid langsung latihan
  const cur = takwinCur();
  const done = takwinDone();
  if (done.includes(cur)) showTakwinPicker();
  else openTakwinStage(cur);
}

function showTakwinPicker() {
  const lv = document.getElementById("takwin-levels");
  const st = document.getElementById("takwin-stage");
  if (lv) lv.hidden = false;
  if (st) st.hidden = true;
  takwinStageId = null;
}

function openTakwinStage(levelId) {
  const lv = TAKWIN.find((x) => x.id === levelId);
  if (!lv) return;
  takwinStageId = levelId;
  const levels = document.getElementById("takwin-levels");
  const stage = document.getElementById("takwin-stage");
  if (levels) levels.hidden = true;
  if (stage) stage.hidden = false;

  const tag = document.getElementById("takwin-tag");
  if (tag) tag.textContent = "Tingkat " + lv.id + "/" + TAKWIN.length;
  const title = document.getElementById("takwin-stage-title");
  if (title) title.textContent = lv.icon + " " + lv.title;
  const desc = document.getElementById("takwin-desc");
  if (desc) desc.textContent = lv.desc;
  const tip = document.getElementById("takwin-tip");
  if (tip) tip.textContent = "💡 " + lv.tip;

  const grid = document.getElementById("takwin-items");
  grid.innerHTML = "";
  lv.items.forEach((raw) => {
    const it = Array.isArray(raw) ? { ar: raw[0], lat: raw[1], note: raw[2] || "" } : raw;
    const cell = document.createElement("div");
    cell.className = "takwin-item";
    cell.innerHTML = `
      <div class="ti-ar">${it.ar}</div>
      <div class="ti-lat">${it.lat}</div>
      ${it.note ? '<div class="ti-note">' + it.note + "</div>" : ""}`;
    grid.appendChild(cell);
  });

  const done = takwinDone();
  const prev = document.getElementById("btn-takwin-prev");
  const next = document.getElementById("btn-takwin-next");
  const btnDone = document.getElementById("btn-takwin-done");
  if (prev) prev.disabled = levelId <= 1;
  if (next) next.disabled = levelId >= TAKWIN[TAKWIN.length - 1].id || !done.includes(levelId);
  if (btnDone) {
    btnDone.textContent = done.includes(levelId) ? "✅ Sudah selesai — Lanjut" : "🎯 Selesai & Lanjut";
    btnDone.dataset.level = levelId;
  }
}

function completeTakwin(levelId) {
  const done = takwinDone();
  const isNew = !done.includes(levelId);
  if (isNew) {
    done.push(levelId);
    store.takwin = { done };
    saveStore();
    addPoints(TAKWIN_POIN);
    toast("🏆 Tingkat " + levelId + " selesai! +" + TAKWIN_POIN + " poin", "gold");
    if (done.length >= TAKWIN.length) {
      addPoints(TAKWIN_BONUS);
      toast("🎉 Masya Allah! Kamu menuntaskan Latihan Tahsin Metode Takwin! +" + TAKWIN_BONUS + " poin", "gold");
    }
  } else {
    toast("Tingkat ini sudah diselesaikan. Lanjut terus! 👏", "gold");
  }
  renderTakwinPicker();
  openTakwinStage(takwinCur());
}

function initTakwin() {
  const start = document.getElementById("btn-takwin-start");
  const back = document.getElementById("btn-takwin-back");
  const done = document.getElementById("btn-takwin-done");
  const prev = document.getElementById("btn-takwin-prev");
  const next = document.getElementById("btn-takwin-next");
  const pickerItems = document.getElementById("takwin-levels");
  if (start) start.addEventListener("click", openTakwinView);
  if (back)
    back.addEventListener("click", () => {
      if (takwinStageId) {
        showTakwinPicker();
        renderTakwinPicker();
      } else {
        const view = document.getElementById("takwin-view");
        const hero = document.getElementById("takwin-hero");
        const grid = document.getElementById("hijaiyah-grid");
        if (view) view.hidden = true;
        if (hero) hero.hidden = false;
        if (grid) grid.hidden = false;
      }
    });
  if (done)
    done.addEventListener("click", () => {
      const id = Number(done.dataset.level || takwinCur());
      completeTakwin(id);
    });
  if (prev)
    prev.addEventListener("click", () => {
      const id = takwinStageId || takwinCur();
      if (id > 1) openTakwinStage(id - 1);
    });
  if (next)
    next.addEventListener("click", () => {
      const id = takwinStageId || takwinCur();
      if (id < TAKWIN[TAKWIN.length - 1].id) openTakwinStage(id + 1);
    });
  renderTakwinPicker();
}

/* ============================================================
   DOA
   ============================================================ */
function renderDoa() {
  const grid = document.getElementById("doa-grid");
  grid.innerHTML = "";
  DOAS.forEach((d) => {
    const card = document.createElement("article");
    card.className = "card doa-card";
    card.innerHTML = `
      <div class="doa-title">
        <h4>${d.name}</h4>
        <span class="doa-ico">${d.icon}</span>
      </div>
      <div class="doa-ar">${d.ar}</div>
      <p class="doa-lat">${d.lat}</p>
      <p class="doa-id"><strong>Arti:</strong>${d.id}</p>`;
    grid.appendChild(card);
  });
}

/* ============================================================
   KUIS
   ============================================================ */
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = []; // per-question: chosen index or null
let quizLocked = false;
let recentQuestionIds = []; // soal kuis terakhir, dihindari agar tidak cepat berulang

/* Tingkat kesulitan naik perlahan sesuai jumlah soal yang pernah dijawab */
const QUIZ_COUNT = 10;
const STAGE_INFO = [
  { label: "Pemula", min: 0, fill: 20, desc: "Soal mudah dulu untuk membangun dasar. Semakin sering latihan, soal akan semakin menantang.", mix: [[1, 10]] },
  { label: "Lancar", min: 20, fill: 60, desc: "Setelah 20 soal: 70% soal sedang + 30% soal mudah.", mix: [[1, 3], [2, 7]] },
  { label: "Mahir", min: 60, fill: 120, desc: "Setelah 60 soal: soal didominasi level sedang–sulit.", mix: [[2, 4], [3, 6]] },
  { label: "Juara", min: 120, fill: 200, desc: "Setelah 120 soal: mayoritas soal sulit. Hebat! 👑", mix: [[2, 2], [3, 8]] }
];
function getStage() {
  const n = store.totalAnswered || 0;
  if (n < 20) return STAGE_INFO[0];
  if (n < 60) return STAGE_INFO[1];
  if (n < 120) return STAGE_INFO[2];
  return STAGE_INFO[3];
}
function drawQuizQuestions() {
  const stage = getStage();
  const buckets = { 1: [], 2: [], 3: [] };
  QUIZ_BANK.forEach((q) => buckets[q.d || 2].push(q));
  const recent = new Set(recentQuestionIds);
  const pick = (level, n) => {
    const avail = buckets[level].filter((q) => !recent.has(q.id));
    const src = avail.length >= n ? avail : buckets[level];
    return shuffle(src).slice(0, n);
  };
  const parts = (stage.mix || []).map(([lvl, n]) => pick(lvl, n));
  const qs = shuffle(parts.flat()).slice(0, QUIZ_COUNT);
  recentQuestionIds = qs.map((q) => q.id);
  return qs;
}
function renderQuizStage() {
  const st = getStage();
  const n = store.totalAnswered || 0;
  const el = document.getElementById("quiz-stage-box");
  if (!el) return;
  document.getElementById("quiz-stage-name").textContent = st.label;
  document.getElementById("quiz-stage-desc").textContent = st.desc;
  const pct = Math.max(0, Math.min(100, ((n - st.min) / (st.fill - st.min)) * 100));
  document.getElementById("quiz-stage-bar").style.width = pct + "%";
}

function startQuiz() {
  quizQuestions = drawQuizQuestions();
  quizIndex = 0;
  quizScore = 0;
  quizAnswered = quizQuestions.map(() => null);
  document.getElementById("quiz-intro").classList.add("hidden");
  document.getElementById("quiz-result").classList.add("hidden");
  document.getElementById("quiz-box").classList.remove("hidden");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quizQuestions[quizIndex];
  document.getElementById("quiz-progress").textContent = `Soal ${quizIndex + 1}/${quizQuestions.length}`;
  document.getElementById("quiz-score").textContent = `⭐ ${quizScore}`;
  document.getElementById("quiz-track-bar").style.width = ((quizIndex + 1) / quizQuestions.length) * 100 + "%";
  document.getElementById("quiz-question").innerHTML = `<span class="q-ar">${q.ar ?? ""}</span>${q.q}`;

  const optsWrap = document.getElementById("quiz-options");
  optsWrap.innerHTML = "";
  const keys = ["A", "B", "C", "D"];

  const answered = quizAnswered[quizIndex];
  const shown = q.options.map((o, i) => {
    let cls = "quiz-option";
    if (answered !== null) {
      cls += " disabled";
      if (i === q.answer) cls += " correct";
      else if (i === answered) cls += " wrong";
    }
    return { cls, o, i };
  });

  shown.forEach(({ cls, o, i }) => {
    const btn = document.createElement("button");
    btn.className = cls;
    btn.innerHTML = `<span class="opt-key">${keys[i]}</span><span>${o}</span>`;
    btn.addEventListener("click", () => {
      if (quizLocked || answered !== null) return;
      selectAnswer(i);
    });
    optsWrap.appendChild(btn);
  });

  // explanation
  const ex = document.getElementById("quiz-explain");
  if (answered !== null) {
    ex.innerHTML = `<strong>💡 Pembahasan:</strong> ${q.explain}`;
    ex.classList.remove("hidden");
  } else {
    ex.classList.add("hidden");
  }

  // nav buttons
  document.getElementById("btn-quiz-prev").classList.toggle("hidden", quizIndex === 0);
  const isLast = quizIndex === quizQuestions.length - 1;
  document.getElementById("btn-quiz-next").classList.toggle("hidden", isLast || answered === null);
  document.getElementById("btn-quiz-finish").classList.toggle("hidden", !isLast || answered === null);
}

function selectAnswer(i) {
  const q = quizQuestions[quizIndex];
  quizAnswered[quizIndex] = i;
  quizLocked = true;
  store.totalAnswered = (store.totalAnswered || 0) + 1;
  if (i === q.answer) {
    quizScore += 10;
    store.answeredQuiz += 1;
    store.totalCorrect = (store.totalCorrect || 0) + 1;
    toast("Benar! 🎉", "gold");
  } else {
    toast("Belum tepat, yuk baca pembahasannya 💡");
  }
  saveStore();
  renderPoints();
  renderQuizQuestion();
  quizLocked = false;
}

function nextQuestion() {
  if (quizIndex < quizQuestions.length - 1) {
    quizIndex += 1;
    renderQuizQuestion();
  }
}
function prevQuestion() {
  if (quizIndex > 0) {
    quizIndex -= 1;
    renderQuizQuestion();
  }
}

function finishQuiz() {
  const correct = quizAnswered.filter((a, i) => a === quizQuestions[i].answer).length;
  const pct = (correct / quizQuestions.length) * 100;
  const isBest = quizScore > store.bestQuiz;
  store.bestQuiz = Math.max(store.bestQuiz, quizScore);
  store.quizCount = (store.quizCount || 0) + 1;
  saveStore();
  renderPoints();

  document.getElementById("quiz-box").classList.add("hidden");
  const res = document.getElementById("quiz-result");
  res.classList.remove("hidden");

  let art = "🏅", title = "Bagus!", mot;
  if (pct >= 90) { art = "🏆"; title = "Masya Allah, Luar Biasa!"; mot = "Kamu calon hafiz/hafizah! Pertahankan ya!";
    confettiBurst(); addPoints(quizScore); }
  else if (pct >= 70) { art = "🌟"; title = "Hebat sekali!"; mot = "Sedikit lagi sempurna. Ayo pelajari pembahasannya lagi!"; addPoints(quizScore); }
  else if (pct >= 50) { art = "💪"; title = "Lumayan bagus!"; mot = "Belajar surah & tajwid lagi, pasti naik terus!"; addPoints(quizScore); }
  else { art = "🌱"; title = "Jangan Menyerah!"; mot = "Belajar lagi di menu Surah & Tajwid ya, kamu pasti bisa!"; }

  document.getElementById("result-art").textContent = art;
  document.getElementById("result-title").textContent = title;
  document.getElementById("result-score-num").textContent = quizScore;
  document.getElementById("result-answer-count").textContent = `${correct} benar dari ${quizQuestions.length} soal${isBest ? " — skor terbaikmu! 🥇" : ""}`;
  document.getElementById("result-motivation").textContent = mot;
}

function renderQuizBest() {
  const el = document.getElementById("quiz-best");
  el.innerHTML = store.bestQuiz > 0 ? `🏅 Skor terbaikmu: <strong>${store.bestQuiz}</strong> poin` : "Belum ada skor terbaik. Ambil tantangan pertamamu! 🚀";
  renderQuizStage();
}

/* ============ KLASEMEN ============ */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function renderLeaderboard() {
  const note = document.getElementById("leader-note");
  const podium = document.getElementById("leader-podium");
  const list = document.getElementById("leader-list");
  const count = document.getElementById("leader-count");
  if (!window.Auth || !window.Auth.isOnline()) {
    note.innerHTML =
      "ℹ️ Klasemen butuh server — buka lewat <code>http://IP-laptop:8710</code>, bukan mode lokal.";
    podium.innerHTML = "";
    list.innerHTML = "";
    count.textContent = "";
    return;
  }
  note.textContent = "Memuat klasemen…";
  try {
    const rows = await window.Auth.fetchLeaderboard();
    const me = window.Auth.getUsername();
    const myIndex = rows.findIndex((r) => r.username === me);
    const countShow = document.createElement("span");

    if (!rows.length) {
      note.textContent = "Belum ada siswa terdaftar. Daftar akun, lalu mulai belajar! 🌱";
      podium.innerHTML = "";
      list.innerHTML = `<p class="leader-empty">Klasemen masih kosong. Jadilah siswa pertama yang masuk daftar! 🚀</p>`;
      count.textContent = "";
      return;
    }

    note.textContent =
      myIndex >= 0
        ? `Posisimu sekarang: #${myIndex + 1} dari ${rows.length} siswa`
        : window.Auth.isGuest()
        ? "Masuk akun dulu agar bisa masuk klasemen ya! 😊"
        : "Ayo kumpulkan poin supaya masuk klasemen! 💪";
    count.textContent = `${rows.length} siswa`;

    // podium 3 besar
    podium.innerHTML = rows
      .slice(0, 3)
      .map((r, i) => {
        const isMe = r.username === me;
        return `<div class="podium-item${i === 0 ? " gold" : ""}">
          <span class="pp-medal">${["🥇", "🥈", "🥉"][i]}</span>
          <strong class="pp-name">${esc(r.nama)}${isMe ? ' <em class="pp-you">(kamu)</em>' : ""}</strong>
          <span class="pp-points">⭐ ${r.points} pts</span>
          <span class="pp-sub">📿 ${r.hafal} hafalan${r.streak > 1 ? ` ・ 🔥 ${r.streak} hari` : ""}</span>
        </div>`;
      })
      .join("");

    // daftar lengkap
    list.innerHTML =
      rows
        .slice(0, 20)
        .map((r, i) => {
          const isMe = r.username === me;
          return `<div class="leader-row${isMe ? " me" : ""}">
            <span class="lr-rank">${i < 3 ? ["🥇", "🥈", "🥉"][i] : "#" + (i + 1)}</span>
            <span class="lr-name">${esc(r.nama)}${isMe ? ' <em class="pp-you">(kamu)</em>' : ""}</span>
            ${r.streak > 1 ? `<span class="lr-fire" title="Hari login beruntun">🔥 ${r.streak}d</span>` : ""}
            <span class="lr-hafal">📿 ${r.hafal}</span>
            <span class="lr-quiz">🧠 ${r.bestQuiz}</span>
            <strong class="lr-points">⭐ ${r.points}</strong>
          </div>`;
        })
        .join("") +
      (rows.length > 20 ? `<p class="leader-more">…dan ${rows.length - 20} siswa lainnya.</p>` : "");
  } catch (e) {
    note.textContent = "⚠️ Gagal memuat klasemen. Coba tekan 🔄 Muat Ulang.";
    podium.innerHTML = "";
    list.innerHTML = "";
    count.textContent = "";
  }
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  checkDailyLogin();
  renderPoints();
  renderHome();
  renderSurahList();
  renderTajwid();
  renderHijaiyah();
  renderDoa();
  renderQuizBest();
  initTakwin();

  // navigation
  document.querySelectorAll("[data-page]").forEach((el) => {
    el.addEventListener("click", () => {
      const page = el.dataset.page;
      if (page === "belajar" && !currentSurah) return;
      goToPage(page);
    });
  });
  document.getElementById("hamburger").addEventListener("click", openSidebar);
  document.getElementById("overlay").addEventListener("click", closeSidebar);

  // pop-up contoh tajwid
  document.getElementById("tajwid-close").addEventListener("click", closeTajwid);
  document.getElementById("tajwid-done").addEventListener("click", closeTajwid);
  document.getElementById("tajwid-overlay").addEventListener("click", (e) => {
    if (e.target.id === "tajwid-overlay") closeTajwid();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTajwid();
  });

  // surah list interactions
  document.getElementById("surah-search").addEventListener("input", (e) => {
    surahSearch = e.target.value;
    renderSurahList();
  });
  document.querySelectorAll("#surah-filter .seg-btn").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#surah-filter .seg-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      surahFilter = b.dataset.filter;
      renderSurahList();
    });
  });

  // surah detail interactions
  document.getElementById("toggle-arti").addEventListener("change", (e) => {
    document.querySelectorAll(".verse-item").forEach((v) => v.classList.toggle("lat-hide", !e.target.checked));
  });
  document.getElementById("btn-mark-hafal").addEventListener("click", toggleMarkHafal);
  document.getElementById("btn-prev").addEventListener("click", () => {
    if (!currentSurah) return;
    const idx = SURAHS.findIndex((s) => s.id === currentSurah.id);
    if (idx > 0) openSurah(SURAHS[idx - 1].id);
    else toast("Ini surah pertama di Juz 'Amma 🌟");
  });
  document.getElementById("btn-next").addEventListener("click", () => {
    if (!currentSurah) return;
    const idx = SURAHS.findIndex((s) => s.id === currentSurah.id);
    if (idx < SURAHS.length - 1) openSurah(SURAHS[idx + 1].id);
    else toast("Kamu sudah sampai surah terakhir! 🎉");
  });

  // quiz
  document.getElementById("btn-start-quiz").addEventListener("click", startQuiz);
  document.getElementById("btn-quiz-prev").addEventListener("click", prevQuestion);
  document.getElementById("btn-quiz-next").addEventListener("click", nextQuestion);
  document.getElementById("btn-quiz-finish").addEventListener("click", finishQuiz);
  document.getElementById("btn-retry").addEventListener("click", () => {
    document.getElementById("quiz-result").classList.add("hidden");
    document.getElementById("quiz-intro").classList.remove("hidden");
    renderQuizBest();
  });

  // klasemen
  const btnReload = document.getElementById("btn-leader-reload");
  if (btnReload) btnReload.addEventListener("click", renderLeaderboard);

  // akun murid: login/daftar + sinkron progres ke server
  if (window.Auth) window.Auth.init();
}

document.addEventListener("DOMContentLoaded", init);