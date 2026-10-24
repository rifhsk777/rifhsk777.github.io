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

async function signToken(password, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const payload = {
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 86400,
    nonce: crypto.randomUUID(),
  };

  const encoded = btoa(
    String.fromCharCode(
      ...new TextEncoder().encode(JSON.stringify(payload))
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encoded)
  );

  const sig = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

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
          "=".repeat((4 - (signature.length % 4)) % 4)
      ),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(encoded)
    );

    if (!valid) return false;

    const payloadBytes = Uint8Array.from(
      atob(
        encoded.replace(/-/g, "+").replace(/_/g, "/") +
          "=".repeat((4 - (encoded.length % 4)) % 4)
      ),
      (c) => c.charCodeAt(0)
    );

    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes)
    );

    return (
      payload.role === "admin" &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

function getBearerToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN_SECRET) return false;

  return verifyToken(
    getBearerToken(request),
    env.ADMIN_TOKEN_SECRET
  );
}

function maskNickname(nickname) {
  if (!nickname) return "Pelanggan";

  const value = String(nickname).trim();

  if (value.length <= 2) {
    return value.charAt(0) + "***";
  }

  return value.slice(0, 2) + "***";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // ==========================================
      // HEALTH CHECK
      // ==========================================
      if (path === "/api/health" && request.method === "GET") {
        return json({
          ok: true,
          service: "rank-vs-bot-api",
        });
      }

      // ==========================================
      // SECRET DIAGNOSTIC
      // Tidak menampilkan nilai secret.
      // ==========================================
      if (
        path === "/api/debug-secrets" &&
        request.method === "GET"
      ) {
        return json({
          passwordExists: Boolean(env.ADMIN_PASSWORD),
          tokenSecretExists: Boolean(env.ADMIN_TOKEN_SECRET),
          environment: env.ENVIRONMENT || "unknown",
        });
      }

      // ==========================================
      // ADMIN LOGIN
      // ==========================================
      if (
        path === "/api/admin/login" &&
        request.method === "POST"
      ) {
        if (!env.ADMIN_PASSWORD || !env.ADMIN_TOKEN_SECRET) {
          return json(
            {
              success: false,
              error:
                "Secret belum terbaca: " +
                [
                  !env.ADMIN_PASSWORD && "ADMIN_PASSWORD",
                  !env.ADMIN_TOKEN_SECRET &&
                    "ADMIN_TOKEN_SECRET",
                ]
                  .filter(Boolean)
                  .join(", "),
            },
            500
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return json(
            {
              success: false,
              error: "Format permintaan login tidak valid.",
            },
            400
          );
        }

        const suppliedPassword =
          typeof body.password === "string"
            ? body.password
            : "";

        if (suppliedPassword !== env.ADMIN_PASSWORD) {
          return json(
            {
              success: false,
              error: "Password admin salah.",
            },
            401
          );
        }

        const token = await signToken(
          env.ADMIN_PASSWORD,
          env.ADMIN_TOKEN_SECRET
        );

        return json({
          success: true,
          token,
          message: "Login berhasil.",
        });
      }

      // ==========================================
      // PUBLIC RECENT ORDERS
      // ==========================================
      if (
        path === "/api/orders/recent" &&
        request.method === "GET"
      ) {
        if (!env.DB) {
          return json({
            success: true,
            orders: [],
          });
        }

        const result = await env.DB.prepare(`
          SELECT id, nickname, service, quantity, status, created_at
          FROM rank_vs_bot_orders
          ORDER BY created_at DESC
          LIMIT 10
        `).all();

        const orders = (result.results || []).map((order) => ({
          ...order,
          nickname: maskNickname(order.nickname),
        }));

        return json({
          success: true,
          orders,
        });
      }

      // ==========================================
      // CREATE ORDER
      // ==========================================
      if (
        path === "/api/orders" &&
        request.method === "POST"
      ) {
        if (!env.DB) {
          return json(
            {
              success: false,
              error: "Database belum terhubung.",
            },
            500
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return json(
            {
              success: false,
              error: "Data pesanan tidak valid.",
            },
            400
          );
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
          return json(
            {
              success: false,
              error: "Nickname dan ID Game wajib diisi.",
            },
            400
          );
        }

        if (!["FLEXIBLE", "NO FLEXIBLE"].includes(service)) {
          return json(
            {
              success: false,
              error: "Layanan tidak valid.",
            },
            400
          );
        }

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 10
        ) {
          return json(
            {
              success: false,
              error: "Jumlah match harus antara 1 sampai 10.",
            },
            400
          );
        }

        const pricePerMatch =
          service === "FLEXIBLE" ? 2500 : 3500;
        const total = pricePerMatch * quantity;
        const id = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO rank_vs_bot_orders
            (
              id,
              nickname,
              game_id,
              service,
              quantity,
              schedule,
              notes,
              total,
              status,
              created_at
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
          .bind(
            id,
            nickname,
            gameId,
            service,
            quantity,
            schedule,
            notes,
            total,
            "MENUNGGU"
          )
          .run();

        return json(
          {
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
          },
          201
        );
      }

      // ==========================================
      // ADMIN: GET ALL ORDERS
      // ==========================================
      if (
        path === "/api/admin/orders" &&
        request.method === "GET"
      ) {
        if (!(await requireAdmin(request, env))) {
          return json(
            {
              success: false,
              error: "Token admin tidak valid atau kedaluwarsa.",
            },
            401
          );
        }

        if (!env.DB) {
          return json(
            {
              success: false,
              error: "Database belum terhubung.",
            },
            500
          );
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

      // ==========================================
      // ADMIN: UPDATE ORDER STATUS
      // ==========================================
      const statusMatch = path.match(
        /^\/api\/admin\/orders\/([^/]+)\/status$/
      );

      if (statusMatch && request.method === "PATCH") {
        if (!(await requireAdmin(request, env))) {
          return json(
            {
              success: false,
              error: "Token admin tidak valid atau kedaluwarsa.",
            },
            401
          );
        }

        if (!env.DB) {
          return json(
            {
              success: false,
              error: "Database belum terhubung.",
            },
            500
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return json(
            {
              success: false,
              error: "Data status tidak valid.",
            },
            400
          );
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
          return json(
            {
              success: false,
              error: "Status pesanan tidak dikenal.",
            },
            400
          );
        }

        const orderId = decodeURIComponent(statusMatch[1]);

        const result = await env.DB.prepare(`
          UPDATE rank_vs_bot_orders
          SET status = ?
          WHERE id = ?
        `)
          .bind(status, orderId)
          .run();

        if (!result.meta || result.meta.changes === 0) {
          return json(
            {
              success: false,
              error: "Pesanan tidak ditemukan.",
            },
            404
          );
        }

        return json({
          success: true,
          message: "Status pesanan berhasil diperbarui.",
          status,
        });
      }

      return json(
        {
          success: false,
          error: "Endpoint tidak ditemukan.",
          path,
        },
        404
      );
    } catch (error) {
      // Jangan kirim detail internal atau secret ke browser.
      console.error("Worker error:", error);

      return json(
        {
          success: false,
          error: "Terjadi kesalahan pada server.",
        },
        500
      );
    }
  },
};
