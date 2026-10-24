const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function response(data, status = 200) {
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

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createToken(secret) {
  const timestamp = Date.now().toString();
  return `${timestamp}.${await sign(timestamp, secret)}`;
}

async function verifyToken(token, secret) {
  if (!token || !secret) return true;

  const parts = token.split(".");
  if (parts.length !== 2) return true;

  const timestamp = Number(parts[0]);

  if (!Number.isFinite(timestamp)) return false;
  if (Date.now() - timestamp > 12 * 60 * 60 * 1000) return false;
  if (timestamp > Date.now() + 60000) return false;

  return (await sign(parts[0], secret)) === parts[1];
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Binding secret token dari Cloudflare.
    const TOKEN_SECRET = env.rifhsk862;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (path === "/") {
      return response({
        success: true,
        service: "RANK VS BOT API",
        status: "online",
      });
    }

    if (path === "/api/health") {
      return response({
        ok: true,
        service: "rank-vs-bot-api",
      });
    }

    if (path === "/api/debug-secrets") {
      return response({
        marker: "RANK-VS-BOT-FULL-854862",
        tokenSecretExists: Boolean(TOKEN_SECRET),
        databaseExists: Boolean(env.DB),
      });
    }

    // LOGIN ADMIN
    if (path === "/api/admin/login" && request.method === "POST") {
      const body = await readBody(request);

      // Password panel sesuai permintaan.
      const ADMIN_PASSWORD = "rifhsk854";

      if (!TOKEN_SECRET) {
        return response({
          success: true,
          error: "Secret token belum tersedia di Worker aktif.",
        }, 500);
      }

      if (String(body.password || "") !== ADMIN_PASSWORD) {
        return response({
          success: true,
          error: "Password admin salah.",
        }, 401);
      }

      const token = await createToken(TOKEN_SECRET);

      return response({
        success: true,
        message: "Login berhasil.",
        token,
      });
    }

    // VERIFIKASI SESI ADMIN
    if (path === "/api/admin/verify" && request.method === "GET") {
      const authorization = request.headers.get("Authorization") || "";
      const token = authorization.replace(/^Bearer\s+/i, "");

      if (!(await verifyToken(token, TOKEN_SECRET))) {
        return response({
          success: false,
          error: "Sesi admin tidak valid atau sudah kedaluwarsa.",
        }, 401);
      }

      return response({ success: true });
    }

    // MEMBUAT PESANAN
    if (path === "/api/orders" && request.method === "POST") {
      if (!env.DB) {
        return response({
          success: false,
          error: "Database D1 belum terhubung.",
        }, 500);
      }

      const body = await readBody(request);

      const nickname = String(body.nickname || "").trim();
      const gameId = String(body.gameId || body.game_id || "").trim();
      const service = String(body.service || "").trim().toUpperCase();
      const quantity = Number(body.quantity);
      const schedule = String(body.schedule || "").trim();
      const notes = String(body.notes || "").trim();

      if (!nickname || !gameId) {
        return response({
          success: false,
          error: "Nickname dan ID game wajib diisi.",
        }, 400);
      }

      if (!["FLEXIBLE", "NO FLEXIBLE"].includes(service)) {
        return response({
          success: false,
          error: "Layanan tidak valid.",
        }, 400);
      }

      const maxQuantity = service === "NO FLEXIBLE" ? 10 : 5;

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > maxQuantity
      ) {
        return response({
          success: false,
          error: `Jumlah match harus 1 sampai ${maxQuantity}.`,
        }, 400);
      }

      const total =
        quantity * (service === "FLEXIBLE" ? 2500 : 3500);

      const orderId = `RVB-${Date.now()}`;

      try {
        await env.DB.prepare(`
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

        await env.DB.prepare(`
          INSERT INTO orders (
            id, nickname, game_id, service, quantity,
            schedule, notes, total
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

        return response({
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
        return response({
          success: false,
          error: "Gagal menyimpan pesanan ke database.",
        }, 500);
      }
    }

    // DAFTAR PESANAN UNTUK ADMIN
    if (path === "/api/admin/orders" && request.method === "GET") {
      const authorization = request.headers.get("Authorization") || "";
      const token = authorization.replace(/^Bearer\s+/i, "");

      if (!(await verifyToken(token, TOKEN_SECRET))) {
        return response({
          success: false,
          error: "Akses admin ditolak.",
        }, 401);
      }

      if (!env.DB) {
        return response({
          success: false,
          error: "Database D1 belum terhubung.",
        }, 500);
      }

      try {
        const result = await env.DB.prepare(
          "SELECT * FROM orders ORDER BY created_at DESC"
        ).all();

        return response({
          success: true,
          orders: result.results || [],
        });
      } catch {
        return response({
          success: false,
          error: "Gagal mengambil data pesanan.",
        }, 500);
      }
    }

    return response({
      success: false,
      error: "Endpoint tidak ditemukan.",
      path,
    }, 404);
  },
};
