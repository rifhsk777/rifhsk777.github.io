const CORS_ORIGINS = [
"https://rifhsk777.github.io",
"https://rifhskboy.github.io"
];

function response(data, status = 200, origin = "*") {
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
const corsOrigin = CORS_ORIGINS.includes(origin)
? origin
: CORS_ORIGINS[0];

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

if (url.pathname === "/api/health" && request.method === "GET") {
  if (!env.DB) {
    return response({
      success: false,
      error: "Binding D1 DB belum dipasang pada Worker."
    }, 500, corsOrigin);
  }

  try {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all();

    return response({
      success: true,
      database: "connected",
      tables: (result.results || []).map(row => row.name)
    }, 200, corsOrigin);
  } catch (error) {
    return response({
      success: false,
      error: "D1 tidak dapat dibaca."
    }, 500, corsOrigin);
  }
}

if (url.pathname === "/api/orders/recent" && request.method === "GET") {
  if (!env.DB) {
    return response({
      success: false,
      error: "Binding D1 DB belum dipasang."
    }, 500, corsOrigin);
  }

  try {
    const result = await env.DB.prepare(`
      SELECT order_id, service, quantity, total, status, created_at
      FROM rank_vs_bot_orders
      ORDER BY created_at DESC
      LIMIT 8
    `).all();

    return response({
      success: true,
      orders: result.results || []
    }, 200, corsOrigin);
  } catch (error) {
    return response({
      success: false,
      error: "Tabel rank_vs_bot_orders tidak ditemukan atau strukturnya berbeda."
    }, 500, corsOrigin);
  }
}

if (url.pathname === "/api/orders" && request.method === "POST") {
  if (!CORS_ORIGINS.includes(origin)) {
    return response({
      success: false,
      error: "Origin tidak diizinkan."
    }, 403, corsOrigin);
  }

  if (!env.DB) {
    return response({
      success: false,
      error: "Binding D1 DB belum dipasang."
    }, 500, corsOrigin);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return response({
      success: false,
      error: "Data pesanan tidak valid."
    }, 400, corsOrigin);
  }

  const nickname = String(body.nickname || "").trim();
  const gameId = String(body.game_id || "").trim();
  const service = String(body.service || "").trim().toUpperCase();
  const quantity = Number(body.quantity);
  const schedule = String(body.schedule || "").trim().toUpperCase();
  const notes = String(body.notes || "").trim().slice(0, 500);

  if (!nickname || !gameId) {
    return response({
      success: false,
      error: "Nickname dan ID Game wajib diisi."
    }, 400, corsOrigin);
  }

  if (!["FLEXIBLE", "NO FLEXIBLE"].includes(service)) {
    return response({
      success: false,
      error: "Pilihan layanan tidak valid."
    }, 400, corsOrigin);
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return response({
      success: false,
      error: "Jumlah match harus 1 sampai 10."
    }, 400, corsOrigin);
  }

  if (!["SEKARANG", "PAGI", "SIANG", "MALAM"].includes(schedule)) {
    return response({
      success: false,
      error: "Jadwal tidak valid."
    }, 400, corsOrigin);
  }

  const total = quantity * (
    service === "FLEXIBLE" ? 2500 : 3500
  );

  const orderId = crypto.randomUUID();

  try {
    await env.DB.prepare(`
      INSERT INTO rank_vs_bot_orders (
        order_id, nickname, game_id, service, quantity,
        schedule, notes, total, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      nickname,
      gameId,
      service,
      quantity,
      schedule,
      notes,
      total,
      "MENUNGGU"
    ).run();

    return response({
      success: true,
      order_id: orderId,
      total,
      message: "Pesanan berhasil disimpan."
    }, 201, corsOrigin);
  } catch (error) {
    return response({
      success: false,
      error: "Pesanan gagal disimpan. Periksa struktur tabel D1."
    }, 500, corsOrigin);
  }
}

return response({
  success: false,
  error: "Endpoint tidak ditemukan."
}, 404, corsOrigin);

}
};
