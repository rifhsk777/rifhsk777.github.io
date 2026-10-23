"use strict";

const form = document.getElementById("orderForm");
const mode = document.getElementById("mode");
const quantity = document.getElementById("quantity");
const totalPrice = document.getElementById("totalPrice");
const priceInfo = document.getElementById("priceInfo");
const scheduleInput = document.getElementById("schedule");

const ADMIN_WHATSAPP = "6285725209623";

function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

function getOrderPrice() {
  const selectedMode = mode.value;
  const qty = Number(quantity.value);

  if (selectedMode === "flex") {
    return qty === 5 ? 13000 : qty * 3000;
  }

  if (selectedMode === "noflex") {
    return qty === 5 ? 23000 : qty * 5000;
  }

  return 0;
}

function updateTotal() {
  const qty = Number(quantity.value);
  const selectedMode = mode.value;
  const total = getOrderPrice();

  totalPrice.textContent = formatRupiah(total);

  const serviceName =
    selectedMode === "flex" ? "Flex" : "No Flex";

  priceInfo.textContent =
    qty === 5
      ? `${serviceName} · Paket 5 match`
      : `${serviceName} · ${qty} match`;

  return total;
}

function setMinimumSchedule() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  scheduleInput.min = now.toISOString().slice(0, 16);
}

mode.addEventListener("change", updateTotal);
quantity.addEventListener("change", updateTotal);

document.getElementById("year").textContent =
  new Date().getFullYear();

setMinimumSchedule();
updateTotal();

form.addEventListener("submit", function (event) {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  const nickname =
    document.getElementById("nickname").value.trim();

  const gameid =
    document.getElementById("gameid").value.trim();

  const notes =
    document.getElementById("notes").value.trim() || "-";

  const selectedMode = mode.value;
  const qty = Number(quantity.value);
  const total = getOrderPrice();

  if (!nickname || !gameid || !scheduleInput.value) {
    alert("Mohon lengkapi semua data wajib.");
    return;
  }

  const scheduleDate = new Date(scheduleInput.value);

  if (Number.isNaN(scheduleDate.getTime())) {
    alert("Jadwal tidak valid. Silakan pilih ulang.");
    return;
  }

  if (scheduleDate.getTime() < Date.now()) {
    alert("Jadwal tidak boleh berada di waktu yang sudah lewat.");
    return;
  }

  const schedule = scheduleDate.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short"
  });

  const serviceName =
    selectedMode === "flex" ? "Flex" : "No Flex";

  const message = [
    "Halo Admin RANK VS BOT BY RIFHSK!",
    "Saya ingin melakukan pemesanan:",
    "",
    `Nama/Nickname: ${nickname}`,
    `Layanan: ${serviceName}`,
    `Jumlah: ${qty} match`,
    `Game ID: ${gameid}`,
    `Jadwal: ${schedule}`,
    `Catatan: ${notes}`,
    `Total pembayaran: ${formatRupiah(total)}`,
    "",
    "Mohon konfirmasi pesanan saya.",
    "Terima kasih."
  ].join("\n");

  const whatsappURL =
    "https://wa.me/" +
    ADMIN_WHATSAPP +
    "?text=" +
    encodeURIComponent(message);

  const newWindow = window.open(
    whatsappURL,
    "_blank",
    "noopener,noreferrer"
  );

  if (!newWindow) {
    window.location.href = whatsappURL;
  }
});
