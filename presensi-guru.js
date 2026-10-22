import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

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
  where,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// =====================================================
// KONFIGURASI FIREBASE
// Gunakan konfigurasi yang sama dengan aplikasi Anda.
// =====================================================

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

// =====================================================
// ELEMEN HTML
// =====================================================

const namaGuruEl = document.getElementById("namaGuru");
const pesanEl = document.getElementById("pesan");
const tanggalEl = document.getElementById("tanggal");
const jadwalEl = document.getElementById("jadwal");
const infoJadwalEl = document.getElementById("infoJadwal");

const btnMuat = document.getElementById("btnMuat");
const btnHadirSemua = document.getElementById("btnHadirSemua");
const btnSimpan = document.getElementById("btnSimpan");
const btnKeluar = document.getElementById("btnKeluar");

const totalSiswaEl = document.getElementById("totalSiswa");
const totalHadirEl = document.getElementById("totalHadir");
const totalSakitEl = document.getElementById("totalSakit");
const totalIzinEl = document.getElementById("totalIzin");
const totalAlpaEl = document.getElementById("totalAlpa");

const tabelSiswaEl = document.getElementById("tabelSiswa");

// =====================================================
// VARIABEL APLIKASI
// =====================================================

let guruAktif = null;
let daftarJadwal = [];
let daftarSiswa = [];
let presensiTersimpan = {};
let sedangMemuat = false;
let sedangMenyimpan = false;

const PILIHAN_STATUS = ["Hadir", "Sakit", "Izin", "Alpa"];

// =====================================================
// CSS RADIO BUTTON
// =====================================================

function pasangCSSRadio() {
  if (document.getElementById("cssRadioPresensi")) return;

  const style = document.createElement("style");
  style.id = "cssRadioPresensi";

  style.textContent = `
    .presensi-status-radio {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 5px;
      width: 100%;
      min-width: 245px;
    }

    .presensi-status-radio label {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 8px 2px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #ffffff;
      color: #374151;
      font-size: 12px;
      cursor: pointer;
      text-align: center;
      box-sizing: border-box;
      transition: background .15s, border-color .15s;
    }

    .presensi-status-radio label:has(input:checked) {
      border-color: #16803d;
      background: #ecfdf3;
      color: #166534;
      font-weight: 700;
    }

    .presensi-status-radio input[type="radio"] {
      width: 17px;
      height: 17px;
      margin: 0;
      accent-color: #16803d;
      cursor: pointer;
    }

    .presensi-status-radio label:focus-within {
      outline: 2px solid #86efac;
      outline-offset: 1px;
    }

    #tabelSiswa td {
      vertical-align: middle;
    }

    .presensi-nama-siswa {
      min-width: 150px;
    }

    .presensi-nisn {
      color: #6b7280;
      font-size: 12px;
    }

    .presensi-pesan-error {
      color: #b91c1c;
    }

    @media (max-width: 480px) {
      .presensi-status-radio {
        min-width: 235px;
        gap: 3px;
      }

      .presensi-status-radio label {
        font-size: 11px;
        padding: 7px 1px;
      }

      .presensi-status-radio input[type="radio"] {
        width: 16px;
        height: 16px;
      }
    }
  `;

  document.head.appendChild(style);
}

// =====================================================
// UTILITAS
// =====================================================

function tampilkanPesan(teks, error = false) {
  if (!pesanEl) return;

  pesanEl.textContent = teks;
  pesanEl.classList.toggle("presensi-pesan-error", error);
}

function escapeHTML(nilai) {
  return String(nilai ?? "").replace(/[&<>"']/g, karakter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[karakter]);
}

function tanggalHariIni() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${hari}`;
}

// Mengubah tanggal menjadi nama hari dalam bahasa Indonesia.
function namaHariDariTanggal(tanggal) {
  if (!tanggal) return "";

  const [tahun, bulan, hari] = tanggal.split("-").map(Number);
  const tanggalObjek = new Date(tahun, bulan - 1, hari);

  const namaHari = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu"
  ];

  return namaHari[tanggalObjek.getDay()];
}

// Format waktu jadwal menjadi teks.
function formatWaktu(jam) {
  if (jam === null || jam === undefined || jam === "") return "-";

  if (typeof jam === "number") {
    const totalMenit = Math.round(jam * 60);
    const hh = String(Math.floor(totalMenit / 60)).padStart(2, "0");
    const mm = String(totalMenit % 60).padStart(2, "0");

    return `${hh}:${mm}`;
  }

  return String(jam);
}

// Mengubah waktu "07:30" menjadi angka 7.5.
function waktuKeAngka(jam) {
  if (typeof jam === "number") return jam;

  const teks = String(jam || "");
  const cocok = teks.match(/^(\d{1,2}):(\d{2})$/);

  if (!cocok) {
    const angka = Number(jam);
    return Number.isFinite(angka) ? angka : null;
  }

  return Number(cocok[1]) + Number(cocok[2]) / 60;
}

// Mengubah waktu dari Firestore menjadi format input time.
function waktuUntukInput(jam) {
  if (typeof jam === "string" && /^\d{2}:\d{2}$/.test(jam)) {
    return jam;
  }

  const angka = Number(jam);

  if (!Number.isFinite(angka)) return "";

  const menitTotal = Math.round(angka * 60);

  return `${String(Math.floor(menitTotal / 60)).padStart(2, "0")}:${String(menitTotal % 60).padStart(2, "0")}`;
}

function ambilJadwalTerpilih() {
  const id = jadwalEl?.value;

  return daftarJadwal.find(jadwal => jadwal.id === id) || null;
}

function ambilStatusSiswa(nisn) {
  const radioTerpilih = document.querySelector(
    `input[name="status-${nisn}"]:checked`
  );

  return radioTerpilih?.value || "Hadir";
}

// =====================================================
// PEMERIKSAAN PROFIL GURU
// =====================================================

async function periksaGuru(user) {
  const refProfil = doc(db, "users", user.uid);
  const snapshot = await getDoc(refProfil);

  if (!snapshot.exists()) {
    throw new Error(
      "Profil pengguna tidak ditemukan pada koleksi users."
    );
  }

  const profil = snapshot.data();

  if (profil.aktif !== true) {
    throw new Error("Akun guru tidak aktif.");
  }

  if (profil.role !== "guru") {
    throw new Error("Akun ini bukan akun guru.");
  }

  return {
    uid: user.uid,
    nama: profil.nama || user.email || "Guru",
    email: user.email || ""
  };
}

// =====================================================
// MEMUAT JADWAL UNTUK PRESENSI
// =====================================================

async function muatJadwalGuru() {
  const tanggal = tanggalEl?.value;
  const hariDipilih = namaHariDariTanggal(tanggal);

  if (!hariDipilih) {
    tampilkanPesan("Pilih tanggal terlebih dahulu.", true);
    return;
  }

  tampilkanPesan(`Memuat jadwal hari ${hariDipilih}...`);

  if (jadwalEl) {
    jadwalEl.innerHTML = '<option value="">Memuat jadwal...</option>';
    jadwalEl.disabled = true;
  }

  try {
    const q = query(
      collection(db, "jadwal"),
      where("guruUid", "==", guruAktif.uid),
      where("aktif", "==", true)
    );

    const snapshot = await getDocs(q);

    daftarJadwal = snapshot.docs
      .map(dok => ({
        id: dok.id,
        ...dok.data()
      }))
      .filter(jadwal =>
        String(jadwal.hari || "").trim().toLowerCase() ===
        hariDipilih.toLowerCase()
      );

    daftarJadwal.sort((a, b) => {
      const kelasA = String(a.kelas || "");
      const kelasB = String(b.kelas || "");

      if (kelasA !== kelasB) {
        return kelasA.localeCompare(kelasB, "id");
      }

      return String(waktuUntukInput(a.jamMulai)).localeCompare(
        String(waktuUntukInput(b.jamMulai))
      );
    });

    jadwalEl.innerHTML =
      '<option value="">-- Pil
