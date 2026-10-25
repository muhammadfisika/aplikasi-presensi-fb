
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
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Gunakan konfigurasi yang sama dengan aplikasi presensi.
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

const namaGuruEl = $("namaGuru");
const pesanEl = $("pesan");
const tabelJadwalEl = $("tabelJadwal");

const panelForm = $("panelForm");
const formJadwal = $("formJadwal");
const judulForm = $("judulForm");

const jadwalIdEl = $("jadwalId");
const hariEl = $("hari");
const kelasEl = $("kelas");
const mataPelajaranEl = $("mataPelajaran");
const jamMulaiEl = $("jamMulai");
const jamSelesaiEl = $("jamSelesai");

const btnTambah = $("btnTambah");
const btnSimpan = $("btnSimpan");
const btnBatal = $("btnBatal");
const btnKeluar = $("btnKeluar");
const pesanFormEl = $("pesanForm");

let guruAktif = null;
let daftarJadwal = [];
let sedangMenyimpan = false;
let sedangMenghapus = false;

function tampilkanPesan(teks, error = false) {
  pesanEl.textContent = teks;
  pesanEl.classList.toggle("gj-error", error);
  pesanEl.classList.toggle("gj-success", !error);
}

function tampilkanPesanForm(teks, error = false) {
  pesanFormEl.textContent = teks;
  pesanFormEl.classList.toggle("gj-error", error);
  pesanFormEl.classList.toggle("gj-success", !error);
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

function waktuUntukInput(nilai) {
  if (typeof nilai === "string") {
    // Format baru: HH:mm
    if (/^\d{2}:\d{2}$/.test(nilai)) return nilai;

    // Kompatibilitas data lama yang menyimpan angka.
    if (/^\d+$/.test(nilai)) {
      const angka = Number(nilai);
      const jam = Math.floor(angka / 60);
      const menit = angka % 60;
      if (angka >= 0 && angka < 1440) {
        return `${String(jam).padStart(2, "0")}:${String(menit).padStart(2, "0")}`;
      }
    }
  }

  if (typeof nilai === "number" && nilai >= 0 && nilai < 1440) {
    return `${String(Math.floor(nilai / 60)).padStart(2, "0")}:${String(nilai % 60).padStart(2, "0")}`;
  }

  return "";
}

function tutupForm() {
  formJadwal.reset();
  jadwalIdEl.value = "";
  judulForm.textContent = "Tambah Jadwal";
  btnSimpan.textContent = "Simpan Jadwal";
  panelForm.hidden = true;
  tampilkanPesanForm("");
}

function bukaFormTambah() {
  if (!guruAktif) {
    tampilkanPesan("Profil guru belum siap. Silakan tunggu.", true);
    return;
  }

  formJadwal.reset();
  jadwalIdEl.value = "";
  judulForm.textContent = "Tambah Jadwal";
  btnSimpan.textContent = "Simpan Jadwal";
  panelForm.hidden = false;
  tampilkanPesanForm("");

  panelForm.scrollIntoView({ behavior: "smooth", block: "start" });
  hariEl.focus();
}

function bukaFormEdit(jadwal) {
  jadwalIdEl.value = jadwal.id;
  hariEl.value = jadwal.hari || "";
  kelasEl.value = jadwal.kelas || "";
  mataPelajaranEl.value = jadwal.mataPelajaran || "";
  jamMulaiEl.value = waktuUntukInput(jadwal.jamMulai);
  jamSelesaiEl.value = waktuUntukInput(jadwal.jamSelesai);

  judulForm.textContent = "Edit Jadwal";
  btnSimpan.textContent = "Simpan Perubahan";
  panelForm.hidden = false;
  tampilkanPesanForm(`Mengedit jadwal kelas ${jadwal.kelas || "-"}.`);

  panelForm.scrollIntoView({ behavior: "smooth", block: "start" });
  hariEl.focus();
}

async function verifikasiGuru(user) {
  const snapshot = await getDoc(doc(db, "users", user.uid));

  if (!snapshot.exists()) {
    throw new Error("Profil pengguna tidak ditemukan pada koleksi users.");
  }

  const profil = snapshot.data();

  if (profil.role !== "guru" || profil.aktif !== true) {
    throw new Error("Halaman ini hanya dapat digunakan oleh akun guru aktif.");
  }

  return {
    uid: user.uid,
    nama: profil.nama || user.email || "Guru",
    email: user.email || ""
  };
}

async function muatDaftarJadwal() {
  if (!guruAktif || !auth.currentUser) return;

  tabelJadwalEl.innerHTML =
    '<tr><td colspan="8">Memuat jadwal...</td></tr>';

  try {
    // Query dibatasi ke UID guru yang sedang login.
    const q = query(
      collection(db, "jadwal"),
      where("guruUid", "==", guruAktif.uid)
    );

    const snapshot = await getDocs(q);

    daftarJadwal = snapshot.docs.map(dok => ({
      id: dok.id,
      ...dok.data()
    }));

    daftarJadwal.sort((a, b) => {
      const urutanHari = [
        "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
      ];

      const hariA = urutanHari.indexOf(a.hari);
      const hariB = urutanHari.indexOf(b.hari);

      if (hariA !== hariB) return hariA - hariB;

      return waktuUntukInput(a.jamMulai)
        .localeCompare(waktuUntukInput(b.jamMulai));
    });

    renderDaftarJadwal();

    tampilkanPesan(
      `${daftarJadwal.length} jadwal milik Anda berhasil dimuat.`
    );
  } catch (error) {
    console.error("Gagal memuat jadwal:", error);

    tabelJadwalEl.innerHTML =
      '<tr><td colspan="8">Jadwal gagal dimuat.</td></tr>';

    tampilkanPesan(
      error.code === "permission-denied"
        ? "Akses ditolak oleh Firestore Rules. Periksa izin membaca jadwal."
        : `Gagal memuat jadwal: ${error.message}`,
      true
    );
  }
}

function renderDaftarJadwal() {
  if (daftarJadwal.length === 0) {
    tabelJadwalEl.innerHTML =
      '<tr><td colspan="8">Belum ada jadwal. Tekan Tambah Jadwal untuk membuat jadwal baru.</td></tr>';
    return;
  }

  tabelJadwalEl.innerHTML = "";

  daftarJadwal.forEach((jadwal, indeks) => {
    const tr = document.createElement("tr");
    const statusAktif = jadwal.aktif === true;

    tr.innerHTML = `
      <td>${indeks + 1}</td>
      <td>${escapeHTML(jadwal.hari || "-")}</td>
      <td>${escapeHTML(jadwal.kelas || "-")}</td>
      <td>${escapeHTML(jadwal.mataPelajaran || "-")}</td>
      <td>${escapeHTML(waktuUntukInput(jadwal.jamMulai) || "-")}</td>
      <td>${escapeHTML(waktuUntukInput(jadwal.jamSelesai) || "-")}</td>
      <td>
        <span class="gj-status ${statusAktif ? "gj-status-active" : "gj-status-inactive"}">
          ${statusAktif ? "Aktif" : "Nonaktif"}
        </span>
      </td>
      <td>
        <div class="gj-row-actions">
          <button type="button" class="danger" data-aksi="edit">
            Edit
          </button>
          <button type="button" class="danger" data-aksi="hapus">
            Hapus
          </button>
        </div>
      </td>
    `;

    tr.querySelector('[data-aksi="edit"]').addEventListener("click", () => {
      bukaFormEdit(jadwal);
    });

    tr.querySelector('[data-aksi="hapus"]').addEventListener("click", () => {
      hapusJadwal(jadwal);
    });

    tabelJadwalEl.appendChild(tr);
  });
}

async function simpanJadwal(event) {
  event.preventDefault();

  if (sedangMenyimpan) return;

  if (
    !auth.currentUser ||
    !guruAktif ||
    auth.currentUser.uid !== guruAktif.uid
  ) {
    tampilkanPesanForm("Sesi login tidak valid. Silakan login kembali.", true);
    return;
  }

  const id = jadwalIdEl.value.trim();
  const hari = hariEl.value;
  const kelas = kelasEl.value.trim();
  const mataPelajaran = mataPelajaranEl.value.trim();
  const jamMulai = jamMulaiEl.value;
  const jamSelesai = jamSelesaiEl.value;

  if (!hari || !kelas || !mataPelajaran || !jamMulai || !jamSelesai) {
    tampilkanPesanForm("Semua kolom wajib diisi.", true);
    return;
  }

  if (jamMulai >= jamSelesai) {
    tampilkanPesanForm(
      "Jam selesai harus lebih besar daripada jam mulai.",
      true
    );
    return;
  }

  if (kelas.length > 30 || mataPelajaran.length > 100) {
    tampilkanPesanForm("Kelas atau mata pelajaran terlalu panjang.", true);
    return;
  }

  // Pastikan ID edit benar-benar ada dalam daftar milik guru ini.
  const jadwalLama = id
    ? daftarJadwal.find(item => item.id === id)
    : null;

  if (id && !jadwalLama) {
    tampilkanPesanForm("Jadwal yang akan diedit tidak ditemukan.", true);
    return;
  }

  sedangMenyimpan = true;
  btnSimpan.disabled = true;
  const teksLama = btnSimpan.textContent;
  btnSimpan.textContent = "Menyimpan...";

  try {
    const dataJadwal = {
      guruUid: guruAktif.uid,
      guruNama: guruAktif.nama,
      hari,
      kelas,
      mataPelajaran,
      jamMulai,
      jamSelesai,
      aktif: jadwalLama ? jadwalLama.aktif === true : true,
      diperbaruiPada: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, "jadwal", id), dataJadwal);
    } else {
      const refBaru = doc(collection(db, "jadwal"));

      await setDoc(refBaru, {
        ...dataJadwal,
        dibuatPada: serverTimestamp()
      });
    }

    tutupForm();
    await muatDaftarJadwal();

    tampilkanPesan(
      id
        ? "Perubahan jadwal berhasil disimpan."
        : "Jadwal baru berhasil ditambahkan."
    );
  } catch (error) {
    console.error("Gagal menyimpan jadwal:", error);

    tampilkanPesanForm(
      error.code === "permission-denied"
        ? "Perubahan ditolak Firestore Rules. Pastikan guru boleh mengelola jadwal miliknya."
        : `Gagal menyimpan jadwal: ${error.message}`,
      true
    );
  } finally {
    sedangMenyimpan = false;
    btnSimpan.disabled = false;
    btnSimpan.textContent = teksLama;
  }
}

async function hapusJadwal(jadwal) {
  if (sedangMenghapus) return;

  if (
    !auth.currentUser ||
    !guruAktif ||
    auth.currentUser.uid !== guruAktif.uid ||
    jadwal.guruUid !== guruAktif.uid
  ) {
    tampilkanPesan("Anda hanya boleh menghapus jadwal milik sendiri.", true);
    return;
  }

  const yakin = window.confirm(
    `Hapus jadwal berikut?\n\n` +
    `${jadwal.hari} | Kelas ${jadwal.kelas} | ${jadwal.mataPelajaran}\n` +
    `${waktuUntukInput(jadwal.jamMulai)}-${waktuUntukInput(jadwal.jamSelesai)}\n\n` +
    "Data presensi lama tidak ikut dihapus."
  );

  if (!yakin) return;

  sedangMenghapus = true;

  try {
    await deleteDoc(doc(db, "jadwal", jadwal.id));
    await muatDaftarJadwal();

    tampilkanPesan("Jadwal berhasil dihapus.");
  } catch (error) {
    console.error("Gagal menghapus jadwal:", error);

    tampilkanPesan(
      error.code === "permission-denied"
        ? "Penghapusan ditolak Firestore Rules. Aturan hapus jadwal guru perlu diperbarui."
        : `Gagal menghapus jadwal: ${error.message}`,
      true
    );
  } finally {
    sedangMenghapus = false;
  }
}

btnTambah.addEventListener("click", bukaFormTambah);
btnBatal.addEventListener("click", tutupForm);
formJadwal.addEventListener("submit", simpanJadwal);

btnKeluar.addEventListener("click", async () => {
  const yakin = window.confirm("Apakah Anda yakin ingin keluar dari aplikasi?");
  if (!yakin) return;

  try {
    await signOut(auth);
    window.location.replace("index.html");
  } catch (error) {
    console.error("Gagal keluar:", error);
    tampilkanPesan("Gagal keluar. Silakan coba kembali.", true);
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("index.html");
    return;
  }

  try {
    guruAktif = await verifikasiGuru(user);
    namaGuruEl.textContent = guruAktif.nama;

    btnTambah.disabled = false;
    await muatDaftarJadwal();
  } catch (error) {
    console.error("Verifikasi akun gagal:", error);

    namaGuruEl.textContent = "Akses tidak tersedia";
    btnTambah.disabled = true;
    tabelJadwalEl.innerHTML =
      '<tr><td colspan="8">Akun tidak dapat mengakses halaman ini.</td></tr>';

    tampilkanPesan(error.message, true);
  }
});
