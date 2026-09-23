/* ============================================================
   Builder data surah — tarik dari equran.id API lalu tulis data.js
   Jalankan: node tools/build-data.js
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "assets", "js", "data.js");
const TMP = path.join(process.env.TEMP || "/tmp", "opencode", "_old_data.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "tazkiah-elearning-builder" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      if (i === tries) throw e;
      await sleep(1200 * i);
    }
  }
}

function revelation(tempat) {
  const s = String(tempat || "").toLowerCase();
  return s.includes("mek") ? "Makkiyah" : "Madaniyah";
}

async function fetchSurah(n) {
  const j = await fetchJson(`https://equran.id/api/v2/surat/${n}`);
  const s = j.data || j;
  if (!s || !Array.isArray(s.ayat)) throw new Error("Respon tidak valid untuk surah " + n);
  const ayahs = s.ayat.map((a) => ({
    a: String(a.teksArab || "").trim(),
    t: String(a.teksLatin || "").trim(),
    i: String(a.teksIndonesia || "").trim()
  }));
  return {
    id: Number(s.nomor),
    name: String(s.namaLatin || "").trim(),
    arabicName: String(s.nama || "").trim(),
    meaning: String(s.arti || "").trim(),
    revelation: revelation(s.tempatTurun),
    verses: Number(s.jumlahAyat) || ayahs.length,
    ayahs
  };
}

async function main() {
  console.log("Membaca data lama (tajwid/hijaiyah/doa/kuis)...");
  const oldSrc = fs.readFileSync(DATA_PATH, "utf8") +
    "\nmodule.exports = { TAJWID, HIJAIYAH, DOAS, QUIZ_BANK };";
  fs.mkdirSync(path.dirname(TMP), { recursive: true });
  fs.writeFileSync(TMP, oldSrc);
  const old = require(TMP);

  const numbers = [1, ...Array.from({ length: 114 - 78 + 1 }, (_, i) => 78 + i)];
  const surahs = [];
  for (const n of numbers) {
    process.stdout.write(`  ${n}/114 ...`);
    try {
      const s = await fetchSurah(n);
      if (s.ayahs.length !== s.verses) {
        console.log(` PERINGATAN: jumlah ayat ${s.ayahs.length} != ${s.verses}`);
      }
      surahs.push(s);
      console.log(" OK");
    } catch (e) {
      console.log(" GAGAL: " + e.message);
      process.exit(1);
    }
    await sleep(120);
  }

  // validasi
  const emptyLatin = [];
  const emptyIndo = [];
  const emptyAr = [];
  let totalAyah = 0;
  for (const s of surahs) {
    totalAyah += s.ayahs.length;
    s.ayahs.forEach((a, i) => {
      if (!a.a) emptyAr.push(`${s.id}:${i + 1}`);
      if (!a.t) emptyLatin.push(`${s.id}:${i + 1}`);
      if (!a.i) emptyIndo.push(`${s.id}:${i + 1}`);
    });
  }
  console.log(`\nTotal surah: ${surahs.length}, total ayat: ${totalAyah}`);
  console.log("Teks arab kosong:", emptyAr.length ? emptyAr.join(", ") : "tidak ada");
  console.log("Latin kosong:", emptyLatin.length ? emptyLatin.join(", ") : "tidak ada");
  console.log("Terjemahan kosong:", emptyIndo.length ? emptyIndo.join(", ") : "tidak ada");

  // serialisasi
  const header = `/* ============================================================
   TAZKIAH E-LEARNING — Data Konten
   Dibangun otomatis dari equran.id (node tools/build-data.js)
   ============================================================ */\n\n`;
  const parts = [
    header,
    "/* ---------------- SURAH JUZ 30 ('AMMA) + AL-FATIHAH ---------------- */",
    "/* a = teks arab, t = transliterasi latin, i = terjemahan Indonesia */",
    "const SURAHS = " + JSON.stringify(surahs, null, 2) + ";\n",
    "/* ---------------- TAJWID ---------------- */",
    "const TAJWID = " + JSON.stringify(old.TAJWID, null, 2) + ";\n",
    "/* ---------------- HIJAIYAH ---------------- */",
    "const HIJAIYAH = " + JSON.stringify(old.HIJAIYAH, null, 2) + ";\n",
    "/* ---------------- DOA HARIAN ---------------- */",
    "const DOAS = " + JSON.stringify(old.DOAS, null, 2) + ";\n",
    "/* ---------------- BANK SOAL KUIS ---------------- */",
    "const QUIZ_BANK = " + JSON.stringify(old.QUIZ_BANK, null, 2) + ";\n"
  ];

  fs.writeFileSync(DATA_PATH, parts.join("\n"), "utf8");
  console.log("\nTersimpan:", DATA_PATH, `(${fs.statSync(DATA_PATH).size} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});