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
    active: (a, b) => (b.lastActive || 0) - (a.lastActive || 0)
  }[mode] || ((a, b) => b.points - a.points);
  return arr.slice().sort(cmp);
}

function renderTable() {
  const rows = sorted();
  const tbody = $("guru-tbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="guru-empty">Tidak ada murid yang cocok${students.length ? "" : " — daftar akun dulu dari aplikasi murid"}.</td></tr>`;
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
        <td>${timeAgo(s.lastActive)}</td>
        <td><button class="row-btn" data-row="${i}">${namaHafal ? "Detail" : "Detail"}</button></td>
      </tr>
      <tr class="row-detail" id="rd-${i}">
        <td></td>
        <td colspan="9">
          <strong style="color:var(--emerald-800)">📿 Surah yang dihafal:</strong>
          ${namaHafal ? `<div class="hafal-tags">${hafal.map((id) => '<span>' + esc(SURAH_NAMES[id] || "Surah " + id) + "</span>").join("")}</div>` : '<span style="color:var(--ink-soft)">Belum ada. Ayo semangat menghafal!</span>'}
          <div style="margin-top:8px">
            ⭐ Poin: <strong>${s.points}</strong> •
            🧠 Skor kuis terbaik: <strong>${s.bestQuiz || 0}</strong> •
            📚 Favorit: <strong>${(s.saved || []).length}</strong> •
            ✏️ Benar: <strong>${s.totalCorrect || 0}</strong> / ${s.totalAnswered || 0} dijawab
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
  $("guru-detail-note").textContent = `Menampilkan ${rows.length} murid • klik "Detail" untuk melihat daftar surah yang dihafal.`;
}

/* ---------- CSV ---------- */
function exportCsv() {
  const sep = ";";
  const head = ["No", "Nama", "Username", "Poin", "Jumlah Hafalan", "Surah Dihafal", "Skor Kuis Terbaik", "Benar", "Dijawab", "Akurasi %", "Kuis Selesai", "Terakhir Aktif"];
  const lines = [head.join(sep)];
  sorted().forEach((s, i) => {
    const hafal = (s.memorized || []).map((id) => SURAH_NAMES[id] || id).join(" / ");
    lines.push([
      i + 1, s.nama, s.username, s.points,
      (s.memorized || []).length, hafal,
      s.bestQuiz || 0, s.totalCorrect || 0, s.totalAnswered || 0,
      s.totalAnswered ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0,
      s.quizCount || 0,
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
  $("btn-guru-login").addEventListener("click", doLogin);
  $("guru-password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("btn-guru-refresh").addEventListener("click", loadStudents);
  $("btn-guru-csv").addEventListener("click", exportCsv);
  $("btn-guru-logout").addEventListener("click", logout);
  $("guru-search").addEventListener("input", renderTable);
  $("guru-sort").addEventListener("change", renderTable);

  if (token) {
    try {
      await api("/api/guru/students");
      showDashboard();
    } catch (e) {
      logout();
    }
  }
});