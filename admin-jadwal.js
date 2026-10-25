import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, addDoc, query, where, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

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
let importSedangBerjalan = false;
let barisImportJadwal = [];
let hasilValidasiJadwal = [];

function pesan(teks, tipe = "info") {
  const el = $("pesan");
  if (!el) { alert(teks); return; }
  el.hidden = false;
  el.textContent = teks;
  el.style.background = tipe === "error" ? "#fbe7e7" : tipe === "sukses" ? "#e4f5e9" : "#edf3fa";
  el.style.color = tipe === "error" ? "#8c2020" : tipe === "sukses" ? "#176334" : "#173a5e";
}

async function periksaAdmin(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) throw new Error("Profil admin tidak ditemukan.");
  const data = snap.data();
  if (data.role !== "admin" || data.aktif !== true) throw new Error("Akses ditolak. Akun bukan admin aktif.");
}

// Waktu pada koleksi jadwal disimpan sebagai teks HH:mm, misalnya 08:00.
function validasiFormatJam(nilai) {
  const jam = String(nilai ?? "").trim();
  const cocok = jam.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!cocok) return { valid: false, menit: null, pesan: `Format jam "${jam}" tidak valid. Gunakan HH:mm, misalnya 08:00.` };
  return { valid: true, menit: Number(cocok[1]) * 60 + Number(cocok[2]), pesan: "" };
}
function keMenit(nilai) {
  if (typeof nilai === "number" && Number.isFinite(nilai)) return Math.round(nilai * 60);
  const hasil = validasiFormatJam(nilai);
  return hasil.valid ? hasil.menit : null;
}
function formatJam(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return "";
  if (typeof nilai === "number" && Number.isFinite(nilai)) {
    const total = Math.round(nilai * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  return String(nilai).trim();
}
function resetForm() {
  $("formJadwal").reset();
  $("aktif").value = "true";
  editId = null;
  $("btnSimpan").textContent = "Simpan Jadwal";
}

async function muatGuru() {
  const snap = await getDocs(collection(db, "users"));
  guru = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .filter(g => g.role === "guru" && g.aktif === true)
    .sort((a, b) => (a.nama || "").localeCompare(b.nama || "", "id"));
  const select = $("guruUid");
  select.replaceChildren();
  const awal = document.createElement("option");
  awal.value = ""; awal.textContent = "Pilih guru"; select.appendChild(awal);
  for (const g of guru) {
    const opt = document.createElement("option");
    opt.value = g.uid; opt.textContent = g.nama || g.email || g.uid;
    select.appendChild(opt);
  }
}

async function muatJadwal() {
  const snap = await getDocs(collection(db, "jadwal"));
  jadwal = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  jadwal.sort((a, b) => (a.hari || "").localeCompare(b.hari || "", "id") ||
    (a.kelas || "").localeCompare(b.kelas || "", "id") ||
    (keMenit(a.jamMulai) ?? 0) - (keMenit(b.jamMulai) ?? 0));
  tampilkanJadwal();
}

function tampilkanJadwal() {
  const kata = $("cari").value.trim().toLowerCase();
  const tbody = $("tabelJadwal");
  tbody.replaceChildren();
  const hasil = jadwal.filter(j => {
    const namaGuru = guru.find(g => g.uid === j.guruUid)?.nama || j.guruNama || "";
    return [j.hari, j.kelas, j.mataPelajaran, namaGuru, formatJam(j.jamMulai), formatJam(j.jamSelesai), j.aktif].join(" ").toLowerCase().includes(kata);
  });
  $("jumlah").textContent = `${hasil.length} jadwal ditampilkan dari ${jadwal.length} jadwal.`;
  if (!hasil.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 7; td.textContent = "Belum ada jadwal yang cocok."; tr.appendChild(td); tbody.appendChild(tr); return;
  }
  for (const j of hasil) {
    const tr = document.createElement("tr");
    const namaGuru = guru.find(g => g.uid === j.guruUid)?.nama || j.guruNama || "-";
    for (const v of [j.hari, j.kelas, j.mataPelajaran, namaGuru, `${formatJam(j.jamMulai)}–${formatJam(j.jamSelesai)}`, j.aktif === true ? "Aktif" : "Tidak aktif"]) {
      const td = document.createElement("td"); td.textContent = String(v ?? ""); tr.appendChild(td);
    }
    const aksi = document.createElement("td");
    const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit"; edit.className = "secondary";
    edit.addEventListener("click", () => isiForm(j));
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.textContent = j.aktif === true ? "Nonaktifkan" : "Aktifkan"; toggle.className = "secondary"; toggle.style.marginLeft = "5px";
    toggle.addEventListener("click", () => ubahStatus(j));
    aksi.append(edit, toggle); tr.appendChild(aksi); tbody.appendChild(tr);
  }
}

function isiForm(j) {
  editId = j.id;
  $("hari").value = j.hari || "";
  $("kelas").value = j.kelas || "";
  $("mapel").value = j.mataPelajaran || "";
  $("guruUid").value = j.guruUid || "";
  $("jamMulai").value = formatJam(j.jamMulai);
  $("jamSelesai").value = formatJam(j.jamSelesai);
  $("aktif").value = j.aktif === true ? "true" : "false";
  $("btnSimpan").textContent = "Simpan Perubahan";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function adaBenturan({ hari, kelas, guruUid, menitMulai, menitSelesai, kecualiId = null }) {
  return jadwal.some(j => {
    if (j.id === kecualiId || j.aktif !== true || j.hari !== hari) return false;
    const mulaiLama = keMenit(j.jamMulai), selesaiLama = keMenit(j.jamSelesai);
    if (mulaiLama === null || selesaiLama === null) return false;
    // Interval [mulai, selesai): 08:00–09:00 tidak bentrok dengan 09:00–10:00.
    const overlap = menitMulai < selesaiLama && menitSelesai > mulaiLama;
    return overlap && (String(j.kelas || "").toLowerCase() === kelas.toLowerCase() || j.guruUid === guruUid);
  });
}

async function simpan(event) {
  event.preventDefault();
  if (!adminSiap || menyimpan) return;
  const hari = $("hari").value, kelas = $("kelas").value.trim();
  const mataPelajaran = $("mapel").value.trim(), guruUid = $("guruUid").value;
  const jamMulai = $("jamMulai").value.trim(), jamSelesai = $("jamSelesai").value.trim();
  const aktif = $("aktif").value === "true";
  const guruTerpilih = guru.find(g => g.uid === guruUid);
  if (!kelas || !mataPelajaran || !guruTerpilih) { pesan("Lengkapi kelas, mata pelajaran, dan guru.", "error"); return; }
  const awal = validasiFormatJam(jamMulai), akhir = validasiFormatJam(jamSelesai);
  if (!awal.valid) { pesan(awal.pesan, "error"); return; }
  if (!akhir.valid) { pesan(akhir.pesan, "error"); return; }
  if (awal.menit >= akhir.menit) { pesan("Jam selesai harus lebih besar daripada jam mulai.", "error"); return; }
  if (aktif && adaBenturan({ hari, kelas, guruUid, menitMulai: awal.menit, menitSelesai: akhir.menit, kecualiId: editId })) {
    pesan("Jadwal bertabrakan dengan jadwal aktif guru atau kelas pada hari dan jam tersebut.", "error"); return;
  }
  const data = { hari, kelas, mataPelajaran, guruUid, guruNama: guruTerpilih.nama || guruTerpilih.email || "", jamMulai, jamSelesai, aktif, diperbaruiPada: serverTimestamp() };
  menyimpan = true; $("btnSimpan").disabled = true;
  try {
    if (editId) {
      await updateDoc(doc(db, "jadwal", editId), data);
      pesan("Jadwal berhasil diperbarui.", "sukses");
    } else {
      await addDoc(collection(db, "jadwal"), { ...data, dibuatPada: serverTimestamp() });
      pesan("Jadwal berhasil ditambahkan.", "sukses");
    }
    resetForm(); await muatJadwal();
  } catch (e) {
    console.error(e); pesan(`Gagal menyimpan jadwal: ${e.message || "Periksa Firestore Rules dan koneksi."}`, "error");
  } finally { menyimpan = false; $("btnSimpan").disabled = false; }
}

async function ubahStatus(j) {
  if (!adminSiap || menyimpan) return;
  const aktifBaru = j.aktif !== true;
  if (!confirm(`${aktifBaru ? "Aktifkan" : "Nonaktifkan"} jadwal ${j.kelas} - ${j.mataPelajaran}?`)) return;
  try {
    await updateDoc(doc(db, "jadwal", j.id), { aktif: aktifBaru, diperbaruiPada: serverTimestamp() });
    pesan("Status jadwal berhasil diperbarui.", "sukses"); await muatJadwal();
  } catch (e) { console.error(e); pesan(`Gagal mengubah status jadwal: ${e.message || ""}`, "error"); }
}

$("formJadwal").addEventListener("submit", simpan);
$("btnBatal").addEventListener("click", resetForm);
$("cari").addEventListener("input", tampilkanJadwal);
$("btnKembali").addEventListener("click", () => { location.href = "./admin.html"; });
$("btnKeluar").addEventListener("click", async () => { await signOut(auth); location.replace("./login.html"); });

// ---------------- IMPORT CSV JADWAL ----------------
const fileJadwal = $("fileJadwal"), btnPratinjau = $("btnPratinjau");
const btnImport = $("btnImport"), infoImport = $("infoImport"), pratinjauJadwal = $("pratinjauJadwal");
const hariValid = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function parseCSVJadwal(teks) {
  teks = teks.replace(/^\uFEFF/, "");
  const barisAwal = teks.split(/\r?\n/).find(x => x.trim() !== "") || "";
  const pemisah = (barisAwal.match(/;/g) || []).length >= (barisAwal.match(/,/g) || []).length ? ";" : ",";
  const hasil = []; let baris = [], nilai = "", dalamKutip = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (c === '"') {
      if (dalamKutip && teks[i + 1] === '"') { nilai += '"'; i++; }
      else dalamKutip = !dalamKutip;
    } else if (c === pemisah && !dalamKutip) { baris.push(nilai.trim()); nilai = ""; }
    else if ((c === "\n" || c === "\r") && !dalamKutip) {
      if (c === "\r" && teks[i + 1] === "\n") i++;
      baris.push(nilai.trim()); if (baris.some(v => v !== "")) hasil.push(baris);
      baris = []; nilai = "";
    } else nilai += c;
  }
  if (dalamKutip) throw new Error("CSV memiliki tanda kutip yang tidak berpasangan.");
  if (nilai.length || baris.length) { baris.push(nilai.trim()); if (baris.some(v => v !== "")) hasil.push(baris); }
  if (hasil.length < 2) throw new Error("CSV tidak berisi data jadwal.");
  const header = hasil[0].map(v => v.trim().replace(/^\uFEFF/, ""));
  const wajib = ["hari", "kelas", "mataPelajaran", "guruUid", "jamMulai", "jamSelesai"];
  for (const k of wajib) if (!header.includes(k)) throw new Error(`Kolom wajib "${k}" tidak ditemukan. Header terbaca: ${header.join(", ")}`);
  return hasil.slice(1).map((kolom, i) => {
    const obj = {}; for (const k of wajib) obj[k] = String(kolom[header.indexOf(k)] || "").trim();
    obj.nomorBaris = i + 2; return obj;
  });
}

function validasiCSVJadwal(baris) {
  const mapGuru = new Map(guru.map(g => [g.uid, g]));
  const hasil = [];
  for (const row of baris) {
    const alasan = [];
    const hari = String(row.hari || "").trim(), kelas = String(row.kelas || "").trim();
    const mataPelajaran = String(row.mataPelajaran || "").trim(), guruUid = String(row.guruUid || "").trim();
    const jamMulai = String(row.jamMulai || "").trim(), jamSelesai = String(row.jamSelesai || "").trim();
    const awal = validasiFormatJam(jamMulai), akhir = validasiFormatJam(jamSelesai);
    const gt = mapGuru.get(guruUid);
    if (!hariValid.includes(hari)) alasan.push("Hari tidak valid");
    if (!kelas) alasan.push("Kelas kosong");
    if (!mataPelajaran) alasan.push("Mapel kosong");
    if (!gt) alasan.push("UID guru tidak ditemukan atau tidak aktif");
    if (!awal.valid) alasan.push(awal.pesan);
    if (!akhir.valid) alasan.push(akhir.pesan);
    const waktuValid = awal.valid && akhir.valid && awal.menit < akhir.menit;
    if (awal.valid && akhir.valid && awal.menit >= akhir.menit) alasan.push("Jam selesai harus lebih besar daripada jam mulai");

    if (waktuValid) {
      const overlapDengan = (mulai, selesai) => awal.menit < selesai && akhir.menit > mulai;
      const bentrokCSV = hasil.some(prev => {
        if (!prev.valid || prev.data.hari !== hari) return false;
        const p = prev.data, pm = keMenit(p.jamMulai), ps = keMenit(p.jamSelesai);
        return pm !== null && ps !== null && overlapDengan(pm, ps) &&
          (String(p.kelas || "").toLowerCase() === kelas.toLowerCase() || p.guruUid === guruUid);
      });
      if (bentrokCSV) alasan.push("Bentrok dengan baris lain dalam CSV");
      const bentrokDB = jadwal.some(j => {
        if (j.aktif !== true || j.hari !== hari) return false;
        const jm = keMenit(j.jamMulai), js = keMenit(j.jamSelesai);
        return jm !== null && js !== null && overlapDengan(jm, js) &&
          (String(j.kelas || "").toLowerCase() === kelas.toLowerCase() || j.guruUid === guruUid);
      });
      if (bentrokDB) alasan.push("Bentrok dengan jadwal aktif di Firestore");
    }
    hasil.push({ nomorBaris: row.nomorBaris, valid: alasan.length === 0, alasan,
      data: { hari, kelas, mataPelajaran, guruUid, guruNama: gt?.nama || gt?.email || "", jamMulai, jamSelesai, aktif: true } });
  }
  return hasil;
}

function tampilkanPratinjauImport() {
  pratinjauJadwal.replaceChildren();
  if (!hasilValidasiJadwal.length) {
    const tr = document.createElement("tr"), td = document.createElement("td");
    td.colSpan = 7; td.textContent = "Tidak ada data untuk ditampilkan."; tr.appendChild(td); pratinjauJadwal.appendChild(tr);
    infoImport.textContent = "Belum ada data pratinjau."; btnImport.disabled = true; return;
  }
  for (const item of hasilValidasiJadwal) {
    const d = item.data, tr = document.createElement("tr");
    for (const v of [item.nomorBaris, d.hari, d.kelas, d.mataPelajaran, d.guruUid, `${formatJam(d.jamMulai)}–${formatJam(d.jamSelesai)}`, item.valid ? "VALID" : item.alasan.join("; ")]) {
      const td = document.createElement("td"); td.textContent = String(v ?? ""); tr.appendChild(td);
    }
    pratinjauJadwal.appendChild(tr);
  }
  const valid = hasilValidasiJadwal.filter(x => x.valid).length, salah = hasilValidasiJadwal.length - valid;
  infoImport.textContent = `Total ${hasilValidasiJadwal.length} baris. ${valid} valid, ${salah} bermasalah. ` + (salah ? "Perbaiki baris bermasalah sebelum import." : "Semua baris valid dan siap diimport.");
  btnImport.disabled = salah > 0;
}

btnPratinjau.addEventListener("click", async () => {
  if (!adminSiap) { pesan("Silakan login sebagai admin terlebih dahulu.", "error"); return; }
  const file = fileJadwal?.files?.[0];
  if (!file) { pesan("Pilih file CSV terlebih dahulu.", "error"); return; }
  try {
    barisImportJadwal = parseCSVJadwal(await file.text());
    hasilValidasiJadwal = validasiCSVJadwal(barisImportJadwal);
    tampilkanPratinjauImport();
    const salah = hasilValidasiJadwal.some(x => !x.valid);
    pesan(salah ? "Pratinjau selesai. Periksa baris bermasalah." : "Pratinjau selesai. Data siap diimport.", salah ? "error" : "sukses");
  } catch (e) {
    console.error(e); hasilValidasiJadwal = []; tampilkanPratinjauImport(); pesan("Gagal membaca CSV: " + e.message, "error");
  }
});

btnImport.addEventListener("click", async () => {
  if (!adminSiap || importSedangBerjalan) return;
  if (!hasilValidasiJadwal.length) { pesan("Klik Pratinjau CSV terlebih dahulu.", "error"); return; }
  hasilValidasiJadwal = validasiCSVJadwal(barisImportJadwal);
  tampilkanPratinjauImport();
  if (hasilValidasiJadwal.some(x => !x.valid)) { pesan("Import dibatalkan. Ada baris tidak valid atau jadwal bertabrakan.", "error"); return; }
  if (!confirm(`Import ${hasilValidasiJadwal.length} jadwal baru ke Firestore?`)) return;
  importSedangBerjalan = true; btnImport.disabled = true; btnPratinjau.disabled = true;
  let berhasil = 0;
  try {
    for (const item of hasilValidasiJadwal) {
      await addDoc(collection(db, "jadwal"), { ...item.data, dibuatPada: serverTimestamp(), diperbaruiPada: serverTimestamp(), sumberImport: "CSV" });
      berhasil++;
      infoImport.textContent = `Mengimpor jadwal: ${berhasil}/${hasilValidasiJadwal.length}`;
    }
    pesan(`Import selesai. ${berhasil} jadwal berhasil ditambahkan.`, "sukses");
    fileJadwal.value = ""; barisImportJadwal = []; hasilValidasiJadwal = [];
    tampilkanPratinjauImport(); infoImport.textContent = "Import selesai."; await muatJadwal();
  } catch (e) {
    console.error("Import jadwal gagal:", e);
    pesan(`Import terhenti setelah ${berhasil} jadwal. Sebagian data mungkin sudah tersimpan. Detail: ${e.message || "Periksa Firestore Rules."}`, "error");
    await muatJadwal();
  } finally {
    importSedangBerjalan = false; btnPratinjau.disabled = false;
    btnImport.disabled = hasilValidasiJadwal.some(x => !x.valid);
  }
});

// ---------------- DOWNLOAD KOLEKSI JADWAL KE EXCEL ----------------
const btnDownloadJadwal = $("btnDownloadJadwal");
if (btnDownloadJadwal) btnDownloadJadwal.addEventListener("click", downloadDataJadwal);

async function downloadDataJadwal() {
  if (!auth.currentUser) { alert("Silakan login terlebih dahulu."); return; }
  if (!window.XLSX) { alert("Pustaka Excel belum tersedia. Pastikan SheetJS dimuat di HTML."); return; }
  btnDownloadJadwal.disabled = true;
  const labelAwal = btnDownloadJadwal.textContent;
  btnDownloadJadwal.textContent = "Menyiapkan Excel...";
  try {
    const profil = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (!profil.exists() || profil.data().role !== "admin" || profil.data().aktif !== true) throw new Error("Hanya admin aktif yang boleh mengunduh data jadwal.");
    const snap = await getDocs(collection(db, "jadwal"));
    if (snap.empty) { alert("Koleksi jadwal belum memiliki data."); return; }
    const gs = await getDocs(query(collection(db, "users"), where("role", "==", "guru")));
    const namaGuru = new Map();
    gs.forEach(d => { const g = d.data(); namaGuru.set(d.id, g.nama || g.email || d.id); });
    const dataExcel = snap.docs.map((d, i) => {
      const j = d.data();
      return { "No": i + 1, "ID Jadwal": d.id, "Nama Guru": namaGuru.get(j.guruUid) || j.guruNama || "", "Guru UID": j.guruUid || "", "Hari": j.hari || "", "Kelas": j.kelas || "", "Mata Pelajaran": j.mataPelajaran || "", "Jam Mulai": formatJam(j.jamMulai), "Jam Selesai": formatJam(j.jamSelesai), "Status": j.aktif === true ? "Aktif" : j.aktif === false ? "Tidak Aktif" : "" };
    });
    const urutan = { Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 7 };
    dataExcel.sort((a, b) => (urutan[a.Hari] || 99) - (urutan[b.Hari] || 99) || String(a.Kelas).localeCompare(String(b.Kelas), "id") || (keMenit(a["Jam Mulai"]) ?? 0) - (keMenit(b["Jam Mulai"]) ?? 0));
    const ws = XLSX.utils.json_to_sheet(dataExcel);
    ws["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data Jadwal");
    const tanggal = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    XLSX.writeFile(wb, `Data_Jadwal_SMAN2_Rangkasbitung_${tanggal}.xlsx`);
    alert(`Berhasil menyiapkan ${dataExcel.length} data jadwal.`);
  } catch (e) {
    console.error("Gagal mengunduh jadwal:", e);
    alert(e.code === "permission-denied" ? "Akses ditolak Firestore. Periksa Firestore Rules." : e.message || "Gagal mengunduh data jadwal.");
  } finally {
    btnDownloadJadwal.disabled = false; btnDownloadJadwal.textContent = labelAwal || "Download Excel Jadwal";
  }
}

// Login dan muat data awal.
onAuthStateChanged(auth, async user => {
  if (!user) { location.replace("./login.html"); return; }
  adminSiap = false;
  try {
    await periksaAdmin(user);
    await muatGuru();
    await muatJadwal();
    adminSiap = true;
  } catch (e) { console.error(e); pesan(e.message || "Gagal memuat data.", "error"); }
});
