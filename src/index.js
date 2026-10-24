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

async function createToken(secret) {
  const timestamp = Date.now().toString();
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
    new TextEncoder().encode(timestamp)
  );

  const encoded = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${timestamp}.${encoded}`;
}

async function verifyToken(token, secret) {
  if (!token || !secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const timestamp = Number(parts[0]);
  if (!Number.isFinite(timestamp)) return false;

  // Token berlaku selama 12 jam.
  if (Date.now() - timestamp > 12 * 60 * 60 * 1000) return false;
  if (timestamp > Date.now() + 60_000) return false;

  const expected = await createTokenForTimestamp(
    parts[0],
    secret
  );

  return expected === parts[1];
}

async function createTokenForTimestamp(timestamp, secret) {
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
    new TextEncoder().encode(timestamp)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
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

    // Diagnosis: hanya menampilkan keberadaan binding,
    // tidak pernah menampilkan nilai secret.
    if (path === "/api/debug-secrets" && request.method === "GET") {
      return response({
        marker: "RANK-VS-BOT-CHECK-7291",
        passwordExists: Boolean(env.ADMIN_PASSWORD),
        tokenSecretExists: Boolean(env.ADMIN_TOKEN_SECRET),
        databaseExists: Boolean(env.DB),
      });
    }

    if (path === "/api/admin/login" && request.method === "POST") {
      if (!env.ADMIN_PASSWORD || !env.ADMIN_TOKEN_SECRET) {
        return response({
          success: false,
          error: "Secret belum tersedia pada runtime Worker yang aktif.",
          passwordExists: Boolean(env.ADMIN_PASSWORD),
          tokenSecretExists: Boolean(env.ADMIN_TOKEN_SECRET),
        }, 500);
      }

      const body = await readBody(request);
      const password = String(body.password || "");

      if (!password || password !== env.ADMIN_PASSWORD) {
        return response({
          success: false,
          error: "Password admin salah.",
        }, 401);
      }

      const token = await createToken(env.ADMIN_TOKEN_SECRET);

      return response({
        success: true,
        message: "Login berhasil.",
        token,
      });
    }

    if (path === "/api/admin/verify" && request.method === "GET") {
      const authorization = request.headers.get("Authorization") || "";
      const token = authorization.replace(/^Bearer\s+/i, "");

      const valid = await verifyToken(token, env.ADMIN_TOKEN_SECRET);

      if (!valid) {
        return response({
          success: false,
          error: "Sesi admin tidak valid atau sudah kedaluwarsa.",
        }, 401);
      }

      return response({ success: true });
    }

    // API order memerlukan database D1.
    if (path === "/api/orders" && request.method === "POST") {
      if (!env.DB) {
        return response({
          success: false,
          error: "Binding database DB belum tersedia.",
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

      const pricePerMatch = service === "FLEXIBLE" ? 2500 : 3500;
      const total = pricePerMatch * quantity;
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
          INSERT INTO orders
          (id, nickname, game_id, service, quantity, schedule, notes, total)
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
          error: "Gagal menyimpan pesanan. Periksa binding dan database D1.",
        }, 500);
      }
    }

    if (path === "/api/admin/orders" && request.method === "GET") {
      const authorization = request.headers.get("Authorization") || "";
      const token = authorization.replace(/^Bearer\s+/i, "");

      if (!(await verifyToken(token, env.ADMIN_TOKEN_SECRET))) {
        return response({
          success: false,
          error: "Akses admin ditolak.",
        }, 401);
      }

      if (!env.DB) {
        return response({
          success: false,
          error: "Binding database DB belum tersedia.",
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
