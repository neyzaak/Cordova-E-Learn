# 🕌 Cordova E-Learn

Website pembelajaran Al-Qur'an interaktif dengan UI modern dan menarik, dirancang khusus untuk **pelajar SMP**.

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| 📖 **Baca Surah** | **38 surah** (571 ayat): Al-Fatihah + seluruh **37 surah Juz 30** (An-Naba' 78 s.d. An-Nas 114) dengan teks Arab, transliterasi latin, dan terjemahan per ayat. Ada pemutar **murottal** online (butuh internet). |
| 🎯 **Mode Hafalan** | Toggle untuk menyembunyikan arti & latin, lalu tandai surah saat sudah hafal (dapat +5 poin). |
| ✨ **Belajar Tajwid** | 14 aturan tajwid dengan contoh bacaan lengkap. |
| 🔤 **Hijaiyah** | 29 huruf Arab dengan cara baca. |
| 🤲 **Doa Harian** | 10 doa pendek sehari-hari: sebelum makan, tidur, belajar, masuk masjid, untuk orang tua, dll. |
| 🧠 **Kuis Seru** | 10 soal pilihan ganda dari bank **2.000+ soal** (dibangkitkan otomatis dari 571 ayat + tajwid + hijaiyah + doa), lengkap dengan pembahasan dan skor (maks 100 poin). |
| 📈 **Kesulitan Bertahap** | Tingkat kesulitan **naik perlahan** sesuai frekuensi latihan: Pemula → Lancar → Mahir → Juara. Soal kuis terakhir tidak langsung diulang. |
| 🌟 **Progres & Poin** | Sistem poin, simpanan favorit, dan progres belajar tersimpan dengan **akun murid** (per siswa). |
| 🔐 **Akun Murid** | Setiap murid punya username & password sendiri. Progres disimpan di server per akun → **tidak ada data tertukar antar murid**, bisa diakses dari perangkat mana pun, dan tetap aman di komputer bersama. |
| 🏆 **Klasemen** | Peringkat siswa otomatis dari poin di server: podium 3 besar + daftar lengkap. Setiap akun **baru dimulai dari 0 poin** agar adil & memotivasi. |
| 👨‍🏫 **Laporan Guru** | Halaman khusus (`guru.html`) dengan kata sandi guru: statistik kelas, tabel progres tiap murid (poin, hafalan + daftar surah, skor kuis, akurasi, jumlah soal, kuis selesai, terakhir aktif) + **unduh CSV**. |
| 🎉 **Confetti** | Efek confetti saat jawaban kuis bagus atau berhasil menghafal surah. |

## 🚀 Cara Menjalankan

**Cara 1 — Langsung buka**
Buka file `public/index.html` di browser (klik dua kali). Semua fitur berjalan offline, kecuali pemutar murottal.

**Cara 2 — Server lokal (disarankan)**
```bash
node server.js
```
Lalu buka `http://localhost:8710`.

**Cara 3 — Cloud (agar bisa diakses dari mana saja)**
Server statis tanpa database (`data/users.json`) **tidak cocok** untuk hosting cloud karena disk-nya
disetel ulang saat instance tidur (akun & progres bisa hilang). Solusinya pasang **PostgreSQL gratis**
(disarankan [Neon](https://neon.tech) atau [Supabase](https://supabase.com)), lalu setel variabel env:

```bash
npm install          # sekali saja, untuk mendukung mode database
DATABASE_URL=postgresql://...node server.js
```
- Kalau `DATABASE_URL` **tidak diisi** → server memakai file `data/users.json` seperti biasa (tanpa perlu `npm install`).
- Kalau diisi → akun & progres tersimpan di PostgreSQL (awet), dan jika DB masih kosong server otomatis
  mengimpor akun lama dari `data/users.json` sekali.
- Contoh deploy gratis **tanpa kartu kredit**:
  - **Vercel** (paling cepat): frontend di-hosting dari folder `public/`, API `/api/*`
    jadi serverless function (file `api/[...slug].js`) — isi env `DATABASE_URL` dan
    `GURU_PASSWORD` sekali (`vercel env add`), lalu `vercel deploy --prod`.
  - **Koyeb** (web service Node klasik dari repo GitHub, build via `Dockerfile`, start
    otomatis `node server.js`) + **Neon** (PostgreSQL gratis) — isi variabel
    `DATABASE_URL` dan `GURU_PASSWORD` di dashboard Koyeb.
  - Cadangan: Render (terkadang minta kartu kredit saat verifikasi akun).

**Agar setiap murid punya data sendiri:** semua perangkat (HP/komputer) di Wi-Fi atau jaringan yang sama
bisa membuka server dari laptop guru: `http://IP-laptop:8710` (contoh: `http://15.22.33.128:8710`).
Murid cukup **Daftar** sekali (username + password), lalu **Masuk** — progres tersimpan otomatis di
`data/users.json` di server. Ganti PC / HP / browser mana pun, data tetap ikut akunnya.

> 💡 Buka `public/index.html` langsung tanpa server = **mode lokal**: data hanya tersimpan di perangkat itu.

## 🔐 Akun Murid (login/daftar)

| Endpoint API | Fungsi |
|---|---|
| `GET /api/ping` | Cek server online |
| `POST /api/register` | Daftar `{username, nama, password}` → `{token}` |
| `POST /api/login` | Masuk `{username, password}` → `{token}` |
| `GET /api/progress` | Ambil progres murid (perlu token) |
| `PUT /api/progress` | Simpan progres `{progress: {points, saved, memorized, bestQuiz, answeredQuiz, totalAnswered, totalCorrect, quizCount, lastActive}}` |
| `GET /api/leaderboard` | Klasemen kelas (urut poin, tanpa perlu login; hanya nama & skor, tanpa data sensitif) |
| `POST /api/guru/login` | Login guru `{password}` → `{token}` |
| `GET /api/guru/students` | Laporan semua murid (auth guru): poin, hafalan, skor, akurasi, dsb. |

- Password di-hash (scrypt) — tidak pernah disimpan dalam bentuk asli.
- Token sesi per perangkat; keluar dari satu perangkat tidak memengaruhi yang lain (perlu login ulang di sana).
- File `data/users.json` **tidak** bisa diakses publik (diblokir server).

## 👨‍🏫 Laporan Guru

Buka `http://IP-laptop:8710/guru.html` di browser Anda (laptop guru). Halaman ini TIDAK ditautkan dari aplikasi murid agar siswa tidak melihat pintu masuk laporan.

- Kata sandi bawaan: **`guru123`**. Ganti saat menjalankan server:
  ```bash
  GURU_PASSWORD=rahasia_baru node server.js
  ```
  (di Windows: `set GURU_PASSWORD=rahasia_baru` lalu `node server.js`)
- Isi laporan: ringkasan kelas (jumlah murid, total poin, rata-rata, hafalan, kuis, soal), tabel per murid
  (poin, jumlah + daftar surah dihafal, skor kuis terbaik, akurasi benar/soal, jumlah kuis, terakhir aktif),
  pencarian & pengurutan, plus tombol **📥 Unduh CSV** untuk dibuka di Excel.
- Sesi guru hilang saat server dimulai ulang — guru perlu login ulang (tinggal ketik password).

## 📁 Struktur

```
├── public/                  # Seluruh halaman & asset situs (di-host Vercel / layanan statis)
│   ├── index.html           # Halaman utama (single page app)
│   ├── guru.html            # Laporan progres murid (khusus guru)
│   └── assets/
│       ├── css/style.css    # Desain & animasi
│       └── js/
│           ├── data.js      # Konten: surah, tajwid, hijaiyah, doa, bank soal (2159)
│           ├── auth.js      # Akun murid & sinkronisasi ke server
│           ├── guru.js      # Logika halaman laporan guru
│           └── app.js       # Logika aplikasi
├── api/[...slug].js         # Vercel Function: semua /api/* → handler server.js
├── data/users.json          # Data murid (dibuat otomatis oleh server, mode file)
├── tools/
│   ├── build-data.js        # Generator data surah (dari equran.id API)
│   └── build-quiz.js        # Generator bank soal 2000+ (dari konten data.js)
└── server.js                # Server statis + API akun murid & guru (port 8710)
```

## 🛠 Teknologi

HTML5 + CSS3 + JavaScript murni (tanpa framework). Font: Plus Jakarta Sans & Amiri (via Google Fonts, dengan fallback sistem). Progres pengguna tersimpan per akun di server (`data/users.json`), dengan cadangan `localStorage` untuk mode lokal. Konten surah bersumber dari [equran.id](https://equran.id) (teks Arab, transliterasi latin Indonesia, dan terjemahan Kemenag) — regenerate kapan saja dengan `node tools/build-data.js`. Bank soal dihasilkan otomatis dari konten dengan `node tools/build-quiz.js` (deterministik, ~2.159 soal, level 1–3).

---
Dibuat dengan 💚 untuk pelajar hebat Indonesia.