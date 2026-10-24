(() => {
  "use strict";

  // GANTI dengan nomor WhatsApp admin, format 62xxxxxxxxxx.
  const WA_ADMIN = "6281234567890";
  const STORAGE_KEY = "rifhsk_orders_v1";

  const PRICES = {
    "Basic": 10000,
    "Pro": 25000,
    "Max 75": 50000
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function rupiah(value) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function toast(message) {
    const box = $("#toast");
    if (!box) return;

    box.textContent = message;
    box.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      box.classList.remove("show");
    }, 2600);
  }

  function goToPage(name) {
    const target = $("#page-" + name);

    if (!target) {
      console.error("Halaman tidak ditemukan:", name);
      return;
    }

    $$(".page").forEach(page => {
      page.classList.toggle("active", page === target);
    });

    $$(".nav-link").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === name
      );
    });

    $("#mainNav")?.classList.remove("open");
    $("#menuToggle")?.setAttribute("aria-expanded", "false");

    if (location.hash !== "#" + name) {
      history.replaceState(null, "", "#" + name);
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function getSelectedPackage() {
    const name = $("#packageSelect")?.value || "";

    return {
      name,
      price: PRICES[name] || 0
    };
  }

  function updateSummary() {
    const selected = getSelectedPackage();

    $("#summaryPackage").textContent =
      selected.name || "Belum dipilih";

    $("#summaryPrice").textContent =
      rupiah(selected.price);
  }

  function loadOrders() {
    try {
      const orders = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      return Array.isArray(orders) ? orders : [];
    } catch (error) {
      console.error("Gagal membaca riwayat:", error);
      return [];
    }
  }

  function renderHistory() {
    const host = $("#historyList");
    if (!host) return;

    const orders = loadOrders();
    host.replaceChildren();

    if (orders.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = `
        <span>▤</span>
        <h3>Belum ada riwayat</h3>
        <p>Pesanan yang dibuat akan tampil di perangkat ini.</p>
      `;

      host.appendChild(empty);
      return;
    }

    orders.slice().reverse().forEach(order => {
      const row = document.createElement("div");
      row.className = "history-item";

      const details = document.createElement("div");

      const title = document.createElement("strong");
      title.textContent = `${order.package} — ${order.name}`;

      const subtitle = document.createElement("small");
      subtitle.textContent =
        `${order.date || ""} · ${order.id || ""}`;

      const amount = document.createElement("span");
      amount.className = "history-price";
      amount.textContent = rupiah(order.price);

      details.append(title, subtitle);
      row.append(details, amount);
      host.appendChild(row);
    });
  }

  // Navigasi semua halaman dan tombol paket.
  document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");

    if (pageButton) {
      event.preventDefault();
      goToPage(pageButton.dataset.page);
      return;
    }

    const packageButton = event.target.closest("[data-package]");

    if (packageButton) {
      const name = packageButton.dataset.package;
      const select = $("#packageSelect");

      if (select && PRICES[name]) {
        select.value = name;
      }

      updateSummary();
      goToPage("order");
      toast(`Paket ${name} dipilih.`);
    }
  });

  // Menu navigasi HP.
  $("#menuToggle")?.addEventListener("click", () => {
    const nav = $("#mainNav");
    const opened = nav.classList.toggle("open");

    $("#menuToggle").setAttribute(
      "aria-expanded",
      String(opened)
    );
  });

  // Update total saat paket diubah.
  $("#packageSelect")?.addEventListener(
    "change",
    updateSummary
  );

  // Membuat pesanan dan membuka WhatsApp.
  $("#orderForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.reportValidity()) {
      return;
    }

    const name = $("#customerName").value.trim();
    const customerWa = $("#customerWa").value.trim();
    const id = $("#gameId").value.trim();
    const note = $("#orderNote").value.trim();
    const selected = getSelectedPackage();

    if (!selected.name || !selected.price) {
      toast("Pilih paket terlebih dahulu.");
      $("#packageSelect").focus();
      return;
    }

    const order = {
      name,
      customerWa,
      id,
      note,
      package: selected.name,
      price: selected.price,
      date: new Date().toLocaleString("id-ID")
    };

    const orders = loadOrders();
    orders.push(order);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(orders)
      );
    } catch (error) {
      console.error("Riwayat tidak dapat disimpan:", error);
      toast("Riwayat tidak bisa disimpan di browser.");
    }

    renderHistory();

    const message = [
      "Halo Admin RIFHSK, saya ingin membuat pesanan.",
      "",
      `Nama: ${name}`,
      `WhatsApp pelanggan: ${customerWa}`,
      `ID/detail: ${id}`,
      `Paket: ${selected.name}`,
      `Total: ${rupiah(selected.price)}`,
      `Catatan: ${note || "-"}`,
      "",
      "Mohon konfirmasi pesanan saya. Terima kasih."
    ].join("\n");

    const number = WA_ADMIN.replace(/\D/g, "");

    if (!number || number === "6281234567890") {
      toast("Ganti nomor admin di script.js sebelum digunakan.");
    }

    const url =
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  });

  // Menghapus riwayat pesanan lokal.
  $("#clearHistory")?.addEventListener("click", () => {
    if (loadOrders().length === 0) {
      toast("Riwayat masih kosong.");
      return;
    }

    if (window.confirm("Hapus semua riwayat di perangkat ini?")) {
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
      toast("Riwayat berhasil dihapus.");
    }
  });

  // Inisialisasi website.
  $("#year").textContent = new Date().getFullYear();

  updateSummary();
  renderHistory();

  const initialPage = location.hash.slice(1);

  goToPage(
    ["dashboard", "order", "payment", "history"].includes(initialPage)
      ? initialPage
      : "dashboard"
  );
})();
