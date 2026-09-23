/* ============================================================
   Vercel Function — catch-all /api/*
   Semua panggilan API diarahkan ke handler server.js yang sama
   dengan mode server lokal, lalu memakai DATABASE_URL (Neon)
   sebagai penyimpanan cloud. Statis (index.html, guru.html, assets)
   dilayani Vercel dari folder public/.
   ============================================================ */
"use strict";

const server = require("../server.js");

// initStorage() cukup sekali per instance hangat (module scope).
let initPromise = null;
function ensureInit() {
  if (!initPromise) {
    initPromise = server
      .initStorage()
      .then(() => true)
      .catch((e) => {
        console.error("[vercel] gagal init storage:", e && e.message);
        initPromise = null; // coba lagi pada permintaan berikutnya
        throw e;
      });
  }
  return initPromise;
}

module.exports = async function handler(req, res) {
  try {
    await ensureInit();
    const pathname = (req.url || "/api/").split("?")[0];
    server.handleApi(req, res, pathname);
  } catch (e) {
    console.error("[vercel] handler error:", e && e.stack);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "Server sedang sibuk. Coba lagi sebentar." }));
    }
  }
};

module.exports.default = module.exports;