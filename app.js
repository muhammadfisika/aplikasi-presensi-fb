
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

// GANTI dengan konfigurasi Firebase milik Anda.
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

function tampilkanPesan(teks, berhasil = false) {
  if (pesan) {
    pesan.textContent = teks;
    pesan.style.color = berhasil ? "#166534" : "#b91c1c";
  }
}

async function periksaPeran(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error(
      "Akun belum memiliki data peran. Hubungi administrator."
    );
  }

  const data = userSnap.data();

  if (data.aktif !== true) {
    throw new Error("Akun tidak aktif. Hubungi administrator.");
  }

  const role = String(data.role || "").toLowerCase();

  if (!["admin", "guru", "kepsek"].includes(role)) {
    throw new Error("Peran akun tidak dikenali.");
  }

  return { ...data, role };
}

if (formLogin) {
  formLogin.addEventListener("submit", async (event) => {
    event.preventDefault();

    tombolLogin.disabled = true;
    tampilkanPesan("Memeriksa akun...");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      const hasil = await signInWithEmailAndPassword(
        auth, email, password
      );

      const profil = await periksaPeran(hasil.user);


if (profil.role === "admin") {
  window.location.replace("./admin.html");
} else if (profil.role === "guru") {
  window.location.replace("./presensi-guru.html");
} else if (profil.role === "kepsek") {
  window.location.replace("./index.html");
} else {
  throw new Error("Peran akun tidak dikenali. Hubungi administrator.");
}


      document.getElementById("password").value = "";
    } catch (error) {
      console.error("Login gagal:", error);

      if (error.code === "auth/invalid-credential") {
        tampilkanPesan("Email atau kata sandi salah.");
      } else if (error.code === "auth/too-many-requests") {
        tampilkanPesan(
          "Terlalu banyak percobaan. Coba lagi beberapa saat."
        );
      } else {
        tampilkanPesan(error.message || "Login gagal.");
      }

      // Hapus sesi bila autentikasi berhasil tetapi profil tidak valid.
      if (auth.currentUser) {
        await signOut(auth).catch(console.error);
      }
    } finally {
      tombolLogin.disabled = false;
    }
  });
}

// Tidak mengarahkan pengguna otomatis agar halaman login
// tidak mengalami loop saat status autentikasi berubah.
onAuthStateChanged(auth, (user) => {
  if (user && formLogin) {
    tampilkanPesan(
      "Sesi pengguna terdeteksi. Silakan masuk atau muat ulang halaman."
    );
  }
});
