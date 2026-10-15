
import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// ==================================================
// 1. KONFIGURASI FIREBASE
// GANTI DENGAN KONFIGURASI DARI APLIKASI ANDA
// ==================================================

const firebaseConfig = {
  apiKey: "AIzaSyBI6VWDbIJ7A-PxNtdQWDDhmnNrCfWWhCI",
  authDomain: "aplikasi-presensi-fb.firebaseapp.com",
  projectId: "aplikasi-presensi-fb",
  storageBucket: "aplikasi-presensi-fb.firebasestorage.app",
  messagingSenderId: "1018611782868",
  appId: "1:1018611782868:web:37304037cece90197c9741"
};

const app = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

// ==================================================
// 2. ELEMEN HALAMAN
// ==================================================

const el = id => document.getElementById(id);

const pesan = el("pesan");
const konten = el("konten");
const namaGuruEl = el("namaGuru");
const jenisRekapEl = el("jenisRekap");
const kelasEl = el("kelas");
const tanggalMulaiEl = el("tanggalMulai");
const tanggalAkhirEl = el("tanggalAkhir");
const btnTampilkan = el("btnTampilkan");
const btnPDF = el("btnPDF");
const btnKembali = el("btnKembali");
const tabelHead = el("tabelHead");
const tabelBody = el("tabelBody");

let guruAktif = null;
let semuaDataGuru = [];
let dataTampil = [];
let kelasDiizinkan = new Set();

// ==================================================
// 3. UTILITAS
// ==================================================

function tampilkanPesan(teks, error = false) {
  pesan.textContent = teks;
  pesan.classList.remove("hidden", "error");

  if (error) {
    pesan.classList.add("error");
  }
}

function formatTanggal(tanggal) {
  if (!tanggal) return "-";

  const bagian = tanggal.split("-");
  if (bagian.length !== 3) return tanggal;

  return `${bagian[2]}/${bagian[1]}/${bagian[0]}`;
}

function hariIni() {
  const sekarang = new Date();

  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${tanggal}`;
}

function awalBulanIni() {
  const sekarang = new Date();

  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");

  return `${tahun}-${bulan}-01`;
}

function normalisasiStatus(status) {
  const nilai = String(status || "").trim().toLowerCase();

  if (nilai === "hadir") return "Hadir";
  if (nilai === "sakit") return "Sakit";
  if (nilai === "izin") return "Izin";
  if (nilai === "alpa" || nilai === "alpha") return "Alpa";

  return "Lainnya";
}

function amanTeks(nilai) {
  return String(nilai ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bandingkanTeks(a, b) {
  return String(a || "").localeCompare(String(b || ""), "id");
}

function kelasData(data) {
  return String(data.kelas || "").trim();
}

function tampilkanTabel(kolom, baris) {
  tabelHead.replaceChildren();
  tabelBody.replaceChildren();

  const trHead = document.createElement("tr");

  kolom.forEach(namaKolom => {
    const th = document.createElement("th");
    th.textContent = namaKolom;
    trHead.appendChild(th);
  });

  tabelHead.appendChild(trHead);

  if (baris.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = kolom.length;
    td.textContent = "Tidak ada data pada periode ini.";
    td.style.textAlign = "center";

    tr.appendChild(td);
    tabelBody.appendChild(tr);
    return;
  }

  baris.forEach(barisData => {
    const tr = document.createElement("tr");

    barisData.forEach(nilai => {
      const td = document.createElement("td");
      td.textContent = String(nilai ?? "-");
      tr.appendChild(td);
    });

    tabelBody.appendChild(tr);
  });
}

// ==================================================
// 4. VALIDASI AKUN GURU
// ==================================================

async function periksaAkunGuru(user) {
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error(
      "Profil pengguna tidak ditemukan di koleksi users."
    );
  }

  const profil = snapshot.data();

  if (
    String(profil.role || "").toLowerCase() !== "guru" ||
    profil.aktif !== true
  ) {
    throw new Error(
      "Akses ditolak. Halaman ini hanya untuk akun guru aktif."
    );
  }

  guruAktif = {
    uid: user.uid,
    nama: profil.nama || user.displayName || user.email || "Guru"
  };

  namaGuruEl.textContent = `Guru: ${guruAktif.nama}`;

  // Rentang awal secara default: awal bulan sampai hari ini.
  tanggalMulaiEl.value = awalBulanIni();
  tanggalAkhirEl.value = hariIni();

  await muatDataGuru();
  konten.classList.remove("hidden");
  tampilkanPesan("Login guru berhasil.");
}

// ==================================================
// 5. MEMUAT DATA PRESENSI MILIK GURU
// ==================================================

async function muatDataGuru() {
  tampilkanPesan("Memuat data presensi...");

  /*
   * Query ini sengaja dibatasi berdasarkan guruUid.
   * Dokumen presensi diharapkan memiliki field guruUid
   * sesuai struktur aplikasi presensi yang digunakan.
   */
  const q = query(
    collection(db, "presensi"),
    where("guruUid", "==", guruAktif.uid)
  );

  const snapshot = await getDocs(q);

  semuaDataGuru = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  /*
   * Kelas diambil dari data presensi yang sudah dimuat.
   * Ini bukan daftar seluruh kelas sekolah.
   */
  kelasDiizinkan = new Set(
    semuaDataGuru
      .map(kelasData)
      .filter(Boolean)
  );

  kelasEl.replaceChildren();

  const opsiSemua = document.createElement("option");
  opsiSemua.value = "";
  opsiSemua.textContent = "Semua kelas yang diajar";
  kelasEl.appendChild(opsiSemua);

  [...kelasDiizinkan]
    .sort(bandingkanTeks)
    .forEach(kelas => {
      const option = document.createElement("option");
      option.value = kelas;
      option.textContent = kelas;
      kelasEl.appendChild(option);
    });

  tampilkanPesan(
    `Data berhasil dimuat. Ditemukan ${semuaDataGuru.length} catatan presensi.`
  );
}

// ==================================================
// 6. FILTER BERDASARKAN RENTANG TANGGAL
// ==================================================

function ambilDataPeriode() {
  const mulai = tanggalMulaiEl.value;
  const akhir = tanggalAkhirEl.value;
  const kelas = kelasEl.value;

  if (!mulai || !akhir) {
    throw new Error("Tanggal mulai dan tanggal akhir wajib diisi.");
  }

  if (mulai > akhir) {
    throw new Error("Tanggal mulai tidak boleh setelah tanggal akhir.");
  }

  return semuaDataGuru.filter(data => {
    const tanggal = String(data.tanggal || "");
    const kelasSiswa = kelasData(data);

    return (
      tanggal >= mulai &&
      tanggal <= akhir &&
      (!kelas || kelasSiswa === kelas)
    );
  });
}

// ==================================================
// 7. REKAP HARIAN
// ==================================================

function buatRekapHarian(data) {
  const urut = [...data].sort((a, b) => {
    const tgl = String(a.tanggal || "")
      .localeCompare(String(b.tanggal || ""));

    if (tgl !== 0) return tgl;

    const kelas = bandingkanTeks(a.kelas, b.kelas);
    if (kelas !== 0) return kelas;

    return bandingkanTeks(a.namaSiswa, b.namaSiswa);
  });

  const baris = urut.map((d, i) => [
    i + 1,
    formatTanggal(d.tanggal),
    d.kelas || "-",
    d.nisn || "-",
    d.namaSiswa || "-",
    d.mataPelajaran || "-",
    normalisasiStatus(d.status)
  ]);

  tampilkanTabel(
    [
      "No.",
      "Tanggal",
      "Kelas",
      "NISN",
      "Nama Siswa",
      "Mata Pelajaran",
      "Status"
    ],
    baris
  );

  return {
    judul: "Rekap Presensi Harian",
    kolom: [
      "No.",
      "Tanggal",
      "Kelas",
      "NISN",
      "Nama Siswa",
      "Mata Pelajaran",
      "Status"
    ],
    baris
  };
}

// ==================================================
// 8. REKAP RINGKASAN PER SISWA
// ==================================================

function buatRekapBulanan(data) {
  const kelompok = new Map();

  data.forEach(d => {
    const nisn = String(d.nisn || "").trim();

    // NISN diperlukan untuk membedakan siswa secara konsisten.
    if (!nisn) return;

    if (!kelompok.has(nisn)) {
      kelompok.set(nisn, {
        nisn,
        nama: d.namaSiswa || "-",
        kelas: d.kelas || "-",
        Hadir: 0,
        Sakit: 0,
        Izin: 0,
        Alpa: 0,
        Lainnya: 0
      });
    }

    const rekap = kelompok.get(nisn);
    const status = normalisasiStatus(d.status);

    if (status in rekap) {
      rekap[status]++;
    } else {
      rekap.Lainnya++;
    }
  });

  const hasil = [...kelompok.values()].sort((a, b) => {
    const kelas = bandingkanTeks(a.kelas, b.kelas);

    if (kelas !== 0) return kelas;

    return bandingkanTeks(a.nama, b.nama);
  });

  const baris = hasil.map((d, i) => [
    i + 1,
    d.kelas,
    d.nisn,
    d.nama,
    d.Hadir,
    d.Sakit,
    d.Izin,
    d.Alpa,
    d.Lainnya
  ]);

  const kolom = [
    "No.",
    "Kelas",
    "NISN",
    "Nama Siswa",
    "Hadir",
    "Sakit",
    "Izin",
    "Alpa",
    "Lainnya"
  ];

  tampilkanTabel(kolom, baris);

  return {
    judul: "Rekap Presensi Per Siswa",
    kolom,
    baris
  };
}

// ==================================================
// 9. HITUNG RINGKASAN STATUS
// ==================================================

function hitungStatistik(data) {
  const hasil = {
    catatan: data.length,
    Hadir: 0,
    Sakit: 0,
    Izin: 0,
    Alpa: 0
  };

  data.forEach(d => {
    const status = normalisasiStatus(d.status);

    if (status in hasil) {
      hasil[status]++;
    }
  });

  el("jumlahCatatan").textContent = hasil.catatan;
  el("jumlahHadir").textContent = hasil.Hadir;
  el("jumlahSakit").textContent = hasil.Sakit;
  el("jumlahIzin").textContent = hasil.Izin;
  el("jumlahAlpa").textContent = hasil.Alpa;
}

// ==================================================
// 10. TAMPILKAN REKAP
// ==================================================

function tampilkanRekap() {
  const data = ambilDataPeriode();
  const mulai = tanggalMulaiEl.value;
  const akhir = tanggalAkhirEl.value;
  const jenis = jenisRekapEl.value;
  const kelas = kelasEl.value;

  dataTampil = data;

  hitungStatistik(data);

  el("judulRekap").textContent =
    jenis === "harian"
      ? "Rekap Presensi Harian"
      : "Rekap Presensi Per Siswa";

  el("periode").textContent =
    `Periode: ${formatTanggal(mulai)} sampai ${formatTanggal(akhir)}` +
    (kelas ? ` | Kelas: ${kelas}` : " | Semua kelas yang tersedia");

  el("statusHasil").textContent =
    `Ditemukan ${data.length} catatan presensi pada periode yang dipilih.`;

  const hasil = jenis === "harian"
    ? buatRekapHarian(data)
    : buatRekapBulanan(data);

  btnPDF.disabled = hasil.baris.length === 0;

  return hasil;
}

// ==================================================
// 11. UNDUH PDF
// ==================================================

function unduhPDF() {
  if (!dataTampil.length) {
    tampilkanPesan("Tidak ada data untuk diunduh.", true);
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    tampilkanPesan(
      "Library PDF belum berhasil dimuat. Periksa koneksi internet.",
      true
    );
    return;
  }

  const jsPDF = window.jspdf.jsPDF;
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const jenis = jenisRekapEl.value;
  const mulai = tanggalMulaiEl.value;
  const akhir = tanggalAkhirEl.value;
  const kelas = kelasEl.value;

  const hasil = jenis === "harian"
    ? buatRekapHarian(dataTampil)
    : buatRekapBulanan(dataTampil);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("REKAP PRESENSI SISWA", 148, 14, {
    align: "center"
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("SMAN 2 RANGKASBITUNG", 148, 21, {
    align: "center"
  });

  pdf.setFontSize(9);
  pdf.text(`Guru: ${guruAktif.nama}`, 14, 30);
  pdf.text(
    `Periode: ${formatTanggal(mulai)} - ${formatTanggal(akhir)}`,
    14,
    36
  );
  pdf.text(`Jenis rekap: ${hasil.judul}`, 14, 42);

  if (kelas) {
    pdf.text(`Kelas: ${kelas}`, 14, 48);
  }

  const yTabel = kelas ? 54 : 48;

  pdf.autoTable({
    startY: yTabel,
    head: [hasil.kolom],
    body: hasil.baris,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2
    },
    headStyles: {
      fillColor: [20, 83, 45]
    },
    margin: {
      left: 10,
      right: 10
    }
  });

  const halaman = pdf.internal.getNumberOfPages();

  for (let i = 1; i <= halaman; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);

    pdf.text(
      `Dicetak: ${new Date().toLocaleString("id-ID")}`,
      10,
      203
    );

    pdf.text(
      `Halaman ${i} dari ${halaman}`,
      287,
      203,
      { align: "right" }
    );
  }

  const namaFile =
    `rekap-presensi-${jenis}-${mulai}-${akhir}.pdf`;

  pdf.save(namaFile);
}

// ==================================================
// 12. EVENT DAN LOGIN
// ==================================================

btnTampilkan.addEventListener("click", () => {
  try {
    tampilkanRekap();
    tampilkanPesan("Rekap berhasil ditampilkan.");
  } catch (error) {
    tampilkanPesan(error.message || "Gagal menampilkan rekap.", true);
  }
});

btnPDF.addEventListener("click", () => {
  try {
    unduhPDF();
  } catch (error) {
    console.error(error);
    tampilkanPesan("Gagal membuat PDF. Periksa konsol browser.", true);
  }
});

btnKembali.addEventListener("click", () => {
  window.location.href = "./presensi-guru.html";
});

jenisRekapEl.addEventListener("change", () => {
  btnPDF.disabled = true;
});

kelasEl.addEventListener("change", () => {
  btnPDF.disabled = true;
});

tanggalMulaiEl.addEventListener("change", () => {
  btnPDF.disabled = true;
});

tanggalAkhirEl.addEventListener("change", () => {
  btnPDF.disabled = true;
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("./index.html");
    return;
  }

  try {
    await periksaAkunGuru(user);
  } catch (error) {
    console.error("Gagal membuka rekap:", error);

    konten.classList.add("hidden");
    tampilkanPesan(
      error.message || "Tidak dapat memuat halaman rekap.",
      true
    );
  }
});
