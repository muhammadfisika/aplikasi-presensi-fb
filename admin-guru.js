
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
  setDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// GANTI dengan konfigurasi Firebase yang SAMA dengan app.js Anda.
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

const $ = (id) => document.getElementById(id);

const form = $("formPengguna");
const pesan = $("pesan");
const daftar = $("daftarPengguna");
const pencarian = $("pencarian");
const jumlahData = $("jumlahData");
const btnSimpan = $("btnSimpan");

let adminSiap = false;
let sedangMenyimpan = false;
let semuaPengguna = [];

function tampilkanPesan(teks, tipe = "info") {
  pesan.hidden = false;
  pesan.textContent = teks;
  pesan.style.background =
    tipe === "error" ? "#fbe7e7" :
    tipe === "sukses" ? "#e4f5e9" : "#edf3fa";
  pesan.style.color =
    tipe === "error" ? "#8c2020" :
    tipe === "sukses" ? "#176334" : "#173a5e";
}

function bersihkanForm() {
  form.reset();
  $("uid").readOnly = false;
  $("role").value = "guru";
  $("aktif").value = "true";
  btnSimpan.textContent = "Simpan Profil";
  $("uid").focus();
}

function teksAman(nilai) {
  return String(nilai ?? "");
}

function normalisasiAktif(nilai) {
  return nilai === true;
}

function profilValid(data) {
  return data &&
    typeof data.nama === "string" &&
    typeof data.email === "string" &&
    ["admin", "guru", "kepsek"].includes(data.role) &&
    typeof data.aktif === "boolean";
}

async function periksaAdmin(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error(
      "Profil admin tidak ditemukan di users/" + user.uid
    );
  }

  const data = snap.data();

  if (
    data.role !== "admin" ||
    data.aktif !== true
  ) {
    throw new Error(
      "Akun ini bukan admin aktif. Periksa role dan aktif di Firestore."
    );
  }

  return data;
}

async function muatPengguna() {
  daftar.innerHTML = "";
  jumlahData.textContent = "Memuat data pengguna...";

  try {
    const snapshot = await getDocs(collection(db, "users"));

    semuaPengguna = snapshot.docs
      .map((item) => ({
        uid: item.id,
        ...item.data()
      }))
      .filter((item) =>
        ["guru", "kepsek"].includes(item.role)
      )
      .sort((a, b) =>
        teksAman(a.nama).localeCompare(teksAman(b.nama), "id")
      );

    tampilkanDaftar();
  } catch (error) {
    console.error("Gagal memuat pengguna:", error);
    daftar.innerHTML =
      '<tr><td colspan="6">Gagal memuat data. Periksa Firestore Rules dan koneksi.</td></tr>';
    jumlahData.textContent = "Data gagal dimuat.";
    tampilkanPesan(
      "Tidak dapat membaca users. Periksa Firestore Rules dan UID admin.",
      "error"
    );
  }
}

function tampilkanDaftar() {
  const kata = pencarian.value.trim().toLowerCase();

  const hasil = semuaPengguna.filter((item) => {
    const gabungan = [
      item.uid,
      item.nama,
      item.email,
      item.nip,
      item.role
    ].map(teksAman).join(" ").toLowerCase();

    return gabungan.includes(kata);
  });

  daftar.replaceChildren();
  jumlahData.textContent =
    `${hasil.length} profil ditampilkan dari ${semuaPengguna.length} profil.`;

  if (hasil.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Tidak ada profil yang cocok.";
    tr.appendChild(td);
    daftar.appendChild(tr);
    return;
  }

  for (const item of hasil) {
    const tr = document.createElement("tr");

    function tambahSel(nilai) {
      const td = document.createElement("td");
      td.textContent = teksAman(nilai);
      tr.appendChild(td);
      return td;
    }

    tambahSel(item.nama);
    tambahSel(item.email);
    tambahSel(item.nip || "-");
    tambahSel(item.role === "kepsek" ? "Kepala Sekolah" : "Guru");

    const statusTd = tambahSel(
      normalisasiAktif(item.aktif) ? "Aktif" : "Tidak aktif"
    );
    statusTd.className = normalisasiAktif(item.aktif)
      ? "status-active"
      : "status-inactive";

    const aksiTd = document.createElement("td");

    const tombolEdit = document.createElement("button");
    tombolEdit.type = "button";
    tombolEdit.className = "table-action secondary";
    tombolEdit.textContent = "Edit";
    tombolEdit.addEventListener("click", () => isiForm(item));

    const tombolStatus = document.createElement("button");
    tombolStatus.type = "button";
    tombolStatus.className = "table-action";
    tombolStatus.textContent = normalisasiAktif(item.aktif)
      ? "Nonaktifkan"
      : "Aktifkan";

    tombolStatus.style.marginLeft = "6px";
    tombolStatus.addEventListener("click", () => ubahStatus(item));

    aksiTd.append(tombolEdit, tombolStatus);
    tr.appendChild(aksiTd);
    daftar.appendChild(tr);
  }
}

function isiForm(item) {
  $("uid").value = item.uid;
  $("uid").readOnly = true;
  $("nama").value = teksAman(item.nama);
  $("email").value = teksAman(item.email);
  $("nip").value = teksAman(item.nip);
  $("role").value = item.role;
  $("aktif").value = item.aktif === true ? "true" : "false";
  btnSimpan.textContent = "Simpan Perubahan";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function simpanProfil(event) {
  event.preventDefault();

  if (!adminSiap || sedangMenyimpan) return;

  const uid = $("uid").value.trim();
  const nama = $("nama").value.trim();
  const email = $("email").value.trim();
  const nip = $("nip").value.trim();
  const role = $("role").value;
  const aktif = $("aktif").value === "true";

  if (!uid || !nama || !email) {
    tampilkanPesan("UID, nama, dan email wajib diisi.", "error");
    return;
  }

  if (!["guru", "kepsek"].includes(role)) {
    tampilkanPesan("Peran hanya boleh Guru atau Kepala Sekolah.", "error");
    return;
  }

  if (!/^[A-Za-z0-9_-]{10,150}$/.test(uid)) {
    tampilkanPesan(
      "Format UID tidak valid. Salin UID persis dari Firebase Authentication.",
      "error"
    );
    return;
  }

  sedangMenyimpan = true;
  btnSimpan.disabled = true;

  try {
    // Pastikan UID memang sudah ada di Firebase Authentication.
    // Membaca ID token pengguna lain tidak tersedia di browser.
    // Karena itu, cocokkan UID secara manual dari Firebase Console.
    const ref = doc(db, "users", uid);
    const sebelumnya = await getDoc(ref);

    if (sebelumnya.exists() && sebelumnya.data().role === "admin") {
      throw new Error(
        "Profil admin tidak dapat diubah dari halaman ini."
      );
    }

    const data = {
      nama,
      email,
      nip,
      role,
      aktif,
      diperbaruiPada: new Date().toISOString()
    };

    await setDoc(ref, data, { merge: true });

    tampilkanPesan(
      sebelumnya.exists()
        ? "Profil pengguna berhasil diperbarui."
        : "Profil pengguna berhasil disimpan.",
      "sukses"
    );

    bersihkanForm();
    await muatPengguna();
  } catch (error) {
    console.error("Gagal menyimpan profil:", error);
    tampilkanPesan(
      "Gagal menyimpan profil: " + (error.message || "Kesalahan tidak diketahui"),
      "error"
    );
  } finally {
    sedangMenyimpan = false;
    btnSimpan.disabled = false;
  }
}

async function ubahStatus(item) {
  if (!adminSiap || sedangMenyimpan) return;

  const aktifBaru = item.aktif !== true;
  const konfirmasi = confirm(
    `${aktifBaru ? "Aktifkan" : "Nonaktifkan"} akun ${item.nama}?`
  );

  if (!konfirmasi) return;

  sedangMenyimpan = true;

  try {
    await setDoc(
      doc(db, "users", item.uid),
      {
        aktif: aktifBaru,
        diperbaruiPada: new Date().toISOString()
      },
      { merge: true }
    );

    tampilkanPesan(
      `Profil ${item.nama} berhasil ${aktifBaru ? "diaktifkan" : "dinonaktifkan"}.`,
      "sukses"
    );

    await muatPengguna();
  } catch (error) {
    console.error("Gagal mengubah status:", error);
    tampilkanPesan(
      "Status tidak dapat diubah. Periksa Firestore Rules.",
      "error"
    );
  } finally {
    sedangMenyimpan = false;
  }
}

form.addEventListener("submit", simpanProfil);
$("btnBatal").addEventListener("click", bersihkanForm);
pencarian.addEventListener("input", tampilkanDaftar);

$("btnKembali").addEventListener("click", () => {
  window.location.href = "./admin.html";
});

$("btnKeluar").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("./login.html");
  } catch (error) {
    tampilkanPesan("Gagal keluar dari aplikasi.", "error");
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("./login.html");
    return;
  }

  try {
    await periksaAdmin(user);
    adminSiap = true;
    await muatPengguna();
  } catch (error) {
    console.error("Pemeriksaan admin gagal:", error);
    tampilkanPesan(
      error.message || "Akses admin ditolak.",
      "error"
    );
    adminSiap = false;
  }
});
