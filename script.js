/* =========================================================
   DATA
   ========================================================= */
const PRODUCTS = [
  {id:1,  name:'Cheat Point Blank',      cat:'FPS',           price:25000, stock:42,  icon:'🎯', popular:true},
  {id:2,  name:'Cheat Free Fire',        cat:'Battle Royale', price:30000, stock:31,  icon:'🔥', popular:true},
  {id:3,  name:'Cheat Mobile Legends',   cat:'MOBA',          price:35000, stock:27,  icon:'⚔️', popular:true},
  {id:4,  name:'Cheat PUBG Mobile',      cat:'Battle Royale', price:40000, stock:19,  icon:'🪂'},
  {id:5,  name:'Cheat COD Mobile',       cat:'FPS',           price:30000, stock:23,  icon:'🔫'},
  {id:6,  name:'Cheat Valorant',         cat:'FPS',           price:45000, stock:12,  icon:'🎮'},
  {id:7,  name:'Cheat Genshin Impact',   cat:'RPG',           price:50000, stock:8,   icon:'🌌'},
  {id:8,  name:'Cheat Roblox',           cat:'Sandbox',       price:20000, stock:55,  icon:'🧱'},
  {id:9,  name:'Cheat Apex Legends',     cat:'FPS',           price:45000, stock:0,   icon:'🚀'},
  {id:10, name:'Cheat Dota 2',           cat:'MOBA',          price:40000, stock:15,  icon:'🛡️'},
  {id:11, name:'Cheat CS2',              cat:'FPS',           price:50000, stock:9,   icon:'💥'},
  {id:12, name:'Cheat Among Us',         cat:'Casual',        price:15000, stock:64,  icon:'👽'},
  {id:13, name:'Panel Reseller',         cat:'Tools',         price:75000, stock:6,   icon:'🧰', popular:true},
  {id:14, name:'Aplikasi Injector',      cat:'Tools',         price:25000, stock:38,  icon:'💉'},
  {id:15, name:'VPN Premium',            cat:'Aplikasi',      price:20000, stock:99,  icon:'🌐'},
  {id:16, name:'Auto Script ML',         cat:'Tools',         price:30000, stock:21,  icon:'📜'},
  {id:17, name:'Cheat Dragon Nest',      cat:'MMORPG',        price:35000, stock:0,   icon:'🐉'},
  {id:18, name:'Cheat Lost Light',       cat:'FPS',           price:40000, stock:11,  icon:'🔦'}
];

const DURATIONS = [
  {id:'1d',  label:'1 Hari',  mult:1},
  {id:'3d',  label:'3 Hari',  mult:2.5},
  {id:'7d',  label:'7 Hari',  mult:5},
  {id:'30d', label:'30 Hari', mult:15}
];

const LS_ORDERS = 'dgstore_orders_v1';
const LS_HWID   = 'dgstore_hwid_v1';
const PAY_WINDOW_MS = 15 * 60 * 1000;

let orders = [];
let checkoutState = { productId:null, durationId:'1d' };
let currentOrderId = null;
let payTimerInterval = null;
let activeFilter = 'all';

/* =========================================================
   UTIL
   ========================================================= */
function rupiah(n){ return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function $(id){ return document.getElementById(id); }
function pad(n){ return String(n).padStart(2,'0'); }

function genOrderId(){
  const t = Date.now().toString(36).toUpperCase().slice(-4);
  const r = Math.random().toString(36).slice(2,6).toUpperCase();
  return 'TRX-WEB-' + t + r;
}
function genLicense(){
  const seg = () => Math.random().toString(36).slice(2,6).toUpperCase().replace(/[^A-Z0-9]/g,'X').padEnd(4,'X');
  return `DG-${seg()}-${seg()}-${seg()}`;
}

function toast(msg, type='info'){
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('toastWrap').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(40px)'; el.style.transition='.3s'; }, 3200);
  setTimeout(()=> el.remove(), 3600);
}

function saveOrders(){ localStorage.setItem(LS_ORDERS, JSON.stringify(orders)); }
function loadOrders(){
  try{ orders = JSON.parse(localStorage.getItem(LS_ORDERS) || '[]'); }
  catch(e){ orders = []; }
  if(!Array.isArray(orders)) orders = [];
}
function getOrder(id){ return orders.find(o => o.id === id); }
function statusLabel(s){
  return s === 'paid' ? 'Lunas' : s === 'expired' ? 'Batal' : 'Menunggu';
}

/* =========================================================
   RENDER PRODUK
   ========================================================= */
function renderFilters(){
  const cats = ['all', ...new Set(PRODUCTS.map(p => p.cat))];
  $('filters').innerHTML = cats.map(c => `
    <button class="chip ${c === activeFilter ? 'active' : ''}" onclick="setFilter('${c}')">
      ${c === 'all' ? 'Semua Produk' : c}
    </button>
  `).join('');
}

function setFilter(cat){
  activeFilter = cat;
  renderFilters();
  renderProducts();
}

function renderProducts(){
  const list = activeFilter === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.cat === activeFilter);
  $('productCount').textContent = '(' + PRODUCTS.length + ')';
  $('productGrid').innerHTML = list.map(p => `
    <article class="product-card ${p.stock === 0 ? 'out' : ''}">
      ${p.popular ? '<span class="badge-pop">🔥 Populer</span>' : ''}
      <div class="p-icon">${p.icon}</div>
      <div class="p-cat">${p.cat}</div>
      <h3>${p.name}</h3>
      <div class="p-meta">
        <span class="p-price">${rupiah(p.price)}<small> /1 hari</small></span>
        <span class="p-stock ${p.stock === 0 ? 'empty' : ''}">${p.stock === 0 ? 'Stok Habis' : 'Stok: ' + p.stock}</span>
      </div>
      <button class="btn btn-primary btn-block btn-sm" ${p.stock === 0 ? 'disabled' : ''} onclick="openCheckout(${p.id})">
        ${p.stock === 0 ? 'Stok Habis' : 'Beli Sekarang'}
      </button>
    </article>
  `).join('');
}

/* =========================================================
   CHECKOUT
   ========================================================= */
function openCheckout(productId){
  const p = PRODUCTS.find(x => x.id === productId);
  if(!p || p.stock === 0){ toast('Stok produk sedang habis', 'error'); return; }
  checkoutState = { productId: p.id, durationId: '1d' };

  $('coIcon').textContent = p.icon;
  $('coProduct').textContent = p.name;
  $('coCat').textContent = p.cat + ' • Stok tersedia: ' + p.stock;

  renderDurations();
  openModal('checkoutModal');
}

function renderDurations(){
  const p = PRODUCTS.find(x => x.id === checkoutState.productId);
  $('durationGrid').innerHTML = DURATIONS.map(d => {
    const total = Math.round(p.price * d.mult / 500) * 500;
    return `
      <button class="dur-btn ${d.id === checkoutState.durationId ? 'active' : ''}" onclick="selectDuration('${d.id}')">
        ${d.label}
        <small>${rupiah(total)}</small>
      </button>`;
  }).join('');
  updateCheckoutTotal();
}

function selectDuration(id){
  checkoutState.durationId = id;
  renderDurations();
}

function updateCheckoutTotal(){
  const p = PRODUCTS.find(x => x.id === checkoutState.productId);
  const d = DURATIONS.find(x => x.id === checkoutState.durationId);
  const total = Math.round(p.price * d.mult / 500) * 500;
  $('coTotal').textContent = rupiah(total);
  return total;
}

function submitCheckout(){
  const p = PRODUCTS.find(x => x.id === checkoutState.productId);
  const d = DURATIONS.find(x => x.id === checkoutState.durationId);
  const name = $('coName').value.trim();
  const email = $('coEmail').value.trim();

  if(!name){ toast('Nama pembeli wajib diisi', 'error'); $('coName').focus(); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Format email tidak valid', 'error'); $('coEmail').focus(); return; }

  const total = Math.round(p.price * d.mult / 500) * 500;
  const now = Date.now();

  const order = {
    id: genOrderId(),
    productId: p.id,
    productName: p.name,
    icon: p.icon,
    duration: d.label,
    price: p.price,
    total: total,
    name: name,
    email: email,
    status: 'pending',
    licenseKey: null,
    createdAt: now,
    expiresAt: now + PAY_WINDOW_MS,
    paidAt: null
  };

  orders.unshift(order);
  saveOrders();
  renderHistory();

  closeModal('checkoutModal');
  showPayment(order.id);
}

/* =========================================================
   PAYMENT MODAL
   ========================================================= */
function showPayment(orderId){
  const o = getOrder(orderId);
  if(!o){ toast('Pesanan tidak ditemukan', 'error'); return; }
  currentOrderId = orderId;
  clearInterval(payTimerInterval);

  if(o.status === 'pending' && Date.now() > o.expiresAt){
    o.status = 'expired';
    saveOrders();
    renderHistory();
  }

  openModal('paymentModal');

  if(o.status === 'paid') showPaySuccess(o);
  else if(o.status === 'expired') showPayExpired(o);
  else showPayPending(o);
}

function showPayPending(o){
  $('payPending').classList.remove('hidden');
  $('paySuccess').classList.add('hidden');
  $('payExpired').classList.add('hidden');

  $('payTotal').textContent = rupiah(o.total);
  $('payOrderId').textContent = o.id;

  setTimeout(() => {
    const qrData = `QRIS.DEMO.DGSTORE|${o.id}|${o.total}|${o.email}`;
    const el = $('qrcode');
    el.innerHTML = '';
    if(window.QRCode){
      new QRCode(el, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      el.innerHTML = '<div style="background:#fff;color:#000;padding:16px;font-size:10px;word-break:break-all;max-width:200px;text-align:center">' + qrData + '</div>';
    }
  }, 60);

  const tick = () => {
    const order = getOrder(o.id);
    if(!order) return;
    const left = order.expiresAt - Date.now();
    if(left <= 0){
      clearInterval(payTimerInterval);
      order.status = 'expired';
      saveOrders();
      renderHistory();
      showPayExpired(order);
      toast('Waktu pembayaran habis, transaksi dibatalkan', 'error');
      return;
    }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    const t = $('payTimer');
    if(t) t.textContent = pad(m) + ':' + pad(s);
  };
  tick();
  payTimerInterval = setInterval(tick, 1000);
}

function showPaySuccess(o){
  clearInterval(payTimerInterval);
  $('payPending').classList.add('hidden');
  $('payExpired').classList.add('hidden');
  $('paySuccess').classList.remove('hidden');

  $('licenseKey').textContent = o.licenseKey || '-';
  $('sucProduct').textContent = o.productName;
  $('sucDuration').textContent = o.duration;
  $('sucEmail').textContent = o.email;
  $('sucOrderId').textContent = o.id;
}

function showPayExpired(o){
  clearInterval(payTimerInterval);
  $('payPending').classList.add('hidden');
  $('paySuccess').classList.add('hidden');
  $('payExpired').classList.remove('hidden');

  $('expProduct').textContent = o.productName || '-';
  $('expDuration').textContent = o.duration || '-';
  $('expOrderId').textContent = o.id || '-';
}

function simulatePay(){
  const o = getOrder(currentOrderId);
  if(!o) return;
  if(o.status !== 'pending'){ toast('Pesanan ini sudah diproses', 'error'); return; }

  o.status = 'paid';
  o.paidAt = Date.now();
  o.licenseKey = genLicense();
  saveOrders();
  clearInterval(payTimerInterval);

  showPaySuccess(o);
  renderHistory();
  toast('Pembayaran berhasil! Lisensi terkirim.', 'success');
}

function copyLicense(){
  const key = $('licenseKey').textContent;
  if(!key || key === '-') return;
  navigator.clipboard.writeText(key)
    .then(() => toast('Kode lisensi disalin ke clipboard', 'success'))
    .catch(() => toast('Gagal menyalin, salin manual ya', 'error'));
}

function closePayment(){
  clearInterval(payTimerInterval);
  closeModal('paymentModal');
}

/* =========================================================
   MODAL HELPERS
   ========================================================= */
function openModal(id){ $(id).classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeModal(id){
  $(id).classList.remove('show');
  document.body.style.overflow = '';
}
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => {
    if(e.target === ov) closeModal(ov.id);
  });
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    document.querySelectorAll('.modal-overlay.show').forEach(ov => closeModal(ov.id));
  }
});

/* =========================================================
   RIWAYAT
   ========================================================= */
function renderHistory(){
  const wrap = $('historyList');
  $('orderCount').textContent = orders.length;

  if(!orders.length){
    wrap.innerHTML = `
      <div class="empty-state">
        <span class="e-icon">🗂️</span>
        Belum ada riwayat pesanan yang tersimpan.<br>
        Setiap pesanan atau pencarian invoice Anda akan otomatis muncul di sini secara instan.
      </div>`;
    return;
  }

  wrap.innerHTML = orders.map(o => `
    <div class="history-item" onclick="openOrderDetail('${o.id}')">
      <div class="hi-icon">${o.icon || '🎮'}</div>
      <div class="hi-main">
        <strong>${o.productName}</strong>
        <span>${o.duration} • ${o.id}</span>
      </div>
      <div class="hi-right">
        <span class="status ${o.status}">${statusLabel(o.status)}</span>
        <span class="hi-total">${rupiah(o.total)}</span>
      </div>
    </div>
  `).join('');
}

function openOrderDetail(id){
  const o = getOrder(id);
  if(!o){ toast('Pesanan tidak ditemukan', 'error'); return; }
  showPayment(id);
}

function clearHistory(){
  if(!orders.length){ toast('Riwayat sudah kosong', 'info'); return; }
  if(!confirm('Hapus semua riwayat pesanan di perangkat ini?')) return;
  orders = [];
  saveOrders();
  renderHistory();
  toast('Riwayat pesanan dihapus', 'success');
}

/* =========================================================
   TRACKING
   ========================================================= */
function trackOrder(){
  const q = $('trackInput').value.trim().toUpperCase();
  if(!q){ toast('Masukkan ID pesanan terlebih dahulu', 'error'); $('trackInput').focus(); return; }

  const o = orders.find(x => x.id.toUpperCase() === q);
  if(!o){
    toast('Pesanan dengan ID tersebut tidak ditemukan', 'error');
    return;
  }
  showPayment(o.id);
}

/* =========================================================
   RESET HWID
   ========================================================= */
function resetHWID(){
  const input = $('hwidInput');
  const key = input.value.trim().toUpperCase();
  const box = $('hwidResult');
  box.className = 'result-box show';

  const KEY_RE = /^DG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  const isDemo = key === 'DG-DEMO-1234-5678';

  if(!key){ box.classList.add('err'); box.textContent = '❌ Kode lisensi wajib diisi.'; return; }
  if(!KEY_RE && !isDemo){
    box.classList.add('err');
    box.textContent = '❌ Format kode lisensi tidak valid. Contoh: DG-A1B2-C3D4-E5F6';
    return;
  }

  const paidOrder = orders.find(o => o.licenseKey === key && o.status === 'paid');
  if(!paidOrder && !isDemo){
    box.classList.add('err');
    box.textContent = '❌ Kode lisensi tidak ditemukan atau belum lunas.';
    return;
  }

  let store = {};
  try{ store = JSON.parse(localStorage.getItem(LS_HWID) || '{}'); }catch(e){ store = {}; }
  const today = new Date().toDateString();
  let rec = store[key];
  if(!rec || rec.date !== today) rec = { date: today, count: 0 };

  if(rec.count >= 5){
    box.classList.add('err');
    box.textContent = '❌ Kuota reset habis (maksimal 5x per 24 jam). Coba lagi besok.';
    return;
  }

  rec.count++;
  store[key] = rec;
  localStorage.setItem(LS_HWID, JSON.stringify(store));

  const sisa = 5 - rec.count;
  box.classList.remove('err');
  box.classList.add('ok');
  box.innerHTML = `✅ <strong>Reset HWID berhasil!</strong><br>
    Kode <strong>${key}</strong> kini bisa digunakan di perangkat baru.<br>
    Sisa kuota reset hari ini: <strong>${sisa}x</strong>.`;

  input.value = '';
  toast('Reset HWID berhasil', 'success');
}

/* =========================================================
   NAV & INIT
   ========================================================= */
function initNav(){
  const burger = $('burger');
  const links = $('navLinks');
  burger.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
}

function expireOldOrders(){
  let changed = false;
  orders.forEach(o => {
    if(o.status === 'pending' && Date.now() > o.expiresAt){
      o.status = 'expired';
      changed = true;
    }
  });
  if(changed) saveOrders();
}

function init(){
  $('year').textContent = new Date().getFullYear();
  loadOrders();
  expireOldOrders();
  renderFilters();
  renderProducts();
  renderHistory();
  initNav();
  window.addEventListener('storage', e => {
    if(e.key === LS_ORDERS){ loadOrders(); renderHistory(); }
  });
}

document.addEventListener('DOMContentLoaded', init);
