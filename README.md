# Dashboard Surveilans Epidemiologi Campak & Rubella (RSUD Campak)

Aplikasi dashboard interaktif berbasis web statis (HTML, CSS, dan JavaScript murni) untuk melakukan pemantauan, pelaporan, dan analisis data surveilans epidemiologi penyakit Campak dan Rubella secara real-time dari data dinamis Google Sheets.

## 🚀 Fitur Utama

- **Data Fetching Dinamis**: Mengambil data secara langsung dari spreadsheet Google Sheets (Formulir Penyelidikan Epidemiologi MR02) tanpa perantara database eksternal.
- **Ringkasan Indikator Epidemiologi (KPI)**:
  - **Total Suspek**: Jumlah kumulatif kasus yang dilaporkan.
  - **Confirmed Lab (CL)**: Kasus yang telah dikonfirmasi positif melalui pengujian laboratorium.
  - **Pending**: Kasus yang masih menunggu hasil uji laboratorium.
  - **Non-Measles (N)**: Kasus yang terbukti negatif campak/rubella melalui uji laboratorium.
  - **Case Fatality Rate (CFR)**: Persentase tingkat kematian dari seluruh kasus yang dilaporkan.
  - **Spesimen Positif**: Jumlah spesimen IgM Campak yang positif.
- **Kurva Epidemiologi (Epi-Curve) Terstandarisasi**: Mengelompokkan kasus berdasarkan **Minggu Epidemiologi (ME)** standar Kemenkes RI / WHO (dimulai hari **Minggu** s/d **Sabtu**). Dilengkapi grafik bar bertumpuk (stacked bar) untuk visualisasi tren kasus mingguan berdasarkan status klasifikasi akhir (CL, Pending, Non-Measles) serta detail rentang tanggal di tooltip.
- **Visualisasi Grafik Interaktif**:
  - **Epi-Curve**: Tren mingguan klasifikasi kasus.
  - **Distribusi Kabupaten**: Grafik batang horizontal sebaran wilayah kabupaten.
  - **Distribusi Umur**: Sebaran kasus berdasarkan kelompok umur spesifik (bayi, balita, anak, remaja, dewasa).
  - **Distribusi Jenis Kelamin**: Donut chart persentase sebaran pasien Laki-laki vs Perempuan.
  - **Klasifikasi Akhir**: Donut chart proporsi kasus terkonfirmasi lab, pending, dan non-measles.
  - **Status Imunisasi MCV1**: Donut chart riwayat imunisasi campak dosis pertama pasien.
- **Filter Data Real-Time**:
  - Filter berdasarkan **Kabupaten** (dropdown otomatis dari data sheet).
  - Filter berdasarkan **Klasifikasi Akhir** (CL, Pending, Non-Measles).
  - Filter berdasarkan **Jenis Kelamin** (L, P).
  - Filter berdasarkan **Range Tanggal (Dari - Sampai)** untuk analisis tren pada kurun waktu tertentu.
  - Tombol **Reset Filter** sekali klik untuk mengembalikan ke data awal.
- **Tabel Kasus & Manajemen Data**:
  - Menampilkan 11 kolom data utama.
  - Pencarian global instan (*real-time search*).
  - Pengurutan data dinamis (*sorting*) dengan mengklik header tabel.
  - Penomoran halaman (*pagination*) otomatis per 20 baris.
  - **Ekspor CSV**: Mengunduh data yang sedang terfilter langsung ke bentuk file CSV.
- **Desain UI/UX Premium**: Menggunakan tema gelap modern (*dark theme*) dengan sentuhan *glassmorphism* (efek blur transparan) serta visualisasi yang sepenuhnya responsif di semua ukuran layar (desktop, tablet, dan smartphone).

---

## 🛠️ Struktur Proyek

Proyek ini dirancang agar sangat ringan dan cepat dimuat karena hanya menggunakan teknologi vanilla (tanpa framework):

```text
.
├── index.html   # Struktur utama halaman web, filter, layout dashboard, & tabel
├── styles.css   # Variabel warna (design tokens), layout grid/flexbox, efek blur, & responsive CSS
└── app.js       # Script parser CSV, kalkulasi minggu epidemiologi, filter, & integrasi Chart.js
```

---

## 📦 Teknologi & Library

- **HTML5 & CSS3** (Vanilla)
- **JavaScript ES6** (Vanilla)
- **Chart.js v4.x** (via CDN) — Visualisasi grafik interaktif
- **Google Fonts** (Inter & JetBrains Mono)
- **SVG Icon System** — Icon minimalis untuk mempercantik UI

---

## ⚙️ Cara Menjalankan Aplikasi Secara Lokal

Karena aplikasi melakukan panggilan jaringan (`fetch`) ke Google Sheets API, Anda perlu menjalankannya menggunakan web server lokal untuk menghindari isu kebijakan CORS pada browser.

1. **Unduh Proyek**:
   ```bash
   git clone https://github.com/rusli3/rsud-campak.git
   cd rsud-campak
   ```

2. **Jalankan Web Server Lokal**:
   - Jika Anda memiliki **Python**:
     ```bash
     python3 -m http.server 8080
     ```
   - Jika Anda menggunakan **Node.js** (`http-server`):
     ```bash
     npx http-server -p 8080
     ```

3. **Buka di Browser**:
   Buka peramban (browser) Anda lalu akses ke alamat:
   [http://localhost:8080](http://localhost:8080)

---

## 📊 Sumber Data & Integrasi Google Sheets

Data dashboard diambil secara langsung dari publikasi Google Sheets dengan format URL ekspor berikut:
`https://docs.google.com/spreadsheets/d/1VxWdlFTe3vu35804887`

**Catatan Integrasi**:
- Baris 0 hingga 9 dilewati (`DATA_START_ROW = 10`) karena berisi judul metadata formulir surveilans.
- Setiap pembaruan data yang dilakukan oleh petugas di Google Sheets akan langsung tercermin di dashboard saat tombol **Refresh Data** ditekan atau ketika halaman dimuat ulang.

---

## 📄 Lisensi

Proyek ini dibangun untuk tujuan pemantauan kesehatan masyarakat dan surveilans epidemiologi.  
Silakan berkontribusi dengan melakukan fork pada repositori ini melalui tautan: [GitHub rusli3](https://github.com/rusli3/).
