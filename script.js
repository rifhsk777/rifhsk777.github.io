/* =========================================================
   KONFIGURASI (OPSIONAL)
   ========================================================= */
const CONFIG = {
  // Masukkan Discord Webhook URL di sini agar Anda dapat notifikasi kode lisensi apa yang diambil pembeli
  // Biarkan kosong "" jika tidak butuh.
  DISCORD_WEBHOOK_URL: "", 
};

/* =========================================================
   DATA PRODUK
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

const LS_ORDERS = 'rfstore_orders_v1';
let orders = [];
let checkoutState = { productId:null, durationId:'1d' };
let currentOrderId = null;
let activeFilter = 'all';

/* =========================================================
   UTIL
   ========================================================= */
function rupiah(n){ return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function $(id){ return document.getElementById(id); }

function genOrderId(){
  const t = Date.now().toString(36).toUpperCase().slice(-4);
  const r = Math.random().toString(36).slice(2,6).toUpperCase();
  return 'TRX-WEB-' + t + r;
}

function genLicense(){
  const seg = () => Math.random().toString(36).slice(2,6).toUpperCase().replace(/[^A-Z0-9]/g,'X').padEnd(4,'X');
  return `RF-${seg()}-${seg()}-${seg()}`;
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
function statusLabel(s){ return s === 'paid' ? 'Lunas' : 'Menunggu'; }

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
   CHECKOUT & PAYMENT (AUTO DELIVERY)
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
        ${d.label}<small>${rupiah(total)}</small>
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
  const contact = $('coContact').value.trim();

  if(!name){ toast('Nama wajib diisi', 'error'); $('coName').focus(); return; }
  if(!contact){ toast('Email/No. WA wajib diisi', 'error'); $('coContact').focus(); return; }

  const total = Math.round(p.price * d.mult / 500) * 500;
  
  const order = {
    id: genOrderId(), productId: p.id, productName: p.name, icon: p.icon,
    duration: d.label, price: p.price, total: total, name: name, email: contact,
    status: 'pending', licenseKey: null, createdAt: Date.now()
  };

  orders.unshift(order);
  saveOrders();
  renderHistory();

  closeModal('checkoutModal');
  showPayment(order.id);
}

function showPayment(orderId){
  const o = getOrder(orderId);
  if(!o){ toast('Pesanan tidak ditemukan', 'error'); return; }
  currentOrderId = orderId;

  openModal('paymentModal');

  // Reset tampilan ke awal (QRIS)
  $('payPending').classList.remove('hidden');
  $('payLoading').classList.add('hidden');
  $('paySuccess').classList.add('hidden');
  
  $('payTotal').textContent = rupiah(o.total);
  $('payOrderId').textContent = o.id;
}

// PROSES UTAMA: Verifikasi & Kirim Kode Otomatis
function processPayment(){
  const o = getOrder(currentOrderId);
  if(!o) return;

  // 1. Sembunyikan QRIS, Tampilkan Loading
  $('payPending').classList.add('hidden');
  $('payLoading').classList.remove('hidden');

  // 2. Simulasi Loading (3 detik seolah mengecek bank)
  setTimeout(() => {
    // 3. Generate Kode Lisensi
    o.status = 'paid';
    o.licenseKey = genLicense();
    saveOrders();
    renderHistory();

    // 4. Kirim notifikasi ke Discord (Jika diisi)
    sendDiscordWebhook(o);

    // 5. Tampilkan layar sukses & kode
    $('payLoading').classList.add('hidden');
    $('paySuccess').classList.remove('hidden');
    
    $('licenseKey').textContent = o.licenseKey;
    $('sucProduct').textContent = o.productName;
    $('sucDuration').textContent = o.duration;
    $('sucEmail').textContent = o.email;

  }, 3000); // 3000 ms = 3 detik loading
}

function copyLicense(){
  navigator.clipboard.writeText($('licenseKey').textContent)
    .then(() => toast('Lisensi berhasil disalin!', 'success'));
}

function closePayment(){ closeModal('paymentModal'); }

// Fungsi Discord Webhook (Agar Anda tahu kode apa yang diambil pembeli)
function sendDiscordWebhook(order) {
  if(!CONFIG.DISCORD_WEBHOOK_URL) return;

  const payload = {
    username: "RFSTORE BOT",
    embeds: [{
      title: "🛒 PESANAN BARU (AUTO-DELIVER)",
      color: 10181046,
      fields: [
        { name: "Order ID", value: order.id, inline: true },
        { name: "Produk", value: order.productName, inline: true },
        { name: "Total", value: rupiah(order.total), inline: true },
        { name: "Pembeli", value: order.name, inline: true },
        { name: "Kontak", value: order.email, inline: true },
        { name: "KODE LISENSI", value: order.licenseKey, inline: false }
      ],
      footer: { text: "RFSTORE System" },
      timestamp: new Date().toISOString()
    }]
  };

  fetch(CONFIG.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(err => console.log("Gagal kirim webhook", err));
}

/* =========================================================
   HELPER MODALS, HISTORY, TRACKING
   ========================================================= */
function openModal(id){ $(id).classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeModal(id){ $(id).classList.remove('show'); document.body.style.overflow = ''; }
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if(e.target === ov) closeModal(ov.id); });
});

function renderHistory(){
  const wrap = $('historyList');
  if(!orders.length){
    wrap.innerHTML = `<div class="empty-state">Belum ada riwayat pesanan.</div>`;
    return;
  }
  wrap.innerHTML = orders.map(o => `
    <div class="history-item" onclick="showPayment('${o.id}')">
      <div class="hi-icon">${o.icon}</div>
      <div class="hi-main">
        <strong>${o.productName}</strong><span>${o.duration} • ${o.id}</span>
      </div>
      <div class="hi-right">
        <span class="status ${o.status}">${statusLabel(o.status)}</span>
        <span class="hi-total">${rupiah(o.total)}</span>
      </div>
    </div>
  `).join('');
}

function clearHistory(){
  if(confirm('Hapus riwayat?')){ orders = []; saveOrders(); renderHistory(); }
}

function trackOrder(){
  const q = $('trackInput').value.trim().toUpperCase();
  const o = orders.find(x => x.id.toUpperCase() === q);
  if(!o){ toast('ID Pesanan tidak ditemukan', 'error'); return; }
  showPayment(o.id);
}

/* INIT */
function init(){
  $('year').textContent = new Date().getFullYear();
  loadOrders(); renderFilters(); renderProducts(); renderHistory();
  
  const burger = $('burger'); const links = $('navLinks');
  burger.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}
document.addEventListener('DOMContentLoaded', init);
