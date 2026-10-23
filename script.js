document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("orderForm");
  const service = document.getElementById("service");
  const qty = document.getElementById("qty");
  const totalPrice = document.getElementById("totalPrice");
  const totalDescription = document.getElementById("totalDescription");

  // Nomor WhatsApp admin yang sudah diperbaiki
  const WHATSAPP_ADMIN = "6285725209623";

  // Pastikan elemen HTML tersedia
  if (!form || !service || !qty || !totalPrice || !totalDescription) {
    console.error("Elemen form atau total pembayaran tidak ditemukan.");
    return;
  }

  // Harga setiap match
  function getPricePerMatch() {
    return service.value === "FLEXIBLE" ? 2500 : 3500;
  }

  // Format rupiah
  function formatRupiah(value) {
    return "Rp" + value.toLocaleString("id-ID");
  }

  // Perbarui total otomatis
  function updateTotal() {
    const jumlah = Number(qty.value) || 1;
    const harga = getPricePerMatch();
    const total = jumlah * harga;

    totalPrice.textContent = formatRupiah(total);
    totalDescription.textContent =
      service.value + " · " + jumlah + " MATCH";
  }

  // Perbarui ketika layanan atau jumlah berubah
  service.addEventListener("change", updateTotal);
  qty.addEventListener("change", updateTotal);
  qty.addEventListener("input", updateTotal);

  // Kirim pesanan ke WhatsApp
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const nickname = document.getElementById("nickname").value.trim();
    const gameid = document.getElementById("gameid").value.trim();
    const scheduleValue = document.getElementById("schedule").value;
    const notes =
      document.getElementById("notes").value.trim() || "-";

    if (!nickname || !gameid || !scheduleValue) {
      alert("Lengkapi nickname, Game ID, dan jadwal terlebih dahulu!");
      return;
    }

    const tanggal = new Date(scheduleValue);

    const jadwal = Number.isNaN(tanggal.getTime())
      ? scheduleValue
      : new Intl.DateTimeFormat("id-ID", {
          dateStyle: "long",
          timeStyle: "short"
        }).format(tanggal);

    const jumlah = Number(qty.value) || 1;
    const total = jumlah * getPricePerMatch();

    const message = [
      "HALO ADMIN RIFHSK YANG PALING GANTENG!",
      "",
      "SAYA INGIN MELAKUKAN PEMESANAN :",
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

    window.open(url, "_blank");
  });

  // Tampilkan total saat halaman pertama kali dibuka
  updateTotal();
});
