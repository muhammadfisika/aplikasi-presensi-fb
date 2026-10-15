
import { initializeApp, getApp, getApps } from
  "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  getFirestore, doc, getDoc, collection, getDocs,
  setDoc, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Gunakan konfigurasi yang sama dengan app.js.
const firebaseConfig = {
  apiKey: "AIzaSyBI6VWDbIJ7A-PxNtdQWDDhmnNrCfWWhCI",
  authDomain: "aplikasi-presensi-fb.firebaseapp.com",
  projectId: "aplikasi-presensi-fb",
  storageBucket: "aplikasi-presensi-fb.firebasestorage.app",
  messagingSenderId: "1018611782868",
  appId: "1:1018611782868:web:37304037cece90197c9741"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);
let pengguna = null;
let semuaSiswa = [];
let nisnEdit = null;
let aksesDiizinkan = false;

function pesan(id, teks, error = false) {
  $(id).textContent = teks;
  $(id).style.color = error ? "#b91c1c" : "#166534";
}

function normalisasi(teks) {
  return String(teks ?? "").trim();
}

function validasiSiswa(data) {
  if (!data.nama || !data.kelas) {
    throw new Error("Nama dan kelas wajib diisi.");
  }
  if (!/^\d{10}$/.test(data.nisn)) {
    throw new Error("NISN harus terdiri dari tepat 10 angka.");
  }
}

function bersihkanForm() {
  nisnEdit = null;
  $("formSiswa").reset();
  $("nisn").disabled = false;
  $("judulForm").textContent = "Tambah Siswa";
  $("btnSimpan").textContent = "Simpan Siswa";
}

function buatSel(teks) {
  const td = document.createElement("td");
  td.textContent = teks;
  return td;
}

function renderSiswa() {
  const kata = normalisasi($("cari").value).toLowerCase();
  const kelas = $("filterKelas").value;

  const data = semuaSiswa.filter(s => {
    const cocokCari =
      s.nama.toLowerCase().includes(kata) ||
      s.nisn.includes(kata);
    return cocokCari && (!kelas || s.kelas === kelas);
  });

  const tbody = $("tabelSiswa");
  tbody.replaceChildren();

  $("jumlahSiswa").textContent =
    `${data.length} siswa ditampilkan dari ${semuaSiswa.length} siswa.`;

  if (!data.length) {
    const tr = document.createElement("tr");
    const td = buatSel("Data siswa tidak ditemukan.");
    td.colSpan = 5;
    tr.append(td);
    tbody.append(tr);
    return;
  }

  data.forEach((s, index) => {
    const tr = document.createElement("tr");
    tr.append(
      buatSel(String(index + 1)),
      buatSel(s.nama),
      buatSel(s.nisn),
      buatSel(s.kelas)
    );

    const tdAksi = document.createElement("td");
    const btnEdit = document.createElement("button");
    btnEdit.className = "small-btn";
    btnEdit.textContent = "Edit";
    btnEdit.type = "button";
    btnEdit.addEventListener("click", () => mulaiEdit(s));

    const btnHapus = document.createElement("button");
    btnHapus.className = "small-btn danger-btn";
    btnHapus.textContent = "Hapus";
    btnHapus.type = "button";
    btnHapus.style.marginLeft = "6px";
    btnHapus.addEventListener("click", () => hapusSiswa(s));

    tdAksi.append(btnEdit, btnHapus);
    tr.append(tdAksi);
    tbody.append(tr);
  });
}

function renderFilterKelas() {
  const pilihanLama = $("filterKelas").value;
  const kelas = [...new Set(semuaSiswa.map(s => s.kelas))]
    .sort((a, b) => a.localeCompare(b, "id"));

  const select = $("filterKelas");
  select.replaceChildren();

  const semua = document.createElement("option");
  semua.value = "";
  semua.textContent = "Semua kelas";
  select.append(semua);

  kelas.forEach(k => {
    const option = document.createElement("option");
    option.value = k;
    option.textContent = k;
    select.append(option);
  });

  select.value = kelas.includes(pilihanLama) ? pilihanLama : "";
}

async function muatSiswa() {
  const snapshot = await getDocs(collection(db, "siswa"));
  semuaSiswa = snapshot.docs.map(d => ({
    ...d.data(),
    nisn: String(d.data().nisn ?? d.id)
  })).sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  renderFilterKelas();
  renderSiswa();
}

function mulaiEdit(siswa) {
  nisnEdit = siswa.nisn;
  $("nama").value = siswa.nama;
  $("nisn").value = siswa.nisn;
  $("kelas").value = siswa.kelas;
  $("nisn").disabled = true;
  $("judulForm").textContent = "Edit Siswa";
  $("btnSimpan").textContent = "Simpan Perubahan";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("formSiswa").addEventListener("submit", async event => {
  event.preventDefault();
  if (!aksesDiizinkan) return;

  const data = {
    nama: normalisasi($("nama").value),
    nisn: normalisasi($("nisn").value),
    kelas: normalisasi($("kelas").value),
    aktif: true
  };

  try {
    validasiSiswa(data);

    if (!nisnEdit) {
      const ref = doc(db, "siswa", data.nisn);
      const lama = await getDoc(ref);
      if (lama.exists()) {
        throw new Error("NISN sudah terdaftar. Gunakan fitur Edit.");
      }
      await setDoc(ref, data);
    } else {
      await setDoc(doc(db, "siswa", nisnEdit), data, { merge: true });
    }

    pesan("pesanForm", "Data siswa berhasil disimpan.");
    bersihkanForm();
    await muatSiswa();
  } catch (error) {
    console.error(error);
    pesan("pesanForm", error.message || "Gagal menyimpan siswa.", true);
  }
});

$("btnBatal").addEventListener("click", bersihkanForm);
$("cari").addEventListener("input", renderSiswa);
$("filterKelas").addEventListener("change", renderSiswa);

async function hapusSiswa(siswa) {
  if (!aksesDiizinkan) return;

  const yakin = confirm(
    `Hapus data siswa ${siswa.nama} (${siswa.nisn})?`
  );
  if (!yakin) return;

  try {
    await deleteDoc(doc(db, "siswa", siswa.nisn));
    if (nisnEdit === siswa.nisn) bersihkanForm();
    await muatSiswa();
    pesan("pesanForm", "Data siswa berhasil dihapus.");
  } catch (error) {
    console.error(error);
    pesan("pesanForm", "Gagal menghapus data. Periksa Firestore Rules.", true);
  }
}

function parseCSV(teks) {
  const baris = [];
  let row = [], cell = "", quoted = false;

  teks = teks.replace(/^\uFEFF/, "");

  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (c === '"') {
      if (quoted && teks[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && teks[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(v => v.trim() !== "")) baris.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }

  if (quoted) throw new Error("CSV memiliki tanda kutip yang tidak berpasangan.");

  row.push(cell);
  if (row.some(v => v.trim() !== "")) baris.push(row);
  if (baris.length < 2) throw new Error("CSV kosong atau hanya berisi header.");

  const header = baris.shift().map(v => v.trim().toLowerCase());
  const iNama = header.indexOf("nama");
  const iNisn = header.indexOf("nisn");
  const iKelas = header.indexOf("kelas");

  if ([iNama, iNisn, iKelas].some(i => i < 0)) {
    throw new Error("Header CSV wajib: nama,nisn,kelas.");
  }

  const siswa = baris.map((r, index) => {
    const data = {
      nama: normalisasi(r[iNama]),
      nisn: normalisasi(r[iNisn]),
      kelas: normalisasi(r[iKelas]),
      aktif: true
    };
    try {
      validasiSiswa(data);
    } catch (e) {
      throw new Error(`Baris data ${index + 2}: ${e.message}`);
    }
    return data;
  });

  const ids = siswa.map(s => s.nisn);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Ada NISN duplikat di dalam file CSV.");
  }

  return siswa;
}

$("btnImport").addEventListener("click", async () => {
  if (!aksesDiizinkan) return;

  const file = $("fileCsv").files[0];
  if (!file) {
    pesan("pesanImport", "Pilih file CSV terlebih dahulu.", true);
    return;
  }

  try {
    const data = parseCSV(await file.text());

    if (!confirm(
      `Import ${data.length} siswa? Jika NISN sudah ada di database, datanya akan diperbarui.`
    )) return;

    // Firestore membatasi batch maksimum 500 operasi.
    // Gunakan 400 operasi per batch.
    for (let start = 0; start < data.length; start += 400) {
      const batch = writeBatch(db);
      const potongan = data.slice(start, start + 400);

      potongan.forEach(s => {
        batch.set(doc(db, "siswa", s.nisn), s, { merge: true });
      });

      await batch.commit();
      pesan(
        "pesanImport",
        `Memproses ${Math.min(start + potongan.length, data.length)} dari ${data.length} siswa...`
      );
    }

    $("fileCsv").value = "";
    await muatSiswa();
    pesan("pesanImport", `Import selesai: ${data.length} siswa diproses.`);
  } catch (error) {
    console.error(error);
    pesan("pesanImport", error.message || "Import gagal.", true);
  }
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
    const profilSnap = await getDoc(doc(db, "users", user.uid));

    if (!profilSnap.exists()) {
      throw new Error("Profil pengguna tidak ditemukan.");
    }

    const profil = profilSnap.data();

    if (profil.aktif !== true || profil.role !== "admin") {
      throw new Error("Halaman ini hanya untuk admin aktif.");
    }

    aksesDiizinkan = true;
    $("identitasAdmin").textContent =
      `Login sebagai ${profil.nama || user.email} (Admin)`;

    await muatSiswa();
  } catch (error) {
    console.error(error);
    $("identitasAdmin").textContent =
      error.message || "Gagal memeriksa hak akses.";
    aksesDiizinkan = false;
  }
});
