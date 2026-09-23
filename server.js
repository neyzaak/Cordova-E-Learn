/* ============================================================
   TAZKIAH E-LEARNING — Server static + API akun murid
   Jalankan: node server.js  →  http://localhost:8710

   Endpoint:
     GET  /api/ping                → cek server online
     POST /api/register            {username, nama, password}
     POST /api/login               {username, password}  → {token}
     GET  /api/progress            (auth: token) → progress murid
     PUT  /api/progress            (auth: token, body: progress)

   Data murid disimpan di data/users.json secara default (password di-hash scrypt);
   bila env DATABASE_URL diisi, memakai PostgreSQL — akun & progres awet di cloud.
   ============================================================ */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
// file web dipindah ke public/ biar cocok dengan hosting statis (Vercel, dll.);
// kalau belum ada public/, tetap layani dari folder proyek (mode offline/LAN lama).
const STATIC_DIR = fs.existsSync(path.join(ROOT, "public")) ? path.join(ROOT, "public") : ROOT;
const PORT = Number(process.env.PORT) || 8710;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

/* Kata sandi guru (ubah lewat env GURU_PASSWORD saat menjalankan server) */
const GURU_PASSWORD = process.env.GURU_PASSWORD || "guru123";
const guruTokens = new Set(); // sesi guru (hilang saat server dimulai ulang → login lagi)

// Mode penyimpanan: false = file data/users.json (lokal), true = PostgreSQL (cloud).
const USE_DB = Boolean(process.env.DATABASE_URL);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

/* ---------- penyimpanan murid ---------- */
let users = [];
function loadUsers() {
  try {
    users = (JSON.parse(fs.readFileSync(USERS_FILE, "utf8")).users || []).filter((u) => u && u.username);
  } catch {
    users = [];
  }
}
function saveUsers() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = USERS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2));
  fs.renameSync(tmp, USERS_FILE);
}

/* ---------- penyimpanan opsional: PostgreSQL (kalau DATABASE_URL diisi) ---------- */
let pgPool = null;

function normalizeProgressJson(raw) {
  if (raw && typeof raw === "object") return sanitizeProgress(raw);
  if (typeof raw === "string") {
    try {
      return sanitizeProgress(JSON.parse(raw));
    } catch {
      return sanitizeProgress({});
    }
  }
  return sanitizeProgress({});
}

async function initStorage() {
  if (!USE_DB) {
    loadUsers();
    console.log(`[file] akun dimuat dari ${USERS_FILE} (${users.length})`);
    return;
  }
  const { Pool } = require("pg"); // dibutuhkan hanya saat mode database
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await pgPool.query(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL,
    token TEXT,
    progress JSONB NOT NULL DEFAULT '{}'::jsonb
  )`);
  const { rows } = await pgPool.query("SELECT username, nama, salt, hash, token, progress FROM users");
  users = rows.map((r) => ({
    username: r.username,
    nama: r.nama,
    salt: r.salt,
    hash: r.hash,
    token: r.token || null,
    progress: normalizeProgressJson(r.progress)
  }));
  console.log(`[db] terhubung PostgreSQL, ${users.length} akun dimuat`);
  // migrasi sekali: bila DB kosong tapi ada data lama di users.json
  await importLegacyUsersIfEmpty();
}

async function importLegacyUsersIfEmpty() {
  if (users.length > 0) return;
  let legacy = [];
  try {
    legacy = (JSON.parse(fs.readFileSync(USERS_FILE, "utf8")).users || []).filter((u) => u && u.username);
  } catch {
    return;
  }
  if (!legacy.length) return;
  let imported = 0;
  for (const u of legacy) {
    const clean = {
      username: u.username,
      nama: u.nama || u.username,
      salt: u.salt,
      hash: u.hash,
      token: u.token || null,
      progress: sanitizeProgress(u.progress)
    };
    try {
      await pgPool.query(
        `INSERT INTO users (username, nama, salt, hash, token, progress)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (username) DO NOTHING`,
        [clean.username, clean.nama, clean.salt, clean.hash, clean.token, JSON.stringify(clean.progress)]
      );
      users.push(clean);
      imported++;
    } catch (e) {
      console.error("[db] impor gagal untuk", clean.username, ":", e.message);
    }
  }
  if (imported) console.log(`[db] mengimpor ${imported} akun lama dari ${USERS_FILE}`);
}

async function persistUser(u) {
  if (!USE_DB) {
    saveUsers(); // mode file: tulis seluruh data seperti sebelumnya
    return;
  }
  try {
    await pgPool.query(
      `INSERT INTO users (username, nama, salt, hash, token, progress)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (username) DO UPDATE SET nama=$2, salt=$3, hash=$4, token=$5, progress=$6`,
      [u.username, u.nama, u.salt, u.hash, u.token, JSON.stringify(u.progress)]
    );
  } catch (e) {
    console.error("[db] gagal menyimpan", u.username, ":", e.message);
  }
}

const DEFAULTS = () => ({
  points: 0,
  saved: [],
  memorized: [],
  bestQuiz: 0,
  answeredQuiz: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  quizCount: 0,
  lastActive: null,
  login: { day: "", streak: 0, best: 0, month: "", days: [] }
});

function sanitizeLogin(src) {
  const s = src || {};
  const clamp = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const isMonth = (v) => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);
  return {
    day: isDate(s.day) ? s.day : "",
    streak: clamp(s.streak, 100000),
    best: clamp(s.best, 100000),
    month: isMonth(s.month) ? s.month : "",
    days: Array.isArray(s.days) ? [...new Set(s.days.filter(isDate))].slice(0, 400) : [],
    level: Number.isInteger(s.level) && s.level >= 0 && s.level <= 2 ? s.level : 0,
    levelDays: clamp(s.levelDays, 100000),
    levelCycles: clamp(s.levelCycles, 10000)
  };
}

function sanitizeProgress(src) {
  const p = src || {};
  const arrOf = (v, max) =>
    Array.isArray(v)
      ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 114))].slice(0, max)
      : [];
  const clamp = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const lastActive =
    Number(p.lastActive) > 0 && Number.isFinite(Number(p.lastActive))
      ? Math.floor(Number(p.lastActive))
      : null;
  return {
    points: clamp(p.points, 1000000000),
    saved: arrOf(p.saved, 114),
    memorized: arrOf(p.memorized, 114),
    bestQuiz: clamp(p.bestQuiz, 100),
    answeredQuiz: clamp(p.answeredQuiz, 10000000),
    totalAnswered: clamp(p.totalAnswered, 10000000),
    totalCorrect: clamp(p.totalCorrect, 10000000),
    quizCount: clamp(p.quizCount, 1000000),
    lastActive,
    login: sanitizeLogin(p.login)
  };
}

/* ---------- keamanan kata sandi & token ---------- */
function hashPw(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 32).toString("hex");
}
function genToken() {
  return crypto.randomBytes(24).toString("hex");
}
function findUserByToken(token) {
  if (!token) return null;
  return users.find((u) => u.token === token) || null;
}

/* ---------- bantuan HTTP ---------- */
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store"
  });
  res.end(body);
}
const ok = (data) => ({ ok: true, ...data });
const err = (message, code = 400) => JSON.parse(JSON.stringify({ ok: false, error: message }));

function readBody(req, cb, limit = 256 * 1024) {
  let data = "";
  req.on("data", (c) => {
    data += c;
    if (data.length > limit) {
      req.destroy();
      cb(new Error("Payload terlalu besar."));
    }
  });
  req.on("end", () => cb(null, data));
}

/* ---------- handlers API ---------- */
function handleApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }

  if (pathname === "/api/ping" && req.method === "GET") {
    return sendJSON(res, 200, ok({ status: "ok", total: users.length }));
  }

  // klasemen — tanpa perlu login (hanya data aman: nama & skor)
  if (pathname === "/api/leaderboard" && req.method === "GET") {
    const rows = users
      .map((u) => ({
        username: u.username,
        nama: u.nama || u.username,
        points: (u.progress && u.progress.points) || 0,
        hafal: (u.progress && u.progress.memorized ? u.progress.memorized.length : 0),
        bestQuiz: (u.progress && u.progress.bestQuiz) || 0,
        streak: (u.progress && u.progress.login && u.progress.login.streak) || 0
      }))
      .sort((a, b) => b.points - a.points || b.hafal - a.hafal || b.bestQuiz - a.bestQuiz)
      .slice(0, 50);
    return sendJSON(res, 200, ok({ leaderboard: rows }));
  }

  // guru: login password
  if (pathname === "/api/guru/login" && req.method === "POST") {
    return readBody(req, (readErr, body) => {
      if (readErr) return sendJSON(res, 400, err(readErr.message));
      let data = {};
      try {
        data = body ? JSON.parse(body) : {};
      } catch {
        return sendJSON(res, 400, err("Format JSON tidak valid."));
      }
      if (String(data.password || "") !== GURU_PASSWORD) {
        return sendJSON(res, 401, err("Kata sandi guru salah."));
      }
      const token = genToken();
      guruTokens.add(token);
      console.log("[guru] login");
      return sendJSON(res, 200, ok({ token }));
    });
  }

  // guru: daftar murid lengkap
  if (pathname === "/api/guru/students" && req.method === "GET") {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!guruTokens.has(token)) {
      return sendJSON(res, 401, err("Sesi guru tidak valid. Login dulu."));
    }
    const students = users
      .map((u) => {
        const p = sanitizeProgress(u.progress);
        return {
          username: u.username,
          nama: u.nama || u.username,
          points: p.points,
          saved: p.saved,
          memorized: p.memorized,
          bestQuiz: p.bestQuiz,
          answeredQuiz: p.answeredQuiz,
          totalAnswered: p.totalAnswered,
          totalCorrect: p.totalCorrect,
          quizCount: p.quizCount,
          acc: p.totalAnswered > 0 ? Math.round((p.totalCorrect / p.totalAnswered) * 100) : 0,
          lastActive: p.lastActive
        };
      })
      .sort((a, b) => b.points - a.points || b.bestQuiz - a.bestQuiz || a.nama.localeCompare(b.nama));
    return sendJSON(res, 200, ok({ students }));
  }

  const post = (pathname === "/api/register" || pathname === "/api/login") && req.method === "POST";
  if (post) {
    return readBody(req, async (readErr, body) => {
      if (readErr) return sendJSON(res, 400, err(readErr.message));
      let data = {};
      try {
        data = body ? JSON.parse(body) : {};
      } catch {
        return sendJSON(res, 400, err("Format JSON tidak valid."));
      }

      if (pathname === "/api/register") {
        const username = String(data.username || "").trim().toLowerCase();
        const nama = String(data.nama || "").trim();
        const password = String(data.password || "");
        if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
          return sendJSON(res, 400, err("Username 3–20 karakter (huruf kecil, angka, _ atau .)"));
        }
        if (!nama || nama.length > 40) return sendJSON(res, 400, err("Nama wajib diisi (maks. 40 huruf)."));
        if (password.length < 4) return sendJSON(res, 400, err("Password minimal 4 karakter."));
        if (users.some((u) => u.username === username)) {
          return sendJSON(res, 409, err("Username sudah dipakai. Coba yang lain."));
        }
        const salt = crypto.randomBytes(16).toString("hex");
        const user = {
          username,
          nama,
          salt,
          hash: hashPw(password, salt),
          token: genToken(),
          progress: DEFAULTS()
        };
        users.push(user);
        await persistUser(user);
        console.log(`[auth] daftar akun: ${username}`);
        return sendJSON(res, 201, ok({ user: { username, nama }, token: user.token }));
      }

      // /api/login
      const username = String(data.username || "").trim().toLowerCase();
      const password = String(data.password || "");
      const user = users.find((u) => u.username === username);
      if (!user || user.hash !== hashPw(password, user.salt)) {
        return sendJSON(res, 401, err("Username atau password salah."));
      }
      user.token = genToken();
      await persistUser(user);
      console.log(`[auth] login: ${username}`);
      return sendJSON(res, 200, ok({ user: { username: user.username, nama: user.nama }, token: user.token }));
    });
  }

  // progress (perlu token)
  if (pathname === "/api/progress") {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const user = findUserByToken(token);
    if (!user) return sendJSON(res, 401, err("Sesi tidak valid. Silakan masuk kembali."));

    if (req.method === "GET") {
      return sendJSON(res, 200, ok({ progress: sanitizeProgress(user.progress) }));
    }
    if (req.method === "PUT") {
      return readBody(req, async (readErr, body) => {
        if (readErr) return sendJSON(res, 400, err(readErr.message));
        let data = {};
        try {
          data = body ? JSON.parse(body) : {};
        } catch {
          return sendJSON(res, 400, err("Format JSON tidak valid."));
        }
        user.progress = sanitizeProgress(data.progress || data);
        await persistUser(user);
        sendJSON(res, 200, ok({ progress: user.progress }));
      });
    }
    return sendJSON(res, 405, err("Metode tidak didukung."));
  }

  sendJSON(res, 404, err("Endpoint tidak ditemukan."));
}

/* ---------- file statis ---------- */
function serveStatic(req, res, pathname) {
  let urlPath = decodeURIComponent(pathname.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const segs = urlPath.split("/").filter(Boolean);
  const hiddenFiles = ["server.js", "package.json", "package-lock.json", "readme.md", "license"];
  const blocked =
    segs.some((s) => s.startsWith(".")) ||
    segs[0] === "data" ||
    segs[0] === "tools" ||
    segs[0] === "node_modules" ||
    hiddenFiles.includes(segs[segs.length - 1].toLowerCase());
  if (blocked) {
    res.writeHead(404, { "Access-Control-Allow-Origin": "*", "Content-Type": "text/plain" });
    return res.end("404 Not Found");
  }

  const filePath = path.join(STATIC_DIR, urlPath);
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
      return res.end("404 Not Found");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

/* ---------- server utama ---------- */
async function startServer() {
  await initStorage();
  http
    .createServer((req, res) => {
      const pathname = (req.url || "/").split("?")[0];
      if (pathname.startsWith("/api/")) {
        handleApi(req, res, pathname);
      } else {
        serveStatic(req, res, pathname);
      }
    })
    .listen(PORT, () => {
      console.log(`🕌 Cordova E-Learn berjalan di http://localhost:${PORT}`);
      console.log(`   Akun terdaftar: ${users.length}`);
    });
}

// Dijalankan langsung (node server.js) ATAU di-require oleh function hosting (Vercel, dll.)
if (require.main === module) {
  startServer().catch((e) => {
    console.error("[db] Gagal menghubungkan database:", e);
    process.exit(1);
  });
}

module.exports = { users, handleApi, serveStatic, initStorage, ok, err, sendJSON, USE_DB };