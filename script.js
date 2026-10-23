"use strict";

const ADMIN_WA = "6285725209623";
const STORAGE_KEY = "rifhsk_rank_bot_orders_v3";

const PACKAGES = {
"flexible": {
name: "FLEXIBLE",
price: 2500,
max: 5
},
"no-flexible": {
name: "NO FLEXIBLE",
price: 3500,
max: 5
}
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const orderForm = $("#orderForm");
const packageInput = $("#package");
const matchesInput = $("#matches");
const qrisPanel = $("#qrisPanel");
const historyList = $("#historyList");
const emptyHistory = $("#emptyHistory");
const toastElement = $("#toast");

let currentOrder = null;
let toastTimer = null;

function formatRupiah(value) {
return "Rp" + Number(value).toLocaleString("id-ID");
}

function escapeHTML(value) {
return String(value ?? "").replace(/[&<>"']/g, (character) => {
const entities = {
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
};

return entities[character];

});
}

function showToast(message) {
toastElement.textContent = message;
toastElement.classList.add("show");

clearTimeout(toastTimer);

toastTimer = setTimeout(() => {
toastElement.classList.remove("show");
}, 2600);
}

function getOrders() {
try {
const stored = localStorage.getItem(STORAGE_KEY);

if (!stored) {
  return [];
}

const orders = JSON.parse(stored);
return Array.isArray(orders) ? orders : [];

} catch (error) {
console.error("Gagal membaca riwayat:", error);
return [];
}
}

function saveOrders(orders) {
try {
localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
return true;
} catch (error) {
console.error("Gagal menyimpan riwayat:", error);
showToast("Penyimpanan gagal. Periksa ruang browser.");
return false;
}
}

function generateOrderCode() {
const date = new Date();
const datePart = [
date.getFullYear().toString().slice(-2),
String(date.getMonth() + 1).padStart(2, "0"),
String(date.getDate()).padStart(2, "0")
].join("");

const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();

return "RIF-${datePart}-${randomPart}";
}

function getSelectedPackage() {
return PACKAGES[packageInput.value] || PACKAGES.flexible;
}

function getMatchCount() {
const raw = Number.parseInt(matchesInput.value, 10);

if (!Number.isFinite(raw)) {
return 1;
}

return Math.max(1, Math.min(5, raw));
}

function updateSummary() {
const selectedPackage = getSelectedPackage();
const matchCount = getMatchCount();
const total = selectedPackage.price * matchCount;

$("#totalPrice").textContent = formatRupiah(total);
$("#summaryPackage").textContent = selectedPackage.name;
$("#summaryPrice").textContent = formatRupiah(selectedPackage.price);
$("#summaryMatches").textContent = "${matchCount} match";

return {
selectedPackage,
matchCount,
total
};
}

function updateDashboard() {
const orders = getOrders();

const totalMatches = orders.reduce((sum, order) => {
return sum + Number(order.matches || 0);
}, 0);

$("#statOrders").textContent = orders.length;
$("#statMatches").textContent = totalMatches;
}

function showPage(pageName) {
const target = document.getElementById(pageName);

if (!target || !target.classList.contains("page")) {
return;
}

$$(".page").forEach((page) => {
page.classList.toggle("active", page.id === pageName);
});

$$(".nav-btn").forEach((button) => {
button.classList.toggle(
"active",
button.dataset.page === pageName
);
});

$("#navigation").classList.remove("open");

if (pageName === "history") {
renderHistory();
}

if (pageName === "dashboard") {
updateDashboard();
}

window.scrollTo({
top: 0,
behavior: "smooth"
});
}

function normalizeWhatsApp(number) {
let digits = String(number).replace(/\D/g, "");

if (digits.startsWith("0")) {
digits = "62" + digits.slice(1);
} else if (digits.startsWith("8")) {
digits = "62" + digits;
}

return digits;
}

function buildWhatsAppMessage(order) {
const note = order.notes ? order.notes : "-";

return [
"PESANAN RANK VS BOT MAX 75",
"",
"Kode Pesanan: ${order.code}",
"ID Game: ${order.gameId}",
"Nickname: ${order.nickname}",
"WhatsApp Pemesan: ${order.customerWa}",
"Paket: ${order.packageName}",
"Harga per Match: ${formatRupiah(order.price)}",
"Jumlah Match: ${order.matches}",
"Total Pembayaran: ${formatRupiah(order.total)}",
"Catatan: ${note}",
"",
"Saya ingin konfirmasi pesanan dan pembayaran.",
"Bukti pembayaran akan saya kirimkan setelah melakukan pembayaran QRIS."
].join("\n");
}

function openWhatsApp(number, message) {
const phone = normalizeWhatsApp(number);

if (!phone) {
showToast("Nomor WhatsApp tidak valid.");
return;
}

const url =
"https://wa.me/" +
phone +
"?text=" +
encodeURIComponent(message);

window.open(url, "_blank", "noopener,noreferrer");
}

function createOrder(event) {
event.preventDefault();

if (!orderForm.reportValidity()) {
return;
}

const gameId = $("#gameId").value.trim();
const nickname = $("#nickname").value.trim();
const customerWa = $("#customerWa").value.trim();
const notes = $("#notes").value.trim();

const normalizedPhone = normalizeWhatsApp(customerWa);

if (!gameId || !nickname || !customerWa) {
showToast("Lengkapi semua kolom wajib.");
return;
}

if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
showToast("Periksa kembali nomor WhatsApp kamu.");
return;
}

const summary = updateSummary();
const order = {
code: generateOrderCode(),
gameId,
nickname,
customerWa,
packageId: packageInput.value,
packageName: summary.selectedPackage.name,
price: summary.selectedPackage.price,
matches: summary.matchCount,
total: summary.total,
notes,
status: "Menunggu Pembayaran",
createdAt: new Date().toISOString()
};

const orders = getOrders();

// Simpan pesanan baru ke riwayat lokal.
orders.unshift(order);

if (!saveOrders(orders)) {
return;
}

currentOrder = order;

$("#newOrderCode").textContent = order.code;
$("#paymentTotal").textContent = formatRupiah(order.total);

qrisPanel.classList.remove("hidden");

updateDashboard();
renderHistory();

showToast("Pesanan berhasil dibuat!");

setTimeout(() => {
qrisPanel.scrollIntoView({
behavior: "smooth",
block: "start"
});
}, 150);
}

async function copyText(text) {
try {
if (navigator.clipboard && window.isSecureContext) {
await navigator.clipboard.writeText(String(text));
} else {
const temporaryInput = document.createElement("textarea");

  temporaryInput.value = String(text);
  temporaryInput.style.position = "fixed";
  temporaryInput.style.opacity = "0";

  document.body.appendChild(temporaryInput);
  temporaryInput.select();

  const success = document.execCommand("copy");

  temporaryInput.remove();

  if (!success) {
    throw new Error("Penyalinan gagal");
  }
}

showToast("Berhasil disalin!");

} catch (error) {
console.error("Gagal menyalin:", error);
showToast("Tidak bisa menyalin. Silakan coba lagi.");
}
}

function renderHistory() {
const orders = getOrders();

historyList.innerHTML = "";

emptyHistory.classList.toggle("hidden", orders.length > 0);
historyList.classList.toggle("hidden", orders.length === 0);

orders.forEach((order) => {
const card = document.createElement("article");

card.className = "glass history-card";

const date = order.createdAt
  ? new Date(order.createdAt).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    })
  : "-";

card.innerHTML = `
  <div class="history-card-head">
    <div>
      <h3>${escapeHTML(order.nickname)}</h3>
      <div class="code">${escapeHTML(order.code)}</div>
    </div>
    <span class="order-status">${escapeHTML(order.status || "Menunggu Pembayaran")}</span>
  </div>

  <div class="history-meta">
    <div>
      <small>ID Game</small>
      <strong>${escapeHTML(order.gameId)}</strong>
    </div>
    <div>
      <small>Paket</small>
      <strong>${escapeHTML(order.packageName)}</strong>
    </div>
    <div>
      <small>Jumlah Match</small>
      <strong>${escapeHTML(order.matches)} match</strong>
    </div>
    <div>
      <small>Total</small>
      <strong>${formatRupiah(order.total)}</strong>
    </div>
    <div>
      <small>WhatsApp</small>
      <strong>${escapeHTML(order.customerWa)}</strong>
    </div>
    <div>
      <small>Tanggal</small>
      <strong>${escapeHTML(date)}</strong>
    </div>
  </div>

  ${
    order.notes
      ? `<p class="muted">Catatan: ${escapeHTML(order.notes)}</p>`
      : ""
  }

  <div class="history-actions">
    <button class="outline-btn" data-action="copy" data-code="${escapeHTML(order.code)}">Salin Kode</button>
    <button class="primary-btn" data-action="send" data-code="${escapeHTML(order.code)}">WhatsApp Admin ↗</button>
    <button class="danger-btn" data-action="delete" data-code="${escapeHTML(order.code)}">Hapus</button>
  </div>
`;

historyList.appendChild(card);

});

updateDashboard();
}

function handleHistoryAction(event) {
const button = event.target.closest("button[data-action]");

if (!button) {
return;
}

const action = button.dataset.action;
const code = button.dataset.code;
const orders = getOrders();

const order = orders.find((item) => item.code === code);

if (!order) {
showToast("Pesanan tidak ditemukan.");
renderHistory();
return;
}

if (action === "copy") {
copyText(order.code);
return;
}

if (action === "send") {
openWhatsApp(ADMIN_WA, buildWhatsAppMessage(order));
return;
}

if (action === "delete") {
const confirmed = window.confirm(
"Hapus pesanan ${order.code} dari riwayat perangkat ini?"
);

if (!confirmed) {
  return;
}

const updatedOrders = orders.filter((item) => item.code !== code);

if (saveOrders(updatedOrders)) {
  renderHistory();
  showToast("Pesanan dihapus dari riwayat.");
}

}
}

function clearHistory() {
const orders = getOrders();

if (orders.length === 0) {
showToast("Riwayat masih kosong.");
return;
}

const confirmed = window.confirm(
"Hapus SEMUA riwayat pesanan dari perangkat ini? Tindakan ini tidak bisa dibatalkan."
);

if (!confirmed) {
return;
}

if (saveOrders([])) {
currentOrder = null;
renderHistory();
updateDashboard();
showToast("Semua riwayat berhasil dihapus.");
}
}

// Navigasi halaman.
document.addEventListener("click", (event) => {
const pageButton = event.target.closest("[data-page]");

if (pageButton) {
event.preventDefault();
showPage(pageButton.dataset.page);
return;
}

const packageButton = event.target.closest("[data-package]");

if (packageButton) {
const packageId = packageButton.dataset.package;

if (PACKAGES[packageId]) {
  packageInput.value = packageId;
  updateSummary();
  showPage("order");
}

}
});

// Menu navigasi mobile.
$("#menuToggle").addEventListener("click", () => {
$("#navigation").classList.toggle("open");
});

// Perhitungan otomatis.
packageInput.addEventListener("change", updateSummary);

matchesInput.addEventListener("input", () => {
const value = Number.parseInt(matchesInput.value, 10);

if (Number.isFinite(value) && value > 5) {
matchesInput.value = "5";
}

if (Number.isFinite(value) && value < 1) {
matchesInput.value = "1";
}

updateSummary();
});

matchesInput.addEventListener("change", () => {
matchesInput.value = String(getMatchCount());
updateSummary();
});

// Pembuatan pesanan.
orderForm.addEventListener("submit", createOrder);

// Salin total pembayaran.
$("#copyTotalBtn").addEventListener("click", () => {
if (!currentOrder) {
showToast("Buat pesanan terlebih dahulu.");
return;
}

copyText(String(currentOrder.total));
});

// Kirim detail pesanan ke WhatsApp admin.
$("#sendOrderBtn").addEventListener("click", () => {
if (!currentOrder) {
showToast("Buat pesanan terlebih dahulu.");
return;
}

openWhatsApp(ADMIN_WA, buildWhatsAppMessage(currentOrder));
});

// Riwayat pesanan.
historyList.addEventListener("click", handleHistoryAction);
$("#clearHistoryBtn").addEventListener("click", clearHistory);

// Beri peringatan jika gambar QRIS tidak ditemukan.
$("#qrisImage").addEventListener("error", () => {
showToast("Gambar qris.jpg tidak ditemukan. Periksa nama file.");
});

// Inisialisasi awal.
updateSummary();
updateDashboard();
renderHistory();
