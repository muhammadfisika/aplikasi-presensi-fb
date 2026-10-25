
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
  addDoc,
  query,
  where,
  updateDoc,
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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let adminSiap = false;
let jadwal = [];
let guru = [];
let editId = null;
let menyimpan = false;

function pesan(teks, tipe = "info") {
  const el = $("pesan");
  el.hidden = false;
  el.textContent = teks;
  el.style.background = tipe === "error" ? "#fbe7e7" :
    tipe === "sukses" ? "#e4f5e9" : "#edf3fa";
  el.style.color = tipe === "error" ? "#8c2020" :
    tipe === "sukses" ? "#176334" : "#173a5e";
}

async function periksaAdmin(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) throw new Error("Profil admin tidak ditemukan.");

  const data = snap.data();
  if (data.role !== "admin" || data.aktif !== true) {
    throw new Error("Akses ditolak. Akun bukan admin aktif.");
  }
}

function resetForm() {
  $("formJadwal").reset();
  $("aktif").value = "true";
  editId = null;
  $("btnSimpan").textContent = "Simpan Jadwal";
}

async function muatGuru() {
  const snap = await getDocs(collection(db, "users"));
  guru = snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(d => d.role === "guru" && d.aktif === true)
    .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"));

  const select = $("guruUid");
  select.replaceChildren();

  const awal = document.createElement("option");
  awal.value = "";
  awal.textContent = "Pilih guru";
  select.appendChild(awal);

  for (const item of guru) {
    const opt = document.createElement("option");
    opt.value = item.uid;
    opt.textContent = `${item.nama || item.email || item.uid}`;
    select.appendChild(opt);
  }
}

async function muatJadwal() {
  const snap = await getDocs(collection(db, "jadwal"));
  jadwal = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  jadwal.sort((a, b) =>
    (a.hari || "").localeCompare(b.hari || "", "id") ||
    (a.kelas || "").localeCompare(b.kelas || "", "id") ||
    Number(a.jamMulai || 0) - Number(b.jamMulai || 0)
  );
  tampilkanJadwal();
}

function tampilkanJadwal() {
  const kata = $("cari").value.trim().toLowerCase();
  const tbody = $("tabelJadwal");
  tbody.replaceChildren();

  const hasil = jadwal.filter(j => {
    const namaGuru = guru.find(g => g.uid === j.guruUid)?.nama || j.guruNama || "";
    return [
      j.hari, j.kelas, j.mataPelajaran, namaGuru,
      j.jamMulai, j.jamSelesai, j.aktif
    ].join(" ").toLowerCase().includes(kata);
  });

  $("jumlah").textContent =
    `${hasil.length} jadwal ditampilkan dari ${jadwal.length} jadwal.`;

  if (!hasil.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "Belum ada jadwal yang cocok.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const j of hasil) {
    const tr = document.createElement("tr");
    const namaGuru = guru.find(g => g.uid === j.guruUid)?.nama || j.guruNama || "-";
    const nilai = [
      j.hari, j.kelas, j.mataPelajaran, namaGuru,
      `${j.jamMulai}–${j.jamSelesai}`,
      j.aktif === true ? "Aktif" : "Tidak aktif"
    ];

    for (const v of nilai) {
      const td = document.createElement("td");
      td.textContent = String(v ?? "");
      tr.appendChild(td);
    }

    const aksi = document.createElement("td");

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.className = "secondary";
    edit.addEventListener("click", () => isiForm(j));

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = j.aktif === true ? "Nonaktifkan" : "Aktifkan";
    toggle.className = "secondary";
    toggle.style.marginLeft = "5px";
    toggle.addEventListener("click", () => ubahStatus(j));

    aksi.append(edit, toggle);
    tr.appendChild(aksi);
    tbody.appendChild(tr);
  }
}

function isiForm(j) {
  editId = j.id;
  $("hari").value = j.hari;
  $("kelas").value = j.kelas;
  $("mapel").value = j.mataPelajaran;
  $("guruUid").value = j.guruUid;
  $("jamMulai").value = j.jamMulai;
  $("jamSelesai").value = j.jamSelesai;
  $("aktif").value = j.aktif === true ? "true" : "false";
  $("btnSimpan").textContent = "Simpan Perubahan";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function simpan(event) {
  event.preventDefault();
  if (!adminSiap || menyimpan) return;

  const hari = $("hari").value;
  const kelas = $("kelas").value.trim();
  const mataPelajaran = $("mapel").value.trim();
  const guruUid = $("guruUid").value;
  const jamMulai = Number($("jamMulai").value);
  const jamSelesai = Number($("jamSelesai").value);
  const aktif = $("aktif").value === "true";
  const guruTerpilih = guru.find(g => g.uid === guruUid);

  if (!kelas || !mataPelajaran || !guruTerpilih) {
    pesan("Lengkapi kelas, mata pelajaran, dan guru.", "error");
    return;
  }

  if (
    !Number.isInteger(jamMulai) ||
    !Number.isInteger(jamSelesai) ||
    jamMulai < 1 ||
    jamSelesai < jamMulai ||
    jamSelesai > 20
  ) {
    pesan("Nomor jam harus bilangan bulat 1–20 dan jam selesai tidak boleh lebih awal.", "error");
    return;
  }

  // Cegah jadwal aktif bertabrakan untuk guru yang sama
  // atau kelas yang sama pada hari dan jam yang sama.
  const tabrakan = jadwal.some(j => {
    if (j.id === editId || j.aktif !== true || !aktif) return false;

    const waktuTumpangTindih =
      jamMulai <= Number(j.jamSelesai) &&
      jamSelesai >= Number(j.jamMulai);

    return j.hari === hari &&
      waktuTumpangTindih &&
      (
        j.kelas.toLowerCase() === kelas.toLowerCase() ||
        j.guruUid === guruUid
      );
  });

  if (tabrakan) {
    pesan(
      "Jadwal bertabrakan dengan jadwal aktif guru atau kelas pada hari dan jam tersebut.",
      "error"
    );
    return;
  }

  const data = {
    hari,
    kelas,
    mataPelajaran,
    guruUid,
    guruNama: guruTerpilih.nama || guruTerpilih.email || "",
    jamMulai,
    jamSelesai,
    aktif,
    diperbaruiPada: serverTimestamp()
  };

  menyimpan = true;
  $("btnSimpan").disabled = true;

  try {
    if (editId) {
      await updateDoc(doc(db, "jadwal", editId), data);
      pesan("Jadwal berhasil diperbarui.", "sukses");
    } else {
      await addDoc(collection(db, "jadwal"), {
        ...data,
        dibuatPada: serverTimestamp()
      });
      pesan("Jadwal berhasil ditambahkan.", "sukses");
    }

    resetForm();
    await muatJadwal();
  } catch (error) {
    console.error(error);
    pesan(
      "Gagal menyimpan jadwal. Periksa Firestore Rules dan koneksi.",
      "error"
    );
  } finally {
    menyimpan = false;
    $("btnSimpan").disabled = false;
  }
}

async function ubahStatus(j) {
  if (!adminSiap || menyimpan) return;

  const aktifBaru = j.aktif !== true;
  if (!confirm(`${aktifBaru ? "Aktifkan" : "Nonaktifkan"} jadwal ${j.kelas} - ${j.mataPelajaran}?`)) return;

  try {
    await updateDoc(doc(db, "jadwal", j.id), {
      aktif: aktifBaru,
      diperbaruiPada: serverTimestamp()
    });
    pesan("Status jadwal berhasil diperbarui.", "sukses");
    await muatJadwal();
  } catch (error) {
    console.error(error);
    pesan("Gagal mengubah status jadwal.", "error");
  }
}

$("formJadwal").addEventListener("submit", simpan);
$("btnBatal").addEventListener("click", resetForm);
$("cari").addEventListener("input", tampilkanJadwal);

$("btnKembali").addEventListener("click", () => {
  location.href = "./admin.html";
});

$("btnKeluar").addEventListener("click", async () => {
  await signOut(auth);
  location.replace("./login.html");
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("./login.html");
    return;
  }

  try {
    await periksaAdmin(user);
    await muatGuru();
    await muatJadwal();
    adminSiap = true;
  } catch (error) {
    console.error(error);
    pesan(error.message || "Gagal memuat data.", "error");
  }
});

//penambahan validasi fungsi waktu

function validasiFormatJam(nilai) {
  const jam = String(nilai ?? "").trim();

  // Mendukung format HH:mm, misalnya 08:00 atau 13:30.
  const cocok = jam.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!cocok) {
    return {
      valid: false,
      menit: null,
      pesan: `Format jam "${jam}" tidak valid. Gunakan HH:mm, misalnya 08:00.`
    };
  }

  const jamAngka = Number(cocok[1]);
  const menitAngka = Number(cocok[2]);

  return {
    valid: true,
    menit: jamAngka * 60 + menitAngka,
    pesan: ""
  };
}

//=======
//PENAMBAHAN FUNGSI UNTUK IMPORT CSV JADWAL

/* ==========================================
   IMPORT JADWAL CSV
   Tambahan Tahap 6
========================================== */

const fileJadwal = document.getElementById("fileJadwal");
const btnPratinjau = document.getElementById("btnPratinjau");
const btnImport = document.getElementById("btnImport");
const infoImport = document.getElementById("infoImport");
const pratinjauJadwal = document.getElementById("pratinjauJadwal");

let barisImportJadwal = [];
let hasilValidasiJadwal = [];
let importSedangBerjalan = false;

const hariValid = [
  "Senin", "Selasa", "Rabu",
  "Kamis", "Jumat", "Sabtu"
];

// Parser CSV yang menangani koma dan tanda kutip.
// Mendukung baris baru Windows maupun Unix.
function parseCSVJadwal(teks) {
  const hasil = [];
  let baris = [];
  let nilai = "";
  let dalamKutip = false;

  teks = teks.replace(/^\uFEFF/, "");

  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];

    if (c === '"') {
      if (dalamKutip && teks[i + 1] === '"') {
        nilai += '"';
        i++;
      } else {
        dalamKutip = !dalamKutip;
      }
    } else if (c === ";" && !dalamKutip) {
      baris.push(nilai.trim());
      nilai = "";
    } else if ((c === "\n" || c === "\r") && !dalamKutip) {
      if (c === "\r" && teks[i + 1] === "\n") i++;

      baris.push(nilai.trim());

      if (baris.some(v => v !== "")) {
        hasil.push(baris);
      }

      baris = [];
      nilai = "";
    } else {
      nilai += c;
    }
  }

  if (dalamKutip) {
    throw new Error("CSV memiliki tanda kutip yang tidak berpasangan.");
  }

  if (nilai.length > 0 || baris.length > 0) {
    baris.push(nilai.trim());
    if (baris.some(v => v !== "")) hasil.push(baris);
  }

  if (hasil.length < 2) {
    throw new Error("CSV tidak berisi data jadwal.");
  }

  const header = hasil[0].map(v => v.trim());

  const wajib = [
    "hari", "kelas", "mataPelajaran",
    "guruUid", "jamMulai", "jamSelesai"
  ];

  for (const kolom of wajib) {
    if (!header.includes(kolom)) {
      throw new Error(`Kolom wajib tidak ditemukan: ${kolom}`);
    }
  }

  return hasil.slice(1).map((kolom, index) => {
    const obj = {};

    for (const k of wajib) {
      obj[k] = (kolom[header.indexOf(k)] || "").trim();
    }

    obj.nomorBaris = index + 2;
    return obj;
  });
}


function validasiCSVJadwal(baris) {
  const dataGuru = new Map(guru.map(g => [g.uid, g]));
  const hasil = [];

  for (const row of baris) {
    const alasan = [];
    const hari = row.hari;
    const kelas = row.kelas;
    const mataPelajaran = row.mataPelajaran;
    const guruUid = row.guruUid;
    const jamMulai = Number(row.jamMulai);
    const jamSelesai = Number(row.jamSelesai);
    const guruTerpilih = dataGuru.get(guruUid);

    if (!hariValid.includes(hari)) {
      alasan.push("Hari tidak valid");
    }

    if (!kelas) alasan.push("Kelas kosong");
    if (!mataPelajaran) alasan.push("Mapel kosong");

    if (!guruTerpilih) {
      alasan.push("UID guru tidak ditemukan atau tidak aktif");
    }

    if (
      !Number.isInteger(jamMulai) ||
      !Number.isInteger(jamSelesai) ||
      jamMulai < 1 ||
      jamSelesai < jamMulai ||
      jamSelesai > 20
    ) {
      alasan.push("Nomor jam tidak valid");
    }

    // Cek benturan antarbaris dalam file.
    const bentrokDalamFile = hasil.some(prev => {
      if (!prev.valid) return false;

      const j = prev.data;

      const overlap =
        jamMulai <= j.jamSelesai &&
        jamSelesai >= j.jamMulai;

      return j.hari === hari &&
        overlap &&
        (
          j.kelas.toLowerCase() === kelas.toLowerCase() ||
          j.guruUid === guruUid
        );
    });

    if (bentrokDalamFile) {
      alasan.push("Bentrok dengan baris lain dalam CSV");
    }

    // Cek benturan dengan jadwal aktif yang sudah tersimpan.
    const bentrokFirestore = jadwal.some(j => {
      if (j.aktif !== true) return false;

      const overlap =
        jamMulai <= Number(j.jamSelesai) &&
        jamSelesai >= Number(j.jamMulai);

      return j.hari === hari &&
        overlap &&
        (
          String(j.kelas || "").toLowerCase() === kelas.toLowerCase() ||
          j.guruUid === guruUid
        );
    });

    if (bentrokFirestore) {
      alasan.push("Bentrok dengan jadwal aktif di Firestore");
    }

    hasil.push({
      nomorBaris: row.nomorBaris,
      valid: alasan.length === 0,
      alasan,
      data: {
        hari,
        kelas,
        mataPelajaran,
        guruUid,
        guruNama: guruTerpilih?.nama || guruTerpilih?.email || "",
        jamMulai,
        jamSelesai,
        aktif: true
      }
    });
  }

  return hasil;
}

function tampilkanPratinjauImport() {
  pratinjauJadwal.replaceChildren();

  if (hasilValidasiJadwal.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "Tidak ada data untuk ditampilkan.";
    tr.appendChild(td);
    pratinjauJadwal.appendChild(tr);
    return;
  }

  for (const item of hasilValidasiJadwal) {
    const d = item.data;
    const tr = document.createElement("tr");

    const nilai = [
      item.nomorBaris,
      d.hari,
      d.kelas,
      d.mataPelajaran,
      d.guruUid,
      `${d.jamMulai}–${d.jamSelesai}`,
      item.valid ? "VALID" : item.alasan.join("; ")
    ];

    for (const v of nilai) {
      const td = document.createElement("td");
      td.textContent = String(v ?? "");
      tr.appendChild(td);
    }

    pratinjauJadwal.appendChild(tr);
  }

  const valid = hasilValidasiJadwal.filter(x => x.valid).length;
  const tidakValid = hasilValidasiJadwal.length - valid;

  infoImport.textContent =
    `Total ${hasilValidasiJadwal.length} baris. ` +
    `${valid} valid, ${tidakValid} bermasalah. ` +
    (tidakValid
      ? "Perbaiki baris bermasalah sebelum import."
      : "Semua baris valid dan siap diimport.");
}

btnPratinjau.addEventListener("click", async () => {
  if (!adminSiap) {
    pesan("Silakan login sebagai admin terlebih dahulu.", "error");
    return;
  }

  const file = fileJadwal.files[0];

  if (!file) {
    pesan("Pilih file CSV terlebih dahulu.", "error");
    return;
  }

  try {
    const teks = await file.text();
    barisImportJadwal = parseCSVJadwal(teks);
    hasilValidasiJadwal = validasiCSVJadwal(barisImportJadwal);
    tampilkanPratinjauImport();
  } catch (error) {
    console.error(error);
    hasilValidasiJadwal = [];
    tampilkanPratinjauImport();
    pesan("Gagal membaca CSV: " + error.message, "error");
  }
});

btnImport.addEventListener("click", async () => {
  if (!adminSiap || importSedangBerjalan) return;

  if (hasilValidasiJadwal.length === 0) {
    pesan("Klik Pratinjau CSV terlebih dahulu.", "error");
    return;
  }

  const tidakValid = hasilValidasiJadwal.filter(x => !x.valid);

  if (tidakValid.length > 0) {
    pesan(
      "Import dibatalkan. Masih ada baris CSV yang tidak valid.",
      "error"
    );
    return;
  }

  // Validasi ulang berdasarkan data lokal terbaru.
  // Untuk impor serentak oleh banyak admin, gunakan backend tepercaya.
  hasilValidasiJadwal = validasiCSVJadwal(barisImportJadwal);

  if (hasilValidasiJadwal.some(x => !x.valid)) {
    tampilkanPratinjauImport();
    pesan("Ada jadwal yang bertabrakan. Periksa pratinjau terbaru.", "error");
    return;
  }

  if (!confirm(
    `Import ${hasilValidasiJadwal.length} jadwal baru ke Firestore?`
  )) return;

  importSedangBerjalan = true;
  btnImport.disabled = true;
  btnPratinjau.disabled = true;

  let berhasil = 0;

  try {
    // Batasi jumlah baris per proses untuk menghindari permintaan
    // yang terlalu besar. Setiap dokumen dibuat dengan ID otomatis.
    for (let i = 0; i < hasilValidasiJadwal.length; i += 100) {
      const kelompok = hasilValidasiJadwal.slice(i, i + 100);

      for (const item of kelompok) {
        await addDoc(collection(db, "jadwal"), {
          ...item.data,
          dibuatPada: serverTimestamp(),
          diperbaruiPada: serverTimestamp(),
          sumberImport: "CSV"
        });

        berhasil++;
      }

      infoImport.textContent =
        `Mengimpor jadwal: ${berhasil}/${hasilValidasiJadwal.length}`;
    }

    pesan(`Import selesai. ${berhasil} jadwal berhasil ditambahkan.`, "sukses");

    fileJadwal.value = "";
    barisImportJadwal = [];
    hasilValidasiJadwal = [];
    tampilkanPratinjauImport();

    infoImport.textContent = "Import selesai.";
    await muatJadwal();
  } catch (error) {
    console.error("Import jadwal gagal:", error);
    pesan(
      `Import terhenti setelah ${berhasil} jadwal. ` +
      "Sebagian data mungkin sudah tersimpan. Periksa Firestore sebelum mencoba ulang.",
      "error"
    );
    await muatJadwal();
  } finally {
    importSedangBerjalan = false;
    btnImport.disabled = false;
    btnPratinjau.disabled = false;
  }
});


//=======================================



/* ============================================
   DOWNLOAD KOLEKSI JADWAL KE EXCEL
   ============================================ */

const btnDownloadJadwal = document.getElementById(
  "btnDownloadJadwal"
);

if (btnDownloadJadwal) {
  btnDownloadJadwal.addEventListener(
    "click",
    downloadDataJadwal
  );
}

async function downloadDataJadwal() {
  if (!auth.currentUser) {
    alert("Silakan login terlebih dahulu.");
    return;
  }

  if (!window.XLSX) {
    alert("Pustaka Excel belum tersedia. Periksa koneksi internet.");
    return;
  }

  btnDownloadJadwal.disabled = true;
  btnDownloadJadwal.textContent = "Menyiapkan Excel...";

  try {
    // Verifikasi akun admin aktif
    const profilRef = doc(db, "users", auth.currentUser.uid);
    const profilSnap = await getDoc(profilRef);

    if (
      !profilSnap.exists() ||
      profilSnap.data().role !== "admin" ||
      profilSnap.data().aktif !== true
    ) {
      throw new Error(
        "Hanya admin aktif yang boleh mengunduh data jadwal."
      );
    }

    // Ambil seluruh dokumen dari koleksi jadwal
    const snapshot = await getDocs(
      collection(db, "jadwal")
    );

    if (snapshot.empty) {
      alert("Koleksi jadwal belum memiliki data.");
      return;
    }

    // Ambil nama guru berdasarkan UID jika tersedia
    const guruSnapshot = await getDocs(
      query(
        collection(db, "users"),
        where("role", "==", "guru")
      )
    );

    const daftarNamaGuru = new Map();

    guruSnapshot.forEach((dok) => {
      const guru = dok.data();
      daftarNamaGuru.set(
        dok.id,
        guru.nama || guru.email || dok.id
      );
    });

    // Susun data Excel dari koleksi jadwal
    const dataExcel = snapshot.docs.map((dok, index) => {
      const j = dok.data();

      return {
        "No": index + 1,
        "ID Jadwal": dok.id,
        "Nama Guru": daftarNamaGuru.get(j.guruUid) || "",
        "Guru UID": j.guruUid || "",
        "Hari": j.hari || "",
        "Kelas": j.kelas || "",
        "Mata Pelajaran": j.mataPelajaran || "",
        "Jam Mulai": formatJamExcel(j.jamMulai),
        "Jam Selesai": formatJamExcel(j.jamSelesai),
        "Status": j.aktif === true
          ? "Aktif"
          : j.aktif === false
            ? "Tidak Aktif"
            : "",
      };
    });

    // Urutkan berdasarkan hari, kelas, dan jam mulai
    const urutanHari = {
      Senin: 1,
      Selasa: 2,
      Rabu: 3,
      Kamis: 4,
      Jumat: 5,
      Sabtu: 6,
      Minggu: 7
    };

    dataExcel.sort((a, b) => {
      const hariA = urutanHari[a.Hari] || 99;
      const hariB = urutanHari[b.Hari] || 99;

      if (hariA !== hariB) return hariA - hariB;

      const kelasA = String(a.Kelas);
      const kelasB = String(b.Kelas);

      if (kelasA !== kelasB) {
        return kelasA.localeCompare(kelasB, "id");
      }

      return String(a["Jam Mulai"]).localeCompare(
        String(b["Jam Mulai"])
      );
    });

    // Buat file Excel
    const worksheet = XLSX.utils.json_to_sheet(dataExcel);

    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 30 },
      { wch: 30 },
      { wch: 12 },
      { wch: 14 },
      { wch: 25 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 }
    ];

    worksheet["!autofilter"] = {
      ref: worksheet["!ref"]
    };

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Data Jadwal"
    );

    const tanggal = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Jakarta"
    });

    XLSX.writeFile(
      workbook,
      `Data_Jadwal_SM​AN2_Rangkasbitung_${tanggal}.xlsx`
    );

    alert(
      `Berhasil menyiapkan ${dataExcel.length} data jadwal.`
    );

  } catch (error) {
    console.error("Gagal mengunduh jadwal:", error);

    alert(
      error.code === "permission-denied"
        ? "Akses ditolak Firestore. Periksa Firestore Rules."
        : error.message || "Gagal mengunduh data jadwal."
    );

  } finally {
    btnDownloadJadwal.disabled = false;
    btnDownloadJadwal.textContent = "Download Excel Jadwal";
  }
}

// Mendukung jam dalam bentuk angka desimal atau teks
function formatJamExcel(jam) {
  if (jam === null || jam === undefined || jam === "") {
    return "";
  }

  if (typeof jam === "number") {
    const totalMenit = Math.round(jam * 60);
    const hh = String(Math.floor(totalMenit / 60)).padStart(2, "0");
    const mm = String(totalMenit % 60).padStart(2, "0");

    return `${hh}:${mm}`;
  }

  return String(jam);
}
