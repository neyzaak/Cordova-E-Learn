/* ============================================================
   TAZKIAH E-LEARNING — Laporan Guru (guru.html)
   ============================================================ */
"use strict";

const SURAH_NAMES = {
  1: "Al-Fatihah",
  78: "An-Naba'", 79: "An-Nazi'at", 80: "'Abasa", 81: "At-Takwir", 82: "Al-Infitar",
  83: "Al-Mutaffifin", 84: "Al-Insyiqaq", 85: "Al-Buruj", 86: "At-Tariq", 87: "Al-A'la",
  88: "Al-Gasyiyah", 89: "Al-Fajr", 90: "Al-Balad", 91: "Asy-Syams", 92: "Al-Lail",
  93: "Ad-Duha", 94: "Al-Insyirah", 95: "At-Tin", 96: "Al-'Alaq", 97: "Al-Qadr",
  98: "Al-Bayyinah", 99: "Az-Zalzalah", 100: "Al-'Adiyat", 101: "Al-Qari'ah",
  102: "At-Takasur", 103: "Al-'Asr", 104: "Al-Humazah", 105: "Al-Fil", 106: "Quraisy",
  107: "Al-Ma'un", 108: "Al-Kausar", 109: "Al-Kafirun", 110: "An-Nasr", 111: "Al-Lahab",
  112: "Al-Ikhlas", 113: "Al-Falaq", 114: "An-Nas"
};

const TOKEN_KEY = "aft-guru";
let students = [];
let token = localStorage.getItem(TOKEN_KEY) || "";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(path, { ...opts, headers });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && data.error) || "Kesalahan (" + res.status + ")");
  return data;
}

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return m + " mnt lalu";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " jam lalu";
  const d = Math.floor(h / 24);
  return d + " hari lalu";
}

/* ---------- mode gelap / terang (sinkron dengan aplikasi murid) ---------- */
const THEME_KEY = "tazkiah-theme";
function applyGuruTheme(dark, persist) {
  const root = document.documentElement;
  if (dark) root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  const b = $("btn-guru-theme");
  if (b) {
    b.textContent = dark ? "☀️" : "🌙";
    b.setAttribute("aria-label", dark ? "Mode terang" : "Mode gelap");
    b.title = dark ? "Ganti ke mode terang" : "Ganti ke mode gelap";
  }
  if (persist) {
    try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (e) {}
  }
}
function initGuruTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  applyGuruTheme(
    saved ? saved === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches),
    false
  );
  const b = $("btn-guru-theme");
  if (b) b.addEventListener("click", () => applyGuruTheme(!rootIsDark(), true));
}
function rootIsDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

/* ---------- login ---------- */
async function doLogin() {
  var msg = $("login-msg");
  var btn = $("btn-guru-login");
  msg.textContent = "";
  try {
    var res = await api("/api/guru/login", {
      method: "POST",
      body: JSON.stringify({ password: $("guru-password").value })
    });
    token = res.token;
    localStorage.setItem(TOKEN_KEY, token);
    showDashboard();
    msg.textContent = "";
  } catch (e) {
    msg.textContent = "⚠️ " + e.message;
  }
}

function logout() {
  token = "";
  localStorage.removeItem(TOKEN_KEY);
  $("view-login").hidden = false;
  $("view-dashboard").hidden = true;
}

/* ---------- tampilan ---------- */
function showDashboard() {
  $("view-login").hidden = true;
  $("view-dashboard").hidden = false;
  loadStudents();
}

async function loadStudents() {
  $("guru-sub").textContent = "Memuat data murid…";
  try {
    const res = await api("/api/guru/students");
    students = res.students || [];
    if (students.length === 0) {
      $("guru-sub").textContent = "Belum ada murid terdaftar.";
    } else {
      const aktif = students.filter((s) => s.totalAnswered > 0 || s.quizCount > 0).length;
      $("guru-sub").textContent = `${students.length} murid terdaftar • ${aktif} sudah mulai berlatih`;
    }
    renderStats();
    renderTable();
  } catch (e) {
    if (String(e.message).includes("401") || String(e.message).includes("Sesi")) {
      logout();
    } else {
      $("guru-sub").textContent = "⚠️ Gagal memuat: " + e.message;
    }
  }
}

function renderStats() {
  const total = students.length;
  const sumPoin = students.reduce((a, s) => a + (s.points || 0), 0);
  const avgPoin = total ? Math.round(sumPoin / total) : 0;
  const sumHafal = students.reduce((a, s) => a + (s.memorized || []).length, 0);
  const sumQuiz = students.reduce((a, s) => a + (s.quizCount || 0), 0);
  const sumSoal = students.reduce((a, s) => a + (s.totalAnswered || 0), 0);
  $("guru-stats").innerHTML = `
    <div class="gstat"><div class="gs-val">${total}</div><div class="gs-label">👥 Murid terdaftar</div></div>
    <div class="gstat"><div class="gs-val">${sumPoin}</div><div class="gs-label">⭐ Total poin kelas</div></div>
    <div class="gstat"><div class="gs-val">${avgPoin}</div><div class="gs-label">📈 Rata-rata poin</div></div>
    <div class="gstat"><div class="gs-val">${sumHafal}</div><div class="gs-label">📿 Total surah dihafal</div></div>
    <div class="gstat"><div class="gs-val">${sumQuiz}</div><div class="gs-label">🧠 Kuis selesai</div></div>
    <div class="gstat"><div class="gs-val">${sumSoal}</div><div class="gs-label">✏️ Soal dijawab</div></div>`;
}

function sorted() {
  const mode = $("guru-sort").value;
  const q = ($("guru-search").value || "").toLowerCase();
  let arr = students.filter((s) => !q || s.nama.toLowerCase().includes(q));
  const cmp = {
    points: (a, b) => b.points - a.points || b.bestQuiz - a.bestQuiz,
    name: (a, b) => a.nama.localeCompare(b.nama, "id"),
    hafal: (a, b) => (b.memorized || []).length - (a.memorized || []).length,
    quiz: (a, b) => (b.quizCount || 0) - (a.quizCount || 0),
    streak: (a, b) => (b.streak || 0) - (a.streak || 0) || (b.bestStreak || 0) - (a.bestStreak || 0),
    active: (a, b) => (b.lastActive || 0) - (a.lastActive || 0)
  }[mode] || ((a, b) => b.points - a.points);
  return arr.slice().sort(cmp);
}

function renderTable() {
  const rows = sorted();
  const tbody = $("guru-tbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="13" class="guru-empty">Tidak ada murid yang cocok${students.length ? "" : " — daftar akun dulu dari aplikasi murid"}.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((s, i) => {
      const hafal = s.memorized || [];
      const namaHafal = hafal
        .map((id) => SURAH_NAMES[id] || "Surah " + id)
        .sort((a, b) => a.localeCompare(b, "id"))
        .join(", ");
      const acc = s.totalAnswered > 0 ? s.totalCorrect + "/" + s.totalAnswered : "—";
      const accBadge =
        s.totalAnswered === 0
          ? `<span class="badge b-red">belum</span>`
          : Math.round((s.totalCorrect / s.totalAnswered) * 100) >= 80
          ? `<span class="badge b-green">${Math.round((s.totalCorrect / s.totalAnswered) * 100)}%</span>`
          : `<span class="badge b-gold">${Math.round((s.totalCorrect / s.totalAnswered) * 100)}%</span>`;
      const streak = s.streak || 0;
      const bestStreak = s.bestStreak || 0;
      const loyaltyLevel = s.loyaltyLevel || 0;
      const levelNames = ["—", "🌱 Pemula (7 hari)", "🌿 Rajin (14 hari)", "🌳 Setia (30 hari)"];
      return `
      <tr>
        <td>${i + 1}</td>
        <td class="nm">${esc(s.nama)}<br /><small style="color:var(--ink-soft);font-weight:600">@${esc(s.username)}</small></td>
        <td class="pts">${s.points}</td>
        <td>${hafal.length > 0 ? `<span class="badge b-green">${hafal.length}</span>` : "—"}</td>
        <td>${s.bestQuiz || "—"}</td>
        <td>${accBadge} <small style="color:var(--ink-soft)">${acc}</small></td>
        <td>${s.totalAnswered || 0}</td>
        <td>${s.quizCount || 0}</td>
        <td>${streak > 0 ? `<span class="badge b-gold">🔥 ${streak} hari</span>` : `<span style="color:var(--ink-soft)">—</span>`}</td>
        <td>${bestStreak > 0 ? `<span class="badge b-green">🏆 ${bestStreak} hari</span>` : `<span style="color:var(--ink-soft)">—</span>`}</td>
        <td>${loyaltyLevel > 0 ? `<span class="badge b-green">${levelNames[loyaltyLevel]}</span>` : `<span style="color:var(--ink-soft)">—</span>`}</td>
        <td>${timeAgo(s.lastActive)}</td>
        <td class="row-actions">
          <button class="row-btn" data-row="${i}">Detail</button>
          <button class="row-danger" data-del="${esc(s.username)}" title="Hapus akun percobaan ini">Hapus</button>
        </td>
      </tr>
      <tr class="row-detail" id="rd-${i}">
        <td></td>
        <td colspan="11">
          <strong style="color:var(--emerald-800)">📿 Surah yang dihafal:</strong>
          ${namaHafal ? `<div class="hafal-tags">${hafal.map((id) => '<span>' + esc(SURAH_NAMES[id] || "Surah " + id) + "</span>").join("")}</div>` : '<span style="color:var(--ink-soft)">Belum ada. Ayo semangat menghafal!</span>'}
          <div style="margin-top:8px">
            ⭐ Poin: <strong>${s.points}</strong> •
            🧠 Skor kuis terbaik: <strong>${s.bestQuiz || 0}</strong> •
            📚 Favorit: <strong>${(s.saved || []).length}</strong> •
            ✏️ Benar: <strong>${s.totalCorrect || 0}</strong> / ${s.totalAnswered || 0} dijawab •
            🔥 Streak: <strong>${streak}</strong> hari •
            🏆 Best: <strong>${bestStreak}</strong> hari •
            📅 Level: <strong>${loyaltyLevel > 0 ? levelNames[loyaltyLevel] : "—"}</strong>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".row-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tr = $("rd-" + btn.dataset.row);
      tr.classList.toggle("show");
      btn.textContent = tr.classList.contains("show") ? "Tutup" : "Detail";
    });
  });

  tbody.querySelectorAll(".row-danger").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const username = btn.dataset.del;
      const st = students.find((x) => x.username === username);
      const label = st && st.nama && st.nama !== username ? ` (${st.nama})` : "";
      const ok = confirm(
        `Hapus akun percobaan @${username}${label}?\n\nSeluruh progres & akunnya akan hilang permanen dan tidak bisa dikembalikan.`
      );
      if (!ok) return;
      btn.disabled = true;
      btn.textContent = "…";
      try {
        await api("/api/guru/delete-student", {
          method: "POST",
          body: JSON.stringify({ username })
        });
        showToast(`🗑️ Akun @${username} dihapus.`);
        students = students.filter((x) => x.username !== username);
        renderStats();
        renderTable();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Hapus";
        alert("Gagal menghapus: " + e.message);
      }
    });
  });

  $("guru-detail-note").textContent = `Menampilkan ${rows.length} murid • klik "Detail" untuk melihat daftar surah yang dihafal.`;
}

/* ---------- hapus akun percobaan (belum ada aktivitas) ---------- */
async function cleanInactive() {
  const inactive = students.filter((s) => (s.totalAnswered || 0) === 0 && (s.quizCount || 0) === 0);
  if (!inactive.length) {
    showToast("Tidak ada akun percobaan (semua sudah ada aktivitas).");
    return;
  }
  const peek = inactive
    .slice(0, 8)
    .map((s) => "@" + s.username + (s.nama && s.nama !== s.username ? " (" + s.nama + ")" : ""))
    .join("\n");
  const more = inactive.length > 8 ? `\n… dan ${inactive.length - 8} akun lain` : "";
  const ok = confirm(
    `Hapus ${inactive.length} akun percobaan (belum ada aktivitas sama sekali)?\n\n${peek}${more}\n\nAkun ini akan hilang permanen.`
  );
  if (!ok) return;
  let okCount = 0;
  const errs = [];
  for (const s of inactive) {
    try {
      await api("/api/guru/delete-student", {
        method: "POST",
        body: JSON.stringify({ username: s.username })
      });
      okCount++;
    } catch (e) {
      errs.push("@" + s.username + " (" + e.message + ")");
    }
  }
  students = students.filter((s) => !inactive.some((x) => x.username === s.username));
  renderStats();
  renderTable();
  showToast(
    `🧹 ${okCount} akun percobaan dihapus${errs.length ? ", " + errs.length + " gagal: " + errs.join(", ") : ""}.`
  );
}

/* ---------- toast sederhana ---------- */
let toastTimer = null;
function showToast(text) {
  let t = document.getElementById("guru-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "guru-toast";
    t.style.cssText =
      "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#065f46;color:#fff;" +
      "font-weight:800;font-size:13.5px;padding:12px 18px;border-radius:99px;box-shadow:0 10px 30px rgba(0,0,0,.25);" +
      "z-index:999;transition:opacity .3s;opacity:0;max-width:92vw;text-align:center;";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 2800);
}

/* ---------- CSV ---------- */
function exportCsv() {
  const sep = ";";
  const levelNames = ["—", "Pemula (7 hari)", "Rajin (14 hari)", "Setia (30 hari)"];
  const head = ["No", "Nama", "Username", "Poin", "Jumlah Hafalan", "Surah Dihafal", "Skor Kuis Terbaik", "Benar", "Dijawab", "Akurasi %", "Kuis Selesai", "Streak Hari", "Best Streak", "Level Loyalitas", "Terakhir Aktif"];
  const lines = [head.join(sep)];
  sorted().forEach((s, i) => {
    const hafal = (s.memorized || []).map((id) => SURAH_NAMES[id] || id).join(" / ");
    lines.push([
      i + 1, s.nama, s.username, s.points,
      (s.memorized || []).length, hafal,
      s.bestQuiz || 0, s.totalCorrect || 0, s.totalAnswered || 0,
      s.totalAnswered ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0,
      s.quizCount || 0,
      s.streak || 0,
      s.bestStreak || 0,
      s.loyaltyLevel > 0 ? levelNames[s.loyaltyLevel] : "—",
      s.lastActive ? new Date(s.lastActive).toLocaleString("id-ID") : ""
    ].join(sep));
  });
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "laporan-progres-murid.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  initGuruTheme();
  $("btn-guru-login").addEventListener("click", doLogin);
  $("guru-password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("btn-guru-refresh").addEventListener("click", loadStudents);
  $("btn-guru-csv").addEventListener("click", exportCsv);
  $("btn-guru-logout").addEventListener("click", logout);
  $("guru-search").addEventListener("input", renderTable);
  $("guru-sort").addEventListener("change", renderTable);
  $("btn-guru-clean").addEventListener("click", cleanInactive);

  if (token) {
    try {
      await api("/api/guru/students");
      showDashboard();
    } catch (e) {
      logout();
    }
  }
});