# Kantor Raffa — Interactive 3D AI Office & Mission Control

## Ringkasan Proyek
- **Nama:** Kantor Raffa (`kantor-raffa`), kantor virtual 3D untuk melihat tim AI spesialis.
- **Manfaat:** Memantau peran karyawan dan alur kerja dari satu tampilan.
- **Kegunaan saat ini:** Demo interaktif alur Jira/Figma. Tahap engineering pada pipeline adalah simulasi; endpoint workspace dapat memeriksa repositori lokal dan menjalankan perintah Git tertentu.
- **Tujuan:** Menambah bot karyawan untuk pekerjaan spesialis, termasuk otomasi bisnis.

### Bot paper-only
Tiga bot ditambahkan ke kantor dan tersedia dari meja masing-masing. Feed harga hanya bersifat read-only; seluruh saldo, entri, posisi, dan hasil adalah simulasi lokal. Tidak ada jaminan profit.

| Bot | Feed | Batasan |
|---|---|---|
| **Meteora LP** | Pool DLMM dan candle 5 menit dari API publik | Ranking read-only; saldo paper tetap tidak teralokasi karena metrik pool bukan hasil bin-range/IL pengguna. |
| **Prediction Market** | Pasar Polymarket crypto Up/Down dengan jendela tepat 300 detik | Entri manual paper; settlement dari outcome resolved; strategi GitHub dinonaktifkan sampai repo diberikan, ditinjau, dan dipin. |
| **XAUUSD EA** | Data market resmi Exness jika akun memiliki akses | Baseline eksperimental paper M5 EMA/ATR, dengan batas risiko dan tanpa endpoint order. Feed unavailable jika akses/kredensial tak ada. |

### Operasional bot
1. Jalankan `yarn dev` dan buka alamat localhost yang dicetak server; klik meja bot di kantor untuk membuka Trading Bots.
2. Feed Meteora/Polymarket publik diperoleh server-side. Bila feed kosong/gagal, UI menampilkan status kosong/stale; harga tidak dibuat-buat.
3. Untuk Exness, isi `EXN_API_KEY`, `EXN_PRIVATE_KEY`, `EXN_ACCOUNT_ID`, dan `EXN_API_BASE_URL` di `.env.local` dari setup resmi account API access point. Route ini hanya untuk server lokal terpercaya; aplikasi tidak memiliki autentikasi dan tidak boleh dipublikasikan dengan kredensial aktif.
4. Kredensial Exness dipakai read-only untuk instrumen, conditions, histori candle, dan tick; tidak pernah untuk order. Tanpa API key/akses yang memenuhi syarat, XAUUSD tampil unavailable. Jangan menaruh nilai rahasia di README, log, Git, chat, atau screenshot.
5. Ledger paper tersimpan di localStorage browser (`kantor-raffa.paper-bots.v1`); data rusak membutuhkan reset eksplisit. Semua tindakan simulasi offline dari endpoint provider dan tidak mengirim order nyata.
6. Jalankan assertion offline dengan `yarn test:paper-bots`; tes gerak kantor: `yarn test:movement`.

---

## 🤖 Mengenal 6 AI Agent (Karyawan Kantor Raffa)

Enam karyawan berikut mewakili peran dalam demo interaktif. Tahap engineering adalah simulasi, bukan pembuatan kode, pengujian, atau rilis otonom:

| Karyawan | Foto & Nama Lengkap | Posisi & Peran | Tugas Utama (Ringkas & Jelas) |
|---|---|---|---|
| **Khansaku** | ![Khansaku](/public/agents/khansaku.jpg) <br> **Khansaku Anindita** `EMP-001` (ID internal `tara`) | **Corporate Secretary & Permaisuri** | Mendampingi Raffa, merangkum informasi, dan membantu koordinasi kantor. |
| **Arga** | ![Arga](/public/agents/arga.jpg) <br> **Arga Pratama** `EMP-002` | **Lead Architect** | Simulasi pemetaan struktur dan dependency proyek. |
| **Jajang** | ![Jajang](/public/agents/jajang.jpg) <br> **Jajang Sasmita** `EMP-003` | **Senior Frontend Dev** | Simulasi slicing Figma dan implementasi antarmuka. |
| **Kian** | ![Kian](/public/agents/kian.jpg) <br> **Kian Wardhana** `EMP-004` | **Senior Backend Specialist** | Simulasi perancangan database dan API. |
| **Vani** | ![Vani](/public/agents/vani.jpg) <br> **Vani Maharani** `EMP-005` | **QA Sentinel & Guardian** | Simulasi pemeriksaan kualitas dan hasil pengujian. |
| **Reno** | ![Reno](/public/agents/reno.jpg) <br> **Reno Alamsyah** `EMP-006` | **DevOps Dispatcher** | Simulasi tahapan deployment dan pelaporan. |

> 👑 **Raffa Yahfazhka (The Boss / CEO)**: Komandan utama kantor yang mengarahkan task backlog Jira, memilih folder proyek, memantau simulasi terminal, dan mendengarkan YouTube Music sambil bekerja.

---

## 🔄 Bagaimana Cara Kerjanya? (Simulasi Interaktif)

1. **Raffa Memilih Folder & Tiket**:
   Raffa membuka **Mission Control** (`J`), memilih folder proyek lokal lewat `SelectField`, dan sistem secara otomatis memvalidasi apakah branch aktif adalah **`dev`** atau **`development`**.
2. **Khansaku (Corporate Secretary & Permaisuri, ID internal `tara`)** mendampingi koordinasi tiket.
3. **Arga (Architect)** menyimulasikan pemetaan arsitektur.
4. **Jajang (Frontend) / Kian (Backend)** menampilkan simulasi implementasi dan slicing Figma.
5. **Vani (QA)** menampilkan simulasi hasil test suite dan pixel diff; tidak menjalankan pengujian nyata.
6. **Reno (DevOps)** menampilkan simulasi rilis; bukan commit, push, atau deployment otonom.

---

## ✨ Fitur-Fitur Terbaru (Update v2.5)

- 🪪 **Kartu Identitas Karyawan AI**: Modal direktori tim lengkap dengan foto profil photorealistic hasil generate AI, badge ID, departemen, dan keahlian masing-masing.
- 📁 **Target Folder Selector & Branch Dev Detection**:
  - `SelectField` untuk memilih folder lokal di komputer.
  - Memeriksa keabsahan repositori Git dan branch aktif.
  - Notifikasi otomatis jika branch belum beralih ke `dev` atau `development`, lengkap dengan tombol instan *checkout ke dev*.
- 🎵 **YouTube Music Player (58 Lagu Playlist Akun Raffa)**:
  - Floating player di sudut kiri bawah dengan animasi piringan hitam (*vinyl spin*).
  - Modal playlist berisi 58 lagu favorit dari playlist akun YouTube Music Raffa.
  - Fitur pencarian cepat lagu dan opsi memasukkan link YouTube kustom.
- ☀️🌙 **Dual Theme (Mode Terang & Gelap)**: Tampilan studio modern responsif di seluruh layar komputer, tablet, maupun mobile.
- ⚡ **Struktur Folder Modular & Ringan**:
  - Komponen dipisahkan secara rapi ke `src/components/ui/Button`, `Container`, `SelectField`, `Modal`, `Navbar`, dll.
  - Rute API terdedikasi di `src/app/api/repo/local-inspect` dan `src/app/api/jira/tickets`.

---

## 🎮 Kontrol Pergerakan & Shortcut

| Tombol | Fungsi |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> atau Panah | Menggerakkan Raffa menjelajahi kantor (anti-inverted) |
| <kbd>Shift</kbd> | Berlari cepat (*Sprint*) |
| **Drag Mouse (Klik & Geser)** | Menggeser sudut pandang kamera 3D |
| **Klik Meja / Karakter** | Membuka meja kerja spesifik karyawan AI |
| <kbd>E</kbd> | Berbicara dengan karyawan AI terdekat |
| <kbd>F</kbd> | Buka workspace Slicing Figma (Jajang) |
| <kbd>J</kbd> | Buka Mission Control (Jira & Folder Picker) |
| <kbd>T</kbd> | Buka / Tutup Terminal Output & Git Diff Drawer |
| <kbd>P</kbd> / <kbd>M</kbd> | Play/Pause & Mute YouTube Music |
| <kbd>C</kbd> | Reset kamera kembali ke Raffa |
| <kbd>Esc</kbd> | Menutup modal yang sedang terbuka |

---

## 🚀 Cara Menjalankan Proyek

Pastikan Node.js dan Yarn sudah terpasang di komputer:

```bash
# 1. Jalankan development server
yarn dev

# 2. Buka di browser
# http://localhost:3000 (atau port yang tertera)
```

Untuk build produksi:
```bash
yarn build && yarn start
```

---

## 🔐 Lokal-Only & Higiene Rahasia
- **Lokal-only:** aplikasi dijalankan di komputer sendiri (`yarn dev` → `http://localhost:3000`). Tidak ada server produksi, telemetry, atau pengiriman data proyek ke pihak ketiga. Akses repositori lokal, Jira, dan chat Khansa hanya lewat route API lokal: `/api/repo/local-inspect`, `/api/jira/tickets`, `/api/khansa/chat`.
- **Rahasia tersimpan di `.env.local`** (di-`.gitignore` lewat pola `.env*.local`, jadi tidak ikut ter-commit). Nama kunci yang dipakai aplikasi:
  - `JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_API_TOKEN` — akses Jira Cloud.
  - `GEMINI_API_KEY` — chat Khansa.
- **Aturan higiene:**
  - Jangan menuliskan nilai rahasia di README, commit, issue, screenshot, atau chat.
  - Jangan pernah commit `.env.local`; cukup simpan di mesin lokal.
  - Ganti (rotate) kunci jika diduga bocor, lalu perbarui `.env.local`.
  - Jangan menambahkan kunci bursa atau kredensial dana nyata (Meteora/Polymarket/Exness) selama bot masih paper-only.
