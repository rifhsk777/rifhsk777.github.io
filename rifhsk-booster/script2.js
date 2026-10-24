function renderFeed() {
  const f = $('feed');
  if(!f) return;
  // HANYA UNTUK TAMPILAN BERANDA: Ambil maksimal 7 terbaru
  const o = getOrders().slice(0, MAX_ORDERS);
  if(!o.length) { f.innerHTML = '<div class="empty-state">Belum ada order. Jadilah yang pertama! 🚀</div>'; return; }
  f.innerHTML = o.map(x => {
    const masked = maskName(x.nickname);
    return '<div class="feed-item"><div class="feed-avatar">' + esc(masked[0]) + '</div><div class="feed-body"><div class="feed-name">' + esc(masked) + '</div><div class="feed-meta">' + esc(PKG_LABEL[x.pkg]) + ' · ' + x.matches + ' match · ' + fmtRp(x.total) + ' · ' + esc(x.schedule) + '</div></div><div class="feed-status st-' + x.status + '">' + statusLabel(x.status) + '</div></div>';
  }).join('');
}

function renderStats() {
  const o = getOrders();
  if($('s-total')) $('s-total').textContent = o.length;
  if($('s-match')) $('s-match').textContent = o.filter(x => x.status === 'confirmed' || x.status === 'done').reduce((a,x) => a + x.matches, 0);
  if($('s-done')) $('s-done').textContent = o.filter(x => x.status === 'done').length;
  if($('s-customers')) $('s-customers').textContent = new Set(o.map(x => x.nickname)).size;
}

let isAdmin = false;

function setStatus(id, st) {
  const l = getOrders();
  const i = l.findIndex(o => o.id === id);
  if(i < 0) return;
  l[i].status = st;
  saveOrders(l);
  renderAdmin(); renderFeed(); renderStats();
  toast('Order ' + id + ' → ' + statusLabel(st), 'success');
}
function deleteOrder(id) {
  if(!confirm('Hapus order ' + id + '?')) return;
  saveOrders(getOrders().filter(o => o.id !== id));
  renderAdmin(); renderFeed(); renderStats();
  toast('Order ' + id + ' dihapus');
}
function doLogin() {
  const v = $('admin-pass').value, e = $('login-err');
  if(v === ADMIN_PASSWORD) {
    isAdmin = true;
    e.textContent = '';
    $('admin-pass').value = '';
    $('login-modal').classList.remove('active');
    $('admin-panel').classList.add('active');
    renderAdmin();
    toast('Berhasil masuk panel admin', 'success');
  } else {
    e.textContent = 'Kode akses salah!';
    $('admin-pass').value = '';
    $('admin-pass').focus();
  }
}
function closeLogin() { $('login-modal').classList.remove('active'); $('login-err').textContent = ''; }
function logoutAdmin() { isAdmin = false; $('admin-panel').classList.remove('active'); toast('Anda telah keluar dari panel admin'); }

function renderAdmin() {
  if(!isAdmin) return;
  const orders = getOrders(); // Tampilkan SEMUA order di panel admin
  const st = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    done: orders.filter(o => o.status === 'done').length,
    revenue: orders.filter(o => o.status === 'done').reduce((a,o) => a + o.total, 0)
  };
  $('admin-stats').innerHTML = '<div class="stat-box"><div class="num">' + st.total + '</div><div class="lbl">Total Order</div></div><div class="stat-box"><div class="num" style="color:var(--yellow)">' + st.pending + '</div><div class="lbl">Pending</div></div><div class="stat-box"><div class="num" style="color:var(--primary)">' + st.confirmed + '</div><div class="lbl">Diproses</div></div><div class="stat-box"><div class="num" style="color:var(--green)">' + st.done + '</div><div class="lbl">Selesai</div></div><div class="stat-box"><div class="num" style="color:var(--green)">' + fmtRp(st.revenue) + '</div><div class="lbl">Pendapatan</div></div>';
  const tb = $('admin-tbody');
  if(!orders.length) { tb.innerHTML = '<tr><td colspan="10"><div class="admin-empty">Belum ada order masuk.</div></td></tr>'; return; }
  tb.innerHTML = orders.map(o => {
    const a = [];
    if(o.status === 'pending') {
      a.push('<button class="mini-btn confirm" onclick="setStatus(\'' + o.id + '\',\'confirmed\')">✓ Konfirmasi</button>');
      a.push('<button class="mini-btn reject" onclick="setStatus(\'' + o.id + '\',\'rejected\')">✗ Tolak</button>');
    } else if(o.status === 'confirmed') {
      a.push('<button class="mini-btn done" onclick="setStatus(\'' + o.id + '\',\'done\')">✓ Selesaikan</button>');
      a.push('<button class="mini-btn reject" onclick="setStatus(\'' + o.id + '\',\'rejected\')">✗ Batal</button>');
    } else {
      a.push('<button class="mini-btn confirm" onclick="setStatus(\'' + o.id + '\',\'pending\')">↺ Reset</button>');
    }
    a.push('<button class="mini-btn del" onclick="deleteOrder(\'' + o.id + '\')">🗑 Hapus</button>');
    return '<tr><td><b style="color:var(--primary)">' + esc(o.id) + '</b></td><td>' + esc(o.nickname) + '</td><td>' + esc(o.server) + '</td><td>' + esc(PKG_LABEL[o.pkg]) + '</td><td>' + o.matches + '</td><td style="color:var(--green);font-weight:700">' + fmtRp(o.total) + '</td><td style="font-size:12px">' + esc(o.schedule) + '</td><td><a href="https://wa.me/' + o.wa.replace(/^0/,'62') + '" target="_blank" style="color:var(--primary)">' + esc(o.wa) + '</a></td><td><span class="feed-status st-' + o.status + '">' + statusLabel(o.status) + '</span></td><td><div class="admin-actions">' + a.join('') + '</div></td></tr>';
  }).join('');
}

document.addEventListener('keydown', function(e) {
  if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    if(isAdmin) { $('admin-panel').classList.add('active'); renderAdmin(); }
    else { $('login-modal').classList.add('active'); setTimeout(() => $('admin-pass').focus(), 100); }
  }
  if(e.key === 'Escape') closeLogin();
});

let cc = 0, ct;
const logoEl = document.querySelector('.logo');
if(logoEl) {
  logoEl.addEventListener('click', () => {
    cc++;
    clearTimeout(ct);
    ct = setTimeout(() => cc = 0, 700);
    if(cc >= 3) {
      cc = 0;
      if(isAdmin) { $('admin-panel').classList.add('active'); renderAdmin(); }
      else { $('login-modal').classList.add('active'); setTimeout(() => $('admin-pass').focus(), 100); }
    }
  });
}
if($('admin-pass')) { $('admin-pass').addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); }); }

window.addEventListener('storage', e => {
  if(e.key === STORAGE_KEY) {
    renderFeed(); renderStats();
    if($('admin-panel').classList.contains('active')) renderAdmin();
  }
});

(function() {
  const els = document.querySelectorAll('.reveal');
  if(!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
  els.forEach(el => obs.observe(el));
})();

let statsAnimated = false;
function animateCounters() {
  if(statsAnimated) return;
  const els = ['s-total','s-match','s-done','s-customers'];
  const targets = els.map(id => { const el = $(id); return el ? parseInt(el.textContent) || 0 : 0; });
  if(targets.every(t => t === 0)) return;
  statsAnimated = true;
  els.forEach((id, i) => {
    const el = $(id);
    if(!el) return;
    const target = targets[i];
    if(target === 0) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
      current += step;
      if(current >= target) { current = target; clearInterval(timer); }
      el.textContent = current;
    }, 35);
  });
}
(function() {
  const f = $('order');
  if(!f) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting) { animateCounters(); obs.disconnect(); } });
  }, { threshold: 0.2 });
  obs.observe(f);
})();

document.addEventListener('mousemove', e => {
  const x = (e.clientX / innerWidth - 0.5) * 20;
  const y = (e.clientY / innerHeight - 0.5) * 20;
  const hero = document.querySelector('.hero');
  if(hero) hero.style.transform = 'translate(' + (x*0.3) + 'px, ' + (y*0.3) + 'px)';
});

document.addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if(!btn) return;
  const ripple = document.createElement('span');
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = 'position:absolute;border-radius:50%;background:rgba(255,255,255,.5);transform:scale(0);animation:rippleAnim .6s linear;width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX-rect.left-size/2) + 'px;top:' + (e.clientY-rect.top-size/2) + 'px;pointer-events:none;';
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if(target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

(function init() {
  if($('year')) $('year').textContent = new Date().getFullYear();
  updT();
  renderFeed();
  renderStats();
  saveOrders(getOrders());
})();
