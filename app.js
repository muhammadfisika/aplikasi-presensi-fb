
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBI6VWDbIJ7A-PxNtdQWDDhmnNrCfWWhCI",
  authDomain: "aplikasi-presensi-fb.firebaseapp.com",
  projectId: "aplikasi-presensi-fb",
  storageBucket: "aplikasi-presensi-fb.firebasestorage.app",
  messagingSenderId: "1018611782868",
  appId: "1:1018611782868:web:37304037cece90197c9741"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const formLogin = document.getElementById("formLogin");
const pesan = document.getElementById("pesan");
const tombolLogin = document.getElementById("tombolLogin");

let sedangMengalihkan = false;

function tampilkanPesan(teks, berhasil = false) {
  if (!pesan) return;

  pesan.textContent = teks;
  pesan.style.color = berhasil ? "#166534" : "#b91c1c";
}

async function periksaPeran(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error(
      "Profil tidak ditemukan pada users/" + user.uid
    );
  }

  const data = userSnap.data();
  const role = String(data.role || "").trim().toLowerCase();

  if (data.aktif !== true) {
    throw new Error(
      "Akun tidak aktif. Pastikan field aktif bernilai boolean true."
    );
  }

  if (!["admin", "guru", "kepsek"].includes(role)) {
    throw new Error(
      'Peran tidak dikenali. Nilai role saat ini: "' + role + '".'
    );
  }

  return { ...data, role };
}

function alamatHalaman(role) {
  const halaman = {
    admin: "./admin.html",
    guru: "./presensi-guru.html",
    kepsek: "./kepsek.html"
  };

  return halaman[role];
}

if (formLogin) {
  formLogin.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (sedangMengalihkan) return;

    if (tombolLogin) tombolLogin.disabled = true;

    tampilkanPesan("Memeriksa email dan kata sandi...");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let loginBerhasil = false;

    try {
      const hasil = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      loginBerhasil = true;

      tampilkanPesan("Login berhasil. Memeriksa hak akses...");

      const profil = await periksaPeran(hasil.user);
      const tujuan = alamatHalaman(profil.role);

      if (!tujuan) {
        throw new Error("Halaman tujuan tidak ditemukan.");
      }

      sedangMengalihkan = true;

      tampilkanPesan(
        "Login berhasil sebagai " + profil.role +
        ". Membuka dashboard...",
        true
      );

      // Jangan signOut setelah autentikasi berhasil.
      window.location.replace(tujuan);

    } catch (error) {
      console.error("Proses login:", error);

      sedangMengalihkan = false;

      if (loginBerhasil && auth.currentUser) {
        // Logout hanya jika profil tidak dapat diverifikasi.
        await signOut(auth).catch(err => {
          console.error("Gagal membersihkan sesi:", err);
        });
      }

      const kode = error.code || "";

      if (kode === "auth/invalid-credential") {
        tampilkanPesan("Email atau kata sandi salah.");
      } else if (kode === "auth/too-many-requests") {
        tampilkanPesan(
          "Terlalu banyak percobaan login. Coba lagi nanti."
        );
      } else if (kode === "permission-denied" ||
                 kode === "firestore/permission-denied") {
        tampilkanPesan(
          "Akses profil ditolak oleh Firestore Rules. " +
          "Periksa izin membaca dokumen users milik sendiri."
        );
      } else {
        tampilkanPesan(error.message || "Login gagal.");
      }

    } finally {
      if (tombolLogin && !sedangMengalihkan) {
        tombolLogin.disabled = false;
      }
    }
  });
}

// Jangan melakukan logout atau pengalihan otomatis dari listener ini.
// Listener hanya memberi informasi jika ada sesi aktif.
onAuthStateChanged(auth, (user) => {
  if (user && formLogin && !sedangMengalihkan) {
    tampilkanPesan(
      "Sesi Firebase terdeteksi. Silakan lanjutkan login jika diperlukan.",
      true
    );
  }
});
