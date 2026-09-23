/* ============================================================
   Builder BANK SOAL KUIS — generate ~2000+ soal dari data konten
   Jalankan: node tools/build-quiz.js
   - Soal dibangkitkan dari SURAHS (571 ayat), TAJWID, HIJAIYAH, DOAS
   - Deterministik (PRNG berseri) → hasil sama setiap build
   - Setiap soal punya "d": 1 (mudah), 2 (sedang), 3 (sulit)
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "assets", "js", "data.js");

/* ---------- PRNG deterministik ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- pemuat data saat ini ---------- */
function loadData() {
  const src = fs.readFileSync(DATA_PATH, "utf8");
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(src + "\nthis.__out = { SURAHS, TAJWID, HIJAIYAH, DOAS, QUIZ_BANK };", sandbox);
  return sandbox.__out;
}

/* ---------- bantuan umum ---------- */
function norm(s) {
  return String(s || "").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 80);
}
function sim(a, b) {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  let m = 0;
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) if (A[i] === B[i]) m++;
  return m / Math.max(A.length, B.length);
}
const uniq = (arr) => [...new Set(arr)];

/* Bangun {options, answer} dari jawaban benar + kandidat pengecoh.
   Bisa diberi pool tambahan (extra) bila pengecoh primer kurang.
   Return null bila tidak cukup 3 pengecoh valid. */
function buildOpts(rng, correct, distractors, opts = {}) {
  const pools = [distractors, ...(opts.extra ? [opts.extra] : [])];
  const chosen = [];
  for (const pool of pools) {
    const cands = uniq(pool).filter(
      (d) => d !== correct && !chosen.includes(d) && sim(d, correct) < 0.92
    );
    for (let i = cands.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    for (const c of cands) {
      if (chosen.length >= 3) break;
      chosen.push(c);
    }
    if (chosen.length >= 3) break;
  }
  if (chosen.length < 3) return null;
  const optsArr = [correct, ...chosen];
  for (let i = optsArr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [optsArr[i], optsArr[j]] = [optsArr[j], optsArr[i]];
  }
  return { options: optsArr, answer: optsArr.indexOf(correct) };
}

/* ---------- generator ---------- */
function generate(SURAHS, TAJWID, HIJAIYAH, DOAS) {
  const bank = [];
  let id = 1;
  const push = (q, opts, answer, explain, d, ar) =>
    bank.push({ id: id++, q, options: opts, answer, explain, d, ...(ar ? { ar } : {}) });

  const names = SURAHS.map((s) => s.name);
  const meanings = SURAHS.map((s) => s.meaning);
  const counts = uniq(SURAHS.map((s) => s.verses));
  const allTranslations = SURAHS.flatMap((s) => s.ayahs.map((a) => a.i)).filter((t) => norm(t).length >= 8);

  // loop per surah
  SURAHS.forEach((s, si) => {
    const rng = mulberry32(1000 + s.id);

    // 1. nama → arti (d1)
    {
      const o = buildOpts(rng, s.meaning, meanings);
      if (o) push(
        `Apa arti nama surah "${s.name}"?`,
        o.options, o.answer,
        `Surah ${s.name} artinya "${s.meaning}".`,
        1, s.arabicName
      );
    }

    // 2. arti → nama (d1)
    {
      const o = buildOpts(rng, s.name, names);
      if (o) push(
        `Surah manakah yang artinya "${s.meaning}"?`,
        o.options, o.answer,
        `Surah yang bermakna "${s.meaning}" adalah ${s.name}.`,
        1
      );
    }

    // 3. tempat turun (d1)
    {
      const correct = s.revelation;
      const wrong = correct === "Makkiyah"
        ? ["Madaniyah", "Syamiyah", "Yamaniyah"]
        : ["Makkiyah", "Syamiyah", "Yamaniyah"];
      const o = buildOpts(rng, correct, wrong);
      if (o) push(
        `Surah ${s.name} termasuk golongan surah apa?`,
        o.options, o.answer,
        `Surah ${s.name} termasuk surah ${correct}.`,
        1
      );
    }

    // 4. surah sebelum / sesudah (d1)
    if (si > 0) {
      const prev = SURAHS[si - 1].name;
      const o = buildOpts(rng, prev, names.filter((n) => n !== prev));
      if (o) push(
        `Surah yang terletak tepat SEBELUM "${s.name}" dalam urutan mushaf adalah...`,
        o.options, o.answer,
        `Urutan mushaf: ${prev} → ${s.name}.`,
        1
      );
    }
    if (si < SURAHS.length - 1) {
      const next = SURAHS[si + 1].name;
      const o = buildOpts(rng, next, names.filter((n) => n !== next));
      if (o) push(
        `Surah yang terletak tepat SESUDAH "${s.name}" dalam urutan mushaf adalah...`,
        o.options, o.answer,
        `Urutan mushaf: ${s.name} → ${next}.`,
        1
      );
    }

    // 5. jumlah ayat (d2)
    {
      const o = buildOpts(rng, String(s.verses) + " ayat", counts.map((c) => c + " ayat"));
      if (o) push(
        `Berapa jumlah ayat dari surah ${s.name}?`,
        o.options, o.answer,
        `Surah ${s.name} memiliki ${s.verses} ayat.`,
        2
      );
    }

    // 6. nomor surah (d2)
    {
      const nums = Array.from({ length: 114 }, (_, i) => i + 1).map(String);
      const o = buildOpts(rng, String(s.id), nums.filter((n) => n !== String(s.id)));
      if (o) push(
        `Dalam urutan Al-Qur'an, surah ${s.name} adalah surah ke berapa?`,
        o.options, o.answer,
        `Surah ${s.name} menempati urutan ke-${s.id} dalam mushaf Al-Qur'an.`,
        2
      );
    }

    // 7. nomor → nama (d2)
    {
      const o = buildOpts(rng, s.name, names.filter((n) => n !== s.name));
      if (o) push(
        `Surah ke-${s.id} dalam Al-Qur'an adalah surah apa?`,
        o.options, o.answer,
        `Surah ke-${s.id} dalam Al-Qur'an adalah surah ${s.name} (${s.meaning}).`,
        2
      );
    }

    // 8. ayat pertama/kedua → surah (d2/d3)
    [0, 1].forEach((ai, k) => {
      if (!s.ayahs[ai]) return;
      const a = s.ayahs[ai];
      const o = buildOpts(rng, s.name, names.filter((n) => n !== s.name));
      if (o) push(
        `Awal surah berikut (${k === 0 ? "ayat 1" : "ayat 2"}) berasal dari surah mana? “${a.i}”`,
        o.options, o.answer,
        `Potongan ayat itu adalah bagian dari surah ${s.name} (${s.meaning}).`,
        k === 0 ? 2 : 3, a.a
      );
    });

    // 9. terjemahan → surah (d2), untuk semua ayat
    s.ayahs.forEach((ay, j) => {
      const o = buildOpts(rng, s.name, names.filter((n) => n !== s.name));
      if (o) push(
        `Terjemahan berikut merupakan ayat dari surah mana? “${ay.i}”`,
        o.options, o.answer,
        `Terjemahan tersebut adalah ayat ${j + 1} dari surah ${s.name} (${s.meaning}).`,
        2, ay.a
      );
    });

    // 10. pilih terjemahan yang benar (d2)
    s.ayahs.forEach((ay, j) => {
      if (norm(ay.i).length < 8) return;
      const distractors = s.ayahs.map((x) => x.i).filter((x) => x !== ay.i);
      const o = buildOpts(rng, ay.i, distractors, { extra: allTranslations });
      if (o) push(
        `Manakah terjemahan yang PALING TEPAT untuk QS. ${s.name} ayat ${j + 1}?`,
        o.options, o.answer,
        `Terjemahan yang benar untuk QS. ${s.name}:${j + 1} adalah “${ay.i}”.`,
        2, ay.a
      );
    });

    // 11. lanjutan ayat (d3)
    s.ayahs.forEach((ay, j) => {
      const nxt = s.ayahs[j + 1];
      if (!nxt) return;
      const distractors = s.ayahs.map((x) => x.i).filter((x) => x !== nxt.i);
      const o = buildOpts(rng, nxt.i, distractors, { extra: allTranslations });
      if (o) push(
        `Pada QS. ${s.name} ayat ${j + 1}: “${ay.a}” — apa terjemahan ayat SELANJUTNYA?`,
        o.options, o.answer,
        `Lanjutan QS. ${s.name}:${j + 1} (ayat ${j + 2}) berarti “${nxt.i}”.`,
        3, ay.a
      );
    });
  });

  // eksklusif: surah dengan jumlah ayat unik (d3)
  const countOwner = {};
  SURAHS.forEach((s) => {
    (countOwner[s.verses] = countOwner[s.verses] || []).push(s.name);
  });
  Object.entries(countOwner).forEach(([cnt, owners]) => {
    if (owners.length !== 1) return;
    const rng = mulberry32(5000 + Number(cnt));
    const o = buildOpts(rng, owners[0], names.filter((n) => n !== owners[0]));
    if (o) push(
      `Manakah surah yang memiliki ${cnt} ayat?`,
      o.options, o.answer,
      `Surah ${owners[0]} memiliki persis ${cnt} ayat.`,
      3
    );
  });

  // tajwid: deskripsi → nama (d2)
  TAJWID.forEach((t, ti) => {
    const rng = mulberry32(9000 + ti);
    const o = buildOpts(rng, t.name, TAJWID.map((x) => x.name).filter((x) => x !== t.name));
    if (o) push(
      `Hukum bacaan tajwid: "${t.desc}" disebut...`,
      o.options, o.answer,
      `Itu adalah definisi dari ${t.name}.`,
      2
    );
  });
  // tajwid: contoh → nama (d2)
  TAJWID.forEach((t, ti) => {
    const rng = mulberry32(10000 + ti);
    const o = buildOpts(rng, t.name, TAJWID.map((x) => x.name).filter((x) => x !== t.name));
    if (o) push(
      `Contoh bacaan “${t.example.ar}” termasuk hukum tajwid apa?`,
      o.options, o.answer,
      `"${t.example.ar}" (dibaca ${t.example.latin}) adalah contoh ${t.name}.`,
      2, t.example.ar
    );
  });

  // hijaiyah: huruf → cara baca (d1)
  HIJAIYAH.forEach((h, hi) => {
    const rng = mulberry32(11000 + hi);
    const o = buildOpts(rng, h.ex, HIJAIYAH.map((x) => x.ex).filter((x) => x !== h.ex));
    if (o) push(
      `Huruf " ${h.ar} " dibaca bagaimana?`,
      o.options, o.answer,
      `Huruf ${h.ar} bernama ${h.name} dan dibaca "${h.ex}".`,
      1, h.ar
    );
  });
  // hijaiyah: cara baca → huruf (d1), options = huruf arab
  HIJAIYAH.forEach((h, hi) => {
    const pool = HIJAIYAH.filter((x) => x.ar !== h.ar);
    const distract = [];
    const rng = mulberry32(12000 + hi);
    for (let tries = 0; tries < 40 && distract.length < 3; tries++) {
      const c = pool[Math.floor(rng() * pool.length)];
      if (!distract.includes(c.ar)) distract.push(c.ar);
    }
    if (distract.length === 3) push(
      `Manakah huruf yang dibaca "${h.ex}"?`,
      [h.ar, ...distract],
      0,
      `Huruf ${h.ar} adalah ${h.name}, dibaca "${h.ex}".`,
      1,
      h.ar
    );
  });

  // doa: terjemahan → tujuan (d1)
  DOAS.forEach((ddoa, di) => {
    const rng = mulberry32(13000 + di);
    const o = buildOpts(
      rng,
      ddoa.name,
      DOAS.map((x) => x.name).filter((x) => x !== ddoa.name)
    );
    if (o) push(
      `Doa dengan arti " ${ddoa.id} " adalah doa yang dibaca untuk...`,
      o.options, o.answer,
      `Itu adalah ${ddoa.name}.`,
      1
    );
  });
  // doa: latin → nama (d2)
  DOAS.forEach((ddoa, di) => {
    const rng = mulberry32(14000 + di);
    const o = buildOpts(rng, ddoa.name, DOAS.map((x) => x.name).filter((x) => x !== ddoa.name));
    if (o) push(
      `" ${ddoa.lat} " adalah bacaan dari doa yang mana?`,
      o.options, o.answer,
      `Itu adalah bacaan dari ${ddoa.name}.`,
      2
    );
  });

  // soal umum (d1)
  const generics = [
    ["Berapa jumlah surah dalam Al-Qur'an?", ["114 surah", "110 surah", "100 surah", "120 surah"], 0, "Al-Qur'an terdiri dari 114 surah.", 1],
    ["Berapa jumlah juz dalam Al-Qur'an?", ["30 juz", "29 juz", "25 juz", "35 juz"], 0, "Al-Qur'an dibagi menjadi 30 juz.", 1],
    ["Surah pertama dalam Al-Qur'an adalah...", ["Al-Fatihah", "An-Nas", "Al-Baqarah", "An-Naba'"], 0, "Surah pertama adalah Al-Fatihah (pembuka).", 1],
    ["Surah terakhir dalam Al-Qur'an adalah...", ["An-Nas", "Al-Falaq", "Al-Ikhlas", "An-Naba'"], 0, "Surah terakhir adalah An-Nas.", 1],
    ["Al-Qur'an diturunkan kepada Nabi...", ["Muhammad ﷺ", "Musa", "Isa", "Ibrahim"], 0, "Al-Qur'an diturunkan kepada Nabi Muhammad ﷺ.", 1],
    ["Membaca Al-Qur'an termasuk perbuatan yang...", ["Mendapat pahala", "Biasa saja", "Tidak bernilai", "Hanya untuk tua"], 0, "Membaca Al-Qur'an bernilai ibadah dan pahala.", 1],
    ["Apa arti Al-Qur'an?", ["Bacaan", "Kitab", "Tulisan", "Hafalan"], 0, "Al-Qur'an berarti bacaan atau yang dibaca.", 1],
    ["Sebelum membaca Al-Qur'an, disunahkan mengucapkan...", ["Bismillah / ta'awudz", "Alhamdulillah", "Subhanallah", "Allahu akbar"], 0, "Dianjurkan membaca ta'awudz (a'udzu billah) kemudian bismillah.", 1],
    ["Surah Al-Falaq dan An-Nas sering disebut...", ["Al-Mu'awwidzatain", "Al-Mulk", "As-Sajdah", "At-Takwir"], 0, "Al-Falaq dan An-Nas disebut Al-Mu'awwidzatain (dua surah perlindungan).", 1],
    ["Membaca Al-Qur'an disarankan dengan...", ["Tartil (perlahan & benar)", "Terburu-buru", "Tanpa arti", "Sepotong-potong seenaknya"], 0, "Allah memerintahkan membaca Al-Qur'an secara tartil.", 1],
    ["Huruf hijaiyah berjumlah...", ["29 huruf", "26 huruf", "30 huruf", "28 huruf"], 0, "Huruf hijaiyah berjumlah 29.", 1],
    ["Surah An-Naba' berada di juz...", ["30 (Juz 'Amma)", "1", "15", "28"], 0, "An-Naba' adalah surah pertama dalam Juz 30.", 1],
    ["Arti nama Juz 30 adalah...", ["Juz 'Amma (dari kata 'amma)", "Juz Tabarak", "Juz Qad Sami'a", "Juz Wal Mulk"], 0, "Juz 30 disebut Juz 'Amma dari awal surahnya: 'Amma yatasa'alun.", 1],
    ["Ayat sujud tilawah ketika membaca ayat sajdah disunahkan...", ["Sujud", "Diam saja", "Tertawa", "Makan"], 0, "Bila bertemu ayat sajdah, disunahkan sujud tilawah.", 1],
    ["Urutan berhenti yang benar saat membaca adalah...", ["Waqaf yang benar sesuai arti", "Asal berhenti", "Sembarangan", "Selalu berhenti di tengah"], 0, "Berhenti (waqaf) sebaiknya pada tempat yang benar agar makna terjaga.", 1]
  ];
  generics.forEach(([q, options, answer, explain, d], gi) => {
    push(q, options, answer, explain, d);
  });

  return bank;
}

/* ---------- penyatuan dengan bank lama ---------- */
function mergeBanks(oldBank, newBank) {
  const seen = new Set();
  const out = [];
  newBank.forEach((qb) => {
    const key = norm(qb.q);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(qb);
  });
  (oldBank || []).forEach((qb) => {
    const key = norm(qb.q);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...qb, d: qb.d || 2 });
  });
  out.forEach((qb, i) => {
    qb.id = i + 1; // penomoran ulang agar id selalu unik
  });
  return out;
}

/* ---------- tulis data.js ---------- */
function writeData(oldData, newBank) {
  const header = `/* ============================================================
   TAZKIAH E-LEARNING — Data Konten
   Dibangun otomatis dari equran.id (node tools/build-data.js)
   & generator bank soal (node tools/build-quiz.js)
   ============================================================ */\n\n`;
  const parts = [
    header,
    "/* ---------------- SURAH JUZ 30 ('AMMA) + AL-FATIHAH ---------------- */",
    "/* a = teks arab, t = transliterasi latin, i = terjemahan Indonesia */",
    "const SURAHS = " + JSON.stringify(oldData.SURAHS, null, 2) + ";\n",
    "/* ---------------- TAJWID ---------------- */",
    "const TAJWID = " + JSON.stringify(oldData.TAJWID, null, 2) + ";\n",
    "/* ---------------- HIJAIYAH ---------------- */",
    "const HIJAIYAH = " + JSON.stringify(oldData.HIJAIYAH, null, 2) + ";\n",
    "/* ---------------- DOA HARIAN ---------------- */",
    "const DOAS = " + JSON.stringify(oldData.DOAS, null, 2) + ";\n",
    "/* ---------------- BANK SOAL KUIS ---------------- */",
    "/* d: 1 mudah, 2 sedang, 3 sulit — dipilih bertahap sesuai frekuensi latihan */",
    "const QUIZ_BANK = " + JSON.stringify(newBank) + ";\n"
  ];
  fs.writeFileSync(DATA_PATH, parts.join("\n"), "utf8");
}

/* ---------- utama ---------- */
const oldData = loadData();
const raw = generate(oldData.SURAHS, oldData.TAJWID, oldData.HIJAIYAH, oldData.DOAS);
const bank = mergeBanks(oldData.QUIZ_BANK || [], raw);

// statistik
const byD = { 1: 0, 2: 0, 3: 0 };
bank.forEach((qb) => (byD[qb.d || 2] = (byD[qb.d || 2] || 0) + 1));
const broken = bank.filter((qb) => !qb.q || !Array.isArray(qb.options) || qb.options.length < 4 || qb.answer < 0 || qb.answer >= qb.options.length || !qb.explain);
const dupOpts = bank.filter((qb) => Array.from(new Set(qb.options)).length !== qb.options.length);
const emptyOpt = bank.filter((qb) => qb.options.some((o) => !String(o).trim()));

console.log(`Soal dibangkitkan: ${raw.length}`);
console.log(`Setelah digabung bank lama + dedupe: ${bank.length}`);
console.log(`Distribusi kesulitan: mudah=${byD[1]}, sedang=${byD[2]}, sulit=${byD[3]}`);
console.log("Soal rusak (tanpa q/opsi/answer/explain):", broken.length);
console.log("Soal dengan opsi ganda:", dupOpts.length);
console.log("Soal dengan opsi kosong:", emptyOpt.length);
if (bank.length < 2000) throw new Error("Target 2000 soal tidak tercapai!");
if (broken.length || dupOpts.length || emptyOpt.length) throw new Error("Ada soal bermasalah!");

writeData(oldData, bank);
console.log("Tersimpan:", DATA_PATH, `(${(fs.statSync(DATA_PATH).size / 1024 / 1024).toFixed(2)} MB)`);