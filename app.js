// ===== KONFIGURASI =====
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyLsu4ZUtYEO5lhbKWW-VVPEaxvAKlOuAz5X7XppNHdX0lBHoh9273DdBMGNTbrcM4I/exec";
const SECRET = "pkpj-secret-123";

let allRecords = [];
let cameraStream = null;

// ===== INIT =====
document.addEventListener("DOMContentLoaded", function () {
  setToday("pemohon_tarikh");
  loadRecords();
});

// ===== HELPER FUNCTIONS =====

function setToday(id) {
  const el = document.getElementById(id);
  if (el) el.valueAsDate = new Date();
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function setMsg(text, color) {
  const el = document.getElementById("msg");
  if (!el) return;
  el.innerText = text;
  el.style.color = color;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#039;",
      '"': "&quot;"
    }[char];
  });
}

function formatDate(value) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return escapeHtml(value);
    return d.toLocaleDateString("ms-MY");
  } catch {
    return escapeHtml(value);
  }
}

function toInputDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

// ===== FORM FUNCTIONS =====

function kiraAmaun() {
  const qty = Number(getValue("qty_dipesan")) || 0;
  const harga = Number(getValue("harga_seunit")) || 0;
  const amaun = qty * harga;
  setValue("amaun", amaun.toFixed(2));
}

function kiraAmaunEdit() {
  const qty = Number(getValue("edit_qty_dipesan")) || 0;
  const harga = Number(getValue("edit_harga_seunit")) || 0;
  const amaun = qty * harga;
  setValue("edit_amaun", amaun.toFixed(2));
}

// ===== FILE HANDLING =====

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    if (!file) {
      resolve({});
      return;
    }

    const reader = new FileReader();

    reader.onload = function () {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;

      resolve({
        gambar_filename: file.name,
        gambar_mime: file.type,
        gambar_base64: base64
      });
    };

    reader.onerror = function () {
      reject(new Error("Gagal baca gambar."));
    };

    reader.readAsDataURL(file);
  });
}

function previewGambar(event) {
  const file = event.target.files[0];
  const preview = document.getElementById("preview");
  const btn = document.getElementById("uploadStatusBtn");

  if (!file) return;

  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";

  btn.innerText = "Gambar dipilih: " + file.name;
  btn.classList.remove("belum");
  btn.classList.add("dipilih");
}

// ===== CAMERA FUNCTIONS =====

async function openCamera() {
  const modal = document.getElementById("cameraModal");
  const video = document.getElementById("cameraPreview");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Browser tidak support kamera. Cuba guna Chrome atau pilih dari galeri.");
    return;
  }

  try {
    modal.classList.add("open");

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    video.srcObject = cameraStream;

  } catch (err) {
    alert("Kamera tidak dapat dibuka. Pastikan permission camera Allow.");
    closeCamera();
  }
}

function closeCamera() {
  const modal = document.getElementById("cameraModal");
  const video = document.getElementById("cameraPreview");

  if (cameraStream) {
    cameraStream.getTracks().forEach(function (track) {
      track.stop();
    });
  }

  cameraStream = null;

  if (video) {
    video.srcObject = null;
  }

  if (modal) {
    modal.classList.remove("open");
  }
}

function capturePhoto() {
  const video = document.getElementById("cameraPreview");
  const canvas = document.getElementById("cameraCanvas");
  const input = document.getElementById("gambar");
  const preview = document.getElementById("preview");
  const btn = document.getElementById("uploadStatusBtn");

  if (!video.videoWidth || !video.videoHeight) {
    alert("Kamera belum ready. Tunggu sekejap.");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(function (blob) {
    if (!blob) {
      alert("Gagal ambil gambar.");
      return;
    }

    const file = new File([blob], "gambar-permohonan.jpg", {
      type: "image/jpeg"
    });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";

    btn.innerText = "Gambar sudah diambil";
    btn.classList.remove("belum");
    btn.classList.add("dipilih");

    closeCamera();
  }, "image/jpeg", 0.85);
}

function openGallery() {
  document.getElementById("gambar").click();
}

// ===== LOAD & DISPLAY DATA =====

async function loadRecords() {
  const tbody = document.getElementById("list");

  try {
    // GUNAKAN GET METHOD DENGAN QUERY PARAMETER - SAMA MACAM PESANAN
    const url = `${APPS_SCRIPT_URL}?secret=${encodeURIComponent(SECRET)}`;
    const res = await fetch(url);
    const result = await res.json();

    if (!result.ok) {
      throw new Error(result.error || "Gagal baca data.");
    }

    allRecords = result.data || [];

    if (!allRecords.length) {
      tbody.innerHTML = `<tr><td colspan="9">Tiada permohonan direkodkan.</td></tr>`;
      return;
    }

    tbody.innerHTML = allRecords.map(function (d) {
      const gambar = d.gambar
        ? `<a href="${escapeHtml(d.gambar)}" target="_blank" class="link-gambar">Lihat</a>`
        : "-";

      return `
        <tr>
          <td>${escapeHtml(d.id)}</td>
          <td>${escapeHtml(d.item_name)}</td>
          <td>${escapeHtml(d.qty_dipesan)}</td>
          <td>${escapeHtml(d.pemohon_nama)}</td>
          <td>${formatDate(d.pemohon_tarikh)}</td>
          <td>RM ${escapeHtml(d.amaun || "0.00")}</td>
          <td><span class="status-badge">${escapeHtml(d.status)}</span></td>
          <td>${gambar}</td>
          <td>
            <button class="btn-small btn-edit" onclick="editRecord('${escapeHtml(d.id)}')">Edit</button>
            <button class="btn-small btn-delete" onclick="deleteRecord('${escapeHtml(d.id)}')">Hapus</button>
          </td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="error">Gagal load: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ===== SUBMIT PERMOHONAN =====

async function hantarPermohonan() {
  const itemName = getValue("item_name");
  const qtyDipesan = getValue("qty_dipesan");
  const pemohonNama = getValue("pemohon_nama");

  if (!itemName || !qtyDipesan || !pemohonNama) {
    setMsg("Sila isi Nama Item, Kuantiti dan Nama Pemohon.", "#dc2626");
    return;
  }

  const gambarFile = document.getElementById("gambar").files[0];

  try {
    setMsg("Sedang hantar permohonan...", "#2563eb");

    const gambarData = await fileToBase64(gambarFile);

    const payload = {
      secret: SECRET,
      action: "create",

      item_name: itemName,
      qty_dipesan: qtyDipesan,
      pemohon_nama: pemohonNama,
      pemohon_jawatan: getValue("pemohon_jawatan"),
      pemohon_tarikh: getValue("pemohon_tarikh"),
      kod_pegawai_pengawal: getValue("kod_pegawai_pengawal"),
      kump_ptj: getValue("kump_ptj"),
      vot_dana: getValue("vot_dana"),
      cp: getValue("cp"),
      program_aktiviti: getValue("program_aktiviti"),
      projek: getValue("projek"),
      setia: getValue("setia"),
      sub_setia: getValue("sub_setia"),
      kod_akaun: getValue("kod_akaun"),
      kod_item: getValue("kod_item"),
      harga_seunit: getValue("harga_seunit"),
      amaun: getValue("amaun"),

      ...gambarData
    };

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!result.ok) {
      throw new Error(result.error || "Gagal hantar permohonan.");
    }

    setMsg("✓ Permohonan berjaya dihantar!", "#16a34a");

    resetForm();
    loadRecords();

  } catch (err) {
    setMsg("✗ Gagal: " + err.message, "#dc2626");
  }
}

function resetForm() {
  document.querySelectorAll(".form-grid input, .form-grid textarea").forEach(function (el) {
    if (!el.id.startsWith("edit_")) {
      el.value = "";
    }
  });

  const preview = document.getElementById("preview");
  preview.style.display = "none";
  preview.src = "";

  const gambar = document.getElementById("gambar");
  gambar.value = "";

  const btn = document.getElementById("uploadStatusBtn");
  btn.innerText = "Belum pilih gambar";
  btn.classList.add("belum");
  btn.classList.remove("dipilih");

  setToday("pemohon_tarikh");
  setMsg("", "#0f172a");
}

// ===== EDIT FUNCTIONS =====

function editRecord(id) {
  const d = allRecords.find(function (x) {
    return String(x.id) === String(id);
  });

  if (!d) {
    alert("Data tidak dijumpai.");
    return;
  }

  // Populate edit modal
  setValue("edit_id", d.id);
  setValue("edit_item_name", d.item_name);
  setValue("edit_qty_dipesan", d.qty_dipesan);
  setValue("edit_pemohon_tarikh", toInputDate(d.pemohon_tarikh));
  setValue("edit_pemohon_nama", d.pemohon_nama);
  setValue("edit_pemohon_jawatan", d.pemohon_jawatan);
  setValue("edit_kod_pegawai_pengawal", d.kod_pegawai_pengawal);
  setValue("edit_kump_ptj", d.kump_ptj);
  setValue("edit_vot_dana", d.vot_dana);
  setValue("edit_cp", d.cp);
  setValue("edit_program_aktiviti", d.program_aktiviti);
  setValue("edit_projek", d.projek);
  setValue("edit_setia", d.setia);
  setValue("edit_sub_setia", d.sub_setia);
  setValue("edit_kod_akaun", d.kod_akaun);
  setValue("edit_kod_item", d.kod_item);
  setValue("edit_harga_seunit", d.harga_seunit);
  setValue("edit_amaun", d.amaun);
  setValue("edit_status", d.status);

  // Show modal
  const modal = document.getElementById("editModal");
  if (modal) {
    modal.classList.add("open");
  }
}

function closeEditModal() {
  const modal = document.getElementById("editModal");
  if (modal) {
    modal.classList.remove("open");
  }
  document.getElementById("editMsg").innerText = "";
}

async function simpanEdit() {
  const id = getValue("edit_id");

  if (!id) {
    alert("ID tidak ditemukan.");
    return;
  }

  try {
    const editMsg = document.getElementById("editMsg");
    editMsg.innerText = "Sedang simpan...";
    editMsg.style.color = "#2563eb";

    const payload = {
      secret: SECRET,
      action: "update",
      id: id,

      item_name: getValue("edit_item_name"),
      qty_dipesan: getValue("edit_qty_dipesan"),
      pemohon_nama: getValue("edit_pemohon_nama"),
      pemohon_jawatan: getValue("edit_pemohon_jawatan"),
      pemohon_tarikh: getValue("edit_pemohon_tarikh"),
      kod_pegawai_pengawal: getValue("edit_kod_pegawai_pengawal"),
      kump_ptj: getValue("edit_kump_ptj"),
      vot_dana: getValue("edit_vot_dana"),
      cp: getValue("edit_cp"),
      program_aktiviti: getValue("edit_program_aktiviti"),
      projek: getValue("edit_projek"),
      setia: getValue("edit_setia"),
      sub_setia: getValue("edit_sub_setia"),
      kod_akaun: getValue("edit_kod_akaun"),
      kod_item: getValue("edit_kod_item"),
      harga_seunit: getValue("edit_harga_seunit"),
      amaun: getValue("edit_amaun"),
      status: getValue("edit_status")
    };

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!result.ok) {
      throw new Error(result.error || "Gagal kemaskini.");
    }

    editMsg.innerText = "✓ Berjaya dikemaskini!";
    editMsg.style.color = "#16a34a";

    setTimeout(function () {
      closeEditModal();
      loadRecords();
    }, 1000);

  } catch (err) {
    const editMsg = document.getElementById("editMsg");
    editMsg.innerText = "✗ Gagal: " + err.message;
    editMsg.style.color = "#dc2626";
  }
}

// ===== DELETE FUNCTIONS =====

async function deleteRecord(id) {
  if (!confirm("Adakah anda pasti ingin padam permohonan ini?")) {
    return;
  }

  try {
    const payload = {
      secret: SECRET,
      action: "delete",
      id: id
    };

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!result.ok) {
      throw new Error(result.error || "Gagal padam.");
    }

    loadRecords();

  } catch (err) {
    alert("Gagal padam: " + err.message);
  }
}

// ===== FILTER FUNCTIONS =====

function applyFilter() {
  const searchInput = getValue("searchInput").toLowerCase();
  const statusFilter = getValue("statusFilter");

  const rows = document.querySelectorAll("#list tr");

  rows.forEach(function (row) {
    const cells = row.querySelectorAll("td");
    if (cells.length === 1) return; // Skip "kosong" row

    const item = cells[1].innerText.toLowerCase();
    const pemohon = cells[3].innerText.toLowerCase();
    const status = cells[6].innerText;

    const matchSearch = item.includes(searchInput) || pemohon.includes(searchInput);
    const matchStatus = !statusFilter || status.includes(statusFilter);

    row.style.display = matchSearch && matchStatus ? "" : "none";
  });
}