// SR Auto — Analytics mühərriki. Köhnə panelin JS-i (docs/legacy/sr_dashboard_template.html, patch6) — hesablama və UI kodu
// dəyişmədən saxlanılıb; yalnız data mənbəyi (Google Sheet / claude.ai / __DATA__ snapshot) /api/data ilə əvəz olunub.
// React yalnız konteyneri render edir; bu modul onu imperativ idarə edir (köhnə panel kimi).
/* eslint-disable */
export function mountDashboard(opts) {
'use strict';
const cleanups = [], ac = new AbortController();
const docOn = (type, fn) => document.addEventListener(type, fn, { signal: ac.signal });
/* ====== Tənzimləmələr ====== */
const CFG = {
  // "from Marketing" tagları (istifadəçinin siyahısı, 22.09.2026). Böyük/kiçik hərf fərq etmir.
  // Total Traffic from Marketing = Növ=Trafik və "Haradan Gəlib" bu siyahıdadır; Total Satış from Marketing = Növ=Sales və "Satış kanalı" bu siyahıdadır
  marketing: ['Facebook', 'Instagram', 'Whatsapp', 'Tiktok', 'Call', 'Call Center', 'Sosial Şəbəkə',
              'Changan.az', 'Skoda.az', 'Avatr.az', 'İnternet', 'Youtube', 'Google', 'Tv'],
  // Bizim brendlər — 8 (istifadəçi qərarı 29.09.2026: köhnə paneldəki "(7)" yazısı səhv idi)
  ourBrands: ['Changan', 'Lynk & Co', 'Mercedes', 'Skoda', 'Xpeng', 'Avatr', 'Leap', 'Deepal'],
  autoRefreshMinutes: 15,                  // səhifə açıq qalanda serverdən yeni datanı bu intervalla yoxlayır
  headerBrands: [['Mercedes-Benz', 'Mercedes'], ['Changan', 'Changan'], ['Xpeng', 'Xpeng'], ['Avatr', 'Avatr'],
                 ['Skoda', 'Skoda'], ['Lynk & Co', 'Lynk & Co']],
};
const OURS_N = CFG.ourBrands.length;
const DIMS = [
  { key: 'nov', title: 'Type', head: 'Növ' },
  { key: 'brand', title: 'Brand', head: 'Brend' },
  { key: 'model', title: 'Model split', head: 'Model', search: true },
  { key: 'kanal', title: 'Channel split', head: 'Kanal', channel: true },
  { key: 'satis', title: 'Sales channel', head: 'Satış kanalı', channel: true },
  { key: 'haradan', title: 'Traffic channel', head: 'Haradan Gəlib', channel: true },
];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const MON3 = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
const NF = new Intl.NumberFormat('en-US');
const fmt = v => NF.format(Math.round(v));
const pct = v => !isFinite(v) ? '—' : (v * 100).toFixed(v >= 0.1 ? 1 : 2) + '%';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).replace(/İ/g, 'I').replace(/ı/g, 'i').trim().toLowerCase();
const $ = id => document.getElementById(id);

/* ====== Data ====== */
// Aktiv data dəsti — applyData() ilə dəyişir (/api/data paketi)
let META = { records: 0 }, DIMV = null, ND = 1, L = 0, T0 = 0, D = null, NOV = {}, MKT = {}, NROWS = 0;
const dateOf = i => new Date(T0 + i * 864e5);
const idxOf = d => Math.round((d.getTime() - T0) / 864e5);
const iso = i => dateOf(i).toISOString().slice(0, 10);
const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - T0) / 864e5); };
const dLong = i => { const d = dateOf(i); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dShort = (i, yr = true) => { const d = dateOf(i); return `${d.getUTCDate()} ${MON3[d.getUTCMonth()]}${yr ? ' ' + d.getUTCFullYear() : ''}`; };
const label = (key, v) => { const s = DIMV[key][v]; return s === '' ? '(boş)' : (key === 'nov' && s === 'Sales' ? 'Sales' : s); };
const mnorm = s => norm(s).replace(/\s+/g, ' ');       // "SOSİAL ŞƏBƏKƏ" = "Sosial Şəbəkə", "TİKTOK" = "Tiktok"
const mktSet = new Set(CFG.marketing.map(mnorm));
function applyData(ds) {
  META = ds.meta; DIMV = ds.dims; ND = ds.ndays; L = ND - 1; D = ds.cols; NROWS = ds.cols.day.length;
  const [y, m, d] = ds.start.split('-').map(Number); T0 = Date.UTC(y, m - 1, d);
  const find = names => DIMV.nov.findIndex(v => names.includes(norm(v)));
  NOV = { mur: find(['müraciət', 'muraciet']), tra: find(['trafik', 'traffic']), sal: find(['sales', 'satış', 'satis']) };
  MKT = { satis: new Uint8Array(DIMV.satis.map(v => mktSet.has(mnorm(v)) ? 1 : 0)),
          haradan: new Uint8Array(DIMV.haradan.map(v => mktSet.has(mnorm(v)) ? 1 : 0)) };
}

const vkey = s => norm(s).replace(/\s+/g, ' ');     // "E CLASS" = "E Class", "STREET TRAFFİC" = "Street Traffic"

/* ====== Vəziyyət ====== */
const S = {
  from: 0, to: 0, preset: 'all',
  sel: Object.fromEntries(DIMS.map(d => [d.key, new Set()])),
  metric: 'all', gran: 'day', showTable: false, search: { model: '' }, page: {}, cmp: false, cmpAll: false,
};
let R = null;                               // son hesablama nəticəsi

function lowerBound(a, x) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }

function compute() {
  const { from, to } = S, len = to - from + 1;
  const pFrom = from - len, hasPrev = pFrom >= 0;
  const lo = lowerBound(D.day, hasPrev ? pFrom : from), hi = lowerBound(D.day, to + 1);
  const cols = DIMS.map(d => D[d.key]);
  const active = DIMS.map(d => S.sel[d.key].size > 0);
  const mem = DIMS.map(d => { const a = new Uint8Array(DIMV[d.key].length); S.sel[d.key].forEach(v => a[v] = 1); return a; });
  const skip0 = DIMS.map(d => !!d.channel);
  const counts = DIMS.map(d => new Float64Array(DIMV[d.key].length));
  const nN = DIMV.nov.length;
  const cur = new Float64Array(nN), prev = new Float64Array(nN);
  let mS = 0, mT = 0, pmS = 0, pmT = 0;
  const series = Array.from({ length: nN }, () => new Float64Array(len));
  const { cnt, day, nov, satis, haradan } = D;
  for (let r = lo; r < hi; r++) {
    let fails = 0, fd = -1;
    for (let i = 0; i < 6; i++) {
      if (active[i] && !mem[i][cols[i][r]]) { if (++fails > 1) break; fd = i; }
    }
    if (fails > 1) continue;
    const c = cnt[r], dy = day[r], nv = nov[r];
    if (dy < from) {
      if (fails === 0) { prev[nv] += c; if (nv === NOV.sal && MKT.satis[satis[r]]) pmS += c; if (nv === NOV.tra && MKT.haradan[haradan[r]]) pmT += c; }
      continue;
    }
    if (fails === 0) {
      for (let i = 0; i < 6; i++) { const v = cols[i][r]; if (v || !skip0[i]) counts[i][v] += c; }
      cur[nv] += c; series[nv][dy - from] += c;
      if (nv === NOV.sal && MKT.satis[satis[r]]) mS += c;
      if (nv === NOV.tra && MKT.haradan[haradan[r]]) mT += c;
    } else {
      const v = cols[fd][r]; if (v || !skip0[fd]) counts[fd][v] += c;
    }
  }
  const g = (arr, k) => (k >= 0 ? arr[k] : 0);
  return {
    len, hasPrev, counts, series,
    k: { tra: g(cur, NOV.tra), sal: g(cur, NOV.sal), mur: g(cur, NOV.mur), mS, mT },
    p: hasPrev ? { tra: g(prev, NOV.tra), sal: g(prev, NOV.sal), mur: g(prev, NOV.mur), mS: pmS, mT: pmT } : null,
  };
}

/* ====== Tarix aralıqları ====== */
const PRESETS = [['all', 'Bütün dövr'], ['d1', 'Son gün'], ['l7', 'Son 7 gün'], ['l30', 'Son 30 gün'], ['l90', 'Son 90 gün'],
                 ['mtd', 'Bu ay'], ['pm', 'Keçən ay'], ['qtd', 'Bu rüb'], ['ytd', 'Bu il'], ['py', 'Keçən il']];
function presetRange(id) {
  const [a, b] = rawRange(id);
  return [Math.max(0, Math.min(L, a)), Math.max(0, Math.min(L, b))];
}
const presetOk = id => { const [a, b] = rawRange(id); return b >= 0 && a <= L; };
function rawRange(id) {
  const e = dateOf(L), y = e.getUTCFullYear(), m = e.getUTCMonth();
  const U = (yy, mm, dd) => idxOf(new Date(Date.UTC(yy, mm, dd)));
  const c = (a, b) => [a, b];                // xam aralıq — kəsilmə presetRange()-də
  switch (id) {
    case 'd1': return [L, L];
    case 'l7': return c(L - 6, L);
    case 'l30': return c(L - 29, L);
    case 'l90': return c(L - 89, L);
    case 'mtd': return c(U(y, m, 1), L);
    case 'pm': return c(U(y, m - 1, 1), U(y, m, 0));
    case 'qtd': return c(U(y, m - (m % 3), 1), L);
    case 'ytd': return c(U(y, 0, 1), L);
    case 'py': return c(U(y - 1, 0, 1), U(y - 1, 11, 31));
    default: return [0, L];
  }
}
function setPreset(id) { [S.from, S.to] = presetRange(id); S.preset = id; update(); }
function setRange(a, b) { S.from = Math.max(0, Math.min(a, b)); S.to = Math.min(L, Math.max(a, b)); S.preset = (S.from === 0 && S.to === L) ? 'all' : 'custom'; update(); }
const presetName = () => (PRESETS.find(p => p[0] === S.preset) || [0, 'Xüsusi aralıq'])[1];
const spanText = () => S.from === S.to ? dShort(S.from) : `${dShort(S.from, dateOf(S.from).getUTCFullYear() !== dateOf(S.to).getUTCFullYear())} – ${dShort(S.to)}`;

/* ====== Açılan pəncərələr ====== */
const CHEV = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CAL = '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
let openPop = null;
function closePop() { if (!openPop) return; openPop.pop.remove(); openPop.btn.setAttribute('aria-expanded', 'false'); openPop = null; }
function mountPop(w, pop) {
  const btn = w.querySelector('.fbtn');
  w.appendChild(pop); btn.setAttribute('aria-expanded', 'true'); openPop = { wrap: w, pop, btn };
  const r = pop.getBoundingClientRect();
  if (r.right > innerWidth - 12) pop.style.left = Math.round(innerWidth - 12 - r.right) + 'px';
  else if (r.left < 12) { pop.style.right = 'auto'; pop.style.left = Math.round(12 - w.getBoundingClientRect().left) + 'px'; }
}
docOn('pointerdown', e => { if (openPop && !openPop.wrap.contains(e.target)) closePop(); });
docOn('keydown', e => { if (e.key === 'Escape' && openPop) { const b = openPop.btn; closePop(); b.focus(); } });

function buildFilters() {
  const mk = (key, icon) => { const w = $('fw-' + key); w.innerHTML = `<button type="button" class="fbtn" id="fb-${key}" aria-haspopup="dialog" aria-expanded="false">${icon}<span class="k"></span><span class="v"></span>${CHEV}</button>`; return w.firstElementChild; };
  mk('date', CAL).onclick = openDatePop;
  ['brand', 'model', 'nov'].forEach(k => { mk(k, '').onclick = () => openDimPop(k); });
  $('fw-cbrand').innerHTML = `<button type="button" class="fbtn" id="fb-cbrand" aria-haspopup="dialog" aria-expanded="false" title="Brend seç — adını yazıb axtarmaq olar"><span class="k"></span><span class="v"></span>${CHEV}</button>`;
  $('fb-cbrand').onclick = () => openDimPop('brand', 'fw-cbrand');
  $('resetAll').onclick = () => { DIMS.forEach(d => S.sel[d.key].clear()); setPreset('all'); };
  $('resetMain').onclick = $('resetAll').onclick;
  $('resetChart').onclick = () => { S.metric = 'all'; S.gran = 'day'; S.cmp = false; S.clickPrev = null; S.showTable = false; $('tblToggle').setAttribute('aria-pressed', false); $('ctable').hidden = true; syncChartControls(); setPreset('all'); };
  $('brands').onclick = e => { const b = e.target.closest('[data-b]'); if (b) toggle('brand', +b.dataset.b); };
  $('chips').onclick = e => {
    const c = e.target.closest('.chip'); if (!c) return;
    if (c.dataset.c === 'date') setPreset('all'); else { S.sel[c.dataset.c].delete(+c.dataset.v); update(); }
  };
}

function monthSpan(y, m) {                             // həmin ayın data daxilindəki aralığı
  const A = idxOf(new Date(Date.UTC(y, m, 1))), B = idxOf(new Date(Date.UTC(y, m + 1, 0)));
  return (B < 0 || A > L) ? null : [Math.max(0, A), Math.min(L, B)];
}
function rangeLabel() {                               // tam ay/il seçilibsə adı ilə yaz
  const a = dateOf(S.from), b = dateOf(S.to);
  const firstOfMonth = a.getUTCDate() === 1 || S.from === 0, lastOfMonth = b.getUTCDate() === new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 0)).getUTCDate() || S.to === L;
  if (firstOfMonth && lastOfMonth) {
    const ay = a.getUTCFullYear(), am = a.getUTCMonth(), by = b.getUTCFullYear(), bm = b.getUTCMonth();
    if (ay === by && am === bm) return `${MONC[am]} ${ay}`;
    if (ay === by && am === 0 && bm === 11) return String(ay);
    if (ay === by) return `${MONC[am]} – ${MONC[bm]} ${ay}`;
  }
  return spanText();
}
let mpAnchor = null;                                  // ay seçimində birinci klik
function openDatePop() {
  const w = $('fw-date');
  if (openPop && openPop.wrap === w) return closePop();
  closePop(); mpAnchor = null;
  const years = [];
  for (let y = dateOf(0).getUTCFullYear(); y <= dateOf(L).getUTCFullYear(); y++) years.push(y);
  const pop = document.createElement('div');
  pop.className = 'pop date'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Tarix aralığı');
  pop.innerHTML = `<div class="presets" role="listbox" aria-label="Hazır aralıqlar">${PRESETS.map(([id, t]) =>
      `<button type="button" class="opt" role="option" data-p="${id}" aria-selected="${S.preset === id}"${presetOk(id) ? '' : ' disabled title="Bu dövr üçün Sheet-də data yoxdur"'}><span class="chk">✓</span>${t}</button>`).join('')}</div>
    <div class="dcal">
      <h4>Ay seç</h4>
      <div class="years">${years.map(y => `<div class="yr">
        <button type="button" class="ybtn" data-y="${y}" title="${y} ilinin hamısı">${y}</button>
        <div class="mg">${MON3C.map((n, m) => { const r = monthSpan(y, m);
          return `<button type="button" class="mb" data-y="${y}" data-m="${m}"${r ? '' : ' disabled'}>${n}</button>`; }).join('')}</div>
      </div>`).join('')}</div>
      <p class="mhint">Bir aya klik — həmin ay. İkinci aya klik — aralıq (məs. yanvar → mart).</p>
      <div class="custom"><h4>Dəqiq tarixlər</h4>
        <div class="drow"><label for="dFrom">Başlanğıc<input type="date" id="dFrom" min="${iso(0)}" max="${iso(L)}" value="${iso(S.from)}"></label>
        <label for="dTo">Son<input type="date" id="dTo" min="${iso(0)}" max="${iso(L)}" value="${iso(S.to)}"></label></div>
        <div class="span-note" id="dNote"></div>
        <div class="pop-actions"><button type="button" class="btn" id="dReset" title="Bütün dövr">Sıfırla</button><button type="button" class="btn" id="dCancel">Bağla</button><button type="button" class="btn primary" id="dApply">Tətbiq et</button></div></div>
    </div>`;
  mountPop(w, pop);
  const fI = $('dFrom'), tI = $('dTo'), note = $('dNote');
  const read = () => { const a = fromIso(fI.value || iso(0)), b = fromIso(tI.value || iso(L)); return [Math.max(0, Math.min(a, b)), Math.min(L, Math.max(a, b))]; };
  const paint = () => {                               // seçilmiş ayları işıqlandır
    fI.value = iso(S.from); tI.value = iso(S.to);
    note.textContent = `${fmt(S.to - S.from + 1)} gün seçilib · data ${dShort(0)} – ${dShort(L)} aralığındadır`;
    pop.querySelectorAll('.mb').forEach(b => {
      const r = monthSpan(+b.dataset.y, +b.dataset.m);
      b.classList.toggle('sel', !!r && r[0] >= S.from && r[1] <= S.to);
      b.classList.toggle('in', !!r && r[1] >= S.from && r[0] <= S.to);
      b.classList.toggle('anchor', !!mpAnchor && +b.dataset.y === mpAnchor.y && +b.dataset.m === mpAnchor.m);
    });
    pop.querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-selected', b.dataset.p === S.preset));
  };
  paint(); fI.oninput = () => { const [a, b] = read(); setRange(a, b); paint(); };
  tI.oninput = fI.oninput;
  pop.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { mpAnchor = null; setPreset(b.dataset.p); paint(); });
  pop.querySelectorAll('.ybtn').forEach(b => b.onclick = () => {
    const y = +b.dataset.y, A = monthSpan(y, 0), B = monthSpan(y, 11);
    if (!A && !B) return;
    mpAnchor = null; setRange(Math.max(0, A ? A[0] : 0), Math.min(L, B ? B[1] : L)); paint();
  });
  pop.querySelectorAll('.mb').forEach(b => b.onclick = () => {
    const y = +b.dataset.y, m = +b.dataset.m, r = monthSpan(y, m); if (!r) return;
    if (mpAnchor) {                                   // ikinci klik — aralıq
      const a0 = monthSpan(mpAnchor.y, mpAnchor.m);
      setRange(Math.min(a0[0], r[0]), Math.max(a0[1], r[1])); mpAnchor = null;
    } else { mpAnchor = { y, m }; setRange(r[0], r[1]); }
    paint();
  });
  $('dCancel').onclick = closePop;
  $('dReset').onclick = () => { mpAnchor = null; setPreset('all'); paint(); };
  $('dApply').onclick = () => { const [a, b] = read(); closePop(); setRange(a, b); };
}

function openDimPop(key, wrapId) {
  const w = $(wrapId || 'fw-' + key);
  if (openPop && openPop.wrap === w) return closePop();
  closePop();
  const i = DIMS.findIndex(d => d.key === key), d = DIMS[i];
  const pop = document.createElement('div');
  pop.className = 'pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', d.head + ' seçimi');
  pop.innerHTML = `${key !== 'nov' ? `<div class="msearch"><input type="search" id="ms-${key}" placeholder="${d.head} axtar…" aria-label="${d.head} axtar" autocomplete="off"></div>` : ''}
    <div class="mlist" role="listbox"></div>`;
  mountPop(w, pop);
  const list = pop.querySelector('.mlist'); let q = '';
  pop._draw = () => {
    const c = R.counts[i], sel = S.sel[key];
    let idx = [];
    for (let v = 0; v < c.length; v++) if ((c[v] > 0 || sel.has(v)) && (v > 0 || !d.channel)) idx.push(v);
    if (q) idx = idx.filter(v => norm(label(key, v)).includes(q));
    idx.sort((a, b) => c[b] - c[a] || a - b);
    let tot = 0; for (let v = 0; v < c.length; v++) if (v > 0 || !d.channel) tot += c[v];
    list.innerHTML = (q ? '' : `<button type="button" class="opt" role="option" data-v="all" aria-selected="${sel.size === 0}"><span class="chk">✓</span><span>Hamısı</span><span class="n">${fmt(tot)}</span></button>`)
      + (idx.length ? idx.map(v => `<button type="button" class="opt" role="option" data-v="${v}" aria-selected="${sel.has(v)}"><span class="chk">✓</span><span>${esc(label(key, v))}</span><span class="n">${fmt(c[v])}</span></button>`).join('')
        : '<div class="empty">Uyğun dəyər tapılmadı</div>');
  };
  pop._draw();
  list.onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    closePop();
    if (b.dataset.v === 'all') { S.sel[key].clear(); update(); }
    else { const v = +b.dataset.v; if (!S.sel[key].has(v)) toggle(key, v); }
  };
  const si = $('ms-' + key); if (si) { si.oninput = () => { q = norm(si.value); pop._draw(); }; si.focus(); }
}

function toggle(key, v) {                            // hər kartda yalnız BİR seçim: yeni klik köhnəni əvəz edir, təkrar klik götürür
  const s = S.sel[key], had = s.has(v); s.clear(); if (!had) s.add(v); update();
}

function renderFilters() {
  const set = (key, k, v, on) => { const b = $('fb-' + key); b.querySelector('.k').textContent = k; b.querySelector('.v').textContent = v; b.classList.toggle('on', on); };
  set('date', '', (S.preset === 'all' || S.preset === 'custom') ? rangeLabel() : presetName(), S.preset !== 'all');
  $('fb-date').title = presetName() + ' · ' + spanText();
  [['brand', 'Brend'], ['model', 'Model'], ['nov', 'Növ']].forEach(([key, k]) => {
    const s = [...S.sel[key]];
    set(key, s.length ? k : '', s.length ? label(key, s[0]) : k, s.length > 0);
  });
  document.querySelectorAll('.brand-btn').forEach(b => b.setAttribute('aria-pressed', S.sel.brand.has(+b.dataset.b)));
  { const s = [...S.sel.brand]; set('cbrand', s.length ? 'Brend' : '', s.length ? label('brand', s[0]) : 'Brend: hamısı', s.length > 0); }
  const chips = [];
  if (S.preset !== 'all') chips.push(`<button type="button" class="chip" data-c="date" aria-label="Tarix filtrini götür"><b>Tarix:</b> ${esc(S.preset === 'custom' ? rangeLabel() : presetName() + ' · ' + spanText())}<span class="x" aria-hidden="true">×</span></button>`);
  DIMS.forEach(d => S.sel[d.key].forEach(v => chips.push(
    `<button type="button" class="chip" data-c="${d.key}" data-v="${v}" aria-label="${esc(d.head + ': ' + label(d.key, v))} filtrini götür"><b>${esc(d.head)}:</b> ${esc(label(d.key, v))}<span class="x" aria-hidden="true">×</span></button>`)));
  $('chips').innerHTML = chips.join('');
  $('chipsRow').hidden = chips.length === 0;
  $('resetMain').disabled = chips.length === 0;
}

/* ====== KPI kartları ====== */
const KPI = [
  { id: 'tra', lab: 'Total Trafik' }, { id: 'sal', lab: 'Total Satış' }, { id: 'conv', lab: 'Conversion Rate' },
  { id: 'mur', lab: 'Total Müraciət' }, { id: 'mS', lab: 'Total Satış from Marketing' }, { id: 'mT', lab: 'Total Traffic from Marketing' },
];
const deltaPc = r => { const c = Math.abs(r) < 5e-4 ? 'flat' : r > 0 ? 'up' : 'down'; return `<span class="delta ${c}">${c === 'up' ? '▲' : c === 'down' ? '▼' : '•'} ${Math.abs(r * 100).toFixed(1)}%</span>`; };
const deltaPp = d => { const c = Math.abs(d) < 5e-5 ? 'flat' : d > 0 ? 'up' : 'down'; return `<span class="delta ${c}">${c === 'up' ? '▲' : c === 'down' ? '▼' : '•'} ${Math.abs(d * 100).toFixed(1)} pp</span>`; };
function renderKpis() {
  const k = R.k, conv = k.tra ? k.sal / k.tra : 0;
  const val = { tra: fmt(k.tra), sal: fmt(k.sal), conv: (conv * 100).toFixed(2) + '%', mur: fmt(k.mur), mS: fmt(k.mS), mT: fmt(k.mT) };
  const tip = { conv: 'Conversion Rate = Total Satış ÷ Total Trafik', mS: 'Satış kanalı marketinq tagı olan satışlar (' + CFG.marketing.join(', ') + ')', mT: 'Haradan Gəlib marketinq tagı olan trafik (' + CFG.marketing.join(', ') + ')' };
  $('kpis').innerHTML = KPI.map(d => `<div class="kpi" title="${esc(d.lab + (tip[d.id] ? ' — ' + tip[d.id] : ''))}"><div class="lab">${esc(d.lab)}</div><div class="val">${val[d.id]}</div></div>`).join('');
}

/* ====== Cədvəllər ====== */
const PAGE = 100;                                   // Looker kimi: səhifədə 100 sətir, qalanı ‹ › ilə
function buildGrid() {
  $('grid').innerHTML = DIMS.map(d => `<article class="tcard" id="card-${d.key}">
      <h2>${d.title}<button type="button" class="link clear" data-clear="${d.key}" hidden>Təmizlə</button></h2>
      <div class="tbox">
        <div class="thead" aria-hidden="true"><span></span><span class="c">${d.head}</span><span class="r">Record Count</span></div>
        <div class="tbody" id="tb-${d.key}" role="listbox" aria-label="${d.title}"></div>
        <div class="tfoot" id="tf-${d.key}"></div>
      </div></article>`).join('');
  const g = $('grid');
  g.addEventListener('click', e => {
    const row = e.target.closest('.trow'); if (row) return toggle(row.dataset.k, +row.dataset.v);
    const cl = e.target.closest('[data-clear]'); if (cl) { S.sel[cl.dataset.clear].clear(); update(); return; }
    const pg = e.target.closest('[data-pg]');
    if (pg && !pg.disabled) { const k = pg.dataset.pg; S.page[k] = (S.page[k] || 0) + (+pg.dataset.dir); renderTable(DIMS.findIndex(d => d.key === k)); $('tb-' + k).scrollTop = 0; }
  });
  g.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('trow')) { e.preventDefault(); toggle(e.target.dataset.k, +e.target.dataset.v); }
  });
}
function funnelHTML() {
  const c = R.counts[0], g = k => (k >= 0 ? c[k] : 0);
  const m = g(NOV.mur), t = g(NOV.tra), s = g(NOV.sal);
  return '<div class="funnel"><h3>Keçid nisbətləri</h3>' + [['Müraciət → Trafik', t, m], ['Trafik → Satış', s, t], ['Müraciət → Satış', s, m]]
    .map(([n, a, b]) => `<div class="fstep"><span>${n}</span><b>${b ? pct(a / b) : '—'}</b></div>`).join('') + '</div>';
}
function renderTable(i) {
  const d = DIMS[i], c = R.counts[i], sel = S.sel[d.key];
  const idx = []; let total = 0, max = 0;
  for (let v = 0; v < c.length; v++) {
    if (d.channel && v === 0) continue;
    total += c[v]; if (c[v] > max) max = c[v];
    if (c[v] > 0 || sel.has(v)) idx.push(v);
  }
  idx.sort((a, b) => c[b] - c[a] || a - b);
  const pages = Math.max(1, Math.ceil(idx.length / PAGE));
  const pg = Math.max(0, Math.min(S.page[d.key] || 0, pages - 1)); S.page[d.key] = pg;
  const shown = idx.slice(pg * PAGE, pg * PAGE + PAGE);
  const tb = $('tb-' + d.key);
  tb.classList.toggle('has-sel', sel.size > 0);
  tb.innerHTML = (shown.length ? shown.map((v, r) => {
    const lab = label(d.key, v), on = sel.has(v), heat = max ? 6 + 82 * c[v] / max : 0;
    return `<div class="trow${on ? ' sel' : ''}${c[v] === 0 ? ' zero' : ''}" role="option" tabindex="0" aria-selected="${on}" data-k="${d.key}" data-v="${v}" title="${esc(lab)} — ${fmt(c[v])} (${total ? pct(c[v] / total) : '—'})">`
      + `<span class="rk">${pg * PAGE + r + 1}.</span><span class="nm">${esc(lab)}</span>`
      + `<span class="hv${heat > 52 ? ' dark' : ''}" style="background:color-mix(in srgb, var(--accent) ${heat.toFixed(1)}%, transparent)">${fmt(c[v])}</span></div>`;
  }).join('') : '<div class="tempty">Seçilmiş filtrlərdə data yoxdur.</div>') + (d.key === 'nov' ? funnelHTML() : '');
  const from = idx.length ? pg * PAGE + 1 : 0, to = pg * PAGE + shown.length;
  $('tf-' + d.key).innerHTML = `<span class="cnt">Cəmi ${fmt(total)}</span><span>${from} - ${to} / ${idx.length}</span>`
    + `<button type="button" class="pg" data-pg="${d.key}" data-dir="-1" aria-label="Əvvəlki səhifə"${pg === 0 ? ' disabled' : ''}>‹</button>`
    + `<button type="button" class="pg" data-pg="${d.key}" data-dir="1" aria-label="Növbəti səhifə"${pg >= pages - 1 ? ' disabled' : ''}>›</button>`;
  $('card-' + d.key).querySelector('[data-clear]').hidden = sel.size === 0;
}

/* ====== Qrafik ====== */
const METRICS = [['all', 'Hamısı'], ['mur', 'Müraciət'], ['tra', 'Trafik'], ['sal', 'Satış']];
const MNAME = { all: 'qeyd (Record Count)', mur: 'müraciət', tra: 'trafik', sal: 'satış' };
const GRANS = [['day', 'Gün'], ['week', 'Həftə'], ['month', 'Ay']];
const MON3C = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
const MONC = MONTHS.map((m, i) => (i === 5 ? 'İyun' : i === 6 ? 'İyul' : m[0].toUpperCase() + m.slice(1)));
let CH = null, syncChartControls = () => {};

function buildChartControls() {
  $('segMetric').innerHTML = METRICS.map(([k, t]) => `<button type="button" data-m="${k}" aria-pressed="${S.metric === k}">${t}</button>`).join('');
  $('segGran').innerHTML = GRANS.map(([k, t]) => `<button type="button" data-g="${k}" aria-pressed="${S.gran === k}">${t}</button>`).join('');
  syncChartControls = () => {
    document.querySelectorAll('#segMetric [data-m]').forEach(b => { b.setAttribute('aria-pressed', b.dataset.m === S.metric); b.disabled = S.cmp; });
    document.querySelectorAll('#segGran [data-g]').forEach(b => { b.setAttribute('aria-pressed', b.dataset.g === S.gran); b.disabled = S.cmp; });
    $('cmpToggle').setAttribute('aria-pressed', S.cmp);
  };
  $('segMetric').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { S.metric = b.dataset.m; syncChartControls(); renderChart(); } };
  $('segGran').onclick = e => { const b = e.target.closest('[data-g]'); if (b) { S.gran = b.dataset.g; syncChartControls(); renderChart(); } };
  $('cmpToggle').onclick = () => {
    S.cmp = !S.cmp;
    $('cmpToggle').setAttribute('aria-pressed', S.cmp); syncChartControls();
    if (S.cmp && MK.months.length) {                          // bazar datası aylıqdır: dövr bazar aylarına düşür
      S.metric = 'sal'; S.gran = 'month'; syncChartControls();
      const [y1, m1] = MK.months[0].split('-').map(Number), [y2, m2] = MK.months[MK.months.length - 1].split('-').map(Number);
      const a = Math.max(0, idxOf(new Date(Date.UTC(y1, m1 - 1, 1)))), b = Math.min(L, idxOf(new Date(Date.UTC(y2, m2, 0))));
      return setRange(a, b);
    }
    renderChart();
  };
  $('tblToggle').onclick = () => { S.showTable = !S.showTable; $('tblToggle').setAttribute('aria-pressed', S.showTable); $('ctable').hidden = !S.showTable; renderChart(); };
}

function buckets() {
  const { from, to } = S, ser = R.series, out = [];
  let cur = null;
  const key = i => { if (S.gran === 'day') return i; const d = dateOf(i); return S.gran === 'week' ? i - ((d.getUTCDay() + 6) % 7) : d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  for (let i = from; i <= to; i++) {
    const k = key(i);
    if (!cur || cur.k !== k) { cur = { k, s: i, e: i, mur: 0, tra: 0, sal: 0, all: 0 }; out.push(cur); }
    cur.e = i; const j = i - from;
    for (let n = 0; n < ser.length; n++) cur.all += ser[n][j];
    if (NOV.mur >= 0) cur.mur += ser[NOV.mur][j];
    if (NOV.tra >= 0) cur.tra += ser[NOV.tra][j];
    if (NOV.sal >= 0) cur.sal += ser[NOV.sal][j];
  }
  return out;
}
const bLabel = b => {
  if (S.gran === 'day') return dLong(b.s);
  if (S.gran === 'week') return `${dShort(b.s, false)} – ${dShort(b.e)}`;
  const d = dateOf(b.s); return `${MONC[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
function niceTicks(max, n) {
  const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  const s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  const t = []; for (let v = 0; v <= Math.ceil(max / s) * s + 1e-9; v += s) t.push(Math.round(v * 1e3) / 1e3);
  return t;
}
const compact = v => v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'K' : fmt(v);

function xTicks(B, iw) {
  const n = B.length, cands = [];
  const span = S.to - S.from + 1;
  B.forEach((b, i) => {
    const d = dateOf(b.s), prev = i ? dateOf(B[i - 1].s) : null;
    if (S.gran === 'day' && span <= 62) {
      cands.push([i, `${d.getUTCDate()} ${MON3C[d.getUTCMonth()]}`]);
    } else if (!prev || prev.getUTCMonth() !== d.getUTCMonth()) {
      const newYear = !prev || prev.getUTCFullYear() !== d.getUTCFullYear();
      cands.push([i, MON3C[d.getUTCMonth()] + (newYear ? ' ' + d.getUTCFullYear() : ''), newYear]);
    }
  });
  const maxL = Math.max(2, Math.floor(iw / 68));
  if (cands.length <= maxL) return cands;
  if (S.gran === 'day' && span <= 62) { const st = Math.ceil(cands.length / maxL); return cands.filter((c, k) => k % st === 0); }
  const st = [2, 3, 4, 6, 12].find(s => Math.ceil(cands.length / s) <= maxL) || 12;
  return cands.filter(c => { const m = dateOf(B[c[0]].s).getUTCMonth(); return m % st === 0; })
    .map(c => { const d = dateOf(B[c[0]].s); return [c[0], MON3C[d.getUTCMonth()] + ' ' + d.getUTCFullYear()]; });
}

/* ====== Bazarla müqayisə (əsas qrafik, aylıq): bizim satış vs Market Sales Split ====== */
// Bazar xətti ana paneldəki Brend/Model filtrinə tabedir: filtr yoxdursa — bizim 7 brendin bazar satışı (S.cmpAll = bütün bazar).
const isOurs = b => CFG.ourBrands.some(o => norm(o) === norm(b));
const ymOf = i => { const d = dateOf(i); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
function marketByYM(yms, brandKey, modelKey, all) {  // ay (YYYY-MM) → bazar satışı; bazar datası olmayan ay = null; {vals, matched}
  const mi = new Map(yms.map((ym, k) => [ym, k])), have = new Set(MK.months), vals = yms.map(ym => have.has(ym) ? 0 : null);
  const bOk = MK.brands.map(b => brandKey ? norm(b) === brandKey : (all || isOurs(b)));
  const mOk = MK.models.map(m => !modelKey || norm(m) === modelKey);
  let matched = 0;
  for (const [m, b, md, c] of MK.rows) {
    if (!bOk[b] || !mOk[md]) continue;
    matched += c;
    const k = mi.get(MK.months[m]); if (k !== undefined) vals[k] += c;
  }
  return { vals, matched };
}
function cmpMarket(B) {
  const brandKey = S.sel.brand.size ? norm(DIMV.brand[[...S.sel.brand][0]]) : '';
  const modelKey = S.sel.model.size ? norm(DIMV.model[[...S.sel.model][0]]) : '';
  const r = marketByYM(B.map(b => ymOf(b.s)), brandKey, modelKey, S.cmpAll);
  const brandName = brandKey ? DIMV.brand[[...S.sel.brand][0]] : '';
  const brandInMk = !brandKey || MK.brands.some(b => norm(b) === brandKey);
  let scope = brandKey ? brandName : (S.cmpAll ? 'bütün bazar' : `bizim ${OURS_N} brend`);
  if (modelKey) scope += ' · ' + DIMV.model[[...S.sel.model][0]];
  let note = '';
  if (!brandInMk) note = `Bazar datasında «${brandName}» brendi yoxdur`;
  else if (modelKey && !r.matched) note = `Bazar datasında «${DIMV.model[[...S.sel.model][0]]}» modeli yoxdur`;
  return { vals: note ? B.map(() => null) : r.vals, scope, note, brandKey, modelKey };
}
function renderCmpChart() {
  if (S.gran !== 'month') S.gran = 'month';
  const B = buckets(), n = B.length, vals = B.map(b => b.sal), MKS = cmpMarket(B), mvals = MKS.vals;
  const svg = $('svg'), W = Math.max(280, Math.round($('plot').clientWidth)), H = 290;
  const m = { l: 52, r: 22, t: 24, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const step = n > 1 ? iw / (n - 1) : iw;
  let vmax = 0; vals.forEach(v => { if (v > vmax) vmax = v; }); mvals.forEach(v => { if (v != null && v > vmax) vmax = v; });
  const ticks = niceTicks(Math.max(vmax, 4), 4), ymax = ticks[ticks.length - 1];
  const x = i => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw), y = v => m.t + ih - (v / ymax) * ih;
  let s = '';
  ticks.forEach((t, k) => { s += `<line class="${k ? 'g-grid' : 'g-base'}" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${compact(t)}</text>`; });
  xTicks(B, iw).forEach(([i, t]) => { const xx = x(i).toFixed(1); s += `<line class="g-base" x1="${xx}" x2="${xx}" y1="${m.t + ih}" y2="${m.t + ih + 4}"/><text x="${xx}" y="${H - 8}" text-anchor="middle">${esc(t)}</text>`; });
  if (n) {
    let dm = '', pen = false;                          // bazar — narıncı qırıq xətt, içiboş nöqtə
    mvals.forEach((v, i) => { if (v == null) { pen = false; return; } dm += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; });
    if (dm) s += `<path class="mk-line dash ln2" d="${dm}"/>`;
    mvals.forEach((v, i) => { if (v != null) s += `<circle class="mk-pt hollow ln2" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5"/>`; });
    let d = ''; for (let i = 0; i < n; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(vals[i]).toFixed(1);
    if (n > 1) s += `<path class="g-area" d="${d}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z"/><path class="g-line" d="${d}"/>`;
    for (let i = 0; i < n; i++) s += `<circle class="g-pt" cx="${x(i).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="3"/>`;
    if (step >= 30 && W >= 520) for (let i = 0; i < n; i++) {   // (telefonda iki xəttin rəqəmləri üst-üstə düşür — tooltip qalır) rəqəmlər: satış üstdə, bazar altda; üst-üstə düşəndə bazar aşağı sürüşür
      const ys = Math.max(m.t - 6, y(vals[i]) - 8);
      s += `<text class="pl" x="${x(i).toFixed(1)}" y="${ys.toFixed(1)}" text-anchor="middle">${fmt(vals[i])}</text>`;
      if (mvals[i] != null) { let ym = y(mvals[i]) - 8; if (Math.abs(ym - ys) < 11) ym = y(mvals[i]) + 15; s += `<text class="pl2" x="${x(i).toFixed(1)}" y="${Math.min(m.t + ih - 2, ym).toFixed(1)}" text-anchor="middle">${fmt(mvals[i])}</text>`; }
    }
    s += `<circle class="g-dot" cx="${x(n - 1).toFixed(1)}" cy="${y(vals[n - 1]).toFixed(1)}" r="4"/>`;
  }
  s += `<rect id="brush" class="g-brush" x="0" y="${m.t}" width="0" height="${ih}" visibility="hidden"/>`
     + `<line id="xh" class="g-xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/><circle id="xd" class="g-dot" r="4.5" visibility="hidden"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = s; svg.style.height = H + 'px';
  CH = { B, vals, x, y, m, W, H, iw, ih, n, cmp: true, mvals, scope: MKS.scope };
  const tot = vals.reduce((a, b) => a + b, 0), mtot = mvals.reduce((a, b) => a + (b || 0), 0), cov = mvals.filter(v => v != null).length;
  const selTxt = [S.sel.brand.size ? label('brand', [...S.sel.brand][0]) : 'bütün brendlər', S.sel.model.size ? label('model', [...S.sel.model][0]) : ''].filter(Boolean).join(' · ');
  $('chartSub').innerHTML = `<span class="legend"><i></i>Bizim satış <b>${fmt(tot)}</b><span class="lg-sub">${esc(selTxt)}</span></span>`
    + `<span class="legend"><i class="d" style="border-color:var(--s2)"></i>Bazar <b>${fmt(mtot)}</b><span class="lg-sub">${esc(MKS.scope)}</span></span>`
    + `<span>Bazar payımız: <strong style="font-size:15px">${mtot ? (tot / mtot * 100).toFixed(1) + '%' : '—'}</strong></span>`
    + `<span>${esc(spanText())}</span>` + (cov < n ? `<span>Bazar datası ${cov}/${n} ayda var</span>` : '')
    + (MKS.brandKey ? '' : `<span class="seg seg-sm" id="cmpScope"><button type="button" data-a="0" aria-pressed="${!S.cmpAll}">Bizim ${OURS_N} brend</button><button type="button" data-a="1" aria-pressed="${S.cmpAll}">Bütün bazar</button></span>`);
  const sc = $('cmpScope'); if (sc) sc.onclick = e => { const b = e.target.closest('[data-a]'); if (b) { S.cmpAll = b.dataset.a === '1'; renderChart(); } };
  $('plotHint').innerHTML = MKS.note ? `<b>${esc(MKS.note)}.</b>` : '';
  svg.setAttribute('aria-label', `Bizim satış və bazar müqayisəsi, ${spanText()}, satış ${fmt(tot)}, bazar ${fmt(mtot)}`);
  if (S.showTable) {
    $('ctable').innerHTML = `<table><thead><tr><th>Dövr</th><th>Bizim satış</th><th>Bazar</th><th>Pay</th></tr></thead><tbody>`
      + B.map((b, i) => `<tr><td>${esc(bLabel(b))}</td><td>${fmt(vals[i])}</td><td>${mvals[i] == null ? '—' : fmt(mvals[i])}</td><td>${mvals[i] ? (vals[i] / mvals[i] * 100).toFixed(1) + '%' : '—'}</td></tr>`).reverse().join('') + '</tbody></table>';
  }
  hideHover();
}
function cmpTipHTML(i) {
  const b = CH.B[i], mv = CH.mvals[i];
  return `<div class="td">${esc(bLabel(b))}</div>`
    + `<div class="tr"><span><i class="key"></i>Bizim satış</span><b>${fmt(b.sal)}</b></div>`
    + `<div class="tr"><span><i class="key" style="background:var(--s2)"></i>Bazar (${esc(CH.scope)})</span><b>${mv == null ? '—' : fmt(mv)}</b></div>`
    + `<div class="tr"><span><i class="key" style="visibility:hidden"></i>Bazar payımız</span><b>${mv ? (b.sal / mv * 100).toFixed(1) + '%' : '—'}</b></div>`;
}
function renderChart() {
  if (S.cmp && MK.rows.length > 0) return renderCmpChart();
  $('svg').style.height = '';
  $('plotHint').textContent = '';
  const B = buckets(), mk = S.metric, vals = B.map(b => b[mk]), n = B.length, cmp = false, mvals = null;
  const svg = $('svg'), W = Math.max(280, Math.round($('plot').clientWidth)), H = 270;
  const m = { l: 50, r: 22, t: 22, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const step = n > 1 ? iw / (n - 1) : iw;
  let vmax = 0, peak = 0; vals.forEach((v, i) => { if (v > vmax) { vmax = v; peak = i; } });
  const ticks = niceTicks(Math.max(vmax, 4), 4), ymax = ticks[ticks.length - 1];
  const x = i => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = v => m.t + ih - (v / ymax) * ih;
  let s = '';
  ticks.forEach((t, k) => { s += `<line class="${k ? 'g-grid' : 'g-base'}" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${compact(t)}</text>`; });
  xTicks(B, iw).forEach(([i, t]) => { const xx = x(i).toFixed(1); s += `<line class="g-base" x1="${xx}" x2="${xx}" y1="${m.t + ih}" y2="${m.t + ih + 4}"/><text x="${xx}" y="${H - 8}" text-anchor="middle">${esc(t)}</text>`; });
  if (n) {
    let d = ''; for (let i = 0; i < n; i++) d += (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(vals[i]).toFixed(1);
    if (n > 1) s += `<path class="g-area" d="${d}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z"/><path class="g-line" d="${d}"/>`;
    if (step >= 24) for (let i = 0; i < n; i++) s += `<circle class="g-pt" cx="${x(i).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="3"/>`;
    if (step >= 34) for (let i = 0; i < n; i++) s += `<text class="pl" x="${x(i).toFixed(1)}" y="${Math.max(m.t - 6, y(vals[i]) - 8).toFixed(1)}" text-anchor="middle">${fmt(vals[i])}</text>`;
    s += `<circle class="g-dot" cx="${x(n - 1).toFixed(1)}" cy="${y(vals[n - 1]).toFixed(1)}" r="4"/>`;
  }
  s += `<rect id="brush" class="g-brush" x="0" y="${m.t}" width="0" height="${ih}" visibility="hidden"/>`
     + `<line id="xh" class="g-xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`
     + `<circle id="xd" class="g-dot" r="4.5" visibility="hidden"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
  CH = { B, vals, x, y, m, W, H, iw, ih, n, cmp, mvals };
  const tot = vals.reduce((a, b) => a + b, 0), days = S.to - S.from + 1;
  const gw = { day: 'gün', week: 'həftə', month: 'ay' }[S.gran];
  $('chartSub').innerHTML = `<span class="legend"><i></i>${{ all: 'Record Count', mur: 'Müraciət', tra: 'Trafik', sal: 'Satış' }[mk]}</span><span><strong>${fmt(tot)}</strong>${MNAME[mk]} · ${esc(spanText())}</span><span>Gündəlik orta: ${fmt(tot / days)}</span>`
    + (n ? `<span>Ən yüksək ${gw}: ${fmt(vmax)} (${esc(bLabel(B[peak]))})</span>` : '');
  svg.setAttribute('aria-label', `${MNAME[mk]} qrafiki, ${spanText()}, cəmi ${fmt(tot)}`);
  if (S.showTable) {
    $('ctable').innerHTML = `<table><thead><tr><th>Dövr</th><th>Müraciət</th><th>Trafik</th><th>Satış</th><th>Cəmi</th></tr></thead><tbody>`
      + B.slice().reverse().map(b => `<tr><td>${esc(bLabel(b))}</td><td>${fmt(b.mur)}</td><td>${fmt(b.tra)}</td><td>${fmt(b.sal)}</td><td>${fmt(b.all)}</td></tr>`).join('') + '</tbody></table>';
  }
  hideHover();
}

function hideHover() { const t = $('tip'); t.classList.remove('show'); ['xh', 'xd'].forEach(id => { const e = $(id); if (e) e.setAttribute('visibility', 'hidden'); }); }
function showHover(i) {
  if (!CH || !CH.n) return;
  const b = CH.B[i], xx = CH.x(i), yy = CH.y(CH.vals[i]);
  const xh = $('xh'), xd = $('xd');
  xh.setAttribute('x1', xx); xh.setAttribute('x2', xx); xh.setAttribute('visibility', 'visible');
  xd.setAttribute('cx', xx); xd.setAttribute('cy', yy); xd.setAttribute('visibility', 'visible');
  const tip = $('tip');
  if (CH.cmp) tip.innerHTML = cmpTipHTML(i);
  else {
    const rows = METRICS.map(([k, t]) => [k, k === 'all' ? 'Cəmi' : t]);
    rows.sort((a, z) => (a[0] === S.metric ? -1 : z[0] === S.metric ? 1 : 0));
    tip.innerHTML = `<div class="td">${esc(bLabel(b))}</div>` + rows.map(([k, t]) =>
      `<div class="tr"><span>${k === S.metric ? '<i class="key"></i>' : '<i class="key" style="visibility:hidden"></i>'}${t}</span>${k === S.metric ? `<b>${fmt(b[k])}</b>` : `<span>${fmt(b[k])}</span>`}</div>`).join('');
  }
  const svgR = $('svg').getBoundingClientRect(), plotR = $('plot').getBoundingClientRect();
  const px = svgR.left - plotR.left + xx * (svgR.width / CH.W);
  tip.classList.add('show');
  const tw = tip.offsetWidth;
  tip.style.left = (px + 14 + tw > plotR.width ? px - 14 - tw : px + 14) + 'px';
  tip.style.top = '8px';
}
function clickBucket(i) {                             // klik: həmin dövrə fokuslan; eyni dövrə təkrar klik — əvvəlki aralığa qayıt
  const b = CH.B[i];
  if (S.from === b.s && S.to === b.e && S.clickPrev) { const p = S.clickPrev; S.clickPrev = null; S.gran = p.gran; S.cmp = p.cmp; syncChartControls(); setRange(p.from, p.to); return; }
  S.clickPrev = { from: S.from, to: S.to, gran: S.gran, cmp: S.cmp };
  if (S.gran !== 'day' || S.cmp) { S.gran = 'day'; S.cmp = false; syncChartControls(); }   // seçilmiş dövrün günlük canlı datası görünsün
  setRange(b.s, b.e);
}
function bindPlot() {
  const plot = $('plot'), svg = $('svg');
  let drag = null, kbd = -1;
  const idxAt = cx => { const r = svg.getBoundingClientRect(), px = (cx - r.left) * (CH.W / r.width); const t = CH.n <= 1 ? 0 : Math.round((px - CH.m.l) / CH.iw * (CH.n - 1)); return Math.max(0, Math.min(CH.n - 1, t)); };
  const drawBrush = () => { const br = $('brush'), a = CH.x(Math.min(drag.i0, drag.i1)), z = CH.x(Math.max(drag.i0, drag.i1)); br.setAttribute('x', a); br.setAttribute('width', Math.max(1, z - a)); br.setAttribute('visibility', 'visible'); };
  plot.addEventListener('pointermove', e => { if (!CH || !CH.n) return; const i = idxAt(e.clientX); showHover(i); if (drag) { drag.i1 = i; if (Math.abs(e.clientX - drag.x0) > 6) drawBrush(); } });
  plot.addEventListener('pointerleave', () => { if (!drag) hideHover(); });
  plot.addEventListener('pointerdown', e => { if (!CH || CH.n < 1 || e.button > 0) return; const i = idxAt(e.clientX); drag = { i0: i, i1: i, x0: e.clientX }; try { plot.setPointerCapture(e.pointerId); } catch (_) {} });
  plot.addEventListener('pointerup', e => {
    if (!drag) return; const d = drag; drag = null;
    if (Math.abs(e.clientX - d.x0) > 8 && d.i0 !== d.i1) { const a = Math.min(d.i0, d.i1), z = Math.max(d.i0, d.i1); setRange(CH.B[a].s, CH.B[z].e); }
    else {
      const br = $('brush'); if (br) br.setAttribute('visibility', 'hidden');
      if (CH && CH.n && d.i0 === d.i1) clickBucket(d.i0);
    }
  });
  plot.addEventListener('pointercancel', () => { drag = null; const br = $('brush'); if (br) br.setAttribute('visibility', 'hidden'); hideHover(); });
  svg.setAttribute('tabindex', '0');
  svg.addEventListener('keydown', e => {
    if (!CH || !CH.n) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); kbd = kbd < 0 ? CH.n - 1 : Math.max(0, Math.min(CH.n - 1, kbd + (e.key === 'ArrowRight' ? 1 : -1))); showHover(kbd); }
  });
  svg.addEventListener('blur', () => { kbd = -1; hideHover(); });
}

/* ====== Yeniləmə ====== */
function update() {
  R = compute();
  renderFilters(); renderKpis();
  DIMS.forEach((d, i) => renderTable(i));
  renderChart();
  if (openPop && openPop.pop._draw) openPop.pop._draw();
}
/* ====== Real Stok lövhəsi ====== */
// Brend kartları (model cədvəli: stok / satış) + seçilmiş modelin detal paneli.
// Dövr (Real Stock "Tarix" sütunu, YYYY-MM): from/to = RS.periods indeksləri. Aralıqda stok son aydan, hədəf/satış/beh ayların cəmi.
const RS = { rows: [], periods: [], from: 0, to: -1, preset: 'l1', q: '', year: '', only: 'all', sort: 'pct', sel: '', ver: -1, gs: [], live: false, at: 0, border: [] };
const RS_ONLY = [['all', 'Hamısı'], ['stock', 'Stokda var'], ['target', 'Hədəfi olan'], ['gap', 'Hədəfdən geri']];
const RS_SORT = [['pct', 'Hədəf %'], ['real', 'Real Stok'], ['hedef', 'Hədəf'], ['actual', 'Satış'], ['price', 'Qiymət'], ['name', 'Ad']];
const RS_SUM = ['stok', 'real', 'hedef', 'actual', 'beh'];
const money = v => v == null ? '—' : fmt(v) + ' ₼';
const ratio = (a, h) => h ? a / h : null;
const ratioTxt = p => p == null ? '—' : (p * 100).toFixed(0) + '%';
const dash = v => v ? fmt(v) : '<span class="nil">–</span>';
const rsBar = p => `<span class="rsx-bar"><i class="${p != null && p >= 1 ? 'done' : ''}" style="width:${p == null ? 0 : Math.min(100, p * 100).toFixed(0)}%"></i></span>`;
const pctTxt = s => { const a = [...s].sort((x, y) => x - y); return !a.length ? '—' : a.length === 1 ? a[0] + '%' : a[0] + '–' + a[a.length - 1] + '%'; };
function rsPeriodRows() {
  if (!RS.periods.length) return RS.rows;
  if (RS.from === RS.to) { const p = RS.periods[RS.from]; return RS.rows.filter(r => r.period === p); }
  const lo = RS.periods[RS.from], hi = RS.periods[RS.to];
  const inRange = RS.rows.filter(r => r.period >= lo && r.period <= hi).sort((a, b) => a.period.localeCompare(b.period));
  const out = new Map();                                // versiya üzrə: son ayın sətri + satış sahələrinin cəmi
  for (const r of inRange) {
    const k = [r.brand, r.model, r.version, r.year].join('|'), o = out.get(k);
    out.set(k, o ? { ...r, hedef: o.hedef + r.hedef, actual: o.actual + r.actual, beh: o.beh + r.beh, qeyd: r.qeyd || o.qeyd } : { ...r });
  }
  return [...out.values()];
}
/* --- dövr seçimi (Bazar payı bölməsinin seçicisi ilə eyni) --- */
const RS_PRESETS = [['all', 'Bütün dövr'], ['l1', 'Son ay'], ['l3', 'Son 3 ay'], ['l6', 'Son 6 ay'], ['ytd', 'Bu il'], ['py', 'Keçən il']];
function rsPresetRange(id) {
  const P = RS.periods, last = P.length - 1;
  if (!P.length) return null;                           // Sheet-də "Tarix" sütunu hələ yoxdur
  const yL = P[last].slice(0, 4);
  switch (id) {
    case 'l1': return [last, last];
    case 'l3': return [Math.max(0, last - 2), last];
    case 'l6': return [Math.max(0, last - 5), last];
    case 'ytd': return [P.findIndex(m => m.startsWith(yL)), last];
    case 'py': { const y = String(+yL - 1), idx = P.map((m, i) => [m, i]).filter(([m]) => m.startsWith(y)); return idx.length ? [idx[0][1], idx[idx.length - 1][1]] : null; }
    default: return [0, last];
  }
}
function rsRangeLabel() {
  const P = RS.periods, span = RS.from === RS.to ? mLong(P[RS.from]) : mLabel(P[RS.from]) + ' – ' + mLabel(P[RS.to]);
  const p = RS_PRESETS.find(q => q[0] === RS.preset);
  return p ? p[1] + ' · ' + span : span;
}
function rsSetRange(a, b, preset) {
  RS.from = Math.min(a, b); RS.to = Math.max(a, b);
  RS.preset = preset || (RS.from === 0 && RS.to === RS.periods.length - 1 ? 'all' : 'custom');
  syncRs();
}
let rsAnchor = -1;
function openRsDatePop() {
  const w = $('fw-rsDate');
  if (openPop && openPop.wrap === w) return closePop();
  closePop(); rsAnchor = -1;
  const P = RS.periods, empty = !P.length, years = empty ? [String(new Date().getFullYear())] : [...new Set(P.map(m => m.slice(0, 4)))];
  const pop = document.createElement('div');
  pop.className = 'pop date mkdate'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Dövr');
  pop.innerHTML = `<div class="presets" role="listbox">${RS_PRESETS.map(([id, t]) => { const r = rsPresetRange(id);
      return `<button type="button" class="opt" role="option" data-p="${id}" aria-selected="${empty ? id === 'all' : RS.preset === id}"${r ? '' : ' disabled'}><span class="chk">✓</span>${t}</button>`; }).join('')}</div>
    <div class="dcal"><h4>Ay seç</h4><div class="years">${years.map(y => `<div class="yr"><button type="button" class="ybtn" data-y="${y}"${empty ? ' disabled' : ''}>${y}</button><div class="mg">${MON3C.map((nm, mi) => {
        const i = P.indexOf(y + '-' + String(mi + 1).padStart(2, '0'));
        return `<button type="button" class="mb" data-i="${i}"${i < 0 ? ' disabled' : ''}>${nm}</button>`; }).join('')}</div></div>`).join('')}</div>
      <p class="mhint">${empty ? 'Aylar Real Stock vərəqinə "Tarix" sütunu əlavə olunanda aktiv olacaq. Hazırda vərəqin son vəziyyəti göstərilir.'
        : 'Bir aya klik — həmin ay. İkinci aya klik — aralıq (məs. yanvar → mart). İlə klik — bütün il. Aralıqda stok son aydan, hədəf / satış / beh ayların cəmidir.'}</p>
      <div class="pop-actions mk-actions"><button type="button" class="btn" id="rsDateReset">Sıfırla</button><button type="button" class="btn primary" id="rsDateClose">Bağla</button></div></div>`;
  mountPop(w, pop);
  const paint = () => {
    pop.querySelectorAll('.mb').forEach(b => { const i = +b.dataset.i; b.classList.toggle('sel', i >= 0 && i >= RS.from && i <= RS.to); b.classList.toggle('anchor', i === rsAnchor); });
    pop.querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-selected', b.dataset.p === (empty ? 'all' : RS.preset)));
  };
  paint();
  pop.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const r = rsPresetRange(b.dataset.p); if (!r) return; rsAnchor = -1; rsSetRange(r[0], r[1], b.dataset.p); paint(); });
  pop.querySelectorAll('.ybtn').forEach(b => b.onclick = () => { const idx = P.map((m, i) => [m, i]).filter(([m]) => m.startsWith(b.dataset.y)); if (!idx.length) return; rsAnchor = -1; rsSetRange(idx[0][1], idx[idx.length - 1][1]); paint(); });
  pop.querySelectorAll('.mb').forEach(b => b.onclick = () => {
    const i = +b.dataset.i; if (i < 0) return;
    if (rsAnchor >= 0) { rsSetRange(rsAnchor, i); rsAnchor = -1; } else { rsAnchor = i; rsSetRange(i, i); }
    paint();
  });
  $('rsDateReset').onclick = () => { rsAnchor = -1; const r = rsPresetRange('l1'); if (r) { rsSetRange(r[0], r[1], 'l1'); paint(); } };
  $('rsDateClose').onclick = closePop;
}
function rsGroups() {
  const out = new Map();
  for (const r of rsPeriodRows()) {
    if (RS.year && String(r.year == null ? '' : r.year) !== RS.year) continue;
    if (RS.q && !norm(r.model + ' ' + r.version).includes(RS.q)) continue;
    const k = r.brand + '|' + r.model;
    let g = out.get(k);
    if (!g) { g = { key: k, brand: r.brand, model: r.model, rows: [], years: new Set(), price: null, prices: new Set(), ilkin: null, faiz: new Set(), muddet: new Set(), ayliq: null }; RS_SUM.forEach(f => g[f] = 0); out.set(k, g); }
    g.rows.push(r); RS_SUM.forEach(f => g[f] += r[f]);
    if (r.year != null) g.years.add(r.year);
    if (r.price != null) { g.prices.add(r.price); if (g.price == null || r.price < g.price) g.price = r.price; }
    if (r.ilkin != null && (g.ilkin == null || r.ilkin < g.ilkin)) g.ilkin = r.ilkin;
    if (r.faiz != null) g.faiz.add(r.faiz);
    if (r.muddet) g.muddet.add(r.muddet);
    if (r.ayliq != null && (g.ayliq == null || r.ayliq < g.ayliq)) g.ayliq = r.ayliq;
  }
  let gs = [...out.values()];
  if (RS.only === 'stock') gs = gs.filter(g => g.real > 0);
  else if (RS.only === 'target') gs = gs.filter(g => g.hedef > 0);
  else if (RS.only === 'gap') gs = gs.filter(g => g.hedef > 0 && g.actual < g.hedef);
  const pc = g => g.hedef ? g.actual / g.hedef : -1;
  const cmp = { real: (a, b) => b.real - a.real, hedef: (a, b) => b.hedef - a.hedef, actual: (a, b) => b.actual - a.actual,
    pct: (a, b) => pc(b) - pc(a), price: (a, b) => (a.price == null ? Infinity : a.price) - (b.price == null ? Infinity : b.price),
    name: (a, b) => a.model.localeCompare(b.model, 'az') };
  const inner = cmp[RS.sort] || cmp.pct;
  const bi = b => { const i = RS.border.indexOf(b); return i < 0 ? 99 : i; };   // brendlər Sheet-dəki ardıcıllıqla
  return gs.sort((a, b) => (bi(a.brand) - bi(b.brand)) || inner(a, b) || a.model.localeCompare(b.model, 'az'));
}
// Kartda model adından brend prefiksi atılır ("Lynk & Co 06" → "06")
const shortModel = (brand, model) => { const b = norm(brand) + ' ', m = norm(model); return m.startsWith(b) && model.length > brand.length + 1 ? model.slice(brand.length + 1) : model; };
const RS_COLS = '<colgroup><col><col class="n"><col class="n"><col class="n"><col class="n"><col class="n"></colgroup>';
function renderRS() {
  const gs = rsGroups(), t = {}; RS_SUM.forEach(f => t[f] = 0);
  gs.forEach(g => RS_SUM.forEach(f => t[f] += g[f]));
  const brands = [], bm = new Map();
  gs.forEach(g => {
    let b = bm.get(g.brand);
    if (!b) { b = { brand: g.brand, gs: [] }; RS_SUM.forEach(f => b[f] = 0); bm.set(g.brand, b); brands.push(b); }
    b.gs.push(g); RS_SUM.forEach(f => b[f] += g[f]);
  });
  RS.gs = gs;
  if (!gs.some(g => g.key === RS.sel)) { RS.sel = gs.length ? gs[0].key : ''; RS.ver = -1; }
  const tp = ratio(t.actual, t.hedef);
  const span = !RS.periods.length ? '' : RS.from === RS.to ? mLong(RS.periods[RS.from]) : mLabel(RS.periods[RS.from]) + ' – ' + mLabel(RS.periods[RS.to]);
  $('rsEb').textContent = 'SATIŞ VƏ STOK · ' + brands.length + ' BREND' + (span ? ' · ' + span.toLocaleUpperCase('az') : '');
  { const b = $('fb-rsDate'); b.querySelector('.v').textContent = RS.periods.length ? rsRangeLabel() : 'Bütün dövr'; b.classList.toggle('on', !!RS.periods.length && RS.preset !== 'l1'); }
  $('rsPct').textContent = tp == null ? '—' : ratioTxt(tp) + ' icra';
  $('rsSum').textContent = `${fmt(t.actual)} / ${fmt(t.hedef)} satış · stok ${fmt(t.stok)} · real stok ${fmt(t.real)} · beh ${fmt(t.beh)}`;
  const head = `<table class="rsx-t">${RS_COLS}<thead><tr><th rowspan="2" class="m">Model</th><th colspan="2" class="grp">Stok</th><th colspan="3" class="grp">Satış</th></tr>`
    + '<tr><th>Ümumi</th><th>Real</th><th>Hədəf</th><th>Fakt</th><th>Beh</th></tr></thead></table>';
  const row = g => {
    const on = g.key === RS.sel, behind = g.hedef > 0 && g.actual < g.hedef;
    return `<tr data-g="${esc(g.key)}" tabindex="0" aria-selected="${on}"${on ? ' class="on"' : ''}>`
      + `<td class="m" title="${esc(g.model)}">${esc(shortModel(g.brand, g.model))}</td><td>${dash(g.stok)}</td><td class="b">${dash(g.real)}</td>`
      + `<td>${dash(g.hedef)}</td><td class="b${behind ? ' bad' : ''}">${dash(g.actual)}</td><td>${dash(g.beh)}</td></tr>`;
  };
  $('rsGrid').innerHTML = brands.length ? brands.map(b => {
    const p = ratio(b.actual, b.hedef);
    return `<article class="rsx-card"><header class="rsx-ch"><div class="rsx-bt"><h3>${esc(b.brand)}</h3><b>${ratioTxt(p)}</b></div>${rsBar(p)}`
      + `<div class="rsx-bs"><span>Hədəf <b>${fmt(b.hedef)}</b></span><span>Satış <b>${fmt(b.actual)}</b></span><span>Beh <b>${fmt(b.beh)}</b></span></div></header>`
      + `<div class="rsx-hd">${head}</div><div class="rsx-sc"><table class="rsx-t">${RS_COLS}<tbody>${b.gs.map(row).join('')}</tbody></table></div></article>`;
  }).join('') : '<div class="rs-empty">Seçilmiş filtrlərə uyğun model yoxdur.</div>';
  renderRsDet();
  $('rsUpd').textContent = (RS.live ? 'Sheet-dən yükləndi' : 'snapshot') + (RS.at ? ' · ' + whenTxt(RS.at) : '')
    + ' · ' + fmt(RS.rows.length) + ' sətir';
  $('rsReset').disabled = !(RS.q || RS.year || RS.only !== 'all' || RS.sort !== 'pct' || (RS.periods.length && RS.preset !== 'l1'));
}
function renderRsDet() {
  const el = $('rsDet'), g = RS.gs.find(x => x.key === RS.sel);
  if (!g) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  if (RS.ver >= g.rows.length) RS.ver = -1;
  const r = RS.ver >= 0 ? g.rows[RS.ver] : null, o = r || g, multi = !r && g.rows.length > 1;
  const p = ratio(o.actual, o.hedef), left = Math.max(0, o.hedef - o.actual);
  const ys = [...g.years].sort((a, b) => a - b);
  const yr = r ? (r.year == null ? '—' : r.year) : !ys.length ? '—' : ys.length > 1 ? ys[0] + '–' + ys[ys.length - 1] : ys[0];
  const st = !o.hedef ? ['', 'Hədəf yoxdur'] : o.actual >= o.hedef ? ['ok', 'Hədəfdə'] : ['bad', 'Hədəfdən geri'];
  const vers = g.rows.length > 1
    ? `<div class="rsx-vers" role="group" aria-label="Versiya">` + [[-1, 'Bütün versiyalar']].concat(g.rows.map((x, i) => [i, x.version || '(versiya adı yoxdur)']))
      .map(([i, n]) => `<button type="button" data-ver="${i}" aria-pressed="${i === RS.ver}">${esc(n)}</button>`).join('') + '</div>'
    : (g.rows[0].version ? `<div class="rsx-v1">${esc(g.rows[0].version)}</div>` : '');
  const cell = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
  const line = (l, v) => `<div><dt>${l}</dt><dd>${v}</dd></div>`;
  el.innerHTML = `<div class="rsx-d1"><div class="rsx-eb">${esc(g.brand)}</div><h3 class="rsx-mn">${esc(g.model)}</h3>`
    + `<div class="rsx-tags"><span>${yr}</span><span>${g.rows.length} versiya</span><span class="st ${st[0]}">${st[1]}</span></div>${vers}`
    + `<div class="rsx-ex"><div class="rsx-exh"><span>Hədəf icrası</span><b>${ratioTxt(p)}</b></div>${rsBar(p)}`
    + `<p>${o.hedef ? `${fmt(o.actual)} satılıb, hədəf ${fmt(o.hedef)} — ${left ? fmt(left) + ' qalıb' : 'hədəf tamamlanıb'}` : `${fmt(o.actual)} satılıb, hədəf təyin olunmayıb`}</p></div></div>`
    + `<div class="rsx-d2"><h4>Stok və satış</h4><div class="rsx-cells">`
    + cell('Stok', fmt(o.stok)) + cell('Real stok', fmt(o.real)) + cell('Beh', fmt(o.beh))
    + cell('Hədəf', fmt(o.hedef)) + cell('Satış', fmt(o.actual)) + cell('Qalan', o.hedef ? fmt(left) : '—') + '</div></div>'
    + `<div class="rsx-d3"><h4>Qiymət və ödəniş</h4><dl>`
    + line('Nağd qiymət', money(o.price)) + line('İlkin faiz', r ? (r.faiz == null ? '—' : r.faiz + '%') : pctTxt(g.faiz))
    + line('İlkin ödəniş', money(o.ilkin)) + line('Müddət', esc(r ? r.muddet || '—' : [...g.muddet].join(' / ') || '—'))
    + line('Aylıq ödəniş', money(o.ayliq)) + '</dl>'
    + (multi ? '<p class="rsx-fn">Bir neçə versiya olduqda qiymət və ödənişlər ən aşağı göstəricidir. <span class="bad">Qırmızı fakt</span> — hədəfdən geri.</p>' : '<p class="rsx-fn"><span class="bad">Qırmızı fakt</span> — hədəfdən geri.</p>')
    + (r && r.qeyd ? `<div class="note">${esc(r.qeyd)}</div>` : '') + '</div>';
}
function rsSelect(key) {
  if (RS.sel === key) return;
  RS.sel = key; RS.ver = -1;
  document.querySelectorAll('#rsGrid tr[data-g]').forEach(tr => { const on = tr.dataset.g === key; tr.classList.toggle('on', on); tr.setAttribute('aria-selected', on); });
  renderRsDet();
}
function buildRsFilters() {
  const tabs = (el, items, cur, on) => {
    $(el).innerHTML = items.map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === cur}">${esc(t)}</button>`).join('');
    $(el).onclick = e => { const b = e.target.closest('[data-v]'); if (b) { on(b.dataset.v); } };
  };
  $('fw-rsDate').innerHTML = `<button type="button" class="fbtn" id="fb-rsDate" aria-haspopup="dialog" aria-expanded="false">${CAL}<span class="k"></span><span class="v"></span>${CHEV}</button>`;
  $('fb-rsDate').onclick = openRsDatePop;
  const years = [...new Set(RS.rows.map(r => r.year).filter(y => y != null))].sort((a, b) => b - a);
  tabs('rsYears', [['', 'Bütün illər']].concat(years.map(y => [String(y), String(y)])), RS.year, v => { RS.year = v; syncRs(); });
  tabs('rsOnly', RS_ONLY, RS.only, v => { RS.only = v; syncRs(); });
  tabs('rsSort', RS_SORT, RS.sort, v => { RS.sort = v; syncRs(); });
  $('rsSearch').oninput = () => { RS.q = norm($('rsSearch').value); renderRS(); };
  $('rsReset').onclick = () => { rsLastMonth(); RS.year = ''; RS.only = 'all'; RS.sort = 'pct'; RS.q = ''; $('rsSearch').value = ''; RS.sel = ''; RS.ver = -1; syncRs(); };
  const grid = $('rsGrid');
  grid.onclick = e => { const tr = e.target.closest('tr[data-g]'); if (tr) rsSelect(tr.dataset.g); };
  grid.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-g]')) { e.preventDefault(); rsSelect(e.target.dataset.g); } };
  $('rsDet').onclick = e => { const b = e.target.closest('[data-ver]'); if (b) { RS.ver = +b.dataset.ver; renderRsDet(); } };
}
function rsLastMonth() { RS.from = RS.to = RS.periods.length - 1; RS.preset = 'l1'; }
function syncRs() {
  [['rsYears', RS.year], ['rsOnly', RS.only], ['rsSort', RS.sort]].forEach(([el, cur]) =>
    document.querySelectorAll('#' + el + ' [data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === cur)));
  renderRS();
}
const RS_HIDDEN = ['skoda'];                            // stok lövhəsində göstərilməyən brendlər
function setRealStock(rows, live) {
  if (rows) rows = rows.filter(r => !RS_HIDDEN.includes(norm(r.brand)));
  if (!rows || !rows.length) { $('rs').hidden = true; return; }
  $('rs').hidden = false;
  RS.rows = rows; RS.live = !!live; RS.at = live ? Date.now() : 0;
  RS.border = [...new Set(rows.map(r => r.brand))];     // brendlərin Sheet-dəki ardıcıllığı
  rows.forEach(r => { if (r.period == null) r.period = ''; });   // köhnə paketlərdə sahə yoxdur
  const prev = RS.periods.length ? [RS.periods[RS.from], RS.periods[RS.to]] : null;
  RS.periods = [...new Set(rows.map(r => r.period).filter(Boolean))].sort();
  const a = prev ? RS.periods.indexOf(prev[0]) : -1, b = prev ? RS.periods.indexOf(prev[1]) : -1;
  if (RS.preset === 'custom' && a >= 0 && b >= 0) { RS.from = a; RS.to = b; }        // yenilənmədə xüsusi aralıq saxlanılır
  else if (RS.periods.length) { const r = rsPresetRange(RS.preset) || rsPresetRange('l1'); RS.from = r[0]; RS.to = r[1]; }
  const keys = new Set(rows.map(r => r.brand + '|' + r.model));
  if (RS.sel && !keys.has(RS.sel)) { RS.sel = ''; RS.ver = -1; }
  buildRsFilters(); syncRs();
}

/* ====== Market Share Analysis (Market Sales Split + CRM rəsmi satış) ====== */
// Sol tərəf: müqayisə brendi/modeli (istənilən brend; qrup seçimləri: bizim 7 brend / bütün brendlər), sağ tərəf: rəqib brend/modeli.
// Hər tərəf üçün ayrıca satış növü: Total (bazar) | Rəsmi (CRM, Növ=Sales) | Grey (bazar − rəsmi). Pay = tərəf ÷ bütün bazar; hər iki tərəf Grey olanda ÷ grey bazar.
const MK = { months: [], brands: [], models: [], rows: [], lb: -2, lm: -1, rb: -1, rm: -1, srcL: 'total', srcR: 'total', from: 0, to: 0, preset: 'all', view: 'share', selMonth: -1, showTable: false, live: false, at: 0 };
const LB_OURS = -2, LB_ALL = -3, RB_RIV = -1, RB_ALL = -3;      // qrup seçimlərinin kodları
const mLabel = ym => { const [y, m] = ym.split('-').map(Number); return MON3C[m - 1] + ' ' + String(y).slice(2); };
const mLong = ym => { const [y, m] = ym.split('-').map(Number); return MONC[m - 1] + ' ' + y; };
const pc1 = v => (isFinite(v) ? v.toFixed(1) + '%' : '—');
const mkYms = () => MK.months.slice(MK.from, MK.to + 1);
function mkBrandOk(sel, side) {                       // brend indeksinə görə seçim funksiyası
  if (sel >= 0) return b => b === sel;
  if (sel === LB_OURS) return b => isOurs(MK.brands[b]);
  if (sel === RB_RIV) return b => !isOurs(MK.brands[b]);
  return () => true;                                   // bütün brendlər
}
function mkSeries(bSel, mSel) {                       // bazar (Market Sales Split): ay → say
  const n = MK.to - MK.from + 1, vals = new Array(n).fill(0), ok = mkBrandOk(bSel); let tot = 0;
  for (const [m, b, md, c] of MK.rows) {
    if (m < MK.from || m > MK.to || !ok(b) || (mSel >= 0 && md !== mSel)) continue;
    vals[m - MK.from] += c; tot += c;
  }
  return { vals, tot };
}
function mkTotals() {
  const n = MK.to - MK.from + 1, vals = new Array(n).fill(0); let tot = 0;
  for (const [m, , , c] of MK.rows) { if (m >= MK.from && m <= MK.to) { vals[m - MK.from] += c; tot += c; } }
  return { vals, tot };
}
function officialSeries(bSel, mSel) {                 // CRM rəsmi satış (Növ=Sales) — yalnız bizim brendlər üçün; ad normallaşdırılaraq uyğunlaşdırılır
  const yms = mkYms(), n = yms.length, vals = new Array(n).fill(0); let tot = 0;
  if (!D || NOV.sal < 0 || !n) return { vals, tot, ok: false };
  const okB = mkBrandOk(bSel), keys = new Set(MK.brands.filter((b, i) => okB(i)).map(norm));
  if (!keys.size) return { vals, tot, ok: false };
  const mKey = mSel >= 0 ? norm(MK.models[mSel]) : '';
  const bOk = new Uint8Array(DIMV.brand.length), mOk = new Uint8Array(DIMV.model.length);
  DIMV.brand.forEach((v, i) => { if (keys.has(norm(v))) bOk[i] = 1; });
  DIMV.model.forEach((v, i) => { if (!mKey || norm(v) === mKey) mOk[i] = 1; });
  const idx = new Map(yms.map((ym, i) => [ym, i]));
  const [y1, m1] = yms[0].split('-').map(Number), [y2, m2] = yms[n - 1].split('-').map(Number);
  const a = Math.max(0, idxOf(new Date(Date.UTC(y1, m1 - 1, 1)))), b = Math.min(L, idxOf(new Date(Date.UTC(y2, m2, 0))));
  for (let r = lowerBound(D.day, a); r < D.day.length && D.day[r] <= b; r++) {
    if (D.nov[r] !== NOV.sal || !bOk[D.brand[r]] || !mOk[D.model[r]]) continue;
    const k = idx.get(ymOf(D.day[r])); if (k !== undefined) { vals[k] += D.cnt[r]; tot += D.cnt[r]; }
  }
  return { vals, tot, ok: tot > 0 || MK.brands.some((b, i) => okB(i) && isOurs(b)) };
}
function mkLists() {                                  // filtr siyahıları (seçilmiş aylar)
  const bt = new Float64Array(MK.brands.length), lm = new Map(), rm = new Map(), okL = mkBrandOk(MK.lb), okR = mkBrandOk(MK.rb);
  for (const [m, b, md, c] of MK.rows) {
    if (m < MK.from || m > MK.to) continue;
    bt[b] += c;
    if (okL(b)) lm.set(md, (lm.get(md) || 0) + c);
    if (okR(b)) rm.set(md, (rm.get(md) || 0) + c);
  }
  return { bt, lm, rm };
}
const lName = () => (MK.lb >= 0 ? MK.brands[MK.lb] : MK.lb === LB_OURS ? 'Bizim brendlər' : 'Bütün brendlər') + (MK.lm >= 0 ? ' · ' + MK.models[MK.lm] : '');
const rName = () => (MK.rb >= 0 ? MK.brands[MK.rb] : MK.rb === RB_RIV ? 'Bütün rəqib brendlər' : 'Bütün brendlər') + (MK.rm >= 0 ? ' · ' + MK.models[MK.rm] : '');
let MKC = null;
const SRC_TXT = { total: '', official: ' · rəsmi', grey: ' · grey' }, SRC_NAME = { total: 'Total', official: 'Rəsmi', grey: 'Grey' };
const sub = (a, b) => a.vals.map((v, i) => Math.max(0, v - b.vals[i]));
const mkSer = vals => ({ vals, tot: vals.reduce((s, v) => s + v, 0) });
function renderMK() {
  if (!MK.rows.length) return;
  const yms = mkYms(), n = yms.length, share = MK.view === 'share', sL = MK.srcL, sR = MK.srcR, bothGrey = sL === 'grey' && sR === 'grey', bothTotal = sL === 'total' && sR === 'total';
  // bazar (Market Sales Split) və rəsmi (CRM) seriyaları
  const Lm = mkSeries(MK.lb, MK.lm), Rm = mkSeries(MK.rb, MK.rm), T = mkTotals();
  const OL = officialSeries(MK.lb, MK.lm), OR = officialSeries(MK.rb, MK.rm), OA = officialSeries(LB_ALL, -1);
  const GL = mkSer(sub(Lm, OL)), GR = mkSer(sub(Rm, OR)), TG = mkSer(sub(T, OA));          // grey = bazar − rəsmi; grey bazar = bütün bazar − bütün rəsmi
  const hasOffL = OL.ok, hasOffR = OR.ok;
  // hər tərəfin satış növünə görə seriya; məxrəc: hər iki tərəf grey → grey bazar, əks halda bütün bazar
  const Lv = sL === 'official' ? OL : sL === 'grey' ? GL : Lm, Rv = sR === 'official' ? OR : sR === 'grey' ? GR : Rm;
  const DEN = bothGrey ? TG : T, denTxt = bothGrey ? 'grey bazar (bütün bazar − rəsmi satışlar)' : 'bütün bazar';
  const bName = lName() + SRC_TXT[sL], rNm = rName() + SRC_TXT[sR];
  if (MK.selMonth >= n) MK.selMonth = -1;
  const sm = MK.selMonth, hasSel = sm >= 0;
  const pick = S2 => hasSel ? S2.vals[sm] : S2.tot;
  const kL = pick(Lv), kR = pick(Rv), kD = pick(DEN), kT = pick(T);
  const shv = (v, d) => d ? v / d * 100 : 0;
  const lP = shv(kL, kD), rP = shv(kR, kD);
  const othP = Math.max(0, 100 - lP - rP);
  const lS = Lv.vals.map((v, i) => shv(v, DEN.vals[i])), rS = Rv.vals.map((v, i) => shv(v, DEN.vals[i]));
  const perTxt = hasSel ? mLong(yms[sm]) : mkRangeLabel();
  const othName = bothTotal ? 'Digər brend/modellər' : bothGrey ? 'Digər brend/modellər (grey)' : 'Bazarın qalanı';
  // filtr düymələri
  const setBtn = (id, k, v, on) => { const b = $(id); b.querySelector('.k').textContent = k; b.querySelector('.v').textContent = v; b.classList.toggle('on', on); };
  setBtn('fb-mkOb', 'Brend', MK.lb >= 0 ? MK.brands[MK.lb] : MK.lb === LB_OURS ? 'Bizim brendlər' : 'Bütün brendlər', MK.lb !== LB_OURS);
  setBtn('fb-mkOm', 'Model', MK.lm >= 0 ? MK.models[MK.lm] : 'Bütün modellər', MK.lm >= 0);
  setBtn('fb-mkRb', 'Rəqib', MK.rb >= 0 ? MK.brands[MK.rb] : MK.rb === RB_RIV ? 'Bütün rəqib brendlər' : 'Bütün brendlər', MK.rb !== RB_RIV);
  setBtn('fb-mkRm', 'Model', MK.rm >= 0 ? MK.models[MK.rm] : 'Bütün modellər', MK.rm >= 0);
  setBtn('fb-mkDate', '', mkRangeLabel(), MK.preset !== 'all');
  document.querySelectorAll('#mkView [data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === MK.view));
  setBtn('fb-mkSrcL', 'Satış növü', SRC_NAME[sL], sL !== 'total');
  setBtn('fb-mkSrcR', 'Satış növü', SRC_NAME[sR], sR !== 'total');
  $('fb-mkSrcL').title = $('fb-mkSrcR').title = 'Total = bazar (Market Sales Split) · Rəsmi = CRM satışı · Grey = bazar − rəsmi';
  $('mkReset').disabled = MK.lb === LB_OURS && MK.lm < 0 && MK.rb === RB_RIV && MK.rm < 0 && MK.preset === 'all' && MK.view === 'share' && MK.srcL === 'total' && MK.srcR === 'total' && MK.selMonth < 0;
  $('mkChartReset').disabled = MK.selMonth < 0 && MK.view === 'share' && !MK.showTable;
  // xəbərdarlıq: rəsmi data olmayan tərəf
  const warn = [];
  const noOff = s => ` üçün rəsmi (CRM) satış datası yoxdur — ${s === 'official' ? 'rəsmi 0 sayılır' : 'bazar satışının hamısı grey sayılır'}`;
  if (sL !== 'total' && !hasOffL) warn.push(lName() + noOff(sL));
  if (sR !== 'total' && !hasOffR) warn.push(rName() + noOff(sR));
  $('mkWarn').hidden = !warn.length; $('mkWarn').textContent = warn.join(' · ');
  // KPI
  const d = lP - rP, dN = kL - kR, sgn = v => (v >= 0 ? '+' : '-');
  const iMax = lS.indexOf(Math.max(...lS)), iMin = lS.indexOf(Math.min(...lS)), iBL = Lv.vals.indexOf(Math.max(...Lv.vals)), iBR = Rv.vals.indexOf(Math.max(...Rv.vals));
  const ay = i => ' (' + mLabel(yms[i]) + ')';
  let kpis;
  {
    kpis = share ? [
      [bName, pc1(lP), `${fmt(kL)} ÷ ${denTxt} ${fmt(kD)} · ${perTxt}`],
      [rNm, pc1(rP), `${fmt(kR)} ÷ ${denTxt} ${fmt(kD)} · ${perTxt}`],
      ['Fərq', sgn(d) + Math.abs(d).toFixed(1) + '%', 'Sol tərəfin payı − rəqibin payı · ' + perTxt],
      othP > 0.05 ? [othName, pc1(othP), 'Müqayisəyə daxil olmayan hissə · ' + perTxt] : [bothGrey ? 'Grey bazar' : 'Bütün bazar', fmt(kD), perTxt],
      ['Ən yüksək pay', pc1(lS[iMax]) + ay(iMax), bName + ' — seçilmiş dövrdə ən yaxşı ay'],
      ['Ən aşağı pay', pc1(lS[iMin]) + ay(iMin), bName + ' — seçilmiş dövrdə ən zəif ay'],
    ] : [
      [bName, fmt(kL), 'Satış sayı · ' + perTxt],
      [rNm, fmt(kR), 'Satış sayı · ' + perTxt],
      ['Fərq', sgn(dN) + fmt(Math.abs(dN)), 'Sol tərəf − rəqib · ' + perTxt],
      [bothGrey ? 'Grey bazar' : 'Bütün bazar', fmt(kD), (bothGrey ? 'Bütün bazar − bütün rəsmi satışlar' : 'Bazarda satılan bütün avtomobillər') + ' · ' + perTxt],
      ['Ən yaxşı ay', fmt(Lv.vals[iBL]) + ay(iBL), bName],
      ['Rəqibin ən yaxşı ayı', fmt(Rv.vals[iBR]) + ay(iBR), rNm],
    ];
  }
  $('mkKpis').innerHTML = kpis.map(([l, v, tt]) => { const mm = String(v).match(/^(.*?)( \(.*\))$/); return `<div class="kpi" title="${esc(tt)}"><div class="lab">${esc(l)}</div><div class="val">${esc(mm ? mm[1] : String(v))}${mm ? `<small>${esc(mm[2])}</small>` : ''}</div></div>`; }).join('');
  // pay zolağı — məxrəc 100%
  $('mkShare').hidden = !share;
  if (share) {
    const segs = [['sw1', lP, bName], ['sw2', rP, rNm]];
    if (othP > 0.05) segs.push(['oth', othP, othName]);
    $('mkShare').innerHTML = `<div class="sbar" role="img" aria-label="${esc(perTxt)}: ${segs.map(s => s[2] + ' ' + pc1(s[1])).join(', ')}">${segs.map(s => `<i class="${s[0]}" style="width:${Math.min(100, s[1]).toFixed(2)}%" title="${esc(s[2])} ${pc1(s[1])}"></i>`).join('')}</div>`
      + `<div class="skey">${segs.map(s => `<span><i class="${s[0]}"></i>${esc(s[2])} <b>${pc1(s[1])}</b></span>`).join('')}<span class="per">${esc(perTxt)} · 100% = ${esc(denTxt)} (${fmt(kD)})${hasSel ? ' · <button type="button" class="link" id="mkSelClear">ayı götür</button>' : ''}</span></div>`;
    const sc = $('mkSelClear'); if (sc) sc.onclick = () => { MK.selMonth = -1; renderMK(); };
  }
  // qrafik
  const bv = share ? lS : Lv.vals, rv = share ? rS : Rv.vals;
  const svg = $('mkSvg'), W = Math.max(280, Math.round($('mkPlot').clientWidth)), H = 290;
  const m = { l: 52, r: 22, t: 24, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  let vmax = 0; bv.forEach(v => { if (v > vmax) vmax = v; }); rv.forEach(v => { if (v > vmax) vmax = v; });
  const ticks = niceTicks(Math.max(vmax, share ? 5 : 4), 4), ymax = ticks[ticks.length - 1];
  const x = i => m.l + (n <= 1 ? iw / 2 : i / (n - 1) * iw), y = v => m.t + ih - (v / ymax) * ih, step = n > 1 ? iw / (n - 1) : iw;
  const f = v => share ? v.toFixed(1) + '%' : fmt(v);
  let out = '';
  ticks.forEach((t, k) => { out += `<line class="${k ? 'g-grid' : 'g-base'}" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${share ? t + '%' : compact(t)}</text>`; });
  if (hasSel) out += `<rect x="${(x(sm) - Math.max(12, iw / Math.max(1, n - 1) / 2)).toFixed(1)}" y="${m.t}" width="${(Math.max(24, iw / Math.max(1, n - 1))).toFixed(1)}" height="${ih}" fill="var(--accent-wash)" rx="4"/>`;
  yms.forEach((ym, i) => { out += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle"${i === sm ? ' font-weight="700" fill="var(--ink)"' : ''}>${mLabel(ym)}</text>`; });
  const line = (vals, cls, dash) => { let dd = ''; vals.forEach((v, i) => dd += (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1));
    out += `<path class="mk-line ${cls}${dash ? ' dash' : ''}" d="${dd}"/>`; vals.forEach((v, i) => out += `<circle class="mk-pt ${cls}${dash ? ' hollow' : ''}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5"/>`); };
  line(rv, 'ln2', false); line(bv, 'ln1', false);
  if (step >= 34 && W >= 520) for (let i = 0; i < n; i++) {   // telefonda iki xəttin rəqəmləri üst-üstə düşür — tooltip qalır
    const yb = Math.max(m.t - 6, y(bv[i]) - 8); let yr = y(rv[i]) - 8; if (Math.abs(yr - yb) < 11) yr = y(rv[i]) + 15;
    const an = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    out += `<text class="pl" x="${x(i).toFixed(1)}" y="${yb.toFixed(1)}" text-anchor="${an}">${f(bv[i])}</text>`
      + `<text class="pl2" x="${x(i).toFixed(1)}" y="${Math.min(m.t + ih - 2, yr).toFixed(1)}" text-anchor="${an}">${f(rv[i])}</text>`;
  }
  out += `<line id="mkXh" class="g-xh" y1="${m.t}" y2="${m.t + ih}" x1="0" x2="0" visibility="hidden"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = out; svg.style.height = H + 'px';
  svg.setAttribute('aria-label', `${bName} və ${rNm} — aylıq ${share ? 'pay' : 'satış'} müqayisəsi`);
  MKC = { yms, Lv, Rv, DEN, T, lS, rS, x, m, W, iw, n, bName, rName: rNm, share, split: false, denTxt };
  $('mkTitle').textContent = (share ? 'Aylıq bazar payı' : 'Aylıq satış sayı') + (bothTotal ? '' : ' — ' + SRC_NAME[sL].toLowerCase() + ' / ' + SRC_NAME[sR].toLowerCase());
  $('mkLegend').hidden = share;
  $('mkLegend').innerHTML = `<span class="legend"><i style="background:var(--s1)"></i>${esc(bName)} <b>${fmt(kL)}</b></span>`
    + `<span class="legend"><i style="background:var(--s2)"></i>${esc(rNm)} <b>${fmt(kR)}</b></span>`
    + `<span>${esc(perTxt)} · ${esc(denTxt)} ${fmt(kD)}${hasSel ? ' · <button type="button" class="link" id="mkSelClear2">ayı götür</button>' : ''}</span>`;
  const sc2 = $('mkSelClear2'); if (sc2) sc2.onclick = () => { MK.selMonth = -1; renderMK(); };
  $('mkTable').hidden = !MK.showTable;
  if (MK.showTable) {
    const oth = i => Math.max(0, 100 - lS[i] - rS[i]);
    $('mkTable').innerHTML = share
      ? `<table><thead><tr><th>Ay</th><th>${esc(bName)}</th><th>${esc(rNm)}</th><th>Fərq</th><th>${esc(othName)}</th><th>${esc(denTxt)}</th></tr></thead><tbody>`
        + yms.map((ym, i) => `<tr><td>${esc(mLong(ym))}</td><td>${pc1(lS[i])}</td><td>${pc1(rS[i])}</td><td>${sgn(lS[i] - rS[i])}${Math.abs(lS[i] - rS[i]).toFixed(1)}%</td><td>${pc1(oth(i))}</td><td>${fmt(DEN.vals[i])}</td></tr>`).reverse().join('')
        + `<tr><td><b>Dövr üzrə</b></td><td><b>${pc1(shv(Lv.tot, DEN.tot))}</b></td><td><b>${pc1(shv(Rv.tot, DEN.tot))}</b></td><td><b>${sgn(Lv.tot - Rv.tot)}${pc1(Math.abs(Lv.tot - Rv.tot) / (DEN.tot || 1) * 100)}</b></td><td><b>${pc1(Math.max(0, 100 - shv(Lv.tot + Rv.tot, DEN.tot)))}</b></td><td><b>${fmt(DEN.tot)}</b></td></tr></tbody></table>`
      : `<table><thead><tr><th>Ay</th><th>${esc(bName)}</th><th>${esc(rNm)}</th><th>Fərq</th><th>${esc(denTxt)}</th></tr></thead><tbody>`
        + yms.map((ym, i) => `<tr><td>${esc(mLong(ym))}</td><td>${fmt(Lv.vals[i])}</td><td>${fmt(Rv.vals[i])}</td><td>${sgn(Lv.vals[i] - Rv.vals[i])}${fmt(Math.abs(Lv.vals[i] - Rv.vals[i]))}</td><td>${fmt(DEN.vals[i])}</td></tr>`).reverse().join('')
        + `<tr><td><b>Cəmi</b></td><td><b>${fmt(Lv.tot)}</b></td><td><b>${fmt(Rv.tot)}</b></td><td><b>${sgn(Lv.tot - Rv.tot)}${fmt(Math.abs(Lv.tot - Rv.tot))}</b></td><td><b>${fmt(DEN.tot)}</b></td></tr></tbody></table>`;
  }
  $('mkUpd').textContent = (MK.live ? 'Sheet-dən yükləndi' : 'snapshot') + (MK.at ? ' · ' + whenTxt(MK.at) : '') + ' · ' + MK.months.length + ' ay · ' + fmt(MK.brands.length) + ' brend';
  if (openPop && openPop.pop._draw) openPop.pop._draw();
}
/* --- tarix: insan-dostu seçim --- */
const MK_PRESETS = [['all', 'Bütün dövr'], ['l1', 'Son ay'], ['l3', 'Son 3 ay'], ['l6', 'Son 6 ay'], ['ytd', 'Bu il'], ['py', 'Keçən il']];
function mkPresetRange(id) {
  const N = MK.months.length, last = N - 1, yL = MK.months[last].slice(0, 4);
  switch (id) {
    case 'l1': return [last, last];
    case 'l3': return [Math.max(0, last - 2), last];
    case 'l6': return [Math.max(0, last - 5), last];
    case 'ytd': { const a = MK.months.findIndex(m => m.startsWith(yL)); return [a, last]; }
    case 'py': { const y = String(+yL - 1), idx = MK.months.map((m, i) => [m, i]).filter(([m]) => m.startsWith(y)); return idx.length ? [idx[0][1], idx[idx.length - 1][1]] : null; }
    default: return [0, last];
  }
}
function mkRangeLabel() {
  const p = MK_PRESETS.find(q => q[0] === MK.preset);
  if (p && MK.preset !== 'custom') return p[1] + (MK.preset === 'all' ? '' : ' · ' + (MK.from === MK.to ? mLabel(MK.months[MK.from]) : mLabel(MK.months[MK.from]) + ' – ' + mLabel(MK.months[MK.to])));
  return MK.from === MK.to ? mLong(MK.months[MK.from]) : mLabel(MK.months[MK.from]) + ' – ' + mLabel(MK.months[MK.to]);
}
function mkSetRange(a, b, preset) { MK.from = Math.min(a, b); MK.to = Math.max(a, b); MK.selMonth = -1; MK.preset = preset || ((MK.from === 0 && MK.to === MK.months.length - 1) ? 'all' : 'custom'); renderMK(); }
let mkAnchor = -1;
function openMkDatePop() {
  const w = $('fw-mkDate');
  if (openPop && openPop.wrap === w) return closePop();
  closePop(); mkAnchor = -1;
  const years = [...new Set(MK.months.map(m => m.slice(0, 4)))];
  const pop = document.createElement('div');
  pop.className = 'pop date mkdate'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Dövr');
  pop.innerHTML = `<div class="presets" role="listbox">${MK_PRESETS.map(([id, t]) => { const r = mkPresetRange(id);
      return `<button type="button" class="opt" role="option" data-p="${id}" aria-selected="${MK.preset === id}"${r ? '' : ' disabled'}><span class="chk">✓</span>${t}</button>`; }).join('')}</div>
    <div class="dcal"><h4>Ay seç</h4><div class="years">${years.map(y => `<div class="yr"><button type="button" class="ybtn" data-y="${y}">${y}</button><div class="mg">${MON3C.map((nm, mi) => {
        const ym = y + '-' + String(mi + 1).padStart(2, '0'), i = MK.months.indexOf(ym);
        return `<button type="button" class="mb" data-i="${i}"${i < 0 ? ' disabled' : ''}>${nm}</button>`; }).join('')}</div></div>`).join('')}</div>
      <p class="mhint">Bir aya klik — həmin ay. İkinci aya klik — aralıq (məs. yanvar → mart). İlə klik — bütün il.</p>
      <div class="pop-actions mk-actions"><button type="button" class="btn" id="mkDateReset">Sıfırla</button><button type="button" class="btn primary" id="mkDateClose">Bağla</button></div></div>`;
  mountPop(w, pop);
  const paint = () => {
    pop.querySelectorAll('.mb').forEach(b => { const i = +b.dataset.i; b.classList.toggle('sel', i >= 0 && i >= MK.from && i <= MK.to); b.classList.toggle('anchor', i === mkAnchor); });
    pop.querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-selected', b.dataset.p === MK.preset));
  };
  paint();
  pop.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const r = mkPresetRange(b.dataset.p); if (!r) return; mkAnchor = -1; mkSetRange(r[0], r[1], b.dataset.p); paint(); });
  pop.querySelectorAll('.ybtn').forEach(b => b.onclick = () => { const idx = MK.months.map((m, i) => [m, i]).filter(([m]) => m.startsWith(b.dataset.y)); if (!idx.length) return; mkAnchor = -1; mkSetRange(idx[0][1], idx[idx.length - 1][1]); paint(); });
  pop.querySelectorAll('.mb').forEach(b => b.onclick = () => {
    const i = +b.dataset.i; if (i < 0) return;
    if (mkAnchor >= 0) { mkSetRange(mkAnchor, i); mkAnchor = -1; } else { mkAnchor = i; mkSetRange(i, i); }
    paint();
  });
  $('mkDateReset').onclick = () => { mkAnchor = -1; mkSetRange(0, MK.months.length - 1, 'all'); paint(); };
  $('mkDateClose').onclick = closePop;
}

function openListPop(wrapId, cfg) {                   // axtarışlı tək-seçim pəncərəsi: qrup seçimləri + brend/model siyahısı
  const w = $(wrapId);
  if (openPop && openPop.wrap === w) return closePop();
  closePop();
  const pop = document.createElement('div');
  pop.className = 'pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', cfg.title);
  pop.innerHTML = `${cfg.noSearch ? '' : `<div class="msearch"><input type="search" placeholder="${esc(cfg.title)} axtar…" aria-label="${esc(cfg.title)} axtar" autocomplete="off"></div>`}<div class="mlist" role="listbox"></div>`;
  mountPop(w, pop);
  const list = pop.querySelector('.mlist'), inp = pop.querySelector('input'); let q = '';
  pop._draw = () => {
    let items = cfg.items(); const cur = cfg.current();
    if (q) items = items.filter(it => norm(it.label).includes(q));
    list.innerHTML = (q ? '' : cfg.groups.map(g => `<button type="button" class="opt grp" role="option" data-v="${g.v}" aria-selected="${cur === g.v}"><span class="chk">✓</span><span>${esc(g.label)}${g.sub ? `<small class="gsub">${esc(g.sub)}</small>` : ''}</span>${g.n != null ? `<span class="n">${fmt(g.n)}</span>` : ''}</button>`).join(''))
      + (items.length ? items.map(it => `<button type="button" class="opt" role="option" data-v="${it.v}" aria-selected="${cur === it.v}"><span class="chk">✓</span><span>${esc(it.label)}${it.tag ? ' <span class="biz">BİZ</span>' : ''}${it.sub ? ` <small class="sub">${esc(it.sub)}</small>` : ''}</span><span class="n">${fmt(it.n)}</span></button>`).join('')
        : '<div class="empty">Uyğun dəyər tapılmadı</div>');
  };
  pop._draw();
  list.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; closePop(); cfg.pick(+b.dataset.v); };
  if (inp) { inp.oninput = () => { q = norm(inp.value); pop._draw(); }; inp.focus(); }
}
function modelBrandMap() {                            // model → əsas brend (siyahıda alt-yazı üçün)
  const mp = new Map();
  for (const [, b, md, c] of MK.rows) { const cur = mp.get(md); if (!cur || c > cur[1]) mp.set(md, [b, c]); }
  return mp;
}
function buildMkFilters() {
  const btn = (id, icon) => `<button type="button" class="fbtn" id="fb-${id}" aria-haspopup="dialog" aria-expanded="false">${icon}<span class="k"></span><span class="v"></span>${CHEV}</button>`;
  ['mkOb', 'mkOm', 'mkRb', 'mkRm'].forEach(id => { $('fw-' + id).innerHTML = btn(id, ''); });
  $('fw-mkDate').innerHTML = btn('mkDate', CAL);
  const brandItems = () => { const { bt } = mkLists(); return [...bt.keys()].filter(b => bt[b] > 0).sort((a, b) => bt[b] - bt[a]).map(b => ({ v: b, label: MK.brands[b], n: bt[b], tag: isOurs(MK.brands[b]) })); };
  const sumBy = ok => { const { bt } = mkLists(); let s = 0; bt.forEach((v, i) => { if (ok(i)) s += v; }); return s; };
  const modelItems = key => { const L2 = mkLists(), mp = modelBrandMap(), sel = key === 'lm' ? MK.lb : MK.rb;
    return [...L2[key]].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([md, n]) => ({ v: md, label: MK.models[md], n, sub: sel < 0 && mp.get(md) ? MK.brands[mp.get(md)[0]] : '' })); };
  $('fb-mkOb').onclick = () => openListPop('fw-mkOb', { title: 'Brend', current: () => MK.lb, items: brandItems,
    groups: [{ v: LB_OURS, label: `Bizim brendlər (${OURS_N})`, n: sumBy(mkBrandOk(LB_OURS)) }, { v: LB_ALL, label: 'Bütün brendlər', n: sumBy(() => true) }],
    pick: v => { MK.lb = v; MK.lm = -1; renderMK(); } });
  $('fb-mkOm').onclick = () => openListPop('fw-mkOm', { title: 'Model', current: () => MK.lm, items: () => modelItems('lm'), groups: [{ v: -1, label: 'Bütün modellər' }], pick: v => { MK.lm = v; renderMK(); } });
  $('fb-mkRb').onclick = () => openListPop('fw-mkRb', { title: 'Rəqib brend', current: () => MK.rb, items: brandItems,
    groups: [{ v: RB_RIV, label: 'Bütün rəqib brendlər', n: sumBy(mkBrandOk(RB_RIV)) }, { v: RB_ALL, label: 'Bütün brendlər', n: sumBy(() => true) }],
    pick: v => { MK.rb = v; MK.rm = -1; renderMK(); } });
  $('fb-mkRm').onclick = () => openListPop('fw-mkRm', { title: 'Rəqib model', current: () => MK.rm, items: () => modelItems('rm'), groups: [{ v: -1, label: 'Bütün modellər' }], pick: v => { MK.rm = v; renderMK(); } });
  $('fb-mkDate').onclick = openMkDatePop;
  $('mkView').innerHTML = [['share', 'Bazar payı %'], ['abs', 'Satış sayı']].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${MK.view === v}">${t}</button>`).join('');
  $('mkView').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { MK.view = b.dataset.v; renderMK(); } };
  const SRC_OPTS = [['total', 'Total', 'Bazar satışı (Market Sales Split)'], ['official', 'Rəsmi', 'Yalnız rəsmi (CRM) satışlar'], ['grey', 'Grey', 'Bazar − rəsmi satışlar']];
  [['L', 'srcL'], ['R', 'srcR']].forEach(([s, key]) => {
    $('fw-mkSrc' + s).innerHTML = btn('mkSrc' + s, '');
    $('fb-mkSrc' + s).onclick = () => openListPop('fw-mkSrc' + s, { title: 'Satış növü', noSearch: true, current: () => SRC_OPTS.findIndex(o => o[0] === MK[key]),
      groups: SRC_OPTS.map((o, i) => ({ v: i, label: o[1], sub: o[2] })), items: () => [], pick: v => { MK[key] = SRC_OPTS[v][0]; renderMK(); } });
  });
  $('mkReset').onclick = () => { Object.assign(MK, { lb: LB_OURS, lm: -1, rb: RB_RIV, rm: -1, srcL: 'total', srcR: 'total', from: 0, to: MK.months.length - 1, preset: 'all', view: 'share', selMonth: -1 }); renderMK(); };
  $('mkTbl').onclick = () => { MK.showTable = !MK.showTable; $('mkTbl').setAttribute('aria-pressed', MK.showTable); renderMK(); };
  $('mkChartReset').onclick = () => { MK.selMonth = -1; MK.view = 'share'; MK.showTable = false; $('mkTbl').setAttribute('aria-pressed', false); renderMK(); };
  const plot = $('mkPlot');
  const idxAt = e => { const r = $('mkSvg').getBoundingClientRect(), px = (e.clientX - r.left) * (MKC.W / r.width); return Math.max(0, Math.min(MKC.n - 1, Math.round((px - MKC.m.l) / MKC.iw * (MKC.n - 1)))); };
  plot.addEventListener('pointermove', e => {
    if (!MKC || !MKC.n) return;
    const i = idxAt(e), r = $('mkSvg').getBoundingClientRect();
    const xh = $('mkXh'); if (xh) { xh.setAttribute('x1', MKC.x(i)); xh.setAttribute('x2', MKC.x(i)); xh.setAttribute('visibility', 'visible'); }
    const tip = $('mkTip'), sh = MKC.share;
    const bv2 = sh ? MKC.lS[i] : MKC.Lv.vals[i], rv2 = sh ? MKC.rS[i] : MKC.Rv.vals[i], fv = v => sh ? pc1(v) : fmt(v);
    tip.innerHTML = `<div class="td">${esc(mLong(MKC.yms[i]))} · ${esc(MKC.denTxt)} ${fmt(MKC.DEN.vals[i])}</div>`
      + `<div class="tr"><span><i class="key" style="background:var(--s1)"></i>${esc(MKC.bName)}</span><b>${fv(bv2)}</b></div>`
      + `<div class="tr"><span><i class="key${MKC.split ? ' d' : ''}" style="${MKC.split ? 'border-top:2px dashed var(--s1);background:none;height:0' : 'background:var(--s2)'}"></i>${esc(MKC.rName)}</span><b>${fv(rv2)}</b></div>`
      + `<div class="tr"><span><i class="key" style="visibility:hidden"></i>Fərq</span><b>${bv2 - rv2 >= 0 ? '+' : '-'}${sh ? Math.abs(bv2 - rv2).toFixed(1) + '%' : fmt(Math.abs(bv2 - rv2))}</b></div>`;
    tip.classList.add('show');
    const pr = plot.getBoundingClientRect(), px2 = r.left - pr.left + MKC.x(i) * (r.width / MKC.W);
    tip.style.left = (px2 + 14 + tip.offsetWidth > pr.width ? px2 - 14 - tip.offsetWidth : px2 + 14) + 'px';
    tip.style.top = '8px';
  });
  plot.addEventListener('pointerleave', () => { $('mkTip').classList.remove('show'); const xh = $('mkXh'); if (xh) xh.setAttribute('visibility', 'hidden'); });
  plot.addEventListener('click', e => { if (!MKC || !MKC.n) return; const i = idxAt(e); MK.selMonth = MK.selMonth === i ? -1 : i; renderMK(); });
  plot.style.cursor = 'pointer';
}
function setMarket(mk, live) {
  if (!mk || !mk.rows || !mk.rows.length) { $('mk').hidden = true; return; }
  $('mk').hidden = false;
  const keep = { lb: MK.lb >= 0 ? MK.brands[MK.lb] : MK.lb, lm: MK.models[MK.lm], rb: MK.rb >= 0 ? MK.brands[MK.rb] : MK.rb, rm: MK.models[MK.rm], from: MK.months[MK.from], to: MK.months[MK.to] };
  Object.assign(MK, { months: mk.months, brands: mk.brands, models: mk.models, rows: mk.rows, live: !!live, at: live ? Date.now() : 0 });
  MK.lb = typeof keep.lb === 'string' ? Math.max(LB_OURS, MK.brands.indexOf(keep.lb)) : keep.lb; MK.lm = keep.lm ? MK.models.indexOf(keep.lm) : -1;
  MK.rb = typeof keep.rb === 'string' ? Math.max(RB_RIV, MK.brands.indexOf(keep.rb)) : keep.rb; MK.rm = keep.rm ? MK.models.indexOf(keep.rm) : -1;
  if (MK.preset && MK.preset !== 'custom' && MK.preset !== 'all' && mkPresetRange(MK.preset)) [MK.from, MK.to] = mkPresetRange(MK.preset);
  else { MK.from = Math.max(0, MK.months.indexOf(keep.from)); MK.to = keep.to && MK.months.includes(keep.to) ? MK.months.indexOf(keep.to) : MK.months.length - 1; if (MK.from === 0 && MK.to === MK.months.length - 1) MK.preset = 'all'; }
  buildMkFilters(); renderMK();
  if (S.cmp) renderChart();
}

/* ====== Data mənbəyi: server (/api/data) ====== */
// Köhnə paneldəki Google Sheet / claude.ai / __DATA__ snapshot yolları əvəzinə: data yalnız login olmuş istifadəçiyə,
// serverdə hazırlanmış kompakt paket kimi gəlir (ETag ilə — dəyişməyibsə yenidən yüklənmir).
let noticeTimer = 0;
function showNotice(kind, text, autoHideMs) {
  const n = $('notice'); clearTimeout(noticeTimer);
  n.className = 'notice ' + kind; n.hidden = false;
  n.innerHTML = `<span>${esc(text)}</span><button type="button" class="nx" aria-label="Bağla">×</button>`;
  n.querySelector('.nx').onclick = () => { n.hidden = true; };
  if (autoHideMs) noticeTimer = setTimeout(() => { n.hidden = true; }, autoHideMs);
}
const whenTxt = ms => { const d = new Date(ms); return `${d.getDate()} ${MON3[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const DATA = { etag: null, lastCheck: 0, syncedAt: 0, busy: false };

async function fetchData() {                           // yeni paket və ya null (dəyişməyib)
  const r = await fetch('/api/data', { headers: DATA.etag ? { 'if-none-match': DATA.etag } : {}, cache: 'no-store' });
  if (r.status === 401) { location.href = '/login'; return null; }
  const lc = r.headers.get('x-last-check'); if (lc) DATA.lastCheck = Date.parse(lc);
  if (r.status === 304) return null;
  if (r.status === 404) throw new Error('Hələ data yoxdur — Sheet-dən ilk göndəriş gözlənilir.');
  if (!r.ok) throw new Error('Server cavabı: ' + r.status);
  DATA.etag = r.headers.get('etag');
  return r.json();
}

async function decodeCrm(c) {                          // sütunlu binar: [cnt u32][day u16][brand, model, nov, kanal, satis, haradan u16]
  const bin = Uint8Array.from(atob(c.blob), ch => ch.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  const n = c.n; let o = 0;
  const u32 = () => { const a = new Uint32Array(buf, o, n); o += n * 4; return a; };
  const u16 = () => { const a = new Uint16Array(buf, o, n); o += n * 2; return a; };
  const cols = { cnt: u32(), day: u16() };
  ['brand', 'model', 'nov', 'kanal', 'satis', 'haradan'].forEach(k => { cols[k] = u16(); });
  return { meta: { records: c.records, skipped: c.skipped }, start: c.start, ndays: c.ndays, dims: c.dims, cols };
}

function snapshot() {                                  // filtrlər açarla yadda saxlanılır — yeni datada kodlar dəyişə bilər
  const sel = {}; DIMS.forEach(d => sel[d.key] = [...S.sel[d.key]].map(v => vkey(DIMV[d.key][v])));
  return { preset: S.preset, a: iso(S.from), b: iso(S.to), sel };
}
function restore(k) {
  DIMS.forEach(d => {
    S.sel[d.key].clear();
    const keys = DIMV[d.key].map(vkey);
    const v = k.sel[d.key].length ? keys.indexOf(k.sel[d.key][0]) : -1; if (v >= 0) S.sel[d.key].add(v);
  });
  if (k.preset === 'custom') { const a = Math.max(0, Math.min(L, fromIso(k.a))), b = Math.max(0, Math.min(L, fromIso(k.b))); S.from = Math.min(a, b); S.to = Math.max(a, b); S.preset = 'custom'; }
  else if (presetOk(k.preset)) { [S.from, S.to] = presetRange(k.preset); S.preset = k.preset; }
  else { S.from = 0; S.to = L; S.preset = 'all'; }
}
function useData(ds) {                                 // yeni data dəstini filtrləri qoruyaraq tətbiq et
  closePop(); const keep = snapshot();
  applyData(ds); restore(keep); refreshMeta(); update();
}

async function applyPayload(p, first) {
  const ds = await decodeCrm(p.crm);
  DATA.syncedAt = Date.parse(p.syncedAt);
  if (first) {
    applyData(ds); S.from = 0; S.to = L;
    buildFilters(); buildGrid(); buildChartControls(); bindPlot(); bindRefresh(); refreshMeta(); update();
  } else useData(ds);
  setRealStock(p.stock.rows, true);
  setMarket(p.market, true);
  if (first) observePlots();
}

function refreshMeta() {
  const last = dateOf(L);                               // datadakı son gün
  const dm = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  $('lastUp').textContent = dm(last);
  $('lastCheck').textContent = DATA.lastCheck ? whenTxt(DATA.lastCheck) : '—';   // istifadəçi qərarı: "Next update date" əvəzinə real sync vaxtı
  $('secSalesSrc').textContent = fmt(META.records || 0) + ' sətir · ' + dShort(0) + ' – ' + dShort(L);
  $('brands').innerHTML = CFG.headerBrands.filter(([, v]) => DIMV.brand.includes(v))
    .map(([t, v]) => `<button type="button" class="brand-btn" data-b="${DIMV.brand.indexOf(v)}" aria-pressed="${S.sel.brand.has(DIMV.brand.indexOf(v))}">${esc(t)}</button>`).join('');
  $('foot').innerHTML = `<span>Mənbə: Google Sheet “data baza”</span><span>Data aralığı: ${dLong(0)} – ${dLong(L)}</span><span>${fmt(META.records || 0)} sətir</span>`;
}

async function refreshData(quiet) {
  try { const p = await fetchData(); if (p) await applyPayload(p, false); refreshMeta(); }
  catch (e) { if (!quiet) showNotice('error', e.message); }
}

function refreshBtn(busy) {
  const b = $('btnRefresh'); if (!b) return;
  b.disabled = !!busy; b.classList.toggle('spin', !!busy);
  $('btnRefreshTxt').textContent = busy ? 'Yenilənir…' : 'Yenilə';
}
async function manualRefresh() {                       // yalnız admin (server action da requireAdmin yoxlayır)
  if (DATA.busy) return;
  DATA.busy = true; refreshBtn(true); document.body.classList.add('busy');
  showNotice('info', 'Google Sheet oxunur… (30–90 saniyə)');
  try {
    const r = await opts.triggerSync();
    await refreshData(true);
    const kind = r.status === 'error' ? 'error' : r.status === 'ok' ? 'ok' : 'info';
    showNotice(kind, r.message, kind === 'error' ? 0 : 8000);
  } catch (e) { showNotice('error', 'Yeniləmə alınmadı: ' + (e && e.message || e)); }
  finally { DATA.busy = false; refreshBtn(false); document.body.classList.remove('busy'); }
}
function bindRefresh() {
  const b = $('btnRefresh');
  if (opts.isAdmin) b.onclick = manualRefresh; else b.remove();
  const t = setInterval(() => {                          // səhifə açıq qalanda serverdəki yeni datanı özü götürür
    if (!DATA.busy && document.visibilityState === 'visible') refreshData(true);
  }, CFG.autoRefreshMinutes * 60000);
  cleanups.push(() => clearInterval(t));
}

/* ====== Başlanğıc ====== */
function observePlots() {
  let raf = 0; const o1 = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderChart); }); o1.observe($('plot'));
  let raf2 = 0; const o2 = new ResizeObserver(() => { cancelAnimationFrame(raf2); raf2 = requestAnimationFrame(() => { if (MK.rows.length) renderMK(); }); }); o2.observe($('mkPlot'));
  cleanups.push(() => { o1.disconnect(); o2.disconnect(); });
}
function fatal(title, text) {
  $('kpis').innerHTML = `<div class="kpi" style="grid-column:1/-1"><div class="lab">${esc(title)}</div><div class="val" style="font-size:14px;white-space:normal;line-height:1.5">${esc(text)}</div></div>`;
}
async function init() {
  document.body.classList.add('busy');
  try {
    const p = await fetchData();
    if (!p) throw new Error('Serverdən data alınmadı.');
    await applyPayload(p, true);
  } catch (e) {
    $('rs').hidden = true; $('mk').hidden = true; $('chartCard').hidden = true;
    fatal('Data yüklənmədi', (e && e.message) || String(e));
  } finally { document.body.classList.remove('busy'); }
}
init();
return () => { ac.abort(); cleanups.forEach(f => f()); clearTimeout(noticeTimer); document.body.classList.remove('busy'); };

}
