const ORIGIN = "https://rifhsk777.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8"
};
const PACKAGES = {
  flex: { name: "Flexible Match", unit: 2500, totals: {1:2500,2:5000,3:7500,4:10000,5:12500,6:15000,7:17500,8:20000,9:22500,10:25000} },
  noflex: { name: "No Flexible", unit: 3500, totals: {1:3500,2:7000,3:10500,4:14000,5:17500,6:21000,7:24500,8:28000,9:31500,10:35000} }
};
const ORDER_STATUSES = ["menunggu_konfirmasi","diproses","selesai","dibatalkan"];
const PAYMENT_STATUSES = ["belum_dibayar","menunggu_verifikasi","dibayar","dikembalikan"];
const json = (d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:CORS});
async function init(db) {
 await db.prepare(`CREATE TABLE IF NOT EXISTS rvb_orders (
 order_code TEXT PRIMARY KEY, customer_name TEXT NOT NULL, game_id TEXT NOT NULL,
 package_type TEXT NOT NULL, match_count INTEGER NOT NULL, schedule TEXT NOT NULL,
 notes TEXT DEFAULT '', unit_price INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0,
 total_price INTEGER NOT NULL, order_status TEXT NOT NULL DEFAULT 'menunggu_konfirmasi',
 payment_status TEXT NOT NULL DEFAULT 'belum_dibayar', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 )`).run();
}
async function sign(payload,secret){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
async function token(env){const exp=String(Date.now()+86400000);return exp+'.'+await sign(exp,env.ADMIN_SESSION_SECRET)}
async function auth(req,env){if(!env.ADMIN_SESSION_SECRET)return false;const t=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');const p=t.split('.');if(p.length!==2||!/^[0-9]+$/.test(p[0])||Number(p[0])<Date.now())return false;return t===p[0]+'.'+await sign(p[0],env.ADMIN_SESSION_SECRET)}
async function handle(req,env){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 const requestOrigin=req.headers.get('Origin');
 if(requestOrigin && requestOrigin!==ORIGIN)return json({error:'Origin tidak diizinkan.'},403);
 if(!env.DB)return json({error:'Binding D1 DB belum dikonfigurasi.'},500);
 const u=new URL(req.url),p=u.pathname.replace(/\/+$/,'')||'/';
 if(p==='/api/health'&&req.method==='GET')return json({success:true,service:'RANK VS BOT API'});
 if(p==='/api/login'&&req.method==='POST'){
  let b;try{b=await req.json()}catch{return json({error:'JSON login tidak valid.'},400)}
  if(!env.ADMIN_PASSWORD||!env.ADMIN_SESSION_SECRET)return json({error:'Atur secrets ADMIN_PASSWORD dan ADMIN_SESSION_SECRET di Cloudflare Worker.'},500);
  if(b.password!==env.ADMIN_PASSWORD)return json({error:'Password admin salah.'},401);
  return json({success:true,token:await token(env)});
 }
 const protectedRoute=p==='/api/stats'||(p==='/api/orders'&&req.method!=='POST');
 if(protectedRoute&&!(await auth(req,env)))return json({error:'Login admin diperlukan atau sesi sudah habis.'},401);
 try{
  await init(env.DB);
  if(p==='/api/orders'&&req.method==='POST'){
   let b;try{b=await req.json()}catch{return json({error:'JSON pesanan tidak valid.'},400)}
   const customerName=String(b.customerName||'').trim(),gameId=String(b.gameId||'').trim(),type=String(b.packageType||''),count=Number(b.matchCount),schedule=String(b.schedule||'').trim(),notes=String(b.notes||'').trim();
   if(!customerName||!gameId||!schedule)return json({error:'Nama, Game ID, dan jadwal wajib diisi.'},400);
   if(!PACKAGES[type])return json({error:'Paket tidak valid.'},400);
   if(!Number.isInteger(count)||count<1||count>10)return json({error:'Jumlah match harus 1–10.'},400);
   const pkg=PACKAGES[type],total=pkg.totals[count],discount=pkg.unit*count-total,code='RVB-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,4).toUpperCase();
   await env.DB.prepare(`INSERT INTO rvb_orders(order_code,customer_name,game_id,package_type,match_count,schedule,notes,unit_price,discount,total_price) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(code,customerName,gameId,type,count,schedule,notes,pkg.unit,discount,total).run();
   return json({success:true,order:{orderCode:code,customerName,gameId,packageType:type,packageName:pkg.name,matchCount:count,schedule,notes,unitPrice:pkg.unit,discount,totalPrice:total}},201);
  }
  if(p==='/api/orders'&&req.method==='GET'){const r=await env.DB.prepare('SELECT * FROM rvb_orders ORDER BY created_at DESC').all();return json({success:true,orders:r.results||[]})}
  if(p==='/api/stats'&&req.method==='GET'){const s=await env.DB.prepare(`SELECT COUNT(*) total_orders,COALESCE(SUM(match_count),0) total_matches,SUM(order_status='menunggu_konfirmasi') waiting_orders,SUM(order_status='diproses') processing_orders,SUM(order_status='selesai') completed_orders,SUM(order_status='dibatalkan') cancelled_orders,COALESCE(SUM(CASE WHEN payment_status='dibayar' THEN total_price ELSE 0 END),0) revenue_paid,COALESCE(SUM(CASE WHEN payment_status!='dibayar' AND order_status!='dibatalkan' THEN total_price ELSE 0 END),0) revenue_pending FROM rvb_orders`).first();return json({success:true,stats:s||{}})}
  if(p==='/api/orders'&&req.method==='PATCH'){
   let b;try{b=await req.json()}catch{return json({error:'JSON pembaruan tidak valid.'},400)}
   if(!ORDER_STATUSES.includes(b.orderStatus)||!PAYMENT_STATUSES.includes(b.paymentStatus)||!b.orderCode)return json({error:'Kode atau status tidak valid.'},400);
   const r=await env.DB.prepare('UPDATE rvb_orders SET order_status=?,payment_status=? WHERE order_code=?').bind(b.orderStatus,b.paymentStatus,b.orderCode).run();
   if(!r.meta||r.meta.changes===0)return json({error:'Pesanan tidak ditemukan.'},404);return json({success:true});
  }
  if(p==='/api/logout'&&req.method==='POST')return json({success:true});
  return json({error:'Endpoint tidak ditemukan.',path:p,method:req.method},404);
 }catch(e){console.error('API error',e);return json({error:'Kesalahan database/API.',detail:String(e?.message||e)},500)}
}
export default {async fetch(req,env){try{return await handle(req,env)}catch(e){console.error(e);return json({error:'Worker gagal memproses permintaan.',detail:String(e?.message||e)},500)}}};
