(() => {
'use strict';

/* ================= EDIT ME ================= */
const PROFILE = {
  name: 'Prince P. Cardines',
  email: 'you@example.com',
  facebook: 'https://facebook.com/',
  instagram: 'https://instagram.com/'
};
/* =========================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- bind profile ---------- */
$$('[data-name]').forEach(el => el.textContent = PROFILE.name);
$$('[data-email]').forEach(el => el.href = 'mailto:' + PROFILE.email);
$$('[data-email-text]').forEach(el => el.textContent = PROFILE.email);
$$('[data-facebook]').forEach(el => el.href = PROFILE.facebook);
$$('[data-instagram]').forEach(el => el.href = PROFILE.instagram);
document.title = PROFILE.name + ' · Barber';
const TITLE = document.title;
document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? 'Come back! Your fade isn\'t done ✂️' : TITLE;
});

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- typing effect ---------- */
(() => {
  const roles = ['Fade Specialist', 'Beard Sculptor', 'Scissor Artist', 'Confidence Builder', 'Story Listener'];
  const el = $('#typed');
  let ri = 0, ci = 0, del = false;
  (function type() {
    const w = roles[ri];
    el.textContent = w.slice(0, ci);
    if (!del && ci < w.length) { ci++; setTimeout(type, 70); }
    else if (!del) { del = true; setTimeout(type, 1300); }
    else if (ci > 0) { ci--; setTimeout(type, 35); }
    else { del = false; ri = (ri + 1) % roles.length; setTimeout(type, 250); }
  })();
})();

/* ---------- counters ---------- */
$$('[data-count]').forEach(el => {
  const end = +el.dataset.count, suf = el.dataset.suffix || '', dur = 1800, t0 = performance.now();
  (function tick(t) {
    const p = clamp((t - t0) / dur, 0, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suf;
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
});

/* ---------- reveal on scroll + progress bar ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.15 });
$$('.reveal').forEach(el => io.observe(el));

const progressBar = $('#progressBar');
function onScroll() {
  const h = document.documentElement.scrollHeight - innerHeight;
  progressBar.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%';
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- flip cards (touch / keyboard) ---------- */
$$('.flip').forEach(c => {
  c.addEventListener('click', () => c.classList.toggle('flipped'));
  c.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.classList.toggle('flipped'); }
  });
});

/* ---------- photo: fallback avatar + 3D tilt ---------- */
(() => {
  const photo = $('#photo');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a3a66"/><stop offset="1" stop-color="#e63946"/></linearGradient></defs>
  <rect width="400" height="500" fill="url(#g)"/>
  <path d="M40 500 Q60 360 200 350 Q340 360 360 500Z" fill="#141b33"/>
  <rect x="165" y="290" width="70" height="80" rx="20" fill="#c98f6c"/>
  <ellipse cx="200" cy="215" rx="88" ry="105" fill="#e0ac8b"/>
  <path d="M108 200 Q100 100 200 95 Q300 100 292 200 Q270 140 200 138 Q130 140 108 200Z" fill="#1a1a1f"/>
  <circle cx="168" cy="215" r="9" fill="#2b1b12"/><circle cx="232" cy="215" r="9" fill="#2b1b12"/>
  <path d="M160 268 Q200 300 240 268" fill="none" stroke="#7a2f2f" stroke-width="7" stroke-linecap="round"/>
  <text x="200" y="470" text-anchor="middle" font-family="Impact,sans-serif" font-size="34" fill="#fff" letter-spacing="3">ADD photo.jpg</text></svg>`;
  photo.addEventListener('error', () => { photo.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }, { once: true });

  const card = $('#photoCard');
  card.addEventListener('pointermove', e => {
    if (reduceMotion) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(700px) rotateY(${x * 18}deg) rotateX(${-y * 18}deg) scale(1.03)`;
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
})();

/* =====================================================================
   INTERACTIVE 3D HEAD  (pure canvas, hand-rolled 3D projection)
   ===================================================================== */
(() => {
const canvas = $('#head');
const ctx = canvas.getContext('2d');
const stage = $('#stage');
const hintEl = $('#hint');
const meterFill = $('#meterFill');
const meterText = $('#meterText');
const chip = $('#challengeChip');

/* ----- view state ----- */
let W = 0, H = 0, S = 100, cx = 0, cy = 0, DPR = 1;
const F = 7;                       // camera distance (perspective)
let cs = 1, sn = 0, cpi = 1, spi = 0;   // cached trig of rotation
let rx = 0, ry = 0, rz = 0;        // rotation output
let px = 0, py = 0, pk = 1;        // projection output

function resize() {
  const r = canvas.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = Math.min(W * 0.27, H * 0.22);
  cx = W / 2; cy = H * 0.5;
}
new ResizeObserver(resize).observe(canvas);
resize();

/* yaw about Y, then pitch about X */
function R(x, y, z) {
  const x1 = x * cs + z * sn, z1 = -x * sn + z * cs;
  rx = x1; ry = y * cpi - z1 * spi; rz = y * spi + z1 * cpi;
}
function P() {
  pk = F / (F - rz);
  px = cx + rx * S * pk;
  py = cy - ry * S * pk;
}

/* ----- head geometry (egg-shaped ellipsoid with a tapered jaw) ----- */
const RX = 0.92, RY = 1.22, RZ = 1.0;
const v3 = [0, 0, 0], n3 = [0, 0, 0];
function taper(ph) { const s = Math.sin(ph); return s < 0 ? 1 - 0.32 * Math.pow(-s, 1.3) : 1; }
function surf(th, ph, o) {
  const t = taper(ph), c = Math.cos(ph);
  o[0] = RX * t * c * Math.sin(th); o[1] = RY * Math.sin(ph); o[2] = RZ * t * c * Math.cos(th);
  return o;
}
function nrm(th, ph, o) {
  const c = Math.cos(ph);
  const x = c * Math.sin(th) / RX, y = Math.sin(ph) / RY, z = c * Math.cos(th) / RZ;
  const l = Math.hypot(x, y, z) || 1;
  o[0] = x / l; o[1] = y / l; o[2] = z / l;
  return o;
}
/* project a point on the head surface (optionally pushed outward) */
function proj(th, ph, push, o) {
  surf(th, ph, v3); nrm(th, ph, n3);
  R(v3[0] + n3[0] * push, v3[1] + n3[1] * push, v3[2] + n3[2] * push); P();
  o.x = px; o.y = py; o.k = pk; o.z = rz;
  R(n3[0], n3[1], n3[2]); o.nz = rz;
  return o;
}
const A = { x: 0, y: 0, k: 1, z: 0, nz: 0 }, B = { x: 0, y: 0, k: 1, z: 0, nz: 0 }, C = { x: 0, y: 0, k: 1, z: 0, nz: 0 };

const LAT = 22, LON = 36, quads = [];
for (let i = 0; i < LAT; i++) {
  const p0 = -Math.PI / 2 + Math.PI * i / LAT, p1 = -Math.PI / 2 + Math.PI * (i + 1) / LAT;
  for (let j = 0; j < LON; j++) {
    const t0 = -Math.PI + 2 * Math.PI * j / LON, t1 = -Math.PI + 2 * Math.PI * (j + 1) / LON;
    const v = new Float32Array(12);
    surf(t0, p0, v3); v.set(v3, 0); surf(t1, p0, v3); v.set(v3, 3);
    surf(t1, p1, v3); v.set(v3, 6); surf(t0, p1, v3); v.set(v3, 9);
    quads.push({ v, n: nrm((t0 + t1) / 2, (p0 + p1) / 2, [0, 0, 0]) });
  }
}
const SKIN = [226, 172, 138];
const LX = -0.42, LY = 0.55, LZ = 0.72;

/* ----- hair ----- */
const RAZOR = 0.015;
const strands = [];
let scr = new Float32Array(0), cnt = new Uint8Array(0);
let sumL0 = 1, sumMin = 0;
let style = 'messy', guard = 0.09, hairCols = [], hairBack = '#000', browCol = '#000';

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function setHairColor(hex) {
  const c = hex2rgb(hex);
  const mul = f => `rgb(${c.map(v => Math.round(v * f)).join(',')})`;
  const mix = a => `rgb(${c.map(v => Math.round(v + (255 - v) * a)).join(',')})`;
  hairCols = [mul(0.78), mul(1), mix(0.2)];
  hairBack = mul(0.5);
  browCol = mul(0.7);
}
setHairColor('#1a1a1f');

function inZone(th, ph) {
  const a = Math.abs(th);
  if (ph > 0.55) return true;                              // scalp above hairline
  if (a > 1.35 && a < 1.8 && ph > -0.32 && ph < 0.32) return false; // keep ears free
  if (a > 1.1 && ph > -0.45) return true;                  // sides + back
  if (a > 0.95 && ph > -0.25 && ph < 0.6) return true;     // sideburns
  return false;
}

function buildHair(st) {
  style = st;
  strands.length = 0;
  const N = st === 'afro' ? 3400 : 3000;
  let tries = 0;
  while (strands.length < N && tries < N * 30) {
    tries++;
    const th = (Math.random() * 2 - 1) * Math.PI, ph = Math.asin(Math.random() * 2 - 1);
    if (!inZone(th, ph)) continue;
    surf(th, ph, v3); nrm(th, ph, n3);
    let dx = n3[0], dy = n3[1], dz = n3[2], L, gk, jit;
    if (st === 'mohawk') {
      const strip = Math.abs(v3[0]) < 0.26 && ph > 0.1;
      if (strip) { L = 0.62 + Math.random() * 0.25; dx *= 0.2; dy = dy * 0.4 + 1.3; dz = dz * 0.3 + (v3[2] > 0 ? 0.3 : -0.3); gk = 0.03; jit = 0.08; }
      else { L = 0.04 + Math.random() * 0.04; gk = 0.2; jit = 0.1; }
    } else if (st === 'afro') {
      L = 0.5 + Math.random() * 0.26; gk = 0.03; jit = 0.5;
    } else {
      L = 0.4 + Math.random() * 0.36; gk = 0.26 + Math.random() * 0.16; jit = 0.2;
      if (ph > 0.55 && Math.abs(th) < 0.8) { dz += 0.35; dy += 0.25; }
    }
    let l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const pts = new Float32Array(21);
    let x = v3[0] * 0.985, y = v3[1] * 0.985, z = v3[2] * 0.985;
    pts[0] = x; pts[1] = y; pts[2] = z;
    const seg = L / 6;
    for (let k = 1; k <= 6; k++) {
      dx += (Math.random() - 0.5) * jit;
      dy += (Math.random() - 0.5) * jit - gk * (0.3 + k / 6);
      dz += (Math.random() - 0.5) * jit;
      l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      x += dx * seg; y += dy * seg; z += dz * seg;
      pts[k * 3] = x; pts[k * 3 + 1] = y; pts[k * 3 + 2] = z;
    }
    strands.push({ p: pts, L0: L, len: L, seg, nx: n3[0], ny: n3[1], nz: n3[2], shade: (Math.random() * 3) | 0, front: 1 });
  }
  sumL0 = 0; sumMin = 0;
  for (const s of strands) { sumL0 += s.L0; sumMin += Math.min(s.L0, RAZOR); }
  scr = new Float32Array(strands.length * 14);
  cnt = new Uint8Array(strands.length);
  growing = false; lastPct = -1; milestones = {};
}

/* ----- interaction state ----- */
let mode = 'cut', drag = null, cutting = false, mouseIn = false;
let mx = 0, my = 0, pmx = 0, pmy = 0;
let yawUser = 0, pitchUser = 0, swayAmt = 1, lastActive = -9999, spin = null;
let growing = false, lastPct = -1, milestones = {}, challenge = null, started = false;
let cutR = 30;

/* ----- sound (clipper buzz) ----- */
let ac = null, osc = null, gain = null, muted = false;
function buzzOn() {
  if (muted) return;
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 96;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
      gain = ac.createGain(); gain.gain.value = 0;
      osc.connect(lp); lp.connect(gain); gain.connect(ac.destination); osc.start();
    }
    if (ac.state === 'suspended') ac.resume();
    gain.gain.setTargetAtTime(0.045, ac.currentTime, 0.03);
  } catch (e) { /* audio not available */ }
}
function buzzOff() { if (gain && ac) gain.gain.setTargetAtTime(0, ac.currentTime, 0.06); }

/* ----- pointer handling ----- */
function updateMouse(e) {
  const r = canvas.getBoundingClientRect();
  mx = e.clientX - r.left; my = e.clientY - r.top;
}
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  updateMouse(e); pmx = mx; pmy = my; mouseIn = true;
  lastActive = performance.now();
  const wantRotate = mode === 'rotate' || e.button === 2 || e.shiftKey;
  if (wantRotate) { drag = 'rotate'; canvas.classList.remove('cut'); canvas.style.cursor = 'grabbing'; }
  else {
    drag = 'cut'; cutting = true; growing = false; buzzOn();
    if (!started) { started = true; hintEl.classList.add('gone'); stage.classList.add('touched'); }
  }
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('pointermove', e => {
  const ox = mx, oy = my;
  updateMouse(e); mouseIn = true; lastActive = performance.now();
  if (drag === 'rotate') {
    yawUser += (mx - ox) * 0.011;
    pitchUser = clamp(pitchUser + (my - oy) * 0.006, -0.5, 0.5);
  }
});
function endDrag(e) {
  drag = null; cutting = false; buzzOff();
  canvas.style.cursor = '';
  if (mode === 'cut') canvas.classList.add('cut');
  if (e && e.pointerType === 'touch') mouseIn = false;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => { if (!drag) mouseIn = false; });
canvas.addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'ArrowLeft') yawUser -= 0.15;
  else if (k === 'ArrowRight') yawUser += 0.15;
  else if (k === 'ArrowUp') pitchUser = clamp(pitchUser - 0.08, -0.5, 0.5);
  else if (k === 'ArrowDown') pitchUser = clamp(pitchUser + 0.08, -0.5, 0.5);
  else return;
  e.preventDefault(); lastActive = performance.now();
});

/* ----- toolbar ----- */
function selectGroup(attr, fn) {
  $$(`[data-${attr}]`, $('.toolbar')).forEach(b => b.addEventListener('click', () => {
    $$(`[data-${attr}]`, b.parentElement).forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    fn(b.dataset[attr]);
  }));
}
selectGroup('mode', v => {
  mode = v;
  canvas.classList.toggle('cut', v === 'cut');
  toast(v === 'cut' ? '✂️ Cut mode: drag over the hair' : '🖐 Rotate mode: drag to turn the head');
});
selectGroup('guard', v => { guard = parseFloat(v); });
selectGroup('style', v => { buildHair(v); toast('New style: ' + v[0].toUpperCase() + v.slice(1)); });
selectGroup('color', v => setHairColor(v));
$('#spinBtn').addEventListener('click', () => { spin = { t0: performance.now(), from: yawUser }; lastActive = performance.now(); });
$('#regrow').addEventListener('click', () => { growing = true; milestones = {}; toast('🌱 Hair is growing back…'); });
$('#challengeBtn').addEventListener('click', () => {
  buildHair(style);
  challenge = { t0: performance.now(), dur: 30000, goal: 80 };
  chip.hidden = false;
  toast('GO! Remove 80% of the hair in 30 seconds ✂️');
});
const soundBtn = $('#soundBtn');
soundBtn.addEventListener('click', () => {
  muted = !muted; soundBtn.textContent = muted ? '🔇' : '🔊'; soundBtn.setAttribute('aria-pressed', String(!muted));
  if (muted) buzzOff();
});

/* ----- hair simulation (project, cut, count) ----- */
let sumLen = 0;
function computeStrand(i) {
  const s = strands[i], p = s.p, o = i * 14, seg = s.seg;
  let nFull = Math.floor(s.len / seg + 1e-6); if (nFull > 6) nFull = 6;
  let c = 0;
  for (let k = 0; k <= nFull; k++) {
    R(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]); P();
    scr[o + c * 2] = px; scr[o + c * 2 + 1] = py; c++;
  }
  const frac = s.len - nFull * seg;
  if (nFull < 6 && frac > 1e-4) {
    const a = nFull * 3, b = a + 3, f = frac / seg;
    R(p[a] + (p[b] - p[a]) * f, p[a + 1] + (p[b + 1] - p[a + 1]) * f, p[a + 2] + (p[b + 2] - p[a + 2]) * f); P();
    scr[o + c * 2] = px; scr[o + c * 2 + 1] = py; c++;
  }
  if (c < 2) { scr[o + 2] = scr[o] + 0.5; scr[o + 3] = scr[o + 1] + 1; c = 2; }
  cnt[i] = c;
}

function segDist2(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - x, qy = ay + dy * t - y;
  return qx * qx + qy * qy;
}

const parts = [];
function spawn(x, y, len) {
  if (parts.length > 320 || Math.random() > 0.45) return;
  parts.push({ x, y, vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 50,
    a: Math.random() * 6.28, va: (Math.random() - 0.5) * 9, l: Math.max(5, len * S * 0.9), life: 0 });
}

function prepareHair() {
  const doCut = cutting && drag === 'cut';
  const R2 = cutR * cutR;
  let allFull = true;
  sumLen = 0;
  for (let i = 0; i < strands.length; i++) {
    const s = strands[i];
    if (growing) {
      if (s.len < s.L0 - 0.002) { s.len = Math.min(s.L0, s.len + (s.L0 - s.len) * 0.09 + 0.003); allFull = false; }
      else s.len = s.L0;
    }
    R(s.nx, s.ny, s.nz);
    const nz = rz; s.front = nz >= 0 ? 1 : 0;
    computeStrand(i);
    if (doCut && nz > -0.25 && s.len > guard + 0.003) {
      const o = i * 14, c = cnt[i];
      for (let k = 0; k < c; k++) {
        if (segDist2(scr[o + k * 2], scr[o + k * 2 + 1], pmx, pmy, mx, my) <= R2) {
          const tl = Math.min(k * s.seg, s.len);
          const nl = Math.max(guard, tl);
          if (nl < s.len - 0.004) {
            spawn(scr[o + k * 2], scr[o + k * 2 + 1], s.len - nl);
            s.len = nl;
            computeStrand(i);
          }
          break;
        }
      }
    }
    sumLen += s.len;
  }
  if (growing && allFull) growing = false;
  pmx = mx; pmy = my;
}

function hairPass(front) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.1, S * 0.011);
  if (!front) {
    ctx.strokeStyle = hairBack; ctx.beginPath();
    for (let i = 0; i < strands.length; i++) {
      if (strands[i].front) continue;
      const o = i * 14, c = cnt[i];
      ctx.moveTo(scr[o], scr[o + 1]);
      for (let k = 1; k < c; k++) ctx.lineTo(scr[o + k * 2], scr[o + k * 2 + 1]);
    }
    ctx.stroke();
    return;
  }
  for (let g = 0; g < 3; g++) {
    ctx.strokeStyle = hairCols[g]; ctx.beginPath();
    for (let i = 0; i < strands.length; i++) {
      const s = strands[i];
      if (!s.front || s.shade !== g) continue;
      const o = i * 14, c = cnt[i];
      ctx.moveTo(scr[o], scr[o + 1]);
      for (let k = 1; k < c; k++) ctx.lineTo(scr[o + k * 2], scr[o + k * 2 + 1]);
    }
    ctx.stroke();
  }
}

function drawParticles(dt) {
  if (!parts.length) return;
  ctx.lineWidth = Math.max(1.1, S * 0.011); ctx.lineCap = 'round';
  ctx.strokeStyle = hairCols[1]; ctx.beginPath();
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; p.life += dt;
    if (p.y > H + 20 || p.life > 3) { parts.splice(i, 1); continue; }
    const dx = Math.cos(p.a) * p.l / 2, dy = Math.sin(p.a) * p.l / 2;
    ctx.moveTo(p.x - dx, p.y - dy); ctx.lineTo(p.x + dx, p.y + dy);
  }
  ctx.stroke();
}

/* ----- drawing the body, head and face ----- */
function drawBody() {
  const nw = 0.36 * S;
  let g = ctx.createLinearGradient(0, cy + 0.7 * S, 0, cy + 1.6 * S);
  g.addColorStop(0, '#8f5d43'); g.addColorStop(1, '#d39a78');
  ctx.fillStyle = g; ctx.fillRect(cx - nw, cy + 0.7 * S, nw * 2, 0.95 * S);
  const top = cy + 1.42 * S;
  g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, '#2a3a66'); g.addColorStop(1, '#141b33');
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(cx - 0.62 * S, top);
  ctx.quadraticCurveTo(cx - 1.5 * S, top + 0.15 * S, cx - 2.6 * S, H + 20);
  ctx.lineTo(cx + 2.6 * S, H + 20);
  ctx.quadraticCurveTo(cx + 1.5 * S, top + 0.15 * S, cx + 0.62 * S, top);
  ctx.quadraticCurveTo(cx, top + 0.38 * S, cx - 0.62 * S, top);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(2, S * 0.03);
  ctx.beginPath(); ctx.moveTo(cx - 0.62 * S, top); ctx.quadraticCurveTo(cx, top + 0.38 * S, cx + 0.62 * S, top); ctx.stroke();
}

function drawHead() {
  ctx.lineWidth = 1; ctx.lineJoin = 'round';
  for (let i = 0; i < quads.length; i++) {
    const q = quads[i];
    R(q.n[0], q.n[1], q.n[2]);
    if (rz <= 0) continue;
    const sh = 0.42 + 0.58 * Math.max(0, rx * LX + ry * LY + rz * LZ);
    const col = `rgb(${(SKIN[0] * sh) | 0},${(SKIN[1] * sh) | 0},${(SKIN[2] * sh) | 0})`;
    ctx.fillStyle = col; ctx.strokeStyle = col;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      R(q.v[k * 3], q.v[k * 3 + 1], q.v[k * 3 + 2]); P();
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function drawEars(front) {
  for (const sg of [-1, 1]) {
    R(sg, 0, 0); const nzE = rz;
    if ((nzE > 0) !== front) continue;
    R(sg * RX * 0.99, 0.02, -0.08); P();
    const ex = px, ey = py, k = pk;
    const w = S * k * (0.07 + 0.12 * Math.abs(nzE)), h = S * k * 0.38;
    const sh = 0.55 + 0.4 * Math.max(0, nzE);
    ctx.fillStyle = `rgb(${(SKIN[0] * sh) | 0},${(SKIN[1] * sh) | 0},${(SKIN[2] * sh) | 0})`;
    ctx.beginPath(); ctx.ellipse(ex, ey, w, h, 0, 0, 6.283); ctx.fill();
    if (nzE > 0.25) {
      ctx.fillStyle = 'rgba(120,55,40,.35)';
      ctx.beginPath(); ctx.ellipse(ex, ey, w * 0.55, h * 0.6, 0, 0, 6.283); ctx.fill();
    }
  }
}

function drawFace(time) {
  ctx.lineCap = 'round';
  /* cheeks */
  ctx.fillStyle = 'rgba(255,110,110,.16)';
  for (const sg of [-1, 1]) {
    proj(sg * 0.62, -0.12, 0, A);
    if (A.nz > 0.1) { ctx.beginPath(); ctx.ellipse(A.x, A.y, 0.13 * S * A.k * A.nz, 0.08 * S * A.k, 0, 0, 6.283); ctx.fill(); }
  }
  /* nose */
  proj(0, -0.1, 0.2, A); proj(0, 0.18, 0.02, B);
  if (A.nz > -0.1) {
    const vis = clamp(A.nz + 0.1, 0, 1);
    ctx.strokeStyle = 'rgba(255,232,215,.28)'; ctx.lineWidth = 0.13 * S * A.k;
    ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(A.x, A.y); ctx.stroke();
    ctx.fillStyle = 'rgba(120,60,40,.2)';
    ctx.beginPath(); ctx.ellipse(A.x, A.y + 0.02 * S, 0.13 * S * A.k * (0.5 + 0.5 * vis), 0.1 * S * A.k, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,238,225,.28)';
    ctx.beginPath(); ctx.ellipse(A.x - 0.02 * S, A.y - 0.02 * S, 0.07 * S * A.k * vis, 0.05 * S * A.k, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(60,25,20,.55)';
    for (const sg of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(A.x + sg * 0.055 * S * A.k * vis, A.y + 0.05 * S * A.k, 0.022 * S * A.k, 0.014 * S * A.k, 0, 0, 6.283); ctx.fill();
    }
  }
  /* eyes */
  const blink = (time % 3800) < 130;
  for (const sg of [-1, 1]) {
    proj(sg * 0.42, 0.12, 0, A);
    if (A.nz < 0.12) continue;
    const ew = 0.15 * S * A.k * Math.max(0.35, A.nz), eh = 0.085 * S * A.k;
    if (blink) {
      ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 0.03 * S * A.k;
      ctx.beginPath(); ctx.moveTo(A.x - ew, A.y); ctx.lineTo(A.x + ew, A.y); ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#f6f2ee';
    ctx.beginPath(); ctx.ellipse(A.x, A.y, ew, eh, 0, 0, 6.283); ctx.fill();
    let lx = 0, ly = 0;
    if (mouseIn) { lx = clamp((mx - A.x) / (S * 1.6), -1, 1); ly = clamp((my - A.y) / (S * 1.6), -1, 1); }
    const ix = A.x + lx * ew * 0.45, iy = A.y + ly * eh * 0.4;
    ctx.fillStyle = '#2b1b12';
    ctx.beginPath(); ctx.ellipse(ix, iy, 0.052 * S * A.k * Math.max(0.5, A.nz), 0.058 * S * A.k, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ix - 0.015 * S * A.k, iy - 0.02 * S * A.k, 0.014 * S * A.k, 0, 6.283); ctx.fill();
  }
  /* eyebrows */
  ctx.strokeStyle = browCol; ctx.lineWidth = 0.05 * S;
  for (const sg of [-1, 1]) {
    proj(sg * 0.2, 0.3, 0.04, A); proj(sg * 0.64, 0.36, 0.04, B);
    if (A.nz > 0.05 && B.nz > 0.05) { ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
  }
  /* mouth (grins while cutting) */
  proj(0, -0.46, 0.02, C);
  if (C.nz > 0.1) {
    const up = [], grin = cutting && drag === 'cut';
    for (let t = -1; t <= 1.01; t += 0.5) {
      const o = { x: 0, y: 0, k: 1, z: 0, nz: 0 };
      proj(t * 0.3, -0.46 + 0.06 * t * t, 0.02, o); up.push(o);
    }
    if (grin) {
      const lo = [];
      for (let t = 1; t >= -1.01; t -= 0.5) {
        const o = { x: 0, y: 0, k: 1, z: 0, nz: 0 };
        proj(t * 0.3, -0.46 + 0.06 * t * t - 0.075 * (1 - t * t), 0.02, o); lo.push(o);
      }
      ctx.fillStyle = '#5a1a1a'; ctx.beginPath(); ctx.moveTo(up[0].x, up[0].y);
      up.forEach(p => ctx.lineTo(p.x, p.y)); lo.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#7a2f2f'; ctx.lineWidth = 0.035 * S * C.k;
    ctx.beginPath(); ctx.moveTo(up[0].x, up[0].y); up.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
  }
}

function drawCursor() {
  if (!mouseIn || mode !== 'cut' || drag === 'rotate') return;
  ctx.save();
  ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.strokeStyle = cutting ? 'rgba(244,201,93,.95)' : 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.arc(mx, my, cutR, 0, 6.283); ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(mx, my); ctx.rotate(-0.4);
  if (cutting) ctx.translate((Math.random() - 0.5) * 2.6, (Math.random() - 0.5) * 2.6);
  const w = 30;
  ctx.fillStyle = '#cfd5df'; ctx.fillRect(-w / 2, -12, w, 12);
  ctx.fillStyle = '#2b2f3a';
  for (let i = -w / 2 + 2; i < w / 2 - 1; i += 5) ctx.fillRect(i, -4, 2.5, 4);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#b8222d'); g.addColorStop(0.5, '#ff5964'); g.addColorStop(1, '#b8222d');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -86, w, 74);
  ctx.fillStyle = '#fff'; ctx.fillRect(-3, -70, 6, 30);
  ctx.restore();
}

/* ----- HUD, milestones, challenge ----- */
const MILES = [[25, '✂️ Nice start! A quarter gone.'], [50, '🔥 Halfway there — looking sharp!'],
  [75, '😮 Almost bald… commitment!'], [100, '💈 Fresh as a baby! Hit Regrow to go again.']];
function updateHud(now) {
  const denom = Math.max(1e-6, sumL0 - sumMin);
  const prog = clamp((sumL0 - sumLen) / denom, 0, 1);
  const pct = Math.round(prog * 100);
  if (pct !== lastPct) {
    lastPct = pct;
    meterFill.style.width = pct + '%'; meterText.textContent = pct + '%';
    if (pct < 10) milestones = {};
    if (!challenge) for (const [m, msg] of MILES) if (pct >= m && !milestones[m]) { milestones[m] = true; toast(msg); }
  }
  if (challenge) {
    const rem = challenge.dur - (now - challenge.t0);
    if (pct >= challenge.goal) {
      toast(`🏆 ${((now - challenge.t0) / 1000).toFixed(1)}s — master barber!`);
      challenge = null; chip.hidden = true;
    } else if (rem <= 0) {
      toast(`⏰ Time's up! You reached ${pct}%. Try again!`);
      challenge = null; chip.hidden = true;
    } else chip.textContent = `⏱ ${(rem / 1000).toFixed(1)}s · goal 80% (${pct}%)`;
  }
}

/* ----- main loop ----- */
let last = 0;
function frame(time) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (time - last) / 1000 || 0.016); last = time;
  ctx.clearRect(0, 0, W, H);
  cutR = Math.max(26, S * 0.26);

  const idle = time - lastActive > 1800 && !drag;
  swayAmt += ((idle && !reduceMotion ? 1 : 0) - swayAmt) * 0.04;
  if (spin) {
    const p = clamp((time - spin.t0) / 1300, 0, 1);
    yawUser = spin.from + Math.PI * 2 * (1 - Math.pow(1 - p, 3));
    if (p >= 1) spin = null;
  }
  const yaw = yawUser + Math.sin(time * 0.0007) * 0.3 * swayAmt;
  const pitch = pitchUser + Math.sin(time * 0.0005) * 0.04 * swayAmt;
  cs = Math.cos(yaw); sn = Math.sin(yaw); cpi = Math.cos(pitch); spi = Math.sin(pitch);

  drawBody();
  prepareHair();
  hairPass(false);
  drawEars(false);
  drawHead();
  drawEars(true);
  drawFace(time);
  hairPass(true);
  drawParticles(dt);
  drawCursor();
  updateHud(time);
}

buildHair('messy');
requestAnimationFrame(frame);
})();

})();
