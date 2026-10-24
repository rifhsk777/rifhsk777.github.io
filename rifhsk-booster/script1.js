const ADMIN_PASSWORD = 'rifhskgantengbanget22';
const WA_ADMIN = '6285725209623';
const STORAGE_KEY = 'rankbooster_orders_v1';
const PRICES = { flexible: 2000, noflexible: 3000 };
const PKG_LABEL = { flexible: 'Flexible', noflexible: 'No Flexible' };
const MAX_ORDERS = 7;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MATCH = 5;

const $ = id => document.getElementById(id);
const fmtRp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(m, t) {
  const e = $('toast');
  if(!e) return;
  e.textContent = m;
  e.className = 'toast show' + (t ? ' ' + t : '');
  clearTimeout(e._t);
  e._t = setTimeout(() => e.className = 'toast', 3200);
}

function maskName(name) {
  if(!name) return '***';
  const n = String(name).trim();
  if(!n) return '***';
  if(n.length === 1) return n.toUpperCase();
  return n.charAt(0).toUpperCase() + '***';
}

function getOrders() {
  try {
    let list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const now = Date.now();
    list = list.filter(o => (now - new Date(o.createdAt).getTime()) < WEEK_MS);
    list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    if(list.length > MAX_ORDERS) list = list.slice(0, MAX_ORDERS);
    return list;
  } catch(e) { return []; }
}

function saveOrders(list) {
  list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  if(list.length > MAX_ORDERS) list = list.slice(0, MAX_ORDERS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function statusLabel(s) {
  return { pending:'Pending', confirmed:'Diproses', done:'Selesai', rejected:'Ditolak' }[s] || s;
}

function updateClock() {
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  const el = $('clock-time');
  if(el) el.textContent = p(now.getHours()) + ':' + p(now.getMinutes()) + ':' + p(now.getSeconds());
}
setInterval(updateClock, 1000);
updateClock();

(function() {
  const c = $('snow-canvas');
  if(!c) return;
  const x = c.getContext('2d');
  let W, H, F = [];
  const COUNT = () => Math.min(140, Math.floor(innerWidth / 12));
  const resize = () => { W = c.width = innerWidth; H = c.height = innerHeight; };
  const mk = () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*2.4+0.6, d: Math.random()+0.4, dr: Math.random()*.6-.3, o: Math.random()*.5+.3 });
  resize();
  F = Array.from({length: COUNT()}, mk);
  function loop() {
    x.clearRect(0, 0, W, H);
    for(const f of F) {
      x.beginPath();
      x.fillStyle = `rgba(200,240,255,${f.o})`;
      x.shadowBlur = 6;
      x.shadowColor = 'rgba(0,229,255,.5)';
      x.arc(f.x, f.y, f.r, 0, Math.PI*2);
      x.fill();
      f.y += f.d;
      f.x += f.dr + Math.sin(f.y*.01)*.3;
      if(f.y > H+5) { f.y = -5; f.x = Math.random()*W; }
      if(f.x > W+5) f.x = -5;
      if(f.x < -5) f.x = W+5;
    }
    x.shadowBlur = 0;
    requestAnimationFrame(loop);
  }
  loop();
  addEventListener('resize', () => { resize(); F = Array.from({length: COUNT()}, mk); });
})();

function openCheck() {
  $('check-modal').classList.add('active');
  $('check-result').innerHTML = '';
  $('check-id').value = '';
  setTimeout(() => $('check-id').focus(), 100);
}
function closeCheck() { $('check-modal').classList.remove('active'); }
function checkStatus() {
  const id = $('check-id').value.trim().toUpperCase();
  if(!id) { toast('Masukkan Order ID', 'error'); return; }
  const orders = getOrders();
  const order = orders.find(o => o.id.toUpperCase() === id);
  if(!order) {
    $('check-result').innerHTML = '<div style="color:var(--accent);padding:12px;text-align:center;background:rgba(255,45,117,.08);border:1px solid rgba(255,45,117,.3);border-radius:10px;font-size:13px">❌ Order tidak ditemukan.</div>';
    return;
  }
  $('check-result').innerHTML = '<div style="background:rgba(6,10,18,.7);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:left;font-size:13px"><div style="display:flex;justify-content:space-between;padding:5px 0;gap:10px"><span style="color:var(--muted)">Order ID</span><b style="color:var(--primary)">' + esc(order.id) + '</b></div><div style="display:flex;justify-content:space-between;padding:5px 0;gap:10px"><span style="color:var(--muted)">Nickname</span><b>' + esc(order.nickname) + '</b></div><div style="display:flex;justify-content:space-between;padding:5px 0;gap:10px"><span style="color:var(--muted)">Paket</span><b>' + esc(PKG_LABEL[order.pkg]) + '</b></div><div style="display:flex;justify-content:space-between;padding:5px 0;gap:10px"><span style="color:var(--muted)">Match</span><b>' + order.matches + '</b></div><div style="display:flex;justify-content:space-between;padding:5px 0;gap:10px"><span style="color:var(--muted)">Jadwal</span><b>' + esc(order.schedule) + '</b></div><div style="display:flex;justify-content:space-between;padding:5px 0;gap:10px"><span style="color:var(--muted)">Total</span><b style="color:var(--green)">' + fmtRp(order.total) + '</b></div><div style="display:flex;justify-content:space-between;padding:5px 0;align-items:center;gap:10px"><span style="color:var(--muted)">Status</span><span class="feed-status st-' + order.status + '">' + statusLabel(order.status) + '</span></div></div>';
}

let currentOrder = null;
function showPayment(o) {
  if(!o) { toast('Belum ada order aktif.', 'error'); return; }
  currentOrder = o;
  $('pm-id').textContent = o.id;
  $('pm-nick').textContent = o.nickname;
  $('pm-match').textContent = o.matches + ' match';
  $('pm-total').textContent = fmtRp(o.total);
  $('copy-note').textContent = '';
  $('payment-modal').classList.add('active');
}
function closePayment() {
  $('payment-modal').classList.remove('active');
  if(currentOrder) $('fab-pay').classList.add('show');
}
function copyNominal() {
  if(!currentOrder) return;
  const t = String(currentOrder.total);
  const ok = () => {
    $('copy-note').style.color = 'var(--green)';
    $('copy-note').textContent = '✓ Nominal ' + fmtRp(currentOrder.total) + ' berhasil disalin!';
    setTimeout(() => { $('copy-note').textContent = ''; }, 2500);
  };
  if(navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(ok).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); ok();
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); ok();
  }
}
function downloadQRIS() {
  const a = document.createElement('a');
  a.href = 'qris.jpg';
  a.download = 'QRIS-RIFHSK-BOOSTER.jpg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  $('copy-note').style.color = 'var(--primary)';
  $('copy-note').textContent = '⬇ Mengunduh gambar QRIS...';
  setTimeout(() => { $('copy-note').textContent = ''; }, 2000);
}
function confirmToWA() {
  if(!currentOrder) { toast('Tidak ada order aktif', 'error'); return; }
  const o = currentOrder;
  const msg = 'Halo Admin RIFHSK BOOSTER! 🎮\nSaya sudah melakukan pembayaran via QRIS.\n\n*Order ID:* ' + o.id + '\n*Nickname:* ' + o.nickname + '\n*ID Server:* ' + o.server + '\n*Paket:* ' + PKG_LABEL[o.pkg] + '\n*Jumlah Match:* ' + o.matches + '\n*Jadwal Main:* ' + o.schedule + '\n*Total:* ' + fmtRp(o.total) + '\n*No. WA:* ' + o.wa + '\n\nMohon konfirmasi pembayaran saya. Terima kasih!';
  window.open('https://wa.me/' + WA_ADMIN + '?text=' + encodeURIComponent(msg), '_blank');
  $('fab-pay').classList.remove('show');
  closePayment();
  toast('Mengarahkan ke WhatsApp admin...', 'success');
}

const form = $('order-form');
const mi = $('f-matches');
const td = $('total-display');
const curPkg = () => {
  const el = document.querySelector('input[name="pkg"]:checked');
  return el ? el.value : 'flexible';
};
const updT = () => {
  const m = Math.max(1, parseInt(mi.value) || 0);
  td.textContent = fmtRp(m * PRICES[curPkg()]);
};
if(mi) mi.addEventListener('input', updT);
document.querySelectorAll('input[name="pkg"]').forEach(r => r.addEventListener('change', updT));

function selectPackage(p) {
  const el = document.querySelector('input[name="pkg"][value="' + p + '"]');
  if(el) { el.checked = true; updT(); }
  const o = $('order');
  if(o) o.scrollIntoView({ behavior: 'smooth' });
}

if(form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const n = $('f-nickname').value.trim();
    const s = $('f-server').value.trim();
    const m = parseInt(mi.value) || 0;
    const sc = $('f-schedule').value;
    const w = $('f-wa').value.trim();
    const p = curPkg();
    if(!n || !s || !m || !sc || !w) { toast('Lengkapi semua data!', 'error'); return; }
    if(m < 1) { toast('Minimal 1 match', 'error'); return; }
    if(m > MAX_MATCH) { toast('Maksimal ' + MAX_MATCH + ' match per order!', 'error'); return; }
    const tot = m * PRICES[p];
    const o = {
      id: 'RB' + Date.now().toString(36).toUpperCase().slice(-6),
      nickname: n, server: s, matches: m, schedule: sc, wa: w,
      pkg: p, total: tot, status: 'pending',
      createdAt: new Date().toISOString()
    };
    const l = getOrders();
    l.unshift(o);
    saveOrders(l);
    renderFeed();
    renderStats();
    if($('admin-panel').classList.contains('active')) renderAdmin();
    form.reset();
    mi.value = 5;
    updT();
    toast('Order dibuat! Lanjut ke pembayaran...', 'success');
    showPayment(o);
  });
  }
