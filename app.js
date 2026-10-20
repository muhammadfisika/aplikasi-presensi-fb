
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
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
  const profilRef = doc(db, "users", user.uid);
  const profilSnap = await getDoc(profilRef);

  if (!profilSnap.exists()) {
    throw new Error(
      "Profil tidak ditemukan. Pastikan ID dokumen users sama dengan UID Authentication: " +
      user.uid
    );
  }

  const data = profilSnap.data();
  const role = String(data.role || "").trim().toLowerCase();

  if (data.aktif !== true) {
    throw new Error(
      "Akun belum aktif. Field aktif harus berupa boolean true."
    );
  }

  if (!["admin", "guru", "kepsek"].includes(role)) {
    throw new Error("Role akun tidak valid: " + role);
  }

  return { ...data, role };
}

function alamatHalaman(role) {
  const halaman = {
    admin: "./admin.html",
    guru: "./presensi-guru.html",
    kepsek: "./kepsek.html"
  };

  return halaman[role] || null;
}

if (formLogin) {
  formLogin.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (sedangMengalihkan) return;

    if (tombolLogin) tombolLogin.disabled = true;

    const emailEl = document.getElementById("email");
    const passwordEl = document.getElementById("password");

    if (!emailEl || !passwordEl) {
      tampilkanPesan("Input email atau password tidak ditemukan.");
      if (tombolLogin) tombolLogin.disabled = false;
      return;
    }

    const email = emailEl.value.trim();
    const password = passwordEl.value;

    tampilkanPesan("Menghubungkan ke Firebase Authentication...");

    try {
      // Simpan sesi secara lokal sebelum melakukan login.
      await setPersistence(auth, browserLocalPersistence);

      const hasil = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      tampilkanPesan(
        "Login berhasil. Memeriksa profil pengguna..."
      );

      const profil = await periksaPeran(hasil.user);
      const tujuan = alamatHalaman(profil.role);

      if (!tujuan) {
        throw new Error("Halaman tujuan tidak ditemukan.");
      }

      tampilkanPesan(
        "Login berhasil sebagai " + profil.role + ". Membuka dashboard...",
        true
      );

      sedangMengalihkan = true;

      // Jangan signOut di sini. Sesi harus tersedia di halaman tujuan.
      window.location.replace(tujuan);

    } catch (error) {
      console.error("Kesalahan login:", error);

      sedangMengalihkan = false;

      const kode = error.code || "";

      if (kode === "auth/api-key-not-valid") {
        tampilkanPesan(
          "API Key Firebase tidak valid. Salin ulang firebaseConfig dari Firebase Console."
        );
      } else if (
        kode === "auth/invalid-credential" ||
        kode === "auth/wrong-password" ||
        kode === "auth/user-not-found"
      ) {
        tampilkanPesan("Email atau kata sandi salah.");
      } else if (kode === "auth/too-many-requests") {
        tampilkanPesan(
          "Terlalu banyak percobaan login. Coba lagi nanti."
        );
      } else if (
        kode === "permission-denied" ||
        kode === "firestore/permission-denied"
      ) {
        tampilkanPesan(
          "Tidak dapat membaca profil pengguna. Periksa Firestore Rules untuk dokumen users milik sendiri."
        );
      } else {
        tampilkanPesan(
          (kode ? kode + ": " : "") +
          (error.message || "Login gagal.")
        );
      }

      // Sengaja tidak melakukan signOut otomatis.
      // Sesi tidak dihapus agar penyebab masalah mudah diperiksa.

    } finally {
      if (tombolLogin && !sedangMengalihkan) {
        tombolLogin.disabled = false;
      }
    }
  });
}

// Listener ini hanya menampilkan informasi.
// Tidak melakukan logout atau mengalihkan halaman.
onAuthStateChanged(auth, (user) => {
  if (user && formLogin && !sedangMengalihkan) {
    tampilkanPesan(
      "Sesi Firebase ditemukan. Silakan lanjutkan login.",
      true
    );
  }
});
