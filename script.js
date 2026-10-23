const ADMIN_WA = "6285725209623";

let selectedService = "FLEXIBLE";
let selectedPrice = 2500;

const priceCards = document.querySelectorAll(".price-card");
const quantityInput = document.getElementById("quantity");
const totalElement = document.getElementById("total");

function rupiah(number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(number);
}

function updateTotal() {
  const quantity = Number(quantityInput.value);
  totalElement.textContent = rupiah(selectedPrice * quantity);
}

priceCards.forEach((card) => {
  card.addEventListener("click", () => {
    priceCards.forEach((item) => item.classList.remove("active"));

    card.classList.add("active");
    selectedService = card.dataset.service;
    selectedPrice = Number(card.dataset.price);

    updateTotal();
  });
});

quantityInput.addEventListener("change", updateTotal);

function updateClock() {
  const now = new Date();

  document.getElementById("clock").textContent =
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now) + " WIB";

  document.getElementById("date").textContent =
    new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(now);
}

setInterval(updateClock, 1000);
updateClock();

document.getElementById("year").textContent =
  new Date().getFullYear();

document.getElementById("orderForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const nickname = document.getElementById("nickname").value.trim();
  const gameId = document.getElementById("gameId").value.trim();
  const quantity = Number(quantityInput.value);
  const notes = document.getElementById("notes").value.trim();
  const total = selectedPrice * quantity;

  if (!nickname || !gameId) {
    alert("Nickname dan ID Game wajib diisi.");
    return;
  }

  const message = [
    "HALO ADMIN RIFHSK YANG PALING GANTENG!",
    "",
    "SAYA INGIN MELAKUKAN PEMESANAN:",
    "",
    "NICKNAME: " + nickname,
    "ID GAME: " + gameId,
    "LAYANAN: " + selectedService,
    "JUMLAH MATCH: " + quantity,
    "CATATAN: " + (notes || "-"),
    "TOTAL PEMBAYARAN: " + rupiah(total),
    "",
    "MOHON KONFIRMASI PESANAN SAYA. TERIMA KASIH."
  ].join("\n");

  const whatsappURL =
    "https://wa.me/" + ADMIN_WA + "?text=" +
    encodeURIComponent(message);

  window.open(whatsappURL, "_blank");
});

updateTotal();
