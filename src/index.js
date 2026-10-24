const ALLOWED_ORIGINS = [
  "https://rifhskboy.github.io"
];

function respond(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const corsOrigin = allowed ? origin : ALLOWED_ORIGINS[0];

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (!env.DB) {
      return respond({
        success: false,
        message: "Binding D1 DB belum terhubung."
      }, 500, corsOrigin);
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      try {
        await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM rank_vs_bot_orders"
        ).first();

        return respond({
          success: true,
          message: "API dan D1 terhubung."
        }, 200, corsOrigin);
      } catch {
        return respond({
          success: false,
          message: "Tabel rank_vs_bot_orders belum tersedia."
        }, 500, corsOrigin);
      }
    }

    if (url.pathname === "/api/orders/recent" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT order_id, service, quantity, total, status, created_at
          FROM rank_vs_bot_orders
          WHERE created_at >= datetime('now', '-7 days')
          ORDER BY created_at DESC
          LIMIT 8
        `).all();

        return respond({
          success: true,
          orders: result.results || []
        }, 200, corsOrigin);
      } catch {
        return respond({
          success: false,
          message: "Gagal mengambil pesanan."
        }, 500, corsOrigin);
      }
    }

    if (url.pathname === "/api/orders" && request.method === "POST") {
      if (!allowed) {
        return respond({
          success: false,
          message: "Origin tidak diizinkan."
        }, 403, corsOrigin);
      }

      let body;

      try {
        body = await request.json();
      } catch {
        return respond({
          success: false,
          message: "Format data tidak valid."
        }, 400, corsOrigin);
      }

      const nickname = String(body.nickname || "").trim();
      const gameId = String(body.game_id || "").trim();
      const service = String(body.service || "").trim().toUpperCase();
      const quantity = Number(body.quantity);
      const schedule = String(body.schedule || "").trim().toUpperCase();
      const notes = String(body.notes || "").trim().slice(0, 500);

      if (!nickname || !gameId) {
        return respond({
          success: false,
          message: "Nickname dan ID Game wajib diisi."
        }, 400, corsOrigin);
      }

      if (!["FLEXIBLE", "NO FLEXIBLE"].includes(service)) {
        return respond({
          success: false,
          message: "Layanan tidak valid."
        }, 400, corsOrigin);
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return respond({
          success: false,
          message: "Jumlah harus 1–10 match."
        }, 400, corsOrigin);
      }

      if (!["SEKARANG", "PAGI", "SIANG", "MALAM"].includes(schedule)) {
        return respond({
          success: false,
          message: "Jadwal tidak valid."
        }, 400, corsOrigin);
      }

      const total = quantity * (
        service === "FLEXIBLE" ? 2500 : 3500
      );

      const orderId = crypto.randomUUID();

      try {
        await env.DB.prepare(`
          INSERT INTO rank_vs_bot_orders
          (order_id, nickname, game_id, service, quantity,
           schedule, notes, total, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MENUNGGU')
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

        return respond({
          success: true,
          order_id: orderId,
          total,
          message: "Pesanan berhasil disimpan."
        }, 201, corsOrigin);
      } catch {
        return respond({
          success: false,
          message: "Gagal menyimpan pesanan ke D1."
        }, 500, corsOrigin);
      }
    }

    return respond({
      success: false,
      message: "Endpoint tidak ditemukan."
    }, 404, corsOrigin);
  }
};
