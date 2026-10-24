const SITE_ORIGIN = "https://rifhskboy.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
function cors(request) { const origin = request.headers.get("Origin"); if (origin && origin !== SITE_ORIGIN) return new Response("Origin not allowed", { status: 403 }); return null; }
export default {
 async fetch(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const blocked = cors(request); if (blocked) return blocked;
  const url = new URL(request.url);
  if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, service: "rank-vs-bot-api" });
  if (url.pathname === "/api/orders/recent" && request.method === "GET") {
   try {
    const result = await env.DB.prepare(`SELECT order_id, service, quantity, created_at FROM rank_vs_bot_orders WHERE created_at >= datetime('now','-7 days') ORDER BY id DESC LIMIT 8`).all();
    return json({ orders: result.results || [] });
   } catch (e) { return json({ error: "Database belum siap atau tabel belum dibuat." }, 500); }
  }
  if (url.pathname === "/api/orders" && request.method === "POST") {
   let body; try { body = await request.json(); } catch { return json({ error: "Format data tidak valid." }, 400); }
   const nickname = String(body.nickname || "").trim().slice(0,40);
   const gameId = String(body.game_id || "").trim().slice(0,40);
   const service = String(body.service || "").trim();
   const quantity = Number(body.quantity);
   const schedule = String(body.schedule || "").trim();
   const notes = String(body.notes || "").trim().slice(0,300);
   if (!nickname || !gameId) return json({ error: "Nickname dan ID game wajib diisi." }, 400);
   if (!["FLEXIBLE", "NO FLEXIBLE"].includes(service)) return json({ error: "Layanan tidak valid." }, 400);
   if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return json({ error: "Jumlah match harus 1 sampai 10." }, 400);
   if (!["SEKARANG", "PAGI", "SIANG", "MALAM"].includes(schedule)) return json({ error: "Jadwal tidak valid." }, 400);
   const total = quantity * (service === "FLEXIBLE" ? 2500 : 3500);
   const orderId = "RVB-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0,5).toUpperCase();
   try {
    await env.DB.prepare(`INSERT INTO rank_vs_bot_orders (order_id,nickname,game_id,service,quantity,schedule,notes,total,status) VALUES (?,?,?,?,?,?,?,?,?)`).bind(orderId,nickname,gameId,service,quantity,schedule,notes,total,"MENUNGGU_PEMBAYARAN").run();
    return json({ ok: true, order_id: orderId, total }, 201);
   } catch (e) { return json({ error: "Pesanan tidak berhasil disimpan. Periksa konfigurasi database." }, 500); }
  }
  return json({ error: "Endpoint tidak ditemukan." }, 404);
 }
};
