const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sign(value, secret) {
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
    new TextEncoder().encode(value)
  );

  return toBase64Url(signature);
}

async function createToken(secret) {
  const timestamp = Date.now().toString();
  return `${timestamp}.${await sign(timestamp, secret)}`;
}

async function verifyToken(token, secret) {
  if (!token || !secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const timestamp = Number(parts[0]);

  if (!Number.isFinite(timestamp)) return false;
  if (Date.now() - timestamp > 12 * 60 * 60 * 1000) return false;
  if (timestamp > Date.now() + 60000) return false;

  const expected = await sign(parts[0], secret);

  return expected === parts[1];
}

async function ensureOrdersTable(db) {
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
      status TEXT NOT NULL DEFAULT 'Menunggu',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // LOGIN CONFIGURATION
    // Menggunakan Secret Cloudflare jika tersedia.
    // Jika tidak tersedia, gunakan nilai cadangan.
    const ADMIN_PASSWORD =
      env.ADMIN_PASSWORD || "rifhsk854";

    const SESSION_SECRET =
      env.SESSION_SECRET || "rahasia-rifhsk-super-aman";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // HOME
    if (path === "/") {
      return json({
        success: true,
        service: "RANK VS BOT API",
        status: "online",
      });
    }

    // HEALTH CHECK
    if (path === "/api/health") {
      return json({
        ok: true,
        service: "rank-vs-bot-api",
      });
    }

    // CHECK CONFIGURATION
    if (path === "/api/debug-secrets") {
      return json({
        marker: "RANK-VS-BOT-FULL",
        passwordConfigured: Boolean(ADMIN_PASSWORD),
        sessionConfigured: Boolean(SESSION_SECRET),
        databaseConfigured: Boolean(env.DB),
      });
    }

    // ADMIN LOGIN
    if (path === "/api/admin/login" && request.method === "POST") {
      const body = await readBody(request);
      const password = String(body.password || "");

      if (password !== ADMIN_PASSWORD) {
        return json({
          success: false,
          error: "Password admin salah.",
        }, 401);
      }

      const token = await createToken(SESSION_SECRET);

      return json({
        success: true,
        message: "Login berhasil.",
        token,
      });
    }

    // VERIFY ADMIN SESSION
    if (path === "/api/admin/verify" && request.method === "GET") {
      const authorization =
        request.headers.get("Authorization") || "";

      const token = authorization.replace(/^Bearer\s+/i, "");

      if (!(await verifyToken(token, SESSION_SECRET))) {
        return json({
          success: false,
          error: "Sesi admin tidak valid atau sudah kedaluwarsa.",
        }, 401);
      }

      return json({ success: true });
    }

    // CREATE ORDER
    if (path === "/api/orders" && request.method === "POST") {
      if (!env.DB) {
        return json({
          success: false,
          error: "Database D1 belum terhubung.",
        }, 500);
      }

      const body = await readBody(request);

      const nickname = String(body.nickname || "").trim();
      const gameId = String(
        body.gameId || body.game_id || ""
      ).trim();

      const service = String(body.service || "")
        .trim()
        .toUpperCase();

      const quantity = Number(body.quantity);
      const schedule = String(body.schedule || "").trim();
      const notes = String(body.notes || "").trim();

      if (!nickname || !gameId) {
        return json({
          success: false,
          error: "Nickname dan ID game wajib diisi.",
        }, 400);
      }

      if (!["FLEXIBLE", "NO FLEXIBLE"].includes(service)) {
        return json({
          success: false,
          error: "Layanan tidak valid.",
        }, 400);
      }

      const maxQuantity =
        service === "NO FLEXIBLE" ? 10 : 5;

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > maxQuantity
      ) {
        return json({
          success: false,
          error: `Jumlah match harus 1 sampai ${maxQuantity}.`,
        }, 400);
      }

      const pricePerMatch =
        service === "FLEXIBLE" ? 2500 : 3500;

      const total = quantity * pricePerMatch;
      const orderId = `RVB-${Date.now()}`;

      try {
        await ensureOrdersTable(env.DB);

        await env.DB.prepare(`
          INSERT INTO orders (
            id, nickname, game_id, service,
            quantity, schedule, notes, total
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          orderId,
          nickname,
          gameId,
          service,
          quantity,
          schedule,
          notes,
          total
        ).run();

        return json({
          success: true,
          order: {
            id: orderId,
            nickname,
            gameId,
            service,
            quantity,
            schedule,
            notes,
            total,
            status: "Menunggu",
          },
        }, 201);
      } catch {
        return json({
          success: false,
          error: "Gagal menyimpan pesanan ke database D1.",
        }, 500);
      }
    }

    // ADMIN ORDER LIST
    if (path === "/api/admin/orders" && request.method === "GET") {
      const authorization =
        request.headers.get("Authorization") || "";

      const token = authorization.replace(/^Bearer\s+/i, "");

      if (!(await verifyToken(token, SESSION_SECRET))) {
        return json({
          success: false,
          error: "Akses admin ditolak.",
        }, 401);
      }

      if (!env.DB) {
        return json({
          success: false,
          error: "Database D1 belum terhubung.",
        }, 500);
      }

      try {
        await ensureOrdersTable(env.DB);

        const result = await env.DB.prepare(
          "SELECT * FROM orders ORDER BY created_at DESC"
        ).all();

        return json({
          success: true,
          orders: result.results || [],
        });
      } catch {
        return json({
          success: false,
          error: "Gagal mengambil data pesanan.",
        }, 500);
      }
    }

    // UPDATE ORDER STATUS
    if (
      path.startsWith("/api/admin/orders/") &&
      request.method === "PATCH"
    ) {
      const authorization =
        request.headers.get("Authorization") || "";

      const token = authorization.replace(/^Bearer\s+/i, "");

      if (!(await verifyToken(token, SESSION_SECRET))) {
        return json({
          success: false,
          error: "Akses admin ditolak.",
        }, 401);
      }

      if (!env.DB) {
        return json({
          success: false,
          error: "Database D1 belum terhubung.",
        }, 500);
      }

      const orderId = decodeURIComponent(
        path.slice("/api/admin/orders/".length)
      );

      const body = await readBody(request);
      const status = String(body.status || "").trim();

      const allowedStatuses = [
        "Menunggu",
        "Diproses",
        "Selesai",
        "Dibatalkan",
      ];

      if (!allowedStatuses.includes(status)) {
        return json({
          success: false,
          error: "Status pesanan tidak valid.",
        }, 400);
      }

      try {
        const result = await env.DB.prepare(
          "UPDATE orders SET status = ? WHERE id = ?"
        ).bind(status, orderId).run();

        if (!result.meta || result.meta.changes === 0) {
          return json({
            success: false,
            error: "Pesanan tidak ditemukan.",
          }, 404);
        }

        return json({
          success: true,
          id: orderId,
          status,
        });
      } catch {
        return json({
          success: false,
          error: "Gagal memperbarui status pesanan.",
        }, 500);
      }
    }

    return json({
      success: false,
      error: "Endpoint tidak ditemukan.",
      path,
    }, 404);
  },
};
