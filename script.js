(() => {
  "use strict";

  const ADMIN_WHATSAPP = "6285725209623";

  const packages = {
    flexible: {
      name: "FLEXIBLE",
      price: 2500,
      max: 5
    },
    "no-flexible": {
      name: "NO FLEXIBLE",
      price: 3500,
      max: 10
    }
  };

  let selectedPackage = "flexible";

  const $ = (id) => document.getElementById(id);

  const rupiah = (value) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(value);

  const matchInput = $("matchCount");

  function getMatchCount() {
    const max = packages[selectedPackage].max;
    const value = Number.parseInt(matchInput.value, 10);

    if (!Number.isFinite(value)) return 1;

    return Math.max(1, Math.min(max, value));
  }

  function updateTotal() {
    const pkg = packages[selectedPackage];
    const count = getMatchCount();
    const total = count * pkg.price;

    matchInput.value = count;
    matchInput.max = pkg.max;

    $("limitHint").textContent =
      `Maksimal ${pkg.max} match`;

    $("calculation").textContent =
      `${count} match × ${rupiah(pkg.price)}`;

    $("total").textContent = rupiah(total);
  }

  function selectPackage(name) {
    if (!packages[name]) return;

    selectedPackage = name;

    document.querySelectorAll(".package").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.package === name
      );
    });

    updateTotal();
  }

  document.querySelectorAll(".package").forEach((button) => {
    button.addEventListener("click", () => {
      selectPackage(button.dataset.package);
    });
  });

  $("minus").addEventListener("click", () => {
    matchInput.value = getMatchCount() - 1;
    updateTotal();
  });

  $("plus").addEventListener("click", () => {
    matchInput.value = getMatchCount() + 1;
    updateTotal();
  });

  matchInput.addEventListener("input", updateTotal);
  matchInput.addEventListener("change", updateTotal);

  function updateClock() {
    const now = new Date();

    $("clock").textContent =
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(now) + " WIB";

    $("date").textContent =
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(now);

    $("year").textContent =
      new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Jakarta",
        year: "numeric"
      }).format(now);
  }

  $("orderForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const playerName = $("playerName").value.trim();

    if (!playerName) {
      $("playerName").focus();
      return;
    }

    updateTotal();

    const pkg = packages[selectedPackage];
    const count = getMatchCount();
    const total = count * pkg.price;

    const playerId = $("playerId").value.trim() || "-";
    const notes = $("notes").value.trim() || "-";

    const message = [
      "*ORDER RIFHSK777*",
      "",
      `Nama / Username: ${playerName}`,
      `ID Game: ${playerId}`,
      `Paket: ${pkg.name}`,
      `Jumlah Match: ${count}`,
      `Harga per Match: ${rupiah(pkg.price)}`,
      `Total Pembayaran: ${rupiah(total)}`,
      `Catatan: ${notes}`,
      "",
      "Saya akan mengirim bukti pembayaran setelah melakukan pembayaran."
    ].join("\n");

    const whatsappURL =
      `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;

    window.open(
      whatsappURL,
      "_blank",
      "noopener,noreferrer"
    );
  });

  updateClock();
  window.setInterval(updateClock, 1000);
  updateTotal();
})();
