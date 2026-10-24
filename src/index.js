const CORS = {
  "Access-Control-Allow-Origin": "https://rifhskboy.github.io",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8",
};

const ORDER_STATUSES = [
  "menunggu_konfirmasi", "diproses", "selesai", "dibatalkan"
];

const PAYMENT_STATUSES = [
  "belum_dibayar", "menunggu_verifikasi", "dibayar", "dikembalikan"
];

const PACKAGES = {
  flex: {
    name: "Flexible Match",
    unit: 3000,
    totals: { 1: 3000, 2: 6000, 3: 9000, 4: 12000, 5: 13000 },
  },
  noflex: {
    name: "No Flexible",
    unit: 5000,
    totals: { 1: 5000, 2: 10000, 3: 15000, 4: 20000, 5: 23000 },
  },
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS,
  });
}

async function initialize(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      order_code TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      game_id TEXT NOT NULL,
      package_type TEXT NOT NULL,
      match_count INTEGER NOT NULL,
      schedule TEXT NOT NULL,
      notes TEXT DEFAULT '',
      unit_price INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL,
      order_status TEXT NOT NULL DEFAULT 'menunggu_konfirmasi',
      payment_status TEXT NOT NULL DEFAULT 'belum_dibayar',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const result = await db.prepare("PRAGMA table_info(orders)").all();
  const columns = (result.results || []).map((c) => c.name);

  const required = [
    "order_code", "customer_name", "game_id", "package_type",
    "match_count", "schedule", "unit_price", "discount",
    "total_price", "order_status", "payment_status", "created_at"
  ];

  const missing = required.filter((c) => !columns.includes(c));

  if (missing.length) {
    throw new Error(
      "Skema tabel D1 lama tidak cocok. Kolom yang tidak ada: " +
      missing.join(", ") +
      ". Jangan hapus database; periksa struktur tabel orders."
    );
  }
}

async function authorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");

  if (!token || !env.ADMIN_SESSION_SECRET) return false;

  const parts = token.split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
  if (Number(parts[0]) < Date.now()) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.ADMIN_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(parts[0])
  );

  const expected = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  return token === `${parts[0]}.${expected}`;
}

async function makeToken(env) {
  const expires = String(Date.now() + 24 * 60 * 60 * 1000);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.ADMIN_SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(expires)
  );

  const encoded = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

  return `${expires}.${encoded}`;
}

async function handler(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!env.DB) {
    return response({ error: "Binding D1 bernama DB belum diatur." }, 500);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/api/health" && request.method === "GET") {
    return response({ success: true, service: "RANK VS BOT API" });
  }

  if (path === "/api/login" && request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return response({ error: "JSON login tidak valid." }, 400);
    }

    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
      return response({
        error: "Atur ADMIN_PASSWORD dan ADMIN_SESSION_SECRET di Cloudflare Worker Settings → Variables and Secrets."
      }, 500);
    }

    if (body.password !== env.ADMIN_PASSWORD) {
      return response({ error: "Password admin salah." }, 401);
    }

    return response({
      success: true,
      token: await makeToken(env),
    });
  }

  if (path.startsWith("/api/") && path !== "/api/orders") {
    if (!(await authorized(request, env))) {
      return response({ error: "Login admin diperlukan." }, 401);
    }
  }

  if (path === "/api/orders" && request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return response({ error: "Format JSON pesanan tidak valid." }, 400);
    }

    const customerName = String(body.customerName || "").trim();
    const gameId = String(body.gameId || "").trim();
    const packageType = String(body.packageType || "");
    const matchCount = Number(body.matchCount);
    const schedule = String(body.schedule || "").trim();
    const notes = String(body.notes || "").trim();

    if (!customerName || !gameId || !schedule) {
      return response({
        error: "Nama pelanggan, Game ID, dan jadwal wajib diisi."
      }, 400);
    }

    if (!PACKAGES[packageType]) {
      return response({ error: "Paket tidak valid." }, 400);
    }

    if (!Number.isInteger(matchCount) || matchCount < 1 || matchCount > 5) {
      return response({ error: "Jumlah match harus 1 sampai 5." }, 400);
    }

    const pkg = PACKAGES[packageType];
    const totalPrice = pkg.totals[matchCount];
    const discount = pkg.unit * matchCount - totalPrice;
    const orderCode = "RVB-" + Date.now().toString(36).toUpperCase();

    try {
      await initialize(env.DB);

      await env.DB.prepare(`
        INSERT INTO orders (
          order_code, customer_name, game_id, package_type,
          match_count, schedule, notes, unit_price, discount,
          total_price, order_status, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderCode, customerName, gameId, packageType,
        matchCount, schedule, notes, pkg.unit, discount,
        totalPrice, "menunggu_konfirmasi", "belum_dibayar"
      ).run();

      return response({
        success: true,
        order: {
          orderCode,
          customerName,
          gameId,
          packageType,
          packageName: pkg.name,
          matchCount,
          schedule,
          notes,
          unitPrice: pkg.unit,
          discount,
          totalPrice,
        }
      }, 201);
    } catch (error) {
      console.error("CREATE ORDER ERROR:", error);
      return response({
        error: "Gagal menyimpan pesanan ke D1.",
        detail: String(error.message || error)
      }, 500);
    }
  }

  if (path === "/api/orders" && request.method === "GET") {
    if (!(await authorized(request, env))) {
      return response({ error: "Login admin diperlukan." }, 401);
    }

    try {
      await initialize(env.DB);
      const result = await env.DB.prepare(
        "SELECT * FROM orders ORDER BY created_at DESC"
      ).all();

      return response({ success: true, orders: result.results || [] });
    } catch (error) {
      return response({
        error: "Gagal membaca pesanan.",
        detail: String(error.message || error)
      }, 500);
    }
  }

  if (path === "/api/stats" && request.method === "GET") {
    if (!(await authorized(request, env))) {
      return response({ error: "Login admin diperlukan." }, 401);
    }

    try {
      await initialize(env.DB);

      const result = await env.DB.prepare(`
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(match_count), 0) AS total_matches,
          SUM(CASE WHEN order_status = 'menunggu_konfirmasi' THEN 1 ELSE 0 END) AS waiting_orders,
          SUM(CASE WHEN order_status = 'diproses' THEN 1 ELSE 0 END) AS processing_orders,
          SUM(CASE WHEN order_status = 'selesai' THEN 1 ELSE 0 END) AS completed_orders,
          SUM(CASE WHEN order_status = 'dibatalkan' THEN 1 ELSE 0 END) AS cancelled_orders,
          COALESCE(SUM(CASE WHEN payment_status = 'dibayar' THEN total_price ELSE 0 END), 0) AS revenue_paid,
          COALESCE(SUM(CASE WHEN payment_status != 'dibayar' AND order_status != 'dibatalkan' THEN total_price ELSE 0 END), 0) AS revenue_pending
        FROM orders
      `).first();

      return response({ success: true, stats: result || {} });
    } catch (error) {
      return response({
        error: "Gagal membaca statistik.",
        detail: String(error.message || error)
      }, 500);
    }
  }

  if (path === "/api/logout" && request.method === "POST") {
    return response({ success: true });
  }

  if (path === "/api/orders" && request.method === "PATCH") {
    return response({ error: "Endpoint tidak valid." }, 404);
  }

  if (path === "/api/orders" && request.method === "POST") {
    return response({ error: "Endpoint tidak valid." }, 404);
  }

  if (path === "/api/orders" && request.method === "PATCH") {
    return response({ error: "Gunakan endpoint pembaruan status yang benar." }, 404);
  }

  const updatePath = path.match(/^\/api\/orders\/([^/]+)$/);

  if (updatePath && request.method === "PATCH") {
    if (!(await authorized(request, env))) {
      return response({ error: "Login admin diperlukan." }, 401);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return response({ error: "JSON pembaruan tidak valid." }, 400);
    }

    const orderStatus = String(body.orderStatus || "");
    const paymentStatus = String(body.paymentStatus || "");
    const orderCode = decodeURIComponent(updatePath[1]);

    if (!ORDER_STATUSES.includes(orderStatus) ||
        !PAYMENT_STATUSES.includes(paymentStatus)) {
      return response({ error: "Status pesanan atau pembayaran tidak valid." }, 400);
    }

    try {
      await initialize(env.DB);

      const result = await env.DB.prepare(`
        UPDATE orders
        SET order_status = ?, payment_status = ?
        WHERE order_code = ?
      `).bind(orderStatus, paymentStatus, orderCode).run();

      if (!result.meta || result.meta.changes === 0) {
        return response({ error: "Pesanan tidak ditemukan." }, 404);
      }

      return response({ success: true });
    } catch (error) {
      return response({
        error: "Gagal memperbarui pesanan.",
        detail: String(error.message || error)
      }, 500);
    }
  }

  return response({ error: "Endpoint tidak ditemukan.", path, method: request.method }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handler(request, env);
    } catch (error) {
      console.error("WORKER ERROR:", error);
      return response({
        error: "Kesalahan Worker.",
        detail: String(error.message || error)
      }, 500);
    }
  }
};
