/*

* RANK VS BOT BY RIFHSK
* Periksa nomor admin sebelum website dipublikasikan.
  */
  const WHATSAPP_ADMIN = "628572092623";

const form = document.getElementById("orderForm");
const service = document.getElementById("service");
const qty = document.getElementById("qty");
const totalPrice = document.getElementById("totalPrice");
const totalDescription = document.getElementById("totalDescription");

function getPricePerMatch() {
return service.value === "FLEXIBLE" ? 2500 : 3500;
}

function formatRupiah(value) {
return new Intl.NumberFormat("id-ID", {
style: "currency",
currency: "IDR",
maximumFractionDigits: 0
}).format(value);
}

function updateTotal() {
const quantity = Number(qty.value);
const total = getPricePerMatch() * quantity;

totalPrice.textContent = formatRupiah(total);
totalDescription.textContent =
"${service.value} · ${quantity} MATCH";
}

service.addEventListener("change", updateTotal);
qty.addEventListener("change", updateTotal);

form.addEventListener("submit", function(event) {
event.preventDefault();

const nickname = document.getElementById("nickname").value.trim();
const gameid = document.getElementById("gameid").value.trim();
const scheduleValue = document.getElementById("schedule").value;
const notes = document.getElementById("notes").value.trim() || "-";

const date = new Date(scheduleValue);
const schedule = Number.isNaN(date.getTime())
? scheduleValue
: new Intl.DateTimeFormat("id-ID", {
dateStyle: "long",
timeStyle: "short"
}).format(date);

const quantity = Number(qty.value);
const total = getPricePerMatch() * quantity;

const message = [
"HALO ADMIN RIFHSK YANG PALING GANTENG!",
"",
"SAYA INGIN MELAKUKAN PEMESANAN :",
"",
"NICKNAME : ${nickname}",
"ID GAME : ${gameid}",
"LAYANAN : ${service.value}",
"JUMLAH : ${quantity} MATCH",
"JADWAL : ${schedule}",
"CATATAN : ${notes}",
"TOTAL PEMBAYARAN : ${formatRupiah(total)}",
"",
"MOHON KONFIRMASI PESANAN SAYA.",
"TERIMA KASIH."
].join("\n");

const whatsappURL =
"https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(message)}";

window.open(whatsappURL, "_blank", "noopener,noreferrer");
});

updateTotal();
