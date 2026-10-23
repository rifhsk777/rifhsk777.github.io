"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("orderForm");
  const service = document.getElementById("service");
  const qty = document.getElementById("qty");
  const totalPrice = document.getElementById("totalPrice");
  const totalDescription = document.getElementById("totalDescription");
  const formError = document.getElementById("formError");

  // Nomor admin: format internasional tanpa tanda +.
  // Pastikan nomor ini benar dan terdaftar di WhatsApp.
  const WHATSAPP_ADMIN = "6285725209623";

  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Tampilkan placeholder jika gambar QRIS belum tersedia.
  const qrisImage = document.getElementById("qrisImage");
  const qrisPlaceholder = document.getElementById("qrisPlaceholder");

  function showQrisPlaceholder() {
    if (qrisImage) qrisImage.hidden = true;
    if (qrisPlaceholder) qrisPlaceholder.hidden = false;
  }

  if (qrisImage && qrisPlaceholder) {
    qrisImage.addEventListener("error", showQrisPlaceholder);

    if (qrisImage.complete && qrisImage.naturalWidth === 0) {
      showQrisPlaceholder();
    }
  }

  if (!form || !service || !qty || !totalPrice || !totalDescription) {
    console.error("Elemen form tidak ditemukan. Periksa index.html.");
    return;
  }

  function getPricePerMatch() {
    return service.value === "FLEXIBLE" ? 2500 : 3500;
  }

  function formatRupiah(value) {
    return "Rp" + Number(value).toLocaleString("id-ID");
  }

  function updateTotal() {
    const jumlah = Number(qty.value) || 1;
    const total = jumlah * getPricePerMatch();

    totalPrice.textContent = formatRupiah(total);
    totalDescription.textContent =
      service.value + " · " + jumlah + " MATCH";
  }

  service.addEventListener("change", updateTotal);
  qty.addEventListener("change", updateTotal);
  qty.addEventListener("input", updateTotal);

  // Tombol pilihan pada kartu harga.
  document.querySelectorAll(".choose").forEach(function (button) {
    button.addEventListener("click", function () {
      service.value = button.dataset.service;
      updateTotal();

      document.getElementById("order").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (formError) {
      formError.hidden = true;
      formError.textContent = "";
    }

    const nickname = document.getElementById("nickname").value.trim();
    const gameid = document.getElementById("gameid").value.trim();
    const scheduleValue = document.getElementById("schedule").value;
    const notes =
      document.getElementById("notes").value.trim() || "-";

    if (!nickname || !gameid || !scheduleValue) {
      showError("Lengkapi nickname, ID Game, dan jadwal terlebih dahulu.");
      return;
    }

    const date = new Date(scheduleValue);

    if (Number.isNaN(date.getTime())) {
      showError("Jadwal tidak valid. Silakan pilih tanggal dan waktu kembali.");
      return;
    }

    if (date.getTime() < Date.now()) {
      showError("Jadwal tidak boleh berada di masa lalu.");
      return;
    }

    const jumlah = Number(qty.value) || 1;
    const total = jumlah * getPricePerMatch();

    const jadwal = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short"
    }).format(date);

    const message = [
      "HALO ADMIN RIFHSK YANG PALING GANTENG!",
      "",
      "SAYA INGIN MELAKUKAN PEMESANAN:",
      "",
      "NICKNAME : " + nickname,
      "ID GAME : " + gameid,
      "LAYANAN : " + service.value,
      "JUMLAH : " + jumlah + " MATCH",
      "JADWAL : " + jadwal,
      "CATATAN : " + notes,
      "TOTAL PEMBAYARAN : " + formatRupiah(total),
      "",
      "MOHON KONFIRMASI PESANAN SAYA.",
      "TERIMA KASIH."
    ].join("\n");

    const url =
      "https://wa.me/" +
      WHATSAPP_ADMIN +
      "?text=" +
      encodeURIComponent(message);

    window.location.href = url;
  });

  function showError(message) {
    if (formError) {
      formError.textContent = message;
      formError.hidden = false;
    } else {
      alert(message);
    }
  }

  updateTotal();
});
