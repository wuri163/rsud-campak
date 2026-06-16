/* ============================================
   EPIDEMIOLOGY REPORT DASHBOARD
   Main Application Logic
   ============================================ */

// === Configuration ===
const SHEET_ID = '1VxWdlFTe3vuf69uDd2f2Y4YEsv8SBofmseTh5z_yj4k';
const GID = '2035804887';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
const ROWS_PER_PAGE = 20;
const DATA_START_ROW = 10; // 0-indexed: rows 0-9 are headers/metadata

// === Column Indices (0-based) ===
const COL = {
  NO: 0,
  SUMBER_LAPORAN: 4,
  TGL_LAPOR: 5,
  TGL_ONSET: 6,
  KABUPATEN: 7,
  NAMA: 9,
  GENDER: 10,
  UMUR_TAHUN: 11,
  UMUR_BULAN: 12,
  ALAMAT: 13,
  DESA: 14,
  KECAMATAN: 15,
  ORTU: 16,
  HP: 17,
  TGL_ONSET_GEJALA: 18,
  TGL_RASH: 19,
  BATUK: 20,
  PILEK: 21,
  MATA_MERAH: 22,
  KOMPLIKASI: 23,
  RAWAT_RS: 24,
  MCV1: 25,
  MCV2: 26,
  BIAS: 27,
  MR_KAMPANYE: 28,
  TGL_VAKSIN: 29,
  JML_DOSIS: 30,
  TGL_SPESIMEN: 32,
  IGM_CAMPAK: 36,
  IGM_RUBELLA: 37,
  VITA: 42,
  BEPERGIAN: 43,
  KONDISI: 44,
  KLASIFIKASI: 46,
};

// === Global State ===
let allCases = [];
let filteredCases = [];
let currentPage = 1;
let sortColumn = -1;
let sortDirection = 'asc';
let charts = {};

// === CSV Parser ===
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        if (char === '\r') i++;
      } else {
        currentField += char;
      }
    }
  }
  // Last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }
  return rows;
}

// === Data Processing ===
function processRow(row) {
  if (!row || row.length < 45) return null;

  const nama = row[COL.NAMA];
  if (!nama || nama.trim() === '') return null;

  const noRaw = row[COL.NO];
  const no = (noRaw && !isNaN(parseInt(noRaw))) ? parseInt(noRaw) : '-';

  const genderRaw = (row[COL.GENDER] || '').toUpperCase().trim();
  const gender = genderRaw === 'L' || genderRaw === 'P' ? genderRaw : '?';

  const umurTahun = parseInt(row[COL.UMUR_TAHUN]) || 0;
  const umurBulan = parseInt(row[COL.UMUR_BULAN]) || 0;

  const klasifikasi = (row[COL.KLASIFIKASI] || '').trim();
  const kondisi = (row[COL.KONDISI] || '').trim().toLowerCase();

  const batuk = isYes(row[COL.BATUK]);
  const pilek = isYes(row[COL.PILEK]);
  const mataM = isYes(row[COL.MATA_MERAH]);

  const igmCampak = (row[COL.IGM_CAMPAK] || '').trim().toLowerCase();
  const igmRubella = (row[COL.IGM_RUBELLA] || '').trim().toLowerCase();

  const mcv1 = (row[COL.MCV1] || '').trim().toLowerCase();

  return {
    no,
    nama: capitalize(nama),
    gender,
    umurTahun,
    umurBulan,
    umurTotal: umurTahun + umurBulan / 12,
    kabupaten: formatKabupaten(row[COL.KABUPATEN]),
    kecamatan: capitalize(row[COL.KECAMATAN] || ''),
    desa: capitalize(row[COL.DESA] || ''),
    alamat: row[COL.ALAMAT] || '',
    sumberLaporan: row[COL.SUMBER_LAPORAN] || '',
    tglLapor: row[COL.TGL_LAPOR] || '',
    tglOnset: row[COL.TGL_ONSET] || '',
    batuk,
    pilek,
    mataM,
    komplikasi: row[COL.KOMPLIKASI] || '',
    rawatRS: isYes(row[COL.RAWAT_RS]),
    mcv1,
    igmCampak,
    igmRubella,
    klasifikasi,
    kondisi,
    tglSpesimen: row[COL.TGL_SPESIMEN] || '',
  };
}

function isYes(val) {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return v === 'ya' || v === 'yes' || v === 'ada';
}

function capitalize(str) {
  if (!str) return '';
  return str.trim().split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function formatKabupaten(raw) {
  if (!raw) return '';
  return raw.trim().replace(/_/g, ' ').split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

// === Data Fetching ===
async function fetchData() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('hidden');

  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const rows = parseCSV(text);

    allCases = [];
    for (let i = DATA_START_ROW; i < rows.length; i++) {
      const c = processRow(rows[i]);
      if (c) allCases.push(c);
    }

    filteredCases = [...allCases];
    currentPage = 1;

    updateLastUpdate();
    populateFilters();
    updateDashboard();

    overlay.classList.add('hidden');
  } catch (err) {
    console.error('Error fetching data:', err);
    overlay.innerHTML = `
      <div class="error-message">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>Gagal memuat data dari Google Sheets.</p>
        <p style="font-size:0.8rem;margin-top:8px;color:#94a3b8">Error: ${err.message}</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="location.reload()">Coba Lagi</button>
      </div>
    `;
  }
}

function refreshData() {
  fetchData();
}

function updateLastUpdate() {
  const now = new Date();
  const options = {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  };
  document.getElementById('lastUpdate').textContent =
    `Update: ${now.toLocaleDateString('id-ID', options)}`;
}

// === Filter Logic ===
function populateFilters() {
  // Kabupaten
  const kabSet = new Set(allCases.map(c => c.kabupaten).filter(Boolean));
  const kabSelect = document.getElementById('filterKabupaten');
  kabSelect.innerHTML = '<option value="">Semua Kabupaten</option>';
  [...kabSet].sort().forEach(k => {
    kabSelect.innerHTML += `<option value="${k}">${k}</option>`;
  });

  // Auto-set date range from data
  let minDate = null, maxDate = null;
  allCases.forEach(c => {
    const d = parseDate(c.tglLapor);
    if (d) {
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    }
  });
  const fromInput = document.getElementById('filterDateFrom');
  const toInput = document.getElementById('filterDateTo');
  if (minDate) fromInput.min = toISODate(minDate);
  if (maxDate) {
    toInput.max = toISODate(maxDate);
    fromInput.max = toISODate(maxDate);
    toInput.min = fromInput.min;
  }
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(str) {
  if (!str) return null;
  // Try DD/MM/YYYY or D/M/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000;
    if (year > 2030 || year < 2020) return null; // Filter out bad dates
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// === Epidemiological Week Helpers (Minggu - Sabtu, Kemenkes/WHO Standard) ===
function getSunday(d) {
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday;
}

function getEpiWeek1Start(year) {
  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay();
  const sunday = new Date(jan4);
  sunday.setDate(jan4.getDate() - day);
  return sunday;
}

function getEpiWeekInfo(d) {
  const dSunday = getSunday(d);
  let year = dSunday.getFullYear();
  let week1Start = getEpiWeek1Start(year);
  
  if (dSunday < week1Start) {
    year = year - 1;
    week1Start = getEpiWeek1Start(year);
  } else {
    const nextWeek1Start = getEpiWeek1Start(year + 1);
    if (dSunday >= nextWeek1Start) {
      year = year + 1;
      week1Start = nextWeek1Start;
    }
  }
  
  const diffTime = dSunday.getTime() - week1Start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7) + 1;
  
  const dSaturday = new Date(dSunday);
  dSaturday.setDate(dSunday.getDate() + 6);
  
  return {
    weekNum,
    year,
    label: `ME ${weekNum}/${year}`,
    shortLabel: `ME ${weekNum}`,
    rangeText: `${formatDateIndo(dSunday)} s/d ${formatDateIndo(dSaturday)}`,
    sundayKey: toISODate(dSunday)
  };
}

function formatDateIndo(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function applyFilters() {
  const kab = document.getElementById('filterKabupaten').value;
  const klas = document.getElementById('filterKlasifikasi').value;
  const gender = document.getElementById('filterGender').value;
  const dateFrom = document.getElementById('filterDateFrom').value;
  const dateTo = document.getElementById('filterDateTo').value;

  const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
  const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;

  filteredCases = allCases.filter(c => {
    if (kab && c.kabupaten !== kab) return false;
    if (klas && c.klasifikasi !== klas) return false;
    if (gender && c.gender !== gender.toUpperCase()) return false;
    if (from || to) {
      const d = parseDate(c.tglLapor);
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
    }
    return true;
  });

  currentPage = 1;
  updateDashboard();
}

function resetFilters() {
  document.getElementById('filterKabupaten').value = '';
  document.getElementById('filterKlasifikasi').value = '';
  document.getElementById('filterGender').value = '';
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  document.getElementById('tableSearch').value = '';
  filteredCases = [...allCases];
  currentPage = 1;
  updateDashboard();
}

// === Dashboard Update ===
function updateDashboard() {
  updateSummaryCards();
  updateCharts();
  renderTable();
}

// === Summary Cards ===
function updateSummaryCards() {
  const total = filteredCases.length;
  const cl = filteredCases.filter(c => c.klasifikasi === 'CL').length;
  const pending = filteredCases.filter(c => c.klasifikasi === 'Pending').length;
  const neg = filteredCases.filter(c => c.klasifikasi === 'N').length;
  const dead = filteredCases.filter(c => c.kondisi === 'meninggal').length;
  const cfr = total > 0 ? ((dead / total) * 100).toFixed(2) : '0.00';
  const specPos = filteredCases.filter(c => c.igmCampak === 'positif').length;

  animateValue('totalCases', total);
  animateValue('confirmedCases', cl);
  animateValue('pendingCases', pending);
  animateValue('negativeCases', neg);
  document.getElementById('cfrValue').textContent = cfr + '%';
  animateValue('specimenPositive', specPos);

  // Details
  document.getElementById('totalDetail').textContent = `Suspek campak/rubella`;
  document.getElementById('confirmedDetail').textContent = `${((cl / total) * 100 || 0).toFixed(1)}% dari total kasus`;
  document.getElementById('pendingDetail').textContent = `Menunggu hasil laboratorium`;
  document.getElementById('negativeDetail').textContent = `Bukan campak/rubella`;
  document.getElementById('cfrDetail').textContent = `${dead} meninggal dari ${total} kasus`;
  document.getElementById('specimenDetail').textContent = `IgM Campak positif`;
}

function animateValue(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// === Chart Rendering ===
function updateCharts() {
  renderEpiCurve();
  renderKabupatenChart();
  renderUmurChart();
  renderGenderChart();
  renderKlasifikasiChart();
  renderImunisasiChart();
}

function getChartDefaults() {
  return {
    color: '#94a3b8',
    borderColor: 'rgba(148, 163, 184, 0.08)',
    font: { family: "'Inter', sans-serif" }
  };
}

Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.08)';
Chart.defaults.font.family = "'Inter', sans-serif";

function destroyChart(name) {
  if (charts[name]) {
    charts[name].destroy();
    charts[name] = null;
  }
}

// 1. Epi-Curve
function renderEpiCurve() {
  destroyChart('epiCurve');

  // Group by epidemiological week (Minggu - Sabtu)
  const weekMap = {};
  filteredCases.forEach(c => {
    const d = parseDate(c.tglLapor);
    if (!d) return;
    const epiInfo = getEpiWeekInfo(d);
    const key = epiInfo.sundayKey;
    if (!weekMap[key]) {
      weekMap[key] = { 
        total: 0, 
        cl: 0, 
        pending: 0, 
        n: 0,
        label: epiInfo.label,
        shortLabel: epiInfo.shortLabel,
        rangeText: epiInfo.rangeText
      };
    }
    weekMap[key].total++;
    if (c.klasifikasi === 'CL') weekMap[key].cl++;
    else if (c.klasifikasi === 'Pending') weekMap[key].pending++;
    else if (c.klasifikasi === 'N') weekMap[key].n++;
  });

  const keys = Object.keys(weekMap).sort();
  const labels = keys.map(k => weekMap[k].label);

  const ctx = document.getElementById('chartEpiCurve').getContext('2d');
  charts.epiCurve = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Confirmed Lab',
          data: keys.map(k => weekMap[k].cl),
          backgroundColor: 'rgba(248, 113, 113, 0.8)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Pending',
          data: keys.map(k => weekMap[k].pending),
          backgroundColor: 'rgba(251, 191, 36, 0.8)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Non-Measles',
          data: keys.map(k => weekMap[k].n),
          backgroundColor: 'rgba(52, 211, 153, 0.8)',
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, padding: 16, font: { size: 11, weight: '500' } }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleFont: { size: 12, weight: '600' },
          bodyFont: { size: 11 },
          borderColor: 'rgba(148, 163, 184, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            title: (items) => {
              const key = keys[items[0].dataIndex];
              return weekMap[key].label;
            },
            afterTitle: (items) => {
              const key = keys[items[0].dataIndex];
              return `Rentang: ${weekMap[key].rangeText}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 10 }, maxRotation: 45 },
          title: { display: true, text: 'Minggu Epidemiologi', font: { size: 11, weight: '600' } }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { stepSize: 5, font: { size: 10 } },
          title: { display: true, text: 'Jumlah Kasus', font: { size: 11, weight: '600' } }
        }
      }
    }
  });
}

// 2. Kabupaten Chart
function renderKabupatenChart() {
  destroyChart('kabupaten');

  const countMap = {};
  filteredCases.forEach(c => {
    const k = c.kabupaten || 'Tidak Diketahui';
    countMap[k] = (countMap[k] || 0) + 1;
  });

  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(s => s[0]);
  const data = sorted.map(s => s[1]);

  const colors = [
    'rgba(20, 184, 166, 0.8)', 'rgba(59, 130, 246, 0.8)',
    'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)',
    'rgba(167, 139, 250, 0.8)', 'rgba(34, 211, 238, 0.8)',
    'rgba(249, 115, 22, 0.8)', 'rgba(236, 72, 153, 0.8)'
  ];

  const ctx = document.getElementById('chartKabupaten').getContext('2d');
  charts.kabupaten = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Kasus',
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          cornerRadius: 8,
          padding: 12,
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 10, font: { size: 10 } },
          grid: { color: 'rgba(148, 163, 184, 0.05)' }
        },
        y: {
          ticks: { font: { size: 11, weight: '500' } },
          grid: { display: false }
        }
      }
    }
  });
}

// 3. Umur Chart
function renderUmurChart() {
  destroyChart('umur');

  const groups = {
    '0-11 bln': 0, '1-4 thn': 0, '5-9 thn': 0,
    '10-14 thn': 0, '15-19 thn': 0, '20+ thn': 0
  };

  filteredCases.forEach(c => {
    const age = c.umurTotal;
    if (age < 1) groups['0-11 bln']++;
    else if (age < 5) groups['1-4 thn']++;
    else if (age < 10) groups['5-9 thn']++;
    else if (age < 15) groups['10-14 thn']++;
    else if (age < 20) groups['15-19 thn']++;
    else groups['20+ thn']++;
  });

  const labels = Object.keys(groups);
  const data = Object.values(groups);

  const ctx = document.getElementById('chartUmur').getContext('2d');
  charts.umur = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Kasus',
        data,
        backgroundColor: [
          'rgba(248, 113, 113, 0.8)', 'rgba(251, 191, 36, 0.8)',
          'rgba(20, 184, 166, 0.8)', 'rgba(59, 130, 246, 0.8)',
          'rgba(167, 139, 250, 0.8)', 'rgba(236, 72, 153, 0.8)'
        ],
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          cornerRadius: 8,
          padding: 12,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11, weight: '500' } },
          title: { display: true, text: 'Kelompok Umur', font: { size: 11, weight: '600' } }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 10, font: { size: 10 } },
          title: { display: true, text: 'Jumlah', font: { size: 11, weight: '600' } }
        }
      }
    }
  });
}

// 4. Gender Chart
function renderGenderChart() {
  destroyChart('gender');

  let l = 0, p = 0;
  filteredCases.forEach(c => {
    if (c.gender === 'L') l++;
    else if (c.gender === 'P') p++;
  });

  const ctx = document.getElementById('chartGender').getContext('2d');
  charts.gender = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Laki-laki', 'Perempuan'],
      datasets: [{
        data: [l, p],
        backgroundColor: ['rgba(59, 130, 246, 0.85)', 'rgba(236, 72, 153, 0.85)'],
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, padding: 16, font: { size: 12, weight: '500' } }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// 5. Klasifikasi Chart
function renderKlasifikasiChart() {
  destroyChart('klasifikasi');

  const countMap = {};
  filteredCases.forEach(c => {
    const k = c.klasifikasi || 'Lainnya';
    countMap[k] = (countMap[k] || 0) + 1;
  });

  const labelMap = { 'CL': 'Confirmed Lab', 'Pending': 'Pending', 'N': 'Non-Measles' };
  const colorMap = {
    'CL': 'rgba(248, 113, 113, 0.85)',
    'Pending': 'rgba(251, 191, 36, 0.85)',
    'N': 'rgba(52, 211, 153, 0.85)',
    'Lainnya': 'rgba(148, 163, 184, 0.5)'
  };

  const labels = Object.keys(countMap).map(k => labelMap[k] || k);
  const data = Object.values(countMap);
  const colors = Object.keys(countMap).map(k => colorMap[k] || 'rgba(148, 163, 184, 0.5)');

  const ctx = document.getElementById('chartKlasifikasi').getContext('2d');
  charts.klasifikasi = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, padding: 16, font: { size: 12, weight: '500' } }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// 6. Imunisasi Chart
function renderImunisasiChart() {
  destroyChart('imunisasi');

  const statusMap = { 'Ya': 0, 'Belum': 0, 'Tidak': 0, 'TidakTahu': 0, 'Lainnya': 0 };

  filteredCases.forEach(c => {
    const v = (c.mcv1 || '').trim().toLowerCase();
    if (v === 'ya') statusMap['Ya']++;
    else if (v === 'belum') statusMap['Belum']++;
    else if (v === 'tidak') statusMap['Tidak']++;
    else if (v === 'tidaktahu') statusMap['TidakTahu']++;
    else statusMap['Lainnya']++;
  });

  const labelMap = { 'Ya': 'Sudah MCV1', 'Belum': 'Belum', 'Tidak': 'Tidak', 'TidakTahu': 'Tidak Tahu', 'Lainnya': 'Tidak Diketahui' };
  const colorMap = {
    'Ya': 'rgba(52, 211, 153, 0.85)',
    'Belum': 'rgba(251, 191, 36, 0.85)',
    'Tidak': 'rgba(248, 113, 113, 0.85)',
    'TidakTahu': 'rgba(148, 163, 184, 0.6)',
    'Lainnya': 'rgba(100, 116, 139, 0.5)'
  };

  // Filter out zeros
  const entries = Object.entries(statusMap).filter(([, v]) => v > 0);
  const labels = entries.map(([k]) => labelMap[k]);
  const data = entries.map(([, v]) => v);
  const colors = entries.map(([k]) => colorMap[k]);

  const ctx = document.getElementById('chartImunisasi').getContext('2d');
  charts.imunisasi = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, padding: 16, font: { size: 12, weight: '500' } }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// === Table Rendering ===
function getDisplayCases() {
  const query = (document.getElementById('tableSearch').value || '').toLowerCase();
  let cases = filteredCases;

  if (query) {
    cases = cases.filter(c =>
      c.nama.toLowerCase().includes(query) ||
      c.alamat.toLowerCase().includes(query) ||
      c.desa.toLowerCase().includes(query) ||
      c.kecamatan.toLowerCase().includes(query) ||
      c.kabupaten.toLowerCase().includes(query)
    );
  }

  // Apply sort
  if (sortColumn >= 0) {
    cases = [...cases].sort((a, b) => {
      let va, vb;
      switch (sortColumn) {
        case 0: va = a.no; vb = b.no; break;
        case 1: va = a.nama; vb = b.nama; break;
        case 2: va = a.gender; vb = b.gender; break;
        case 3: va = a.umurTotal; vb = b.umurTotal; break;
        case 4: va = a.kabupaten; vb = b.kabupaten; break;
        case 5: va = a.kecamatan; vb = b.kecamatan; break;
        case 6: va = a.tglLapor; vb = b.tglLapor; break;
        case 7:
          va = (a.batuk ? 1 : 0) + (a.pilek ? 1 : 0) + (a.mataM ? 1 : 0);
          vb = (b.batuk ? 1 : 0) + (b.pilek ? 1 : 0) + (b.mataM ? 1 : 0);
          break;
        case 8: va = a.igmCampak; vb = b.igmCampak; break;
        case 9: va = a.klasifikasi; vb = b.klasifikasi; break;
        case 10: va = a.kondisi; vb = b.kondisi; break;
        default: va = ''; vb = '';
      }
      const numA = Number(va);
      const numB = Number(vb);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return cases;
}

function renderTable() {
  const cases = getDisplayCases();
  const totalPages = Math.ceil(cases.length / ROWS_PER_PAGE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const pageData = cases.slice(start, start + ROWS_PER_PAGE);

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = pageData.map(c => `
    <tr>
      <td style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.72rem">${c.no}</td>
      <td style="color:var(--text-primary);font-weight:500">${c.nama}</td>
      <td><span class="badge ${c.gender === 'L' ? 'badge-l' : 'badge-p'}">${c.gender}</span></td>
      <td style="font-family:'JetBrains Mono',monospace">${formatAge(c.umurTahun, c.umurBulan)}</td>
      <td>${c.kabupaten}</td>
      <td>${c.kecamatan}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem">${c.tglLapor}</td>
      <td>${formatGejala(c)}</td>
      <td>${formatIgm(c.igmCampak)}</td>
      <td><span class="badge ${getBadgeClass(c.klasifikasi)}">${c.klasifikasi || '-'}</span></td>
      <td style="color:${c.kondisi === 'meninggal' ? 'var(--accent-coral)' : 'var(--accent-emerald)'}">${capitalize(c.kondisi) || '-'}</td>
    </tr>
  `).join('');

  // Pagination
  document.getElementById('paginationInfo').textContent =
    `Menampilkan ${start + 1}-${Math.min(start + ROWS_PER_PAGE, cases.length)} dari ${cases.length} kasus`;

  renderPagination(totalPages);
}

function formatAge(tahun, bulan) {
  if (tahun === 0 && bulan === 0) return '0 bln';
  if (tahun === 0) return `${bulan} bln`;
  if (bulan === 0) return `${tahun} thn`;
  return `${tahun}t ${bulan}b`;
}

function formatGejala(c) {
  const g = [];
  if (c.batuk) g.push('B');
  if (c.pilek) g.push('P');
  if (c.mataM) g.push('M');
  if (g.length === 0) return '<span style="color:var(--text-muted)">—</span>';
  return g.join(', ');
}

function formatIgm(val) {
  if (!val) return '<span style="color:var(--text-muted)">—</span>';
  if (val === 'positif') return '<span style="color:var(--accent-coral);font-weight:600">Positif</span>';
  if (val === 'negatif') return '<span style="color:var(--accent-emerald)">Negatif</span>';
  if (val.includes('equivocal')) return '<span style="color:var(--accent-amber)">Equivocal</span>';
  return `<span style="color:var(--text-muted)">${val}</span>`;
}

function getBadgeClass(klas) {
  if (klas === 'CL') return 'badge-cl';
  if (klas === 'Pending') return 'badge-pending';
  if (klas === 'N') return 'badge-negative';
  return '';
}

function renderPagination(totalPages) {
  const controls = document.getElementById('paginationControls');
  controls.innerHTML = '';

  // Prev
  const prevBtn = createPageBtn('‹', () => { currentPage--; renderTable(); });
  prevBtn.disabled = currentPage <= 1;
  controls.appendChild(prevBtn);

  // Page numbers
  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    controls.appendChild(createPageBtn('1', () => { currentPage = 1; renderTable(); }));
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.textContent = '…';
      dots.style.cssText = 'color:var(--text-muted);padding:0 4px;font-size:0.8rem';
      controls.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const btn = createPageBtn(String(i), () => { currentPage = i; renderTable(); });
    if (i === currentPage) btn.classList.add('active');
    controls.appendChild(btn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '…';
      dots.style.cssText = 'color:var(--text-muted);padding:0 4px;font-size:0.8rem';
      controls.appendChild(dots);
    }
    controls.appendChild(createPageBtn(String(totalPages), () => { currentPage = totalPages; renderTable(); }));
  }

  // Next
  const nextBtn = createPageBtn('›', () => { currentPage++; renderTable(); });
  nextBtn.disabled = currentPage >= totalPages;
  controls.appendChild(nextBtn);
}

function createPageBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'page-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

// === Table Sort ===
function sortTable(colIndex) {
  if (sortColumn === colIndex) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = colIndex;
    sortDirection = 'asc';
  }

  // Update header styles
  const ths = document.querySelectorAll('.data-table th');
  ths.forEach((th, i) => {
    th.classList.toggle('sorted', i === colIndex);
    const icon = th.querySelector('.sort-icon');
    if (icon) {
      icon.textContent = i === colIndex ? (sortDirection === 'asc' ? '↑' : '↓') : '↕';
    }
  });

  renderTable();
}

// === Table Search ===
function searchTable() {
  currentPage = 1;
  renderTable();
}

// === Export CSV ===
function exportCSV() {
  const cases = getDisplayCases();
  const headers = ['No', 'Nama', 'JK', 'Umur Tahun', 'Umur Bulan', 'Kabupaten', 'Kecamatan', 'Desa', 'Tgl Lapor', 'Batuk', 'Pilek', 'Mata Merah', 'Komplikasi', 'IgM Campak', 'Klasifikasi', 'Kondisi'];

  const rows = cases.map(c => [
    c.no, `"${c.nama}"`, c.gender, c.umurTahun, c.umurBulan,
    `"${c.kabupaten}"`, `"${c.kecamatan}"`, `"${c.desa}"`,
    c.tglLapor, c.batuk ? 'Ya' : 'Tidak', c.pilek ? 'Ya' : 'Tidak',
    c.mataM ? 'Ya' : 'Tidak', `"${c.komplikasi}"`,
    c.igmCampak, c.klasifikasi, c.kondisi
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `surveilans_campak_rubella_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// === Copy Prompt to AI Agent ===
function initCopyPromptButtons() {
  const buttons = document.querySelectorAll('.btn-copy-prompt');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const chartKey = btn.getAttribute('data-chart');
      const chartName = btn.getAttribute('data-name');
      
      const chart = charts[chartKey];
      if (!chart) {
        alert('Data grafik belum siap.');
        return;
      }
      
      // Get current date range filter values (if any)
      const dateStartEl = document.getElementById('filterStartDate');
      const dateEndEl = document.getElementById('filterEndDate');
      const dateRangeText = (dateStartEl && dateStartEl.value && dateEndEl && dateEndEl.value) 
        ? `${dateStartEl.value} s.d. ${dateEndEl.value}` 
        : 'Seluruh Periode';

      // Gather current filter selections to add context to prompt
      const kabEl = document.getElementById('filterKabupaten');
      const kabText = kabEl ? kabEl.value || 'Semua' : 'Semua';
      
      const dataJSON = getChartDataJSON(chartKey);
      
      const promptText = `Anda adalah seorang Epidemiolog Senior dan Spesialis Surveilans Penyakit.
Berikut adalah data ${chartName} dari Dashboard Surveilans Campak/Rubella berdasarkan Data Kunjungan Pasien RSUD Dr. Soedarso:

Konteks Filter Aktif:
- Rentang Tanggal: ${dateRangeText}
- Kabupaten/Kota: ${kabText}

Data (Format JSON):
${JSON.stringify(dataJSON, null, 2)}

Tugas Anda:
1. Buatlah analisis deskriptif naratif dari data di atas (identifikasi tren, pola, puncak kasus, atau kelompok berisiko tinggi).
2. Berikan interpretasi epidemiologis sesuai aspek Orang/Tempat/Waktu.
3. Berikan rekomendasi intervensi kesehatan masyarakat berbasis bukti (Evidence-Based Decision Making).`;

      navigator.clipboard.writeText(promptText).then(() => {
        // Visual feedback
        const span = btn.querySelector('span');
        const originalIcon = btn.innerHTML;
        
        btn.classList.add('copied');
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-copied"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Copied!</span>
        `;
        
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = originalIcon;
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Gagal menyalin prompt.');
      });
    });
  });
}

function getChartDataJSON(chartKey) {
  const chart = charts[chartKey];
  if (!chart) return [];
  
  const labels = chart.data.labels;
  const datasets = chart.data.datasets;
  
  return labels.map((label, index) => {
    const row = {};
    if (chartKey === 'epiCurve') {
      row["Minggu Epidemiologi"] = label;
    } else if (chartKey === 'kabupaten') {
      row["Kabupaten"] = label;
    } else if (chartKey === 'umur') {
      row["Kelompok Umur"] = label;
    } else if (chartKey === 'gender') {
      row["Jenis Kelamin"] = label;
    } else if (chartKey === 'klasifikasi') {
      row["Klasifikasi Akhir"] = label;
    } else if (chartKey === 'imunisasi') {
      row["Status Imunisasi"] = label;
    } else {
      row["Kategori"] = label;
    }
    
    datasets.forEach(ds => {
      row[ds.label || 'Jumlah'] = ds.data[index];
    });
    return row;
  });
}

// === Initialize ===
document.addEventListener('DOMContentLoaded', () => {
  fetchData();
  initCopyPromptButtons();
});
