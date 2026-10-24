const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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

function normalizePath(path) {
  return path.replace(/\/+$/, "") || "/";
}

function base64urlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

async function signToken(secret) {
  const payload = {
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 86400,
    nonce: crypto.randomUUID(),
  };

  const encoded = base64urlEncode(JSON.stringify(payload));

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
    new TextEncoder().encode(encoded)
  );

  const sig = base64urlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${encoded}.${sig}`;
}

async function verifyToken(token, secret) {
  try {
    if (!token || !secret) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [encoded, signature] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = Uint8Array.from(
      atob(
        signature.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - signature.length % 4) % 4)
      ),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(encoded)
    );

    if (!valid) return false;

    const payload = JSON.parse(base64urlDecode(encoded));

    return payload.role === "admin" &&
      Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function bearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";
}

async function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN_SECRET) return false;

  return verifyToken(
    bearerToken(request),
    env.ADMIN_TOKEN_SECRET
  );
}

function maskNickname(nickname) {
  const value = String(nickname || "Pelanggan").trim();

  if (value.length <= 2) {
    return value.charAt(0) + "***";
  }

  return value.slice(0, 2) + "***";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // HALAMAN UTAMA API
      if (path === "/" && request.method === "GET") {
        return json({
          success: true,
          service: "RANK VS BOT API",
          health: "/api/health",
        });
      }

      // STATUS WORKER
      if (path === "/api/health" && request.method === "GET") {
        return json({
          ok: true,
          service: "rank-vs-bot-api",
        });
      }

      // DIAGNOSTIK: TIDAK PERNAH MENAMPILKAN NILAI SECRET
      if (
        path === "/api/debug-secrets" &&
        request.method === "GET"
      ) {
        return json({
          passwordExists: Boolean(env.ADMIN_PASSWORD),
          tokenSecretExists: Boolean(env.ADMIN_TOKEN_SECRET),
          databaseExists: Boolean(env.DB),
        });
      }

      // LOGIN ADMIN
      if (
        path === "/api/admin/login" &&
        request.method === "POST"
      ) {
        if (
          typeof env.ADMIN_PASSWORD !== "string" ||
          env.ADMIN_PASSWORD.length === 0 ||
          typeof env.ADMIN_TOKEN_SECRET !== "string" ||
          env.ADMIN_TOKEN_SECRET.length === 0
        ) {
          return json({
            success: false,
            error: "Konfigurasi secret belum terbaca oleh Worker aktif.",
            diagnostic: {
              passwordExists: Boolean(env.ADMIN_PASSWORD),
              tokenSecretExists: Boolean(env.ADMIN_TOKEN_SECRET),
            },
          }, 500);
        }

        const body = await readJson(request);

        if (!body || typeof body.password !== "string") {
          return json({
            success: false,
            error: "Password tidak ditemukan dalam permintaan.",
          }, 400);
        }

        if (body.password !== env.ADMIN_PASSWORD) {
          return json({
            success: false,
            error: "Password admin salah.",
          }, 401);
        }

        const token = await signToken(env.ADMIN_TOKEN_SECRET);

        return json({
          success: true,
          token,
          message: "Login berhasil.",
        });
      }

      // DAFTAR PESANAN TERBARU UNTUK PUBLIK
      if (
        path === "/api/orders/recent" &&
        request.method === "GET"
      ) {
        if (!env.DB) {
          return json({
            success: true,
            orders: [],
            warning: "Database belum terhubung.",
          });
        }

        const result = await env.DB.prepare(`
          SELECT id, nickname, service, quantity, status, created_at
          FROM rank_vs_bot_orders
          ORDER BY created_at DESC
          LIMIT 10
        `).all();

        const orders = (result.results || []).map(order => ({
          ...order,
          nickname: maskNickname(order.nickname),
        }));

        return json({
          success: true,
          orders,
        });
      }

      // MEMBUAT PESANAN
      if (
        path === "/api/orders" &&
        request.method === "POST"
      ) {
        if (!env.DB) {
          return json({
            success: false,
            error: "Database D1 belum terhubung.",
          }, 500);
        }

        const body = await readJson(request);

        if (!body) {
          return json({
            success: false,
            error: "Format data pesanan tidak valid.",
          }, 400);
        }

        const nickname = String(body.nickname || "").trim();
        const gameId = String(body.gameId || "").trim();
        const service = String(body.service || "")
          .trim()
          .toUpperCase();
        const quantity = Number(body.quantity);
        const schedule = String(body.schedule || "").trim();
        const notes = String(body.notes || "").trim();

        if (!nickname || !gameId) {
          return json({
            success: false,
            error: "Nickname dan ID Game wajib diisi.",
          }, 400);
        }

        if (!["FLEXIBLE", "NO FLEXIBLE"].includes(service)) {
          return json({
            success: false,
            error: "Layanan tidak valid.",
          }, 400);
        }

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 10
        ) {
          return json({
            success: false,
            error: "Jumlah match harus 1 sampai 10.",
          }, 400);
        }

        const price = service === "FLEXIBLE" ? 2500 : 3500;
        const total = price * quantity;
        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO rank_vs_bot_orders
          (id, nickname, game_id, service, quantity, schedule,
           notes, total, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          id,
          nickname,
          gameId,
          service,
          quantity,
          schedule,
          notes,
          total,
          "MENUNGGU"
        ).run();

        return json({
          success: true,
          message: "Pesanan berhasil dibuat.",
          order: {
            id,
            nickname,
            gameId,
            service,
            quantity,
            schedule,
            notes,
            total,
            status: "MENUNGGU",
          },
        }, 201);
      }

      // ADMIN: MENGAMBIL SEMUA PESANAN
      if (
        path === "/api/admin/orders" &&
        request.method === "GET"
      ) {
        if (!(await isAdmin(request, env))) {
          return json({
            success: false,
            error: "Sesi admin tidak valid atau sudah kedaluwarsa.",
          }, 401);
        }

        if (!env.DB) {
          return json({
            success: false,
            error: "Database D1 belum terhubung.",
          }, 500);
        }

        const result = await env.DB.prepare(`
          SELECT *
          FROM rank_vs_bot_orders
          ORDER BY created_at DESC
          LIMIT 500
        `).all();

        return json({
          success: true,
          orders: result.results || [],
        });
      }

      // ADMIN: MENGUBAH STATUS PESANAN
      const statusMatch = path.match(
        /^\/api\/admin\/orders\/([^/]+)\/status$/
      );

      if (statusMatch && request.method === "PATCH") {
        if (!(await isAdmin(request, env))) {
          return json({
            success: false,
            error: "Sesi admin tidak valid atau sudah kedaluwarsa.",
          }, 401);
        }

        if (!env.DB) {
          return json({
            success: false,
            error: "Database D1 belum terhubung.",
          }, 500);
        }

        const body = await readJson(request);

        if (!body) {
          return json({
            success: false,
            error: "Format data status tidak valid.",
          }, 400);
        }

        const allowedStatuses = [
          "MENUNGGU",
          "SUDAH BAYAR",
          "DIPROSES",
          "SELESAI",
          "DIBATALKAN",
        ];

        const status = String(body.status || "")
          .trim()
          .toUpperCase();

        if (!allowedStatuses.includes(status)) {
          return json({
            success: false,
            error: "Status pesanan tidak dikenal.",
          }, 400);
        }

        const orderId = decodeURIComponent(statusMatch[1]);

        const result = await env.DB.prepare(`
          UPDATE rank_vs_bot_orders
          SET status = ?
          WHERE id = ?
        `).bind(status, orderId).run();

        if (!result.meta || result.meta.changes === 0) {
          return json({
            success: false,
            error: "Pesanan tidak ditemukan.",
          }, 404);
        }

        return json({
          success: true,
          message: "Status pesanan berhasil diperbarui.",
          status,
        });
      }

      return json({
        success: false,
        error: "Endpoint tidak ditemukan.",
        path,
      }, 404);

    } catch (error) {
      console.error("RANK VS BOT API error:", error);

      return json({
        success: false,
        error: "Terjadi kesalahan pada server atau database.",
      }, 500);
    }
  },
};
