/* Leitor de PDF do Índice de Ifá
   Abre leitor.html#d=N&p=221&t=TÍTULO na página pedida e destaca o título do patakí.
   Usa PDF.js 3.11 (build UMD), que também funciona abrindo o arquivo direto do disco (file://).
   De onde vem o PDF, nesta ordem:
     1. arquivo escolhido no aparelho (guardado no IndexedDB deste navegador);
     2. pasta pdf/ ao lado do site (só quando servido por http/https: localhost ou GitHub Pages). */
(function(){
'use strict';

const DOCS = {
  N: {f:'pdf/naveira.pdf', nome:'Naveira', longo:'Colección de Ifá — Roberto Naveira', pags:3118, chaves:['NAVEIRA','COLECCION']},
  D: {f:'pdf/delgado.pdf', nome:'Delgado', longo:'Tratado Enciclopédico de Caminos de Ifá — Yamel Delgado', pags:3089, chaves:['DELGADO','TRATADO','256']},
  V: {f:'pdf/verger.pdf',  nome:'Verger',  longo:'Ewé — o uso das plantas na sociedade iorubá — Pierre Verger', pags:618, chaves:['VERGER','EWE']}
};
const ORDEM = ['N','D','V'];
const ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const GAP = 30;
const ON_FILE = location.protocol === 'file:';
const $ = id => document.getElementById(id);
const lib = window.pdfjsLib;
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const lsGet = k => { try { return localStorage.getItem(k); } catch(e) { return null; } };
const lsSet = (k,v) => { try { localStorage.setItem(k,v); } catch(e) {} };
const mb = n => (n/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1}) + ' MB';
try { history.scrollRestoration = 'manual'; } catch(e) {}

/* ---------- worker do PDF.js ---------- */
lib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
/* via file:// o navegador não deixa criar Web Worker; carregando o worker como script comum,
   o PDF.js passa a rodar na thread principal (um pouco mais lento, mas funciona) */
const workerReady = ON_FILE ? new Promise(res => {
  const s = document.createElement('script'); s.src = 'vendor/pdfjs/pdf.worker.min.js';
  s.onload = s.onerror = () => res(); document.head.appendChild(s);
}) : Promise.resolve();
const PDF_OPTS = {
  isEvalSupported: false,          // mitigação de CVE-2024-4367
  disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144,
  standardFontDataUrl: ON_FILE ? undefined : 'vendor/pdfjs/standard_fonts/'
};

/* ---------- IndexedDB: PDFs escolhidos no aparelho ---------- */
const idb = {
  _db: null,
  open(){
    if(!this._db) this._db = new Promise((res, rej) => {
      if(!window.indexedDB) return rej(new Error('sem IndexedDB'));
      const r = indexedDB.open('ifa-pdfs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return this._db;
  },
  async tx(mode, fn){
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('arquivos', mode), st = t.objectStore('arquivos'), r = fn(st);
      t.oncomplete = () => res(r && r.result); t.onerror = t.onabort = () => rej(t.error);
    });
  },
  get(k){ return this.tx('readonly', st => st.get(k)).then(v => v || null); },
  set(k, v){ return this.tx('readwrite', st => st.put(v, k)); },
  del(k){ return this.tx('readwrite', st => st.delete(k)); }
};
const mem = {};   // reserva quando o navegador não deixa gravar (ex.: Firefox via file://)
async function getRec(d){
  if(mem[d]) return mem[d];
  try { return await idb.get(d); } catch(e) { return null; }
}
const toBytes = async b => new Uint8Array(b.arrayBuffer ? await b.arrayBuffer() :
  await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(b); }));

/* ---------- estado ---------- */
const S = {
  d: null, pdf: null, kind: null, rec: null, blobUrl: null,
  n: 0, base: {w:595, h:842}, cssW: 0, cssH: 0, gen: 0,
  zi: Math.max(0, ZOOMS.indexOf(parseFloat(lsGet('ifa.zoom')) || 1)),
  cur: 1, target: null, pending: 0, moved: false,
  pages: [], visible: new Set(), rendered: new Map(), busy: false, io: null
};
if(S.zi < 0 || !ZOOMS[S.zi]) S.zi = 3;
const loaded = {};       // d -> Promise<{ok, pdf, kind, rec}>
const hlCache = new Map();
let routeTok = 0;

/* ---------- carregar documento ---------- */
async function loadDoc(d){
  await workerReady;
  const rec = await getRec(d);
  if(rec && (rec.blob || rec.buf)){
    try {
      const data = rec.buf ? new Uint8Array(rec.buf.slice(0)) : await toBytes(rec.blob);
      const pdf = await lib.getDocument({...PDF_OPTS, data}).promise;
      return {ok:true, pdf, kind:'idb', rec};
    } catch(e) { return {ok:false, err:'O arquivo guardado de '+DOCS[d].nome+' não abriu ('+(e.message||e)+'). Escolha de novo.'}; }
  }
  if(!ON_FILE){
    try {
      const task = lib.getDocument({...PDF_OPTS, url: DOCS[d].f});
      task.onProgress = p => { if(p.total) prog(p.loaded / p.total); };
      const pdf = await task.promise;
      return {ok:true, pdf, kind:'web'};
    } catch(e) {
      return {ok:false, err: (e && e.name === 'MissingPDFException') ? null : 'Falha ao abrir '+DOCS[d].f+': '+(e.message||e)};
    }
  }
  return {ok:false, err:null};
}
/* descarta o documento em cache (arquivo trocado ou esquecido) */
function dropDoc(d){
  const old = loaded[d]; delete loaded[d];
  if(S.d === d) teardown();
  if(old) old.then(r => { if(r.ok) try { r.pdf.destroy(); } catch(e) {} });
}
function getDoc(d){
  if(!loaded[d]) loaded[d] = loadDoc(d).then(r => { if(!r.ok) delete loaded[d]; return r; });
  return loaded[d];
}

/* ---------- rotas: #d=N&p=221&t=TITULO  ·  #arquivos ---------- */
function parseHash(){
  const h = location.hash.replace(/^#/, '');
  if(h === 'arquivos') return {setup:true};
  const q = new URLSearchParams(h), d = (q.get('d') || '').toUpperCase();
  return {d: DOCS[d] ? d : null, p: Math.max(1, parseInt(q.get('p'), 10) || 1), t: (q.get('t') || '').trim()};
}
async function route(){
  const tok = ++routeTok, r = parseHash();
  if(r.setup || !r.d){ showSetup(null); return; }
  S.target = {d:r.d, p:r.p, t:r.t};
  setCtx();
  if(S.d !== r.d || !S.pdf){
    prog(0.03);
    const res = await getDoc(r.d);
    if(tok !== routeTok) return;
    prog(null);
    if(!res.ok){ showSetup(r.d, res.err); return; }
    await mount(r.d, res);
    if(tok !== routeTok) return;
  }
  hideSetup();
  goTo(r.p, true);
  refreshHL();
}
window.addEventListener('hashchange', route);

/* ---------- montar páginas ---------- */
async function mount(d, res){
  teardown();
  S.d = d; S.pdf = res.pdf; S.kind = res.kind; S.rec = res.rec || null; S.n = res.pdf.numPages;
  if(S.blobUrl){ URL.revokeObjectURL(S.blobUrl); S.blobUrl = null; }
  if(S.rec && S.rec.blob) S.blobUrl = URL.createObjectURL(S.rec.blob);
  try { const p1 = await res.pdf.getPage(1), vp = p1.getViewport({scale:1}); S.base = {w:vp.width, h:vp.height}; } catch(e) {}
  const box = $('pages'), frag = document.createDocumentFragment();
  S.pages = new Array(S.n);
  for(let i = 1; i <= S.n; i++){
    const el = document.createElement('div'); el.className = 'page'; el.dataset.n = i;
    S.pages[i-1] = el; frag.appendChild(el);
  }
  box.replaceChildren(frag);
  layout();
  S.io = new IntersectionObserver(onIO, {rootMargin: '120% 0px'});
  S.pages.forEach(el => S.io.observe(el));
  $('pgtot').textContent = '/ ' + S.n;
  $('ctrls').hidden = false;
  if(S.n !== DOCS[d].pags)
    toast('Este arquivo tem ' + S.n + ' páginas; o índice foi feito sobre um de ' + DOCS[d].pags + '. As páginas podem não bater.', 7000);
}
function teardown(){
  if(S.io){ S.io.disconnect(); S.io = null; }
  S.rendered.forEach((r, n) => unrender(n));
  S.rendered.clear(); S.visible.clear();
  $('pages').replaceChildren();
  S.pages = []; S.pdf = null; S.d = null;
}
function layout(){
  const vw = document.documentElement.clientWidth, pad = vw <= 560 ? 12 : 24;
  S.cssW = Math.round(Math.min(vw - pad, 860) * ZOOMS[S.zi]);
  S.cssH = Math.round(S.cssW * S.base.h / S.base.w);
  const st = document.documentElement.style;
  st.setProperty('--pw', S.cssW + 'px'); st.setProperty('--ph', S.cssH + 'px');
  S.gen++;
  $('zl').textContent = Math.round(ZOOMS[S.zi] * 100) + '%';
  $('zout').disabled = S.zi === 0; $('zin').disabled = S.zi === ZOOMS.length - 1;
  pump();
}
const barH = () => $('bar').offsetHeight;
const firstTop = () => S.pages.length ? S.pages[0].getBoundingClientRect().top + window.scrollY : 0;
const pageTop = n => firstTop() + (n - 1) * (S.cssH + GAP);
const clampP = n => Math.min(Math.max(1, n | 0), S.n || 1);

/* ---------- renderização sob demanda (só as páginas perto da tela) ---------- */
function onIO(entries){
  entries.forEach(e => {
    const n = +e.target.dataset.n;
    if(e.isIntersecting) S.visible.add(n); else { S.visible.delete(n); unrender(n); }
  });
  pump();
}
function pump(){
  if(S.busy || !S.pdf) return;
  let best = 0, bd = 1e9;
  S.visible.forEach(n => {
    const r = S.rendered.get(n);
    if(r && r.gen === S.gen) return;
    const dd = Math.abs(n - S.cur);
    if(dd < bd){ bd = dd; best = n; }
  });
  if(!best) return;
  S.busy = true;
  renderPage(best).catch(e => { console.warn('página', best, e); S.rendered.delete(best); })
    .finally(() => { S.busy = false; pump(); });
}
function freeClip(c){ const cv = c.querySelector('canvas'); if(cv){ cv.width = 0; cv.height = 0; } c.remove(); }
function unrender(n){
  const r = S.rendered.get(n); if(!r) return;
  try { r.task && r.task.cancel(); } catch(e) {}
  const el = S.pages[n-1]; if(el) el.querySelectorAll('.clip,.spin').forEach(c => c.classList.contains('clip') ? freeClip(c) : c.remove());
  S.rendered.delete(n);
}
async function renderPage(n){
  const gen = S.gen, pdf = S.pdf, el = S.pages[n-1];
  if(!el) return;
  if(!el.querySelector('.clip') && !el.querySelector('.spin')){ const sp = document.createElement('i'); sp.className = 'spin'; el.appendChild(sp); }
  const entry = {gen, task:null, clip:null, done:false};
  S.rendered.set(n, entry);
  const page = await pdf.getPage(n);
  if(gen !== S.gen || pdf !== S.pdf || !S.visible.has(n) || S.rendered.get(n) !== entry) return;
  const vp1 = page.getViewport({scale:1}), scale = S.cssW / vp1.width;
  let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const area = S.cssW * dpr * vp1.height * scale * dpr, MAXA = 14e6;
  if(area > MAXA) dpr *= Math.sqrt(MAXA / area);
  const vp = page.getViewport({scale: scale * dpr});
  const cv = document.createElement('canvas');
  cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
  cv.style.width = '100%';
  const clip = document.createElement('div'); clip.className = 'clip'; clip.appendChild(cv);
  entry.task = page.render({canvasContext: cv.getContext('2d', {alpha:false}), viewport: vp});
  try { await entry.task.promise; }
  catch(e){ cv.width = cv.height = 0; if(e && e.name === 'RenderingCancelledException') return; throw e; }
  if(gen !== S.gen || !S.visible.has(n) || S.rendered.get(n) !== entry){ cv.width = cv.height = 0; return; }
  el.querySelectorAll('.clip,.spin').forEach(c => c.classList.contains('clip') ? freeClip(c) : c.remove());
  el.appendChild(clip);
  entry.clip = clip; entry.done = true; entry.scale = scale;
  if(isTarget(n)) await applyHL(n, page, entry);
}

/* ---------- destaque do título ---------- */
const isTarget = n => S.target && S.target.d === S.d && S.target.p === n && S.target.t;
async function findRects(page, n){
  const t = S.target.t, key = S.d + '|' + n + '|' + t;
  if(hlCache.has(key)) return hlCache.get(key);
  const T = norm(t.replace(/^\s*\d+\s*[.\-)]+[-\s]*/, ''));
  const rects = [];
  if(T.length >= 4){
    const tc = await page.getTextContent(), vp1 = page.getViewport({scale:1});
    let joined = ''; const owner = [];
    tc.items.forEach((it, i) => { if(!it.str) return; const s = norm(it.str); joined += s; for(let k = 0; k < s.length; k++) owner.push(i); });
    for(const L of [Math.min(T.length, 30), Math.min(T.length, 14)]){
      const k0 = T.slice(0, L); let from = 0, at;
      while((at = joined.indexOf(k0, from)) >= 0 && rects.length < 80){
        let e = at + k0.length;
        while(e < joined.length && e - at < T.length && joined[e] === T[e - at]) e++;
        new Set(owner.slice(at, e)).forEach(i => {
          const it = tc.items[i], tx = lib.Util.transform(vp1.transform, it.transform);
          const fh = Math.hypot(tx[2], tx[3]) || Math.abs(it.height) || 10;
          rects.push({x: tx[4] - 2, y: tx[5] - fh * 0.9, w: Math.max(it.width, 4) + 4, h: fh * 1.2});
        });
        from = e;
      }
      if(rects.length) break;
    }
  }
  hlCache.set(key, rects);
  return rects;
}
async function applyHL(n, page, entry){
  let rects = [];
  try { rects = await findRects(page, n); } catch(e) {}
  if(!entry.clip || S.rendered.get(n) !== entry) return;
  entry.clip.querySelectorAll('.hl').forEach(e => e.remove());
  const k = entry.scale;
  rects.forEach(r => {
    const d = document.createElement('div'); d.className = 'hl';
    d.style.cssText = 'left:'+(r.x*k)+'px;top:'+(r.y*k)+'px;width:'+(r.w*k)+'px;height:'+(r.h*k)+'px';
    entry.clip.appendChild(d);
  });
  if(S.pending === n){
    S.pending = 0;
    if(rects.length && !S.moved){
      const y = Math.min(...rects.map(r => r.y)) * k;
      window.scrollTo({top: Math.max(0, pageTop(n) + y - barH() - Math.min(140, innerHeight * 0.18)), behavior: 'smooth'});
    }
  }
}
async function refreshHL(){
  document.querySelectorAll('.hl').forEach(e => e.remove());
  document.querySelectorAll('.page.tgt').forEach(e => e.classList.remove('tgt'));
  if(!S.target || S.target.d !== S.d || !S.pdf) return;
  const el = S.pages[S.target.p - 1]; if(!el) return;
  el.classList.add('tgt');
  const r = S.rendered.get(S.target.p);
  if(r && r.done && r.gen === S.gen && S.target.t){ const page = await S.pdf.getPage(S.target.p); applyHL(S.target.p, page, r); }
}

/* ---------- navegação ---------- */
function goTo(n, fromLink){
  if(!S.pdf) return;
  n = clampP(n);
  S.moved = false;
  S.pending = fromLink && S.target && S.target.t && S.target.d === S.d && S.target.p === n ? n : 0;
  window.scrollTo(0, Math.max(0, pageTop(n) - barH() - 10));
  setCur(n);
  pump();
}
let hashT = 0;
function setCur(n){
  S.cur = n;
  const inp = $('pgin'); if(document.activeElement !== inp) inp.value = n;
  $('prev').disabled = n <= 1; $('next').disabled = n >= S.n;
  const tg = S.target && S.target.d === S.d ? S.target.p : 0;
  $('backtgt').hidden = !tg || Math.abs(n - tg) <= 1; $('tgtp').textContent = tg;
  $('native').href = (S.blobUrl || DOCS[S.d].f) + '#page=' + n;
  document.title = (S.target && S.target.t && n === tg ? S.target.t : DOCS[S.d].nome) + ' — p. ' + n;
  clearTimeout(hashT);
  hashT = setTimeout(() => {   // guarda a página atual no endereço, sem criar histórico
    const t = S.target && S.target.d === S.d && S.target.p === S.cur && S.target.t ? '&t=' + encodeURIComponent(S.target.t) : '';
    const h = '#d=' + S.d + '&p=' + S.cur + t;
    if(location.hash !== h) try { history.replaceState(null, '', h); } catch(e) {}
  }, 500);
}
let raf = 0;
window.addEventListener('scroll', () => {
  if(raf || !S.pdf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const y = window.scrollY + barH() + (innerHeight - barH()) * 0.25 - firstTop();
    const n = clampP(Math.floor(y / (S.cssH + GAP)) + 1);
    if(n !== S.cur) setCur(n);
  });
}, {passive:true});
['wheel','touchmove','keydown','mousedown'].forEach(ev => window.addEventListener(ev, () => { S.moved = true; }, {passive:true}));

function setCtx(){
  const d = S.target && S.target.d;
  $('docname').textContent = d ? DOCS[d].longo : 'Leitor';
  $('ctx').textContent = S.target && S.target.t ? S.target.t : (d ? 'p. ' + S.target.p : '');
  $('ctx').title = $('ctx').textContent;
}

/* ---------- controles ---------- */
$('prev').onclick = () => goTo(S.cur - 1);
$('next').onclick = () => goTo(S.cur + 1);
$('backtgt').onclick = () => { if(S.target) { goTo(S.target.p, true); refreshHL(); } };
$('pgin').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); goTo(parseInt(e.target.value, 10) || S.cur); e.target.blur(); } });
$('pgin').addEventListener('change', e => goTo(parseInt(e.target.value, 10) || S.cur));
$('pgin').addEventListener('focus', e => e.target.select());
function zoom(dz){
  const i = Math.min(ZOOMS.length - 1, Math.max(0, S.zi + dz));
  if(i === S.zi || !S.pdf) return;
  const top = pageTop(S.cur), frac = (window.scrollY + barH() - top) / (S.cssH + GAP), n = S.cur;
  S.zi = i; lsSet('ifa.zoom', ZOOMS[i]);
  layout();
  window.scrollTo(0, pageTop(n) + frac * (S.cssH + GAP) - barH());
  refreshHL();
}
$('zin').onclick = () => zoom(1);
$('zout').onclick = () => zoom(-1);
let rsT = 0, lastW = document.documentElement.clientWidth;
window.addEventListener('resize', () => {
  clearTimeout(rsT);
  rsT = setTimeout(() => {
    const w = document.documentElement.clientWidth;
    if(w === lastW || !S.pdf) return;
    lastW = w; const n = S.cur; layout(); window.scrollTo(0, pageTop(n) - barH() - 10); refreshHL();
  }, 150);
});
document.addEventListener('keydown', e => {
  if(!S.pdf || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
  if(e.key === 'ArrowRight'){ e.preventDefault(); goTo(S.cur + 1); }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); goTo(S.cur - 1); }
  else if(e.key === '+' || e.key === '='){ zoom(1); }
  else if(e.key === '-'){ zoom(-1); }
});
const menu = $('menu'), menubtn = $('menubtn');
const setMenu = open => { menu.hidden = !open; menubtn.setAttribute('aria-expanded', open); };
menubtn.onclick = e => { e.stopPropagation(); setMenu(menu.hidden); };
document.addEventListener('click', e => { if(!menu.hidden && !menu.contains(e.target) && e.target !== menubtn) setMenu(false); });
$('files').onclick = () => { setMenu(false); showSetup(null); };
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { setMenu(false); location.hash = '#d=' + b.dataset.go + '&p=1'; });

/* ---------- tela de arquivos ---------- */
let setupFor = null;
async function showSetup(d, err){
  setupFor = d;
  $('setup').hidden = false; $('pages').hidden = true; $('ctrls').hidden = true;
  setMenu(false);
  $('closesetup').hidden = !S.pdf;
  if(d){
    const p = S.target ? S.target.p : 1;
    $('setupeyebrow').textContent = DOCS[d].longo;
    $('setuptitle').textContent = 'Falta o PDF de ' + DOCS[d].nome;
    $('setupmsg').innerHTML = err ? esc(err) :
      'Para abrir a <b>p. ' + p + '</b>, escolha o arquivo <b>' + esc(DOCS[d].longo) + '</b> (' + DOCS[d].pags.toLocaleString('pt-BR') +
      ' páginas). Pode marcar os três PDFs de uma vez: o leitor reconhece cada um pelo número de páginas.';
  } else {
    $('setupeyebrow').textContent = 'Arquivos PDF';
    $('setuptitle').textContent = 'PDFs do leitor';
    $('setupmsg').textContent = 'Escolha os arquivos no aparelho. Pode marcar os três de uma vez: o leitor reconhece cada um pelo número de páginas.';
  }
  document.title = 'Arquivos PDF — Índice de Ifá';
  window.scrollTo(0, 0);
  paintList();
}
function hideSetup(){ $('setup').hidden = true; $('pages').hidden = false; if(S.pdf) $('ctrls').hidden = false; }
$('closesetup').onclick = () => { hideSetup(); if(S.target && S.target.d === S.d) goTo(S.cur); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function webHas(d){
  if(ON_FILE) return false;
  try { const r = await fetch(DOCS[d].f, {method:'HEAD', cache:'no-store'}); return r.ok; } catch(e) { return false; }
}
async function paintList(){
  const rows = await Promise.all(ORDEM.map(async d => {
    const rec = await getRec(d), web = rec ? false : await webHas(d);
    let st;
    if(rec) st = '<span class="st ' + (rec.pages === DOCS[d].pags ? 'ok' : 'warn') + '">' + (mem[d] ? 'aberto nesta aba' : 'guardado no aparelho') +
      ' · ' + mb(rec.size) + '</span><button class="btn x" data-del="' + d + '">esquecer</button>';
    else if(web) st = '<span class="st web">na pasta pdf/</span>';
    else st = '<span class="st no">não encontrado</span>';
    return '<li><div class="nm"><b>' + esc(DOCS[d].longo) + '</b><span>' + DOCS[d].pags.toLocaleString('pt-BR') + ' páginas · ' +
      (rec ? esc(rec.name) : DOCS[d].f) + '</span></div>' + st + '</li>';
  }));
  $('doclist').innerHTML = rows.join('');
  $('doclist').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const d = b.dataset.del; delete mem[d]; try { await idb.del(d); } catch(e) {}
    dropDoc(d);
    toast(DOCS[d].nome + ' removido deste navegador.'); paintList();
  });
}
$('pick').onclick = () => $('file').click();
$('file').onchange = async e => {
  const files = [...e.target.files]; e.target.value = '';
  const got = [];
  for(const f of files){ const d = await addFile(f); if(d) got.push(d); }
  paintList();
  if(!got.length) return;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch(err) {}
  const r = parseHash();
  if(r.d && got.includes(r.d)) route();
  else if(setupFor && got.includes(setupFor)){ location.hash = '#d=' + setupFor + '&p=' + (S.target ? S.target.p : 1); }
};
async function addFile(file){
  toast('Lendo “' + file.name + '”…', 60000);
  let pages = 0;
  try {
    await workerReady;
    const pdf = await lib.getDocument({...PDF_OPTS, data: await toBytes(file)}).promise;
    pages = pdf.numPages; pdf.destroy();
  } catch(e) { toast('“' + file.name + '” não abriu como PDF.'); return null; }
  let d = ORDEM.find(k => DOCS[k].pags === pages);
  if(!d){ const nm = norm(file.name); d = ORDEM.find(k => DOCS[k].chaves.some(c => nm.includes(c))); }
  if(!d){ toast('Não reconheci “' + file.name + '” (' + pages + ' páginas).', 6000); return null; }
  const rec = {blob: file, name: file.name, size: file.size, pages, at: Date.now()};
  delete mem[d];
  try { await idb.set(d, rec); }
  catch(e1){
    try { await idb.set(d, {...rec, blob: null, buf: (await toBytes(file)).buffer}); }
    catch(e2){ mem[d] = rec; toast('Este navegador não deixou guardar o arquivo: ele vale até fechar a aba.', 6000); }
  }
  dropDoc(d);
  toast(DOCS[d].nome + ' pronto (' + pages.toLocaleString('pt-BR') + ' páginas' + (pages !== DOCS[d].pags ? ' — o índice espera ' + DOCS[d].pags : '') + ').', 4000);
  return d;
}

/* ---------- avisos ---------- */
let toastT = 0;
function toast(msg, ms){
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 3200);
}
function prog(v){
  const p = $('prog');
  if(v == null){ p.hidden = true; return; }
  p.hidden = false; $('progbar').style.width = Math.round(Math.min(1, Math.max(0, v)) * 100) + '%';
}

route();
})();
