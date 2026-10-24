const ALLOWED_STATUSES = [
  "MENUNGGU",
  "SUDAH BAYAR",
  "DIPROSES",
  "SELESAI",
  "DIBATALKAN",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function normalizeStatus(status) {
  const value = String(status || "MENUNGGU")
    .trim()
    .toUpperCase();

  const aliases = {
    "MENUNGGU PEMBAYARAN": "MENUNGGU",
    "SUDAH DIBAYAR": "SUDAH BAYAR",
    "PAID": "SUDAH BAYAR",
    "PROCESSING": "DIPROSES",
    "COMPLETED": "SELESAI",
    "CANCELLED": "DIBATALKAN",
    "CANCELED": "DIBATALKAN",
  };

  const normalized = aliases[value] || value;

  if (!ALLOWED_STATUSES.includes(normalized)) {
    throw new Error("Status pesanan tidak valid.");
  }

  return normalized;
}

function normalizeOrder(row) {
  return {
    ...row,
    order_id: row.order_id ?? row.id ?? "",
    id: row.id ?? row.order_id ?? "",
    game_id: row.game_id ?? row.gameId ?? "",
    status: normalizeStatus(row.status),
  };
}

async function getColumns(db) {
  const result = await db.prepare("PRAGMA table_info(orders)").all();
  return (result.results || []).map((column) => column.name);
}

async function ensureTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      game_id TEXT NOT NULL,
      service TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      schedule TEXT,
      notes TEXT,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'MENUNGGU',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const columns = await getColumns(db);

  const required = [
    "nickname",
    "service",
    "quantity",
    "total",
  ];

  const missing = required.filter((name) => !columns.includes(name));

  if (missing.length) {
    throw new Error(
      "Struktur tabel orders tidak cocok. Kolom yang belum tersedia: " +
      missing.join(", ") +
      ". Periksa skema tabel D1."
    );
  }

  return columns;
}

function getSecret(env) {
  return env.ADMIN_SESSION_SECRET || "rahasia-rifhsk-super-aman";
}

async function signToken(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  const bytes = new Uint8Array(signature);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createToken(env) {
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  const payload = String(expires);
  const signature = await signToken(payload, getSecret(env));

  return `${payload}.${signature}`;
}

async function verifyToken(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");

  if (parts.length !== 2) return false;

  const [payload, signature] = parts;

  if (!/^\d+$/.test(payload)) return false;
  if (Number(payload) < Date.now()) return false;

  const expected = await signToken(payload, getSecret(env));

  return signature === expected;
}

async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (!env.DB) {
    return json({
      success: false,
      error: "Binding D1 DB belum dikonfigurasi di Cloudflare Worker.",
    }, 500);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // Login admin
  if (path === "/api/admin/login" && request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Format JSON tidak valid." }, 400);
    }

    const password = env.ADMIN_PASSWORD || "rifhsk854";

    if (body.password !== password) {
      return json({
        success: false,
        error: "Password admin salah.",
      }, 401);
    }

    return json({
      success: true,
      token: await createToken(env),
    });
  }

  // Seluruh endpoint admin selain login wajib menggunakan token
  if (path.startsWith("/api/admin/")) {
    const authenticated = await verifyToken(request, env);

    if (!authenticated) {
      return json({
        success: false,
        error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login kembali.",
      }, 401);
    }
  }

  // Membuat pesanan baru
  if (path === "/api/orders" && request.method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Format JSON tidak valid." }, 400);
    }

    const nickname = String(body.nickname || "").trim();
    const gameId = String(body.game_id ?? body.gameId ?? "").trim();
    const service = String(body.service || "").trim().toUpperCase();
    const quantity = Number(body.quantity);
    const total = Number(body.total);
    const schedule = String(body.schedule || "").trim();
    const notes = String(body.notes || "").trim();

    if (!nickname || !gameId || !service) {
      return json({
        success: false,
        error: "Nickname, ID game, dan layanan wajib diisi.",
      }, 400);
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return json({
        success: false,
        error: "Jumlah pertandingan harus antara 1 sampai 10.",
      }, 400);
    }

    if (!Number.isSafeInteger(total) || total <= 0) {
      return json({
        success: false,
        error: "Total pembayaran tidak valid.",
      }, 400);
    }

    const orderId = `RVB-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

    try {
      const columns = await ensureTable(env.DB);

      const values = {
        id: orderId,
        order_id: orderId,
        nickname,
        game_id: gameId,
        gameId,
        service,
        quantity,
        schedule,
        notes,
        total,
        status: "MENUNGGU",
        created_at: new Date().toISOString(),
      };

      const insertColumns = Object.keys(values).filter((key) =>
        columns.includes(key)
      );

      if (!insertColumns.some((key) => key === "id" || key === "order_id")) {
        throw new Error(
          "Tabel orders tidak memiliki kolom id atau order_id."
        );
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      const sql = `
        INSERT INTO orders (${insertColumns.map((name) => `"${name}"`).join(", ")})
        VALUES (${placeholders})
      `;

      await env.DB.prepare(sql)
        .bind(...insertColumns.map((key) => values[key]))
        .run();

      return json({
        success: true,
        message: "Pesanan berhasil disimpan.",
        order_id: orderId,
      }, 201);
    } catch (error) {
      console.error("D1 INSERT ERROR:", error);

      return json({
        success: false,
        error: "Gagal menyimpan pesanan ke database D1.",
        detail: String(error?.message || error),
      }, 500);
    }
  }

  // Daftar pesanan admin
  if (path === "/api/admin/orders" && request.method === "GET") {
    try {
      await ensureTable(env.DB);

      const result = await env.DB.prepare(
        "SELECT * FROM orders ORDER BY created_at DESC"
      ).all();

      const orders = (result.results || []).map(normalizeOrder);

      return json({
        success: true,
        orders,
      });
    } catch (error) {
      console.error("D1 SELECT ERROR:", error);

      return json({
        success: false,
        error: "Gagal mengambil data pesanan.",
        detail: String(error?.message || error),
      }, 500);
    }
  }

  // Update status: mendukung /:id dan /:id/status
  const statusMatch = path.match(
    /^\/api\/admin\/orders\/([^/]+)(?:\/status)?$/
  );

  if (statusMatch && request.method === "PATCH") {
    const orderId = decodeURIComponent(statusMatch[1]);

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Format JSON tidak valid." }, 400);
    }

    let status;

    try {
      status = normalizeStatus(body.status);
    } catch (error) {
      return json({
        success: false,
        error: error.message,
        allowed_statuses: ALLOWED_STATUSES,
      }, 400);
    }

    try {
      const columns = await ensureTable(env.DB);
      const idColumn = columns.includes("id")
        ? "id"
        : columns.includes("order_id")
          ? "order_id"
          : null;

      if (!idColumn) {
        throw new Error("Kolom id/order_id tidak ditemukan di tabel orders.");
      }

      if (!columns.includes("status")) {
        throw new Error("Kolom status tidak ditemukan di tabel orders.");
      }

      const result = await env.DB.prepare(
        `UPDATE orders SET status = ? WHERE "${idColumn}" = ?`
      ).bind(status, orderId).run();

      if (!result.meta || result.meta.changes === 0) {
        return json({
          success: false,
          error: "Pesanan tidak ditemukan.",
        }, 404);
      }

      return json({
        success: true,
        message: "Status pesanan berhasil diperbarui.",
        order_id: orderId,
        status,
      });
    } catch (error) {
      console.error("D1 UPDATE ERROR:", error);

      return json({
        success: false,
        error: "Gagal memperbarui status pesanan.",
        detail: String(error?.message || error),
      }, 500);
    }
  }

  return json({
    success: false,
    error: "Endpoint tidak ditemukan.",
    path,
    method: request.method,
  }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("WORKER ERROR:", error);

      return json({
        success: false,
        error: "Terjadi kesalahan pada Worker.",
        detail: String(error?.message || error),
      }, 500);
    }
  },
};
