
import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

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
const $ = id => document.getElementById(id);

const STATUS = ["Hadir", "Sakit", "Izin", "Alpa"];

let guruAktif = null;
let daftarJadwal = [];
let jadwalTerpilih = null;
let daftarSiswa = [];
let statusSiswa = new Map();
let siapSimpan = false;
let sedangMenyimpan = false;

function tanggalLokal() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");
  return `${tahun}-${bulan}-${tanggal}`;
}

function tampilkanPesan(teks, tipe = "info") {
  const el = $("pesan");
  el.hidden = false;
  el.textContent = teks;
  el.style.background = tipe === "error" ? "#fbe7e7" :
    tipe === "sukses" ? "#e4f5e9" : "#edf3fa";
  el.style.color = tipe === "error" ? "#8c2020" :
    tipe === "sukses" ? "#176334" : "#173a5e";
}

async function periksaGuru(user) {
  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) {
    throw new Error("Profil guru tidak ditemukan di Firestore.");
  }

  const data = snap.data();

  if (data.role !== "guru" || data.aktif !== true) {
    throw new Error("Akses ditolak. Akun bukan guru aktif.");
  }

  guruAktif = {
    uid: user.uid,
    nama: data.nama || user.email || "Guru"
  };

  $("namaGuru").textContent = `Guru: ${guruAktif.nama}`;
}

async function muatJadwalGuru() {
  const q = query(
    collection(db, "jadwal"),
    where("guruUid", "==", guruAktif.uid),
    where("aktif", "==", true)
  );

  const snap = await getDocs(q);

  daftarJadwal = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  daftarJadwal.sort((a, b) =>
    (a.hari || "").localeCompare(b.hari || "", "id") ||
    Number(a.jamMulai || 0) - Number(b.jamMulai || 0) ||
    (a.kelas || "").localeCompare(b.kelas || "", "id")
  );

  const select = $("jadwal");
  select.replaceChildren();

  const awal = document.createElement("option");
  awal.value = "";
  awal.textContent = daftarJadwal.length
    ? "Pilih jadwal mengajar"
    : "Belum ada jadwal aktif";
  select.appendChild(awal);

  for (const j of daftarJadwal) {
    const opt = document.createElement("option");
    opt.value = j.id;
    opt.textContent =
      `${j.hari} | ${j.kelas} | ${j.mataPelajaran} | Jam ${j.jamMulai}-${j.jamSelesai}`;
    select.appendChild(opt);
  }

  select.disabled = daftarJadwal.length === 0;

  if (!daftarJadwal.length) {
    tampilkanPesan(
      "Belum ada jadwal aktif untuk akun guru ini. Hubungi admin untuk memeriksa jadwal.",
      "error"
    );
  }
}

function buatIdPresensi(tanggal, jadwalId, nisn) {
  // NISN harus berupa angka agar aman digunakan pada ID dokumen.
  // ID jadwal dari Firestore tidak mengandung tanda slash.
  return `${tanggal}__${jadwalId}__${nisn}`;
}

async function muatPresensiSiswa() {
  siapSimpan = false;
  $("btnSimpan").disabled = true;
  $("btnHadirSemua").disabled = true;

  const tanggal = $("tanggal").value;
  const jadwalId = $("jadwal").value;

  if (!tanggal || !jadwalId) {
    tampilkanPesan("Pilih tanggal dan jadwal terlebih dahulu.", "error");
    return;
  }

  jadwalTerpilih = daftarJadwal.find(j => j.id === jadwalId);

  if (!jadwalTerpilih || jadwalTerpilih.guruUid !== guruAktif.uid) {
    tampilkanPesan("Jadwal tidak valid untuk akun guru ini.", "error");
    return;
  }

  try {
    // Data siswa memakai NISN sebagai ID dokumen sesuai Tahap 4.
    const qSiswa = query(
      collection(db, "siswa"),
      where("kelas", "==", jadwalTerpilih.kelas),
      where("aktif", "==", true)
    );

    const snapSiswa = await getDocs(qSiswa);

    daftarSiswa = snapSiswa.docs.map(d => ({
      id: d.id,
      ...d.data()
    })).sort((a, b) =>
      (a.nama || "").localeCompare(b.nama || "", "id")
    );

    if (daftarSiswa.some(s => !/^\d{10}$/.test(String(s.nisn || s.id)))) {
      tampilkanPesan(
        "Ada data siswa yang NISN-nya bukan 10 digit. Periksa data siswa sebelum melanjutkan.",
        "error"
      );
      return;
    }

    // Membaca presensi milik guru sendiri. Filter tanggal dan jadwal
    // dilakukan di browser setelah query dibatasi dengan guruUid.
    const qPresensi = query(
      collection(db, "presensi"),
      where("guruUid", "==", guruAktif.uid)
    );

    const snapPresensi = await getDocs(qPresensi);

    const tersimpan = new Map();

    for (const d of snapPresensi.docs) {
      const p = d.data();

      if (p.tanggal === tanggal && p.jadwalId === jadwalId) {
        tersimpan.set(String(p.siswaId), p.status);
      }
    }

    statusSiswa = new Map();

    for (const s of daftarSiswa) {
      const nisn = String(s.nisn || s.id);
      statusSiswa.set(
        nisn,
        tersimpan.get(nisn) || "Hadir"
      );
    }

    $("infoJadwal").textContent =
      `${jadwalTerpilih.hari} | ${jadwalTerpilih.kelas} | ` +
      `${jadwalTerpilih.mataPelajaran} | ` +
      `Jam ${jadwalTerpilih.jamMulai}-${jadwalTerpilih.jamSelesai} | ${tanggal}`;

    tampilkanSiswa();

    siapSimpan = true;
    $("btnSimpan").disabled = daftarSiswa.length === 0;
    $("btnHadirSemua").disabled = daftarSiswa.length === 0;

    tampilkanPesan(
      daftarSiswa.length
        ? `Berhasil memuat ${daftarSiswa.length} siswa. Periksa status sebelum menyimpan.`
        : "Tidak ada siswa aktif pada kelas ini. Periksa koleksi siswa.",
      daftarSiswa.length ? "sukses" : "error"
    );
  } catch (error) {
    console.error("Gagal memuat presensi:", error);
    tampilkanPesan(
      "Gagal memuat siswa atau presensi. Periksa Firestore Rules dan data kelas.",
      "error"
    );
  }
}

function tampilkanSiswa() {
  const tbody = $("tabelSiswa");
  tbody.replaceChildren();

  if (!daftarSiswa.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Tidak ada siswa pada kelas ini.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    perbaruiRingkasan();
    return;
  }

  daftarSiswa.forEach((s, index) => {
    const nisn = String(s.nisn || s.id);
    const tr = document.createElement("tr");

    const kolom = [
      String(index + 1),
      nisn,
      s.nama || "(Nama belum diisi)",
      s.kelas || ""
    ];

    for (const teks of kolom) {
      const td = document.createElement("td");
      td.textContent = teks;
      tr.appendChild(td);
    }

    const tdStatus = document.createElement("td");
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Status ${s.nama || nisn}`);

    for (const status of STATUS) {
      const opt = document.createElement("option");
      opt.value = status;
      opt.textContent = status;
      select.appendChild(opt);
    }

    select.value = statusSiswa.get(nisn) || "Hadir";

    select.addEventListener("change", () => {
      statusSiswa.set(nisn, select.value);
      perbaruiRingkasan();
    });

    tdStatus.appendChild(select);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  });

  perbaruiRingkasan();
}

function perbaruiRingkasan() {
  const jumlah = {
    Hadir: 0,
    Sakit: 0,
    Izin: 0,
    Alpa: 0
  };

  for (const status of statusSiswa.values()) {
    if (Object.hasOwn(jumlah, status)) {
      jumlah[status]++;
    }
  }

  $("totalSiswa").textContent = `Siswa: ${daftarSiswa.length}`;
  $("totalHadir").textContent = `Hadir: ${jumlah.Hadir}`;
  $("totalSakit").textContent = `Sakit: ${jumlah.Sakit}`;
  $("totalIzin").textContent = `Izin: ${jumlah.Izin}`;
  $("totalAlpa").textContent = `Alpa: ${jumlah.Alpa}`;
}

$("btnHadirSemua").addEventListener("click", () => {
  if (!siapSimpan) return;

  for (const s of daftarSiswa) {
    statusSiswa.set(String(s.nisn || s.id), "Hadir");
  }

  tampilkanSiswa();
  tampilkanPesan(
    "Semua siswa diatur menjadi Hadir. Tekan Simpan Presensi untuk menyimpan perubahan.",
    "info"
  );
});

$("btnMuat").addEventListener("click", muatPresensiSiswa);

$("jadwal").addEventListener("change", () => {
  siapSimpan = false;
  $("btnSimpan").disabled = true;
  $("btnHadirSemua").disabled = true;
  $("tabelSiswa").innerHTML =
    '<tr><td colspan="5">Klik Tampilkan Siswa untuk memuat jadwal.</td></tr>';
});

$("tanggal").addEventListener("change", () => {
  siapSimpan = false;
  $("btnSimpan").disabled = true;
  $("btnHadirSemua").disabled = true;
  $("tabelSiswa").innerHTML =
    '<tr><td colspan="5">Klik Tampilkan Siswa untuk memuat presensi tanggal ini.</td></tr>';
});

$("btnSimpan").addEventListener("click", async () => {
  if (!siapSimpan || sedangMenyimpan || !jadwalTerpilih) return;

  if (!daftarSiswa.length) {
    tampilkanPesan("Tidak ada data siswa untuk disimpan.", "error");
    return;
  }

  const tanggal = $("tanggal").value;

  if (!tanggal) {
    tampilkanPesan("Tanggal presensi wajib diisi.", "error");
    return;
  }

  if (!confirm(
    `Simpan presensi ${daftarSiswa.length} siswa untuk ` +
    `${jadwalTerpilih.kelas} tanggal ${tanggal}?`
  )) return;

  sedangMenyimpan = true;
  $("btnSimpan").disabled = true;
  $("btnHadirSemua").disabled = true;

  let tersimpan = 0;

  try {
    // setDoc dengan ID deterministik mencegah duplikat untuk
    // kombinasi tanggal + jadwal + NISN yang sama.
    for (const s of daftarSiswa) {
      const nisn = String(s.nisn || s.id);
      const id = buatIdPresensi(tanggal, jadwalTerpilih.id, nisn);

      await setDoc(doc(db, "presensi", id), {
        tanggal,
        jadwalId: jadwalTerpilih.id,
        guruUid: guruAktif.uid,
        guruNama: guruAktif.nama,
        kelas: jadwalTerpilih.kelas,
        mataPelajaran: jadwalTerpilih.mataPelajaran,
        jamMulai: Number(jadwalTerpilih.jamMulai),
        jamSelesai: Number(jadwalTerpilih.jamSelesai),
        siswaId: nisn,
        nisn,
        namaSiswa: s.nama || "",
        status: statusSiswa.get(nisn) || "Hadir",
        diperbaruiPada: serverTimestamp()
      }, { merge: true });

      tersimpan++;
    }

    tampilkanPesan(
      `Berhasil menyimpan ${tersimpan} dari ${daftarSiswa.length} presensi.`,
      "sukses"
    );
  } catch (error) {
    console.error("Gagal menyimpan presensi:", error);
    tampilkanPesan(
      `Penyimpanan berhenti setelah ${tersimpan} siswa. ` +
      "Sebagian data mungkin sudah tersimpan. Periksa Firestore sebelum mengulang.",
      "error"
    );
  } finally {
    sedangMenyimpan = false;
    $("btnSimpan").disabled = !siapSimpan;
    $("btnHadirSemua").disabled = !siapSimpan;
  }
});

$("btnKeluar").addEventListener("click", async () => {
  await signOut(auth);
  location.replace("./login.html");
});

$("tanggal").value = tanggalLokal();

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("./login.html");
    return;
  }

  try {
    await periksaGuru(user);
    await muatJadwalGuru();
  } catch (error) {
    console.error(error);
    tampilkanPesan(
      error.message || "Gagal memeriksa akun guru.",
      "error"
    );
  }
});
