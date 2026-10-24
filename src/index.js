const STATUSES = [
  "MENUNGGU",
  "SUDAH BAYAR",
  "DIPROSES",
  "SELESAI",
  "DIBATALKAN"
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store"
    }
  });
}

function encode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signature(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return encode(new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  ));
}

async function createToken(secret) {
  const payload = encode(new TextEncoder().encode(JSON.stringify({
    role: "admin",
    exp: Date.now() + 8 * 60 * 60 * 1000
  })));
  return payload + "." + await signature(payload, secret);
}

async function validToken(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const expected = await signature(parts[0], secret);
    if (expected.length !== parts[1].length) return false;

    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ parts[1].charCodeAt(i);
    }
    if (diff !== 0) return false;

    let encoded = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    while (encoded.length % 4) encoded += "=";

    const payload = JSON.parse(atob(encoded));
    return payload.role === "admin" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

async function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN_SECRET) return false;
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return validToken(auth.slice(7), env.ADMIN_TOKEN_SECRET);
}

function maskName(value) {
  const name = String(value || "");
  return name.length ? name[0] + "***" : "***";
}

function maskId(value) {
  const id = String(value || "");
  return id.slice(0, Math.min(3, id.length)) + "****";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    if (path === "/" || path === "/api/health") {
      return json({ ok: true, service: "rank-vs-bot-api" });
    }

    if (!env.DB) {
      return json({ success: false, error: "Binding D1 DB belum dikonfigurasi." }, 500);
    }

    try {
      // LOGIN ADMIN
      if (path === "/api/admin/login" && request.method === "POST") {
        if (!env.ADMIN_PASSWORD || !env.ADMIN_TOKEN_SECRET) {
          return json({
            success: false,
            error: "Atur secret ADMIN_PASSWORD dan ADMIN_TOKEN_SECRET di Cloudflare."
          }, 500);
        }

        const body = await request.json();

        if (typeof body.password !== "string" ||
            body.password !== env.ADMIN_PASSWORD) {
          return json({ success: false, error: "Password admin salah." }, 401);
        }

        const token = await createToken(env.ADMIN_TOKEN_SECRET);
        return json({ success: true, token });
      }

      // LIVE ORDER: DATA PELANGGAN DISENSOR DI SERVER
      if (path === "/api/orders/recent" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT order_id, nickname, game_id, service, quantity, total, status, created_at
          FROM rank_vs_bot_orders
          ORDER BY created_at DESC
          LIMIT 10
        `).all();

        return json({
          success: true,
          orders: (result.results || []).map(o => ({
            order_id: o.order_id,
            nickname: maskName(o.nickname),
            game_id: maskId(o.game_id),
            service: o.service,
            quantity: o.quantity,
            total: o.total,
            status: o.status,
            created_at: o.created_at
          }))
        });
      }

      // BUAT PESANAN PELANGGAN
      if (path === "/api/orders" && request.method === "POST") {
        const body = await request.json();

        const nickname = String(body.nickname || "").trim().slice(0, 60);
        const gameId = String(body.game_id || "").trim().slice(0, 40);
        const service = String(body.service || "").trim().toUpperCase();
        const quantity = Number(body.quantity);
        const schedule = String(body.schedule || "").trim().toUpperCase();
        const notes = String(body.notes || "").trim().slice(0, 500);

        if (!nickname || !gameId) {
          return json({ success: false, error: "Nickname dan ID game wajib diisi." }, 400);
        }

        if (!["FLEXIBLE", "NO FLEXIBLE"].includes(service)) {
          return json({ success: false, error: "Layanan tidak valid." }, 400);
        }

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
          return json({ success: false, error: "Jumlah match maksimal 5." }, 400);
        }

        if (!["SEKARANG", "PAGI", "SIANG", "MALAM"].includes(schedule)) {
          return json({ success: false, error: "Jadwal tidak valid." }, 400);
        }

        const total = quantity * (service === "FLEXIBLE" ? 2500 : 3500);
        const orderId = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO rank_vs_bot_orders
          (order_id, nickname, game_id, service, quantity, schedule, notes, total, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MENUNGGU')
        `).bind(
          orderId, nickname, gameId, service, quantity, schedule, notes, total
        ).run();

        return json({
          success: true,
          order_id: orderId,
          total,
          status: "MENUNGGU"
        }, 201);
      }

      // SEMUA ENDPOINT ADMIN DI BAWAH INI WAJIB LOGIN
      if (path.startsWith("/api/admin/")) {
        if (!await isAdmin(request, env)) {
          return json({
            success: false,
            error: "Sesi admin berakhir. Silakan login kembali."
          }, 401);
        }
      }

      // DAFTAR PESANAN LENGKAP UNTUK ADMIN
      if (path === "/api/admin/orders" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT order_id, nickname, game_id, service, quantity,
                 schedule, notes, total, status, created_at
          FROM rank_vs_bot_orders
          ORDER BY created_at DESC
          LIMIT 200
        `).all();

        return json({ success: true, orders: result.results || [] });
      }

      // UBAH STATUS PESANAN DARI PANEL ADMIN
      const match = path.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);

      if (match && request.method === "PATCH") {
        const orderId = decodeURIComponent(match[1]);
        const body = await request.json();
        const status = String(body.status || "").toUpperCase();

        if (!STATUSES.includes(status)) {
          return json({ success: false, error: "Status tidak valid." }, 400);
        }

        const result = await env.DB.prepare(`
          UPDATE rank_vs_bot_orders
          SET status = ?
          WHERE order_id = ?
        `).bind(status, orderId).run();

        if (!result.meta || result.meta.changes === 0) {
          return json({ success: false, error: "Pesanan tidak ditemukan." }, 404);
        }

        return json({ success: true, order_id: orderId, status });
      }

      return json({ success: false, error: "Endpoint tidak ditemukan." }, 404);

    } catch (error) {
      console.error("API error:", error);
      return json({
        success: false,
        error: "Kesalahan server. Periksa binding D1 dan struktur tabel."
      }, 500);
    }
  }
};
