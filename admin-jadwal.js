
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
