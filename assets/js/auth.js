/* ============================================================
   TAZKIAH E-LEARNING — Akun murid & sinkronisasi server
   ============================================================ */
"use strict";

(function () {
  const TOKEN_KEY = "aft-token";
  const USER_KEY = "aft-user";

  let online = false; // API server terjangkau
  let token = "";
  let username = "";
  let nama = "";
  let syncing = false;
  let syncTimer = null;

  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch(path, { ...opts, headers });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) throw new Error((data && data.error) || "Terjadi kesalahan (" + res.status + ")");
    return data;
  }

  function mergeLogin(local, remote) {
    if (!remote) return;
    const L = local;
    // data server lebih baru (bulan berbeda → yang terbaru menang)
    if (!L.month) {
      L.month = remote.month || "";
      L.day = remote.day || "";
      L.streak = remote.streak || 0;
      L.best = remote.best || 0;
      L.days = remote.days || [];
      L.level = remote.level || 0;
      L.levelDays = remote.levelDays || 0;
      L.levelCycles = remote.levelCycles || 0;
      return;
    }
    if (remote.month !== L.month) {
      if ((remote.month || "") > L.month) {
        L.month = remote.month;
        L.day = remote.day;
        L.streak = remote.streak;
        L.days = remote.days || [];
        L.level = remote.level || 0;
        L.levelDays = remote.levelDays || 0;
        L.levelCycles = remote.levelCycles || 0;
      }
      L.best = Math.max(L.best || 0, remote.best || 0);
      return;
    }
    // bulan sama → gabungkan hari login & ambil rekor/streak terbesar
    const set = new Set([...(L.days || []), ...(remote.days || [])]);
    L.days = [...set].sort();
    L.streak = Math.max(L.streak || 0, remote.streak || 0);
    L.best = Math.max(L.best || 0, remote.best || 0);
    if ((remote.day || "") > (L.day || "")) {
      L.day = remote.day;
      L.level = remote.level || 0;
      L.levelDays = remote.levelDays || 0;
      L.levelCycles = remote.levelCycles || 0;
    }
  }

  function applyServerProgress(progress) {
    if (!progress || typeof window.storeReady !== "function") return;
    window.storeReady((store) => {
      store.points = progress.points || 0;
      store.saved = Array.isArray(progress.saved) ? progress.saved : [];
      store.memorized = Array.isArray(progress.memorized) ? progress.memorized : [];
      store.bestQuiz = progress.bestQuiz || 0;
      store.answeredQuiz = progress.answeredQuiz || 0;
      store.totalAnswered = progress.totalAnswered || 0;
      store.totalCorrect = progress.totalCorrect || 0;
      store.quizCount = progress.quizCount || 0;
      store.lastActive = progress.lastActive || null;
      mergeLogin(store.login, progress.login);
      window.__saveStoreLocal();
      if (typeof window.renderAll === "function") window.renderAll();
    });
  }

  function showOverlay() {
    const el = document.getElementById("auth-overlay");
    if (el) el.classList.add("show");
  }
  function hideOverlay() {
    const el = document.getElementById("auth-overlay");
    if (el) el.classList.remove("show");
  }

  function updateUi() {
    const statusEl = document.getElementById("auth-status");
    const userEl = document.getElementById("sidebar-user");
    const namaEl = document.getElementById("user-nama");
    if (userEl) userEl.hidden = !(online && username);
    if (namaEl) namaEl.textContent = nama || username || "";
    if (statusEl) {
      statusEl.textContent = online
        ? username
          ? "🔒 Akun: " + (nama || username)
          : "🔒 Server terhubung — silakan masuk"
        : "ℹ️ Mode lokal: data tersimpan di perangkat ini";
    }
  }

  /* ---------- API publik ---------- */
  window.Auth = {
    isOnline: () => online,
    isGuest: () => !online || !username,
    getNama: () => nama,
    getUsername: () => username,

    /** ambil klasemen dari server (tanpa token) */
    fetchLeaderboard: async function () {
      const data = await api("/api/leaderboard");
      return data.leaderboard || [];
    },

    init: async function () {
      token = localStorage.getItem(TOKEN_KEY) || "";
      username = localStorage.getItem(USER_KEY) || "";

      try {
        await api("/api/ping");
        online = true;
      } catch (e) {
        online = false;
      }

      if (online) {
        if (token) {
          try {
            const data = await api("/api/progress");
            nama = localStorage.getItem("aft-nama") || username || "";
            applyServerProgress(data.progress);
            hideOverlay();
          } catch (e) {
            // token tidak valid → minta masuk ulang
            token = "";
            username = "";
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            showOverlay();
          }
        } else {
          showOverlay();
        }
      } else {
        nama = "";
        hideOverlay();
      }
      if (typeof window.__afterAuth === "function") window.__afterAuth(online);
      updateUi();
      return { online, username };
    },

    register: async function (usernameInput, namaInput, password) {
      const data = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ username: usernameInput, nama: namaInput, password })
      });
      token = data.token;
      username = data.user.username;
      nama = data.user.nama;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, username);
      localStorage.setItem("aft-nama", nama || "");
      hideOverlay();
      updateUi();
      applyServerProgress({ points: 0, saved: [], memorized: [], bestQuiz: 0, answeredQuiz: 0 });
      return data.user;
    },

    login: async function (usernameInput, password) {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: usernameInput, password })
      });
      token = data.token;
      username = data.user.username;
      nama = data.user.nama;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, username);
      localStorage.setItem("aft-nama", nama || "");
      hideOverlay();
      updateUi();
      const prog = await api("/api/progress");
      applyServerProgress(prog.progress);
      return data.user;
    },

    logout: function () {
      token = "";
      username = "";
      nama = "";
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem("aft-nama");
      updateUi();
      showOverlay();
    },

    guest: function () {
      hideOverlay();
      updateUi();
      window.toast && window.toast("Mode lokal: pakai akun agar progres tersimpan di server.");
    },

    /* kirim progres ke server (di-throttle biar tidak spam) */
    sync: function (store) {
      if (!online || !token) return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(async () => {
        if (syncing) return;
        syncing = true;
        try {
          await api("/api/progress", {
            method: "PUT",
            body: JSON.stringify({
              progress: {
                points: store.points,
                saved: store.saved,
                memorized: store.memorized,
                bestQuiz: store.bestQuiz,
                answeredQuiz: store.answeredQuiz,
                totalAnswered: store.totalAnswered,
                totalCorrect: store.totalCorrect,
                quizCount: store.quizCount,
                lastActive: store.lastActive,
                login: store.login
              }
            })
          });
        } catch (e) {
          // abaikan; akan dicoba lagi pada perubahan berikutnya
        } finally {
          syncing = false;
        }
      }, 700);
    }
  };

  /* ---------- wiring UI ---------- */
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    const overlay = document.getElementById("auth-overlay");
    const form = document.getElementById("auth-form");
    const msg = document.getElementById("auth-msg");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const fieldNama = document.getElementById("field-nama");
    const submit = document.getElementById("auth-submit");
    const title = document.getElementById("auth-title");
    const usernameInput = document.getElementById("auth-username");
    const namaInput = document.getElementById("auth-nama");
    const passwordInput = document.getElementById("auth-password");
    const guestBtn = document.getElementById("auth-guest");
    const logoutBtn = document.getElementById("btn-logout");

    if (!form) return;

    let mode = "login"; // atau "register"
    function setMode(m) {
      mode = m;
      const isReg = m === "register";
      fieldNama.hidden = !isReg;
      tabLogin.classList.toggle("active", !isReg);
      tabRegister.classList.toggle("active", isReg);
      title.textContent = isReg ? "Buat akun murid baru" : "Masuk ke akun murid";
      submit.textContent = isReg ? "Daftar & Mulai" : "Masuk";
      msg.textContent = "";
      passwordInput.setAttribute("autocomplete", isReg ? "new-password" : "current-password");
    }
    tabLogin.addEventListener("click", () => setMode("login"));
    tabRegister.addEventListener("click", () => setMode("register"));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = usernameInput.value.trim();
      const n = namaInput.value.trim();
      const p = passwordInput.value;
      msg.textContent = "";
      submit.disabled = true;
      submit.textContent = "Memproses…";
      try {
        if (mode === "register") {
          if (!n) throw new Error("Nama lengkap wajib diisi.");
          await window.Auth.register(u, n, p);
        } else {
          await window.Auth.login(u, p);
        }
        // reset form untuk keamanan
        passwordInput.value = "";
        // segarkan klasemen jika sedang dibuka
        if (typeof renderLeaderboard === "function") {
          const klasemen = document.getElementById("page-klasemen");
          if (klasemen && klasemen.classList.contains("active")) renderLeaderboard();
        }
      } catch (err) {
        msg.textContent = "⚠️ " + err.message;
        submit.disabled = false;
        submit.textContent = mode === "register" ? "Daftar & Mulai" : "Masuk";
      }
    });

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        window.Auth.logout();
        window.toast && window.toast("Kamu sudah keluar dari akun.");
      });
    }
    if (guestBtn) guestBtn.addEventListener("click", () => window.Auth.guest());
  });
})();