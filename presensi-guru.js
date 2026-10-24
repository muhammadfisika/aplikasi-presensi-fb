
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// =====================================================
// KONFIGURASI FIREBASE
// Gunakan konfigurasi yang SAMA dengan aplikasi Anda.
// Ganti semua nilai GANTI_... dengan konfigurasi Firebase.
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
// CSS dibuat melalui JavaScript agar tidak perlu
// mengedit file HTML untuk tampilan radio button.
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

// Mengubah tanggal input menjadi nama hari dalam bahasa Indonesia.
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


function formatWaktu(jam) {
  return String(jam ?? "-");
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
// MEMUAT JADWAL MILIK GURU
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

    // Hanya tampilkan jadwal dengan hari yang sama.
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

      return Number(a.jamMulai || 0) - Number(b.jamMulai || 0);
    });

    jadwalEl.innerHTML =
      '<option value="">-- Pilih jadwal --</option>';

    if (daftarJadwal.length === 0) {
      jadwalEl.disabled = true;

      tampilkanPesan(
        `Tidak ada jadwal aktif untuk hari ${hariDipilih}. ` +
        "Periksa field hari, guruUid, dan aktif pada koleksi jadwal.",
        true
      );

      if (infoJadwalEl) infoJadwalEl.textContent = "";
      return;
    }

    daftarJadwal.forEach(jadwal => {
      const option = document.createElement("option");
      option.value = jadwal.id;
      option.textContent =
        `${jadwal.kelas || "-"} | ` +
        `${jadwal.mataPelajaran || "-"} | ` +
        `Jam ${jadwal.jamMulai}-${jadwal.jamSelesai}`;

      jadwalEl.appendChild(option);
    });

    jadwalEl.disabled = false;

    tampilkanPesan(
      `${daftarJadwal.length} jadwal ditemukan untuk hari ${hariDipilih}.`
    );

  } catch (error) {
    console.error("Gagal memuat jadwal:", error);

    tampilkanPesan(
      error.code === "permission-denied"
        ? "Akses jadwal ditolak oleh Firestore Rules."
        : `Jadwal gagal dimuat: ${error.message}`,
      true
    );
  }
}


// =====================================================
// MEMUAT DATA SISWA DALAM KELAS TERPILIH
// =====================================================

async function muatSiswa() {
  if (sedangMemuat || sedangMenyimpan) return;

  const jadwal = ambilJadwalTerpilih();
  const tanggal = tanggalEl?.value;

  if (!tanggal) {
    tampilkanPesan("Silakan pilih tanggal presensi.", true);
    return;
  }

  if (!jadwal) {
    tampilkanPesan("Silakan pilih jadwal pelajaran.", true);
    return;
  }

  sedangMemuat = true;

  if (btnMuat) btnMuat.disabled = true;
  if (btnSimpan) btnSimpan.disabled = true;
  if (tabelSiswaEl) {
    tabelSiswaEl.innerHTML =
      '<tr><td colspan="4">Memuat data siswa...</td></tr>';
  }

  try {
    if (infoJadwalEl) {
      infoJadwalEl.textContent =
        `${jadwal.kelas} | ${jadwal.mataPelajaran} | ` +
        `Jam ${jadwal.jamMulai}-${jadwal.jamSelesai} | ${tanggal}`;
    }

    // Baca siswa berdasarkan kelas jadwal.
    const qSiswa = query(
      collection(db, "siswa"),
      where("kelas", "==", jadwal.kelas),
      where("aktif", "==", true)
    );

    const snapshotSiswa = await getDocs(qSiswa);

    daftarSiswa = snapshotSiswa.docs.map(dok => ({
      id: dok.id,
      ...dok.data()
    }));

    // Urutkan nama siswa.
    daftarSiswa.sort((a, b) =>
      String(a.nama || "").localeCompare(
        String(b.nama || ""),
        "id"
      )
    );

    if (daftarSiswa.length === 0) {
      // Periksa apakah siswa kelas ini ada tetapi tidak aktif,
      // atau field aktif belum diisi dengan Boolean true.
      const qSemuaKelas = query(
        collection(db, "siswa"),
        where("kelas", "==", jadwal.kelas)
      );

      const semuaSiswa = await getDocs(qSemuaKelas);

      if (semuaSiswa.empty) {
        throw new Error(
          `Tidak ditemukan data siswa untuk kelas "${jadwal.kelas}". ` +
          "Periksa ejaan field kelas pada koleksi siswa dan jadwal."
        );
      }

      throw new Error(
        `Ada ${semuaSiswa.size} data siswa pada kelas "${jadwal.kelas}", ` +
        "tetapi tidak ada yang memenuhi aktif: true. " +
        "Pastikan field aktif bertipe Boolean true, bukan teks."
      );
    }

    // Memuat data presensi sebelumnya untuk guru.
    // Mengambil data guru ini lalu menyaring tanggal dan jadwal
    // agar sesuai dengan struktur kode sebelumnya.
    const qPresensi = query(
      collection(db, "presensi"),
      where("guruUid", "==", guruAktif.uid)
    );

    const snapshotPresensi = await getDocs(qPresensi);

    presensiTersimpan = {};

    snapshotPresensi.docs.forEach(dok => {
      const data = dok.data();

      if (
        data.tanggal === tanggal &&
        data.jadwalId === jadwal.id
      ) {
        const nisn = String(data.nisn || data.siswaId || "");
        if (nisn) presensiTersimpan[nisn] = data.status;
      }
    });

    tampilkanDaftarSiswa();
    hitungRekap();

    tampilkanPesan(
      `Berhasil memuat ${daftarSiswa.length} siswa kelas ${jadwal.kelas}.`
    );

    if (btnSimpan) btnSimpan.disabled = false;
  } catch (error) {
    console.error("Gagal memuat siswa/presensi:", error);

    if (tabelSiswaEl) {
      tabelSiswaEl.innerHTML =
        `<tr><td colspan="4">${escapeHTML(error.message)}</td></tr>`;
    }

    daftarSiswa = [];
    presensiTersimpan = {};
    hitungRekap();

    tampilkanPesan(
      error.code === "permission-denied"
        ? "Akses baca ditolak oleh Firestore Rules. " +
          "Pastikan guru diizinkan membaca koleksi siswa dan presensi."
        : error.message || "Gagal memuat data siswa.",
      true
    );
  } finally {
    sedangMemuat = false;

    if (btnMuat) btnMuat.disabled = false;

    if (btnSimpan) {
      btnSimpan.disabled =
        daftarSiswa.length === 0 || sedangMenyimpan;
    }
  }
}

// =====================================================
// TAMPILKAN TABEL DENGAN 4 KOLOM RADIO
// =====================================================

function tampilkanDaftarSiswa() {
  if (!tabelSiswaEl) {
    throw new Error(
      'Elemen HTML dengan id "tabelSiswa" tidak ditemukan.'
    );
  }

  if (daftarSiswa.length === 0) {
    tabelSiswaEl.innerHTML =
      '<tr><td colspan="4">Tidak ada siswa untuk ditampilkan.</td></tr>';
    return;
  }

  tabelSiswaEl.innerHTML = "";

  daftarSiswa.forEach((siswa, index) => {
    const nisn = String(siswa.nisn || siswa.id || "");
    const nama = String(siswa.nama || "Tanpa nama");
    const statusTersimpan = presensiTersimpan[nisn];
    const statusAwal = PILIHAN_STATUS.includes(statusTersimpan)
      ? statusTersimpan
      : "Hadir";

    const tr = document.createElement("tr");

    const nomorTd = document.createElement("td");
    nomorTd.textContent = String(index + 1);

    const namaTd = document.createElement("td");
    namaTd.className = "presensi-nama-siswa";
    namaTd.innerHTML = `
      <div>${escapeHTML(nama)}</div>
      <div class="presensi-nisn">NISN: ${escapeHTML(nisn)}</div>
    `;

    const statusTd = document.createElement("td");
    statusTd.colSpan = 2;

    const grup = document.createElement("div");
    grup.className = "presensi-status-radio";

    PILIHAN_STATUS.forEach(status => {
      const label = document.createElement("label");
      const radio = document.createElement("input");

      radio.type = "radio";
      radio.name = `status-${nisn}`;
      radio.value = status;
      radio.checked = statusAwal === status;
      radio.setAttribute(
        "aria-label",
        `${nama}: ${status}`
      );

      const teks = document.createElement("span");
      teks.textContent = status;

      label.append(radio, teks);
      grup.appendChild(label);

      radio.addEventListener("change", hitungRekap);
    });

    statusTd.appendChild(grup);
    tr.append(nomorTd, namaTd, statusTd);
    tabelSiswaEl.appendChild(tr);
  });

  hitungRekap();
}

// =====================================================
// REKAP JUMLAH STATUS
// =====================================================

function hitungRekap() {
  const jumlah = {
    Hadir: 0,
    Sakit: 0,
    Izin: 0,
    Alpa: 0
  };

  daftarSiswa.forEach(siswa => {
    const nisn = String(siswa.nisn || siswa.id || "");
    const status = ambilStatusSiswa(nisn);

    if (Object.prototype.hasOwnProperty.call(jumlah, status)) {
      jumlah[status]++;
    }
  });

  if (totalSiswaEl) {
    totalSiswaEl.textContent = String(daftarSiswa.length);
  }

  if (totalHadirEl) totalHadirEl.textContent = String(jumlah.Hadir);
  if (totalSakitEl) totalSakitEl.textContent = String(jumlah.Sakit);
  if (totalIzinEl) totalIzinEl.textContent = String(jumlah.Izin);
  if (totalAlpaEl) totalAlpaEl.textContent = String(jumlah.Alpa);
}

// =====================================================
// TOMBOL HADIR SEMUA
// =====================================================

function tandaiSemuaHadir() {
  if (daftarSiswa.length === 0) {
    tampilkanPesan("Muat daftar siswa terlebih dahulu.", true);
    return;
  }

  daftarSiswa.forEach(siswa => {
    const nisn = String(siswa.nisn || siswa.id || "");
    const radioHadir = document.querySelector(
      `input[name="status-${nisn}"][value="Hadir"]`
    );

    if (radioHadir) radioHadir.checked = true;
  });

  hitungRekap();
  tampilkanPesan(
    "Semua siswa ditandai Hadir. Tekan Simpan Presensi untuk menyimpan."
  );
}

// =====================================================
// SIMPAN PRESENSI KE FIRESTORE
// =====================================================

async function simpanPresensi() {
  if (sedangMenyimpan || sedangMemuat) return;

  if (!auth.currentUser || !guruAktif) {
    tampilkanPesan("Sesi login tidak ditemukan. Silakan login kembali.", true);
    return;
  }

  const jadwal = ambilJadwalTerpilih();
  const tanggal = tanggalEl?.value;

  if (!tanggal || !jadwal) {
    tampilkanPesan("Pilih tanggal dan jadwal terlebih dahulu.", true);
    return;
  }

  if (daftarSiswa.length === 0) {
    tampilkanPesan("Daftar siswa masih kosong. Muat siswa terlebih dahulu.", true);
    return;
  }

  sedangMenyimpan = true;

  if (btnSimpan) {
    btnSimpan.disabled = true;
    btnSimpan.textContent = "Menyimpan...";
  }

  try {
    let berhasil = 0;

    for (const siswa of daftarSiswa) {
      const nisn = String(siswa.nisn || siswa.id || "").trim();
      const namaSiswa = String(siswa.nama || "").trim();
      const status = ambilStatusSiswa(nisn);

      if (!nisn || !PILIHAN_STATUS.includes(status)) {
        throw new Error(
          `NISN atau status tidak valid untuk siswa ${namaSiswa || "(tanpa nama)"}.`
        );
      }

      // ID deterministik mencegah duplikasi presensi
      // untuk siswa, tanggal, dan jadwal yang sama.
      const idPresensi = `${tanggal}__${jadwal.id}__${nisn}`;

      const dataPresensi = {
        tanggal,
        jadwalId: jadwal.id,
        guruUid: guruAktif.uid,
        guruNama: guruAktif.nama,
        kelas: jadwal.kelas,
        mataPelajaran: jadwal.mataPelajaran,
        jamMulai: Number(jadwal.jamMulai),
        jamSelesai: Number(jadwal.jamSelesai),
        siswaId: nisn,
        nisn,
        namaSiswa,
        status,
        diperbaruiPada: serverTimestamp()
      };

      await setDoc(
        doc(db, "presensi", idPresensi),
        dataPresensi,
        { merge: true }
      );

      berhasil++;
    }

    // Simpan kembali status lokal setelah berhasil.
    daftarSiswa.forEach(siswa => {
      const nisn = String(siswa.nisn || siswa.id || "");
      presensiTersimpan[nisn] = ambilStatusSiswa(nisn);
    });

    hitungRekap();

    tampilkanPesan(
      `Berhasil menyimpan presensi ${berhasil} siswa ` +
      `kelas ${jadwal.kelas} tanggal ${tanggal}.`
    );
  } catch (error) {
    console.error("Gagal menyimpan presensi:", error);

    tampilkanPesan(
      error.code === "permission-denied"
        ? "Penyimpanan ditolak oleh Firestore Rules. " +
          "Periksa UID guru, jadwal aktif, kelas siswa, dan aturan presensi."
        : `Presensi gagal disimpan: ${error.message}. ` +
          "Sebagian data mungkin sudah tersimpan; periksa data sebelum mencoba lagi.",
      true
    );
  } finally {
    sedangMenyimpan = false;

    if (btnSimpan) {
      btnSimpan.disabled = daftarSiswa.length === 0;
      btnSimpan.textContent = "Simpan Presensi";
    }
  }
}

// =====================================================
// EVENT TOMBOL
// =====================================================

if (btnMuat) {
  btnMuat.addEventListener("click", muatSiswa);
}

if (btnHadirSemua) {
  btnHadirSemua.addEventListener("click", tandaiSemuaHadir);
}

if (btnSimpan) {
  btnSimpan.addEventListener("click", simpanPresensi);
}

if (jadwalEl) {
  jadwalEl.addEventListener("change", () => {
    daftarSiswa = [];
    presensiTersimpan = {};

    if (tabelSiswaEl) {
      tabelSiswaEl.innerHTML =
        '<tr><td colspan="4">Tekan Tampilkan Siswa untuk memuat daftar.</td></tr>';
    }

    hitungRekap();

    if (infoJadwalEl) {
      const jadwal = ambilJadwalTerpilih();

      infoJadwalEl.textContent = jadwal
        ? `${jadwal.kelas} | ${jadwal.mataPelajaran} | ` +
          `Jam ${jadwal.jamMulai}-${jadwal.jamSelesai}`
        : "";
    }

    if (btnSimpan) btnSimpan.disabled = true;
  });
}

if (tanggalEl) {
  tanggalEl.addEventListener("change", () => {
    daftarSiswa = [];
    presensiTersimpan = {};

    if (tabelSiswaEl) {
      tabelSiswaEl.innerHTML =
        '<tr><td colspan="4">Tekan Tampilkan Siswa untuk memuat daftar.</td></tr>';
    }

    hitungRekap();

    if (btnSimpan) btnSimpan.disabled = true;
  });
}

if (btnKeluar) {
  btnKeluar.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.replace("./login.html");
    } catch (error) {
      console.error("Gagal logout:", error);
      tampilkanPesan("Gagal keluar. Silakan coba kembali.", true);
    }
  });
}

// =====================================================
// MULAI APLIKASI
// =====================================================

pasangCSSRadio();

if (tanggalEl && !tanggalEl.value) {
  tanggalEl.value = tanggalHariIni();
}

if (btnSimpan) btnSimpan.disabled = true;

if (tabelSiswaEl) {
  tabelSiswaEl.innerHTML =
    '<tr><td colspan="4">Memeriksa sesi login...</td></tr>';
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("./login.html");
    return;
  }

  try {
    guruAktif = await periksaGuru(user);

    if (namaGuruEl) {
      namaGuruEl.textContent = guruAktif.nama;
    }

    await muatJadwalGuru();
  } catch (error) {
    console.error("Pemeriksaan akun guru gagal:", error);

    tampilkanPesan(
      `${error.message} Silakan periksa akun dan profil Firestore.`,
      true
    );

    if (
      error.message.includes("Profil pengguna") ||
      error.message.includes("bukan akun guru") ||
      error.message.includes("tidak aktif")
    ) {
      // Jangan logout otomatis; tampilkan pesan agar penyebabnya
      // dapat diperiksa terlebih dahulu.
    }
  }
});
