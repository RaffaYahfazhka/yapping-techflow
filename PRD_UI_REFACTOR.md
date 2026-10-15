# PRD: Refactor Total UI/UX 2D & Visual Assets — Material Tailwind Design System & AI Isometric Sprites

## 1. Overview & Problem Statement
Platform Yapping Techflow saat ini menghadapi dua tantangan utama:
1. **Layout 2D yang Tidak Konsisten ("Dempet-dempetan" & "Nabrak-nabrak")**: Inkonsistensi posisi fixed antara Top Navbar, Bottom Dock, Mini Music Player, serta sistem modal/dialog/card yang terhimpit pada berbagai ukuran layar.
2. **Visual Elemen Lingkungan & Karakter yang Perlu Peningkatan Estetika & Realisme**: Elemen perabot, furnitur apartemen/penthouse, dekorasi kantor, dan karakter 3D/2.5D saat ini memerlukan aset visual yang lebih hidup, kohesif, dan realistis seperti nuansa luxury suite/apartemen modern.

Untuk menyelesaikan ini, seluruh antarmuka 2D akan distandarisasi menggunakan fondasi arsitektur **[Material Tailwind](https://www.material-tailwind.com/)** (desain sistem Tailwind CSS berbasis Material Design 3 dengan ripples, elevated glassmorphism, responsive dialogs, dan floating navigation bars), dipadukan dengan aset furnitur apartemen realistis hasil **AI Asset Generation**.

---

## 2. Goals & Non-Goals

### Goals
1. **Material Tailwind Component System**:
   - Menerapkan pola dan komponen resmi dari **Material Tailwind (`https://www.material-tailwind.com/`)**:
     - **Navbar**: Floating sticky responsive navbar dengan typography hierarchy yang rapi.
     - **Dialog / Modal**: Menggunakan arsitektur `Dialog`, `DialogHeader`, `DialogBody`, dan `DialogFooter` dengan scrollable view terisolasi dan backdrop blur.
     - **Button & IconButton**: Ripple effects, elevated shadows, pills, dan ukuran seragam (`sm`, `md`, `lg`).
     - **Card & Avatar**: Card ber-elevasi halus dengan border glassmorphism modern untuk direktori tim dan profil karyawan.
     - **Chip / Badge**: Badge status online, live feed, dan chip filter departemen.
2. **Zero Collision Layout (Anti Nabrak)**: Menetapkan safe zones layar yang ketat untuk Navbar, Bottom Dock, Floating Widgets (Music Player, Minimap), dan Modal System.
3. **AI-Generated Realistic Penthouse Visuals (Apartemen/Suite)**:
   - Membuat aset gambar/tekstur visual realistis (meja eksekutif, lounge sofa teras, bar pantry espresso, tanaman indoor, arcade, meja meeting, dan karakter karyawan) menggunakan image generation AI.
   - Mengubah aset visual ke dalam format PNG transparan / SVG resolusi tinggi yang teroptimasi.
   - Mengintegrasikan aset visual tersebut ke dalam sistem texture/sprite atau billboard/canvas 3D tanpa merusak physics, collision, atau koordinat navigasi yang sudah presisi.
4. **Preservasi Logika Navigasi & Karakter**:
   - Mempertahankan alur logika pergerakan (`autonomous social engine`, `waypoint slots`, `collision avoidance`, `follow Raffa`).
   - Sprite/model baru cukup ditempelkan (*drop-in replacement*) ke entitas koordinat yang ada.
5. **Pembersihan Styling Warisan**:
   - Menghapus styling legacy di `globals.css` yang bertabrakan dengan utility classes Tailwind dan token Material Tailwind.

### Non-Goals
- Tidak merusak sistem state management finansial/trading (`PredictionBotProvider`, orderbook, balance).
- Tidak merusak endpoint API backend (`/api/jira/tickets`, `/api/markets/*`, `/api/khansa/chat`).
- Tidak mengubah aturan collision logic matematis yang sudah mencegah karakter saling bertubrukan di ruang 3D.

---

## 3. UI Layer Architecture & Screen Layout Map

```
+-------------------------------------------------------------------------------+
| TOP SAFE AREA: Navbar (Material Tailwind Floating Bar, Fixed top-3, z-40)    |
| [Logo + Title]        [Live Indicators Chip]        [Action Buttons + Theme]  |
+-------------------------------------------------------------------------------+
| FLOATING WIDGETS (z-30 / z-40):                                               |
| - Top-Right: Minimap Radar HUD (top-20 right-4)                               |
| - Top-Right: Notification Toasts (top-24 right-4, stack-down)                 |
|                                                                               |
|              3D / 2.5D LUXURY APARTMENT SUITE CANVAS VIEWPORT                 |
|   (Realistic AI-Generated Penthouse Furniture, Decor & Stylized Characters)  |
|                                                                               |
| - Bottom-Left: Mini Music Player (bottom-20 min-[1280px]:bottom-5 left-6)      |
| - Bottom-Right: Terminal Drawer Toggle                                        |
+-------------------------------------------------------------------------------+
| BOTTOM SAFE AREA: Quick Actions Dock (Material Tailwind Capsule, z-40)        |
| [Radar] [WAG] [Traktir] [Wallboard] | [Wardrobe] [Darts] [Arcade] [Photo]     |
+-------------------------------------------------------------------------------+
| MODALS OVERLAY (Material Tailwind Dialog, inset-0, z-50, backdrop-blur-xl)   |
+-------------------------------------------------------------------------------+
```

---

## 4. Rencana Visual: AI Asset Generation (Apartemen & Furniture Realistis)

### 4.1. Daftar Aset Furnitur Penthouse yang Di-generate:
1. **Executive Boss Desk & Ergonomic Chair**: Meja kayu walnut mewah dengan aksen lampu LED SCBD dan monitor curved.
2. **Pantry Espresso Bar & Coffee Island**: Counter marmer hitam dengan mesin espresso modern, toples kopi, dan kursi bar apartemen.
3. **Terrace Outdoor Lounge**: Sofa outdoor rotan sintetis premium, meja kaca rendah, dan pot tanaman tropis teras rooftop.
4. **Meeting Holo Table & Display Stand**: Meja kaca frameless futuristik untuk area presentasi Wallboard.
5. **Apartment Living Decor**: Karpet bertekstur, tanaman monstera/fiddle leaf fig besar, standing lamp estetik, dan partisi kaca modern.
6. **Minigame Props**: Papan Sky Darts modern dan kabinet Retro Arcade Cyberpunk.

### 4.2. Karakter (Avatars & Outfits):
- Portrait visual resolusi tinggi untuk 11 karakter (Raffa, Khansaku, Altair, Damian, Kenzo, Vani, Jajang, Arga, Kian, Tara, Reno).
- Visual sprite/kartu identitas yang konsisten dengan tema pemuda techflow modern SCBD.

### 4.3. Pipeline Integrasi Aset:
- **Generation**: Menghasilkan gambar resolusi tinggi menggunakan tool AI Image Generation.
- **Processing**: Penghapusan background menjadi PNG transparan tajam (alpha channel) dan penyimpanan di `public/assets/props/` serta `public/assets/characters/`.
- **Mapping ke Codingan**: Menghubungkan path aset ke `modelManifest.ts` atau scene texture map Three.js sehingga logika pergerakan karakter tetap berjalan normal mengitari perabot baru.

---

## 5. Implementasi Material Tailwind pada Komponen UI 2D

### 5.1. Top Navbar (`src/components/navigation/Navbar/Navbar.tsx`)
- Mengikuti pola **Material Tailwind Navbar**:
  - `Navbar` wrapper dengan border glassmorphism (`bg-[#0a0a0e]/90 backdrop-blur-2xl border-white/10`).
  - 3 cluster fleksibel: Brand + Badge, Jira Sprint Chip (sembunyi di `< xl`), dan Action Button cluster dengan `IconButton` dan `Button` varian `gradient` / `outlined`.
  - Desain kompak, padding konsisten, anti meluber di breakpoint layar sempit.

### 5.2. Bottom Quick Actions Dock (`src/components/ui/dock.tsx` & `src/app/page.tsx`)
- Kapsul melayang bertema **Material Tailwind Floating Bar**:
  - Ukuran pill `rounded-full` dengan batasan lebar maksimal ~520px-550px.
  - Button styling mengadopsi Material Tailwind Pill (`px-3 py-1.5`, ripple effect, aksen warna elegan: emerald, amber, rose, cyan).
  - Teks responsif: ringkas di desktop, icon-only di mobile/tablet dengan tooltip bersih.
  - Clearance minimal 100px ke arah Mini Player Musik di kiri.

### 5.3. Floating Mini Music Player (`src/components/music/MusicPlayerWidget/`)
- Mengadopsi pola **Material Tailwind Card**:
  - Posisi adaptif: `bottom-20 min-[1280px]:bottom-5 left-4 sm:left-6 z-30`.
  - Dimensi ringkas `w-[300px]` dengan 3 kolom kontrol, tidak pernah menabrak dock tengah.
  - Vinyl disc rotating avatar + equalizer bars + progress bar yang presisi.

### 5.4. Unified Modal System (`src/components/ui/Modal/Modal.tsx`)
- Dibangun dengan struktur **Material Tailwind Dialog**:
  - `Dialog`: Kontainer modal dengan animasi pop-in spring dan backdrop overlay blur.
  - `DialogHeader`: Judul, subtitle, icon identitas, dan tombol tutup silang (`X`) yang tidak bergeser saat scrolling.
  - `DialogBody`: Area scrollable mandiri (`overflow-y-auto max-h-[70vh]`) yang menjaga konten di dalamnya tetap bernapas.
  - `DialogFooter`: Tombol aksi (Batal, Simpan, Konfirmasi) tersusun rapi di kanan bawah.
- Diterapkan pada:
  - `BossWardrobeModal` (setelan pakaian & grid emote santai)
  - `TeamDirectoryModal` (direktori tim & profil agent)
  - `OfficeGroupChatModal` (WAG Warung Kopi & feed obrolan)
  - `SkyDartsModal` & `RetroArcadeModal`
  - `MusicPlayerModal`

### 5.5. Cards & Primitives (`AgentIdentityCard`, `Button`, `Badge`)
- **AgentIdentityCard**: Mengadopsi **Material Tailwind Card** dengan `CardHeader`, `CardBody`, dan `CardFooter`. Tombol aksi memiliki `whitespace-nowrap shrink-0`.
- **Button.tsx**: Standar **Material Tailwind Button** dengan varian `filled`, `gradient`, `outlined`, `text` (ghost), serta ripple animation murni tanpa wrapper perusak flex.
- **Badge.tsx**: Standar **Material Tailwind Chip** untuk status pegawai dan filter departemen.

### 5.6. Autonomous AI Office Dialogue & WAG Group Chat ("Warung Kopi TechFlow")
- **Kebutuhan `GEMINI_API_KEY`**:
  - **YA, MUTLAK DIBUTUHKAN**: Untuk menghasilkan percakapan karyawan secara live dan dinamis tanpa data dummy/hardcoded, sistem memanggil backend `/api/khansa/chat` dengan mode `employee_dialogue`.
  - Engine dialog (`employeeDialogue.ts`) menerapkan prinsip **"NEVER fallback to static dummy"**. Jika `GEMINI_API_KEY` tidak disetel di `.env.local` atau upstream API gagal, sistem tidak akan memunculkan teks dummy palsu melainkan drop request demi menjaga orisinalitas percakapan.
- **Simulasi Obrolan Grup WhatsApp Kantor yang Natural ("Warung Kopi TechFlow")**:
  - **Persona Autentik Pekerja Startup/SCBD**:
    - **Jajang (Frontend Engineer)**: Keluh kesah CSS flexbox, bug hydration Next.js, ajakan ngopi Janji Jiwa/Kopi Kenangan.
    - **Damian (Quant/Trader)**: Analisis candle chart Bitcoin/Solana, leverage liquidasi, pamer cuan/rungkad.
    - **Altair (Backend/DevOps)**: Server AWS down, deploy production hari Jumat, keluhan database migration.
    - **Vani (Design/UI)**: Warna hex tidak sesuai Figma, komplain tombol terlalu dempet/nabrak.
    - **Raffa (Bos/Executive)**: Respons santai, traktir kopi, approve cuti, bagi-bagi tugas dadakan.
  - **Mekanisme Autonomous Background Chatter**:
    - Loop otomatis berkala (interval acak 20-45 detik) yang mensimulasikan interaksi spontan antar karyawan di grup chat.
    - Kontekstual terhadap event kantor terkini (misal: ada yang baru ditraktir kopi, lembur malam, atau orderan trading tereksekusi).
    - Desain bubble chat mengadopsi tampilan **WhatsApp / Slack Modern** dengan timestamp real-time, badge role karyawan, dan fitur reaction stiker/emoji.

---

## 6. Rencana Eksekusi Bertahap (Execution Plan)

1. **Fase 1: Setup Material Tailwind & Sanitasi CSS Global**
   - Integrasikan package & tema **Material Tailwind** (`@material-tailwind/react` atau utility primitives yang kompatibel dengan Next.js App Router).
   - Bersihkan selector liar dan konflik styling di `src/app/globals.css`.

2. **Fase 2: Pembuatan & Integrasi Aset AI (Apartemen, Furnitur & Karakter)**
   - Generate aset visual furnitur apartemen realistis (meja bos, sofa lounge, bar pantry, tanaman, kabinet arcade).
   - Generate aset portrait dan sprite karakter modern.
   - Simpan di folder aset statis dan petakan ke codingan engine 3D/2.5D tanpa mengubah koordinat waypoint.

3. **Fase 3: Rebuild Core UI Primitives & Anti-Bentrok Layout (Material Tailwind)**
   - Implementasikan `Button`, `Modal` (Dialog), dan `Dock` berbasis Material Tailwind.
   - Pasang koordinasi posisi safe-zone antara Bottom Dock dan `MusicPlayerWidget`.

4. **Fase 4: Rebuild Content Modals & Cards**
   - Rapikan `BossWardrobeModal.tsx` (busana & grid emote).
   - Rapikan `TeamDirectoryModal.tsx` & `AgentIdentityCard.tsx` (Card & Chip system).
   - Rapikan `OfficeGroupChatModal.tsx` (feed pesan & quick action bar).

5. **Fase 5: Verifikasi, Build & Pengecekan Visual**
   - Jalankan `yarn tsc --noEmit` untuk memastikan 0 error.
   - Pengecekan responsivitas multi-resolusi (mobile, laptop, desktop monitor).
