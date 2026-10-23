"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("orderForm");
  const qty = document.getElementById("qty");
  const totalPrice = document.getElementById("totalPrice");
  const totalDescription = document.getElementById("totalDescription");
  const selectedService = document.getElementById("selectedService");
  const formError = document.getElementById("formError");

  // Nomor WhatsApp admin
  const WHATSAPP_ADMIN = "6285725209623";

  // Layanan default
  let currentService = "FLEXIBLE";

  // Tahun footer
  document.getElementById("year").textContent =
    new Date().getFullYear();

  // JAM DIGITAL LANGSUNG
  function updateClock() {
    const now = new Date();

    document.getElementById("liveClock").textContent =
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(now);

    document.getElementById("liveDate").textContent =
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(now);
  }

  updateClock();
  setInterval(updateClock, 1000);

  // QRIS
  const qrisImage = document.getElementById("qrisImage");
  const qrisPlaceholder = document.getElementById("qrisPlaceholder");
  const downloadQris = document.getElementById("downloadQris");

  function showQrisPlaceholder() {
    qrisImage.hidden = true;
    qrisPlaceholder.hidden = false;
    downloadQris.hidden = true;
  }

  qrisImage.addEventListener("error", showQrisPlaceholder);

  if (qrisImage.complete && qrisImage.naturalWidth === 0) {
    showQrisPlaceholder();
  }

  // Harga per match
  function getPricePerMatch() {
    return currentService === "FLEXIBLE" ? 2500 : 3500;
  }

  function formatRupiah(value) {
    return "Rp" + Number(value).toLocaleString("id-ID");
  }

  // Perbarui total
  function updateTotal() {
    const jumlah = Number(qty.value) || 1;
    const total = jumlah * getPricePerMatch();

    totalPrice.textContent = formatRupiah(total);
    totalDescription.textContent =
      currentService + " · " + jumlah + " MATCH";

    selectedService.textContent = currentService;

    document.querySelectorAll(".price-card").forEach(function (card) {
      const button = card.querySelector(".choose");
      card.classList.toggle(
        "selected",
        button.dataset.service === currentService
      );
    });
  }

  // Pilih layanan melalui kartu harga
  document.querySelectorAll(".choose").forEach(function (button) {
    button.addEventListener("click", function () {
      currentService = button.dataset.service;
      updateTotal();

      document.getElementById("order").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  qty.addEventListener("change", updateTotal);
  qty.addEventListener("input", updateTotal);

  // Formulir WhatsApp
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    formError.hidden = true;
    formError.textContent = "";

    const nickname =
      document.getElementById("nickname").value.trim();

    const gameid =
      document.getElementById("gameid").value.trim();

    const notes =
      document.getElementById("notes").value.trim() || "-";

    if (!nickname || !gameid) {
      showError("Nickname dan ID Game wajib diisi.");
      return;
    }

    const jumlah = Number(qty.value) || 1;
    const total = jumlah * getPricePerMatch();

    const message = [
      "HALO ADMIN RIFHSK YANG PALING GANTENG!",
      "",
      "SAYA INGIN MELAKUKAN PEMESANAN:",
      "",
      "NICKNAME : " + nickname,
      "ID GAME : " + gameid,
      "LAYANAN : " + currentService,
      "JUMLAH : " + jumlah + " MATCH",
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
    formError.textContent = message;
    formError.hidden = false;
  }

  updateTotal();
});
