const D = window.IFA_DATA;
let cur = D.order[0], avF = null, q = '', src = 'all';

/* ---------- links para as páginas dos PDFs ----------
   Toda referência de página vira um <a>. O destino depende do modo:
   - "leitor": leitor.html (PDF.js embutido) — abre na página e destaca o título; funciona no celular.
   - "nativo": pdf/<arquivo>.pdf#page=N — visualizador do próprio navegador (Chrome, Edge, Firefox).
   - "auto":   nativo quando a página é aberta direto do disco (file://), leitor quando servida por http(s). */
const DOCS = {
  N: {f: 'pdf/naveira.pdf', nome: 'Naveira'},
  D: {f: 'pdf/delgado.pdf', nome: 'Delgado'},
  V: {f: 'pdf/verger.pdf',  nome: 'Verger'}
};
const lsGet = k => { try { return localStorage.getItem(k); } catch(e) { return null; } };
const lsSet = (k,v) => { try { localStorage.setItem(k,v); } catch(e) {} };
let MODO = lsGet('ifa.modo') || 'auto';
const modoEf = () => MODO === 'auto' ? (location.protocol === 'file:' ? 'nativo' : 'leitor') : MODO;
const escA = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function pdfHref(doc, p, t){
  p = Math.max(1, parseInt(p,10) || 1);
  if(modoEf() === 'nativo') return DOCS[doc].f + '#page=' + p;
  return 'leitor.html#d=' + doc + '&p=' + p + (t ? '&t=' + encodeURIComponent(String(t).slice(0,160)) : '');
}
/* o leitor reaproveita sempre a mesma aba; o PDF nativo abre uma aba nova a cada link */
const pdfTarget = () => modoEf() === 'nativo' ? '_blank' : 'ifa-leitor';
/* <a> para uma página. inner já vem escapado. */
function pA(doc, p, inner, t, cls){
  return '<a class="'+(cls||'pl')+'" href="'+escA(pdfHref(doc,p,t))+'" target="'+pdfTarget()+'"'+
    ' title="'+escA(DOCS[doc].nome+' · p. '+p+(t ? ' — '+t : ''))+'">'+inner+'</a>';
}
/* "N p.12" com a página clicável */
const tagPg = (doc, p, t) => '<span class="tag t'+doc+'">'+doc+'</span>'+pA(doc, p, 'p.'+p, t);
/* "p. 12, 30" (lista de páginas, cada uma um link) */
const pgList = (doc, ps, t) => ps.map(p => pA(doc, p, String(p), t)).join(', ');
/* início do odu em cada tratado */
const oduPgs = o => tagPg('N', o.navp, o.nav)+' '+tagPg('D', o.delp, o.del);
/* troca "Naveira p. 187 e 191" / "Delgado p. 427" num texto por links */
const linkify = html => html.replace(/(Naveira|Delgado) p\. (\d+(?:\s+e\s+\d+)*)/g, (m, who, nums) => {
  const doc = who === 'Naveira' ? 'N' : 'D';
  return who + ' p. ' + nums.replace(/\d+/g, n => pA(doc, n, n));
});
const CELL = {}; D.odus.forEach(o => CELL[o.c] = o);
const nameOf = c => CELL[c] ? CELL[c].nav : c;
const both = c => { const o = CELL[c]; return o ? (o.nav === o.del ? o.nav : o.nav + ' / ' + o.del) : c; };
const keep = it => src === 'all' || it.s === src;
const esc = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const hi = (s,t) => { if(!t) return esc(s); const i = norm(s).indexOf(norm(t));
  return i<0 ? esc(s) : esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+t.length))+'</mark>'+esc(s.slice(i+t.length)); };

/* picker */
const picker = document.getElementById('picker');
picker.innerHTML = D.groups.map(g =>
  '<div class="navgrp"><span class="glabel">'+g.label+'</span><div class="gbtns">' +
  D.order.filter(k => D.orishas[k].grp === g.id).map(k => {
    const o = D.orishas[k];
    return '<button class="ob" data-k="'+k+'"><i style="background:'+o.accent+'"></i>'+o.label+' <b>'+o.total+'</b></button>';
  }).join('') + '</div></div>').join('');
const togg = document.getElementById('togg');
togg.onclick = () => { const open = picker.classList.toggle('open'); togg.setAttribute('aria-expanded', open);
  togg.textContent = open ? 'Fechar' : 'Trocar orixá'; };
picker.addEventListener('click', e => { const b = e.target.closest('.ob'); if(!b) return;
  cur = b.dataset.k; avF = null; q = ''; picker.classList.remove('open');
  togg.setAttribute('aria-expanded', false); togg.textContent = 'Trocar orixá';
  render(); document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'}); });

/* map */
const mapEl = document.getElementById('map');
mapEl.innerHTML = D.odus.map(o => '<div class="cell" data-c="'+o.c+'"></div>').join('');
mapEl.addEventListener('mouseover', e => { const c = e.target.closest('.cell'); if(!c) return;
  const n = c.dataset.n || 0, o = CELL[c.dataset.c];
  document.getElementById('maptip').innerHTML = both(c.dataset.c)+' · <span class="tag tN">N</span>p.'+o.navp+
    ' <span class="tag tD">D</span>p.'+o.delp+' · <span>'+n+' patakí'+(n==1?'':'s')+'</span>'; });
mapEl.addEventListener('click', e => { const c = e.target.closest('.cell'); if(!c || !c.dataset.n) return;
  const t = document.getElementById('g-'+c.dataset.c.replace('-','_'));
  if(t) t.scrollIntoView({behavior:'smooth', block:'start'}); });

function paintMap(){
  const o = D.orishas[cur], counts = {};
  o.groups.forEach(g => counts[g.c] = g.items.filter(keep).length);
  const max = Math.max(1, ...Object.values(counts));
  [...mapEl.children].forEach(c => { const n = counts[c.dataset.c] || 0;
    if(n){ c.dataset.n = n; c.style.background = o.accent; c.style.opacity = (0.2+0.8*Math.sqrt(n/max)).toFixed(3); }
    else { delete c.dataset.n; c.style.background = ''; c.style.opacity = 1; } });
  document.getElementById('sw').innerHTML = [0.25,0.45,0.65,0.85,1].map(v =>
    '<div class="sw" style="background:'+o.accent+';opacity:'+v+'"></div>').join('');
  document.getElementById('mapmeta').textContent = o.odus+' de 256 odus acesos';
}

const TAX = [
 ['Irunmole','ìrunmolè · os que vieram do orun','irunmole',
  'As divindades primordiais, anteriores à formação dos corpos. O tratado não as trata como assunto ocasional: quase toda seção de odu traz um campo fixo declarando quais irunmoles governam aquele signo. Em 218 dos 256 odus esse campo está preenchido, e os três nomes que mais retornam são Ifá, Ori e Eshu — a tríade que sustenta qualquer consulta.',
  ['irunmole','ori','elegua','arabiti','ogun','obatala','oshun','shango','egun','iyami','orishaoko','oke','ibeyi','onile','babalu','osun','oya','yemaya']],
 ['Orisha','òrìṣà · força com casa na terra','obatala',
  'A distinção entre irunmole e orisha aqui é de origem, não de posto. Irunmole desceu do orun; orisha é a força que ganhou história, caminho, assentamento e sacerdócio na terra. Um mesmo nome pode aparecer nas duas chaves conforme o relato.',
  ['elegua','ogun','ochosi','osun','ozain','obatala','oduduwa','olofin','olorun','shango','aggayu','oya','oranyan','yemaya','olokun','oshun','oshumare','babalu','nana','inle','orishaoko','iroko','oke','onile','ogue','yewa','obba','boromu','iyami','ibeyi','dada']],
 ['Eledá · alagbatori','o dono da cabeça','eleda',
  'O orixá que rege a cabeça de cada pessoa — o que se determina no itá e a quem se devem as obrigações. O termo alagbatori não aparece nesta coleção; o equivalente usado é Eledá, com ángel de la guarda como sinônimo corrente. É categoria de posse: a cabeça pertence a alguém.',
  ['eleda','ori','obatala','oduduwa','shango','yemaya','oshun','oya','elegua','ogun']],
 ['Ori','orí · a cabeça como divindade','ori',
  'Não é o orixá tutelar, é a própria cabeça. Escolhe o destino antes de nascer e é a única instância que se cultua sem intermediário — por isso o tratado repete que nenhum orixá salva quem tem o ori contra si. Aparece declarado como irunmole em mais odus do que qualquer orixá.',
  ['ori','eleda','irunmole','arabiti']],
 ['Egun · Ará Onú','os que vieram antes','egun',
  'Os mortos. O tratado separa por função, não por natureza: de um lado o egun protetor e o guia espiritual, de outro o egun buruku e o obsessor. Ará Onú é o morto já elevado, que não pede mais resgate. A diferença aparece no que se faz com cada um: ao protetor se dá luz, bóveda e comida; ao que se agarra se faz oparaldo, a obra que separa o vivo do morto que o segue — e é a operação mais registrada de todas, com 156 patakís nos dois tratados somados. Guardião, aqui, é função exercida, não posto herdado: o mesmo morto protege ou atrapalha conforme a relação que se estabelece com ele.',
  ['egun','araonu','egunburu','oparaldo','egbe','abiku','oro','iku','dada']],
 ['Egun buruku · obsessores','o que o oparaldo retira','egunburu',
  'Espíritos que se prendem à pessoa e desviam o que estava traçado. Aparecem sobretudo nos trechos de obra — oparaldo, banhos, rituais de separação — e menos como personagem de história. É por isso que a lista deles é curta em patakís e longa em procedimentos.',
  ['egunburu','araonu','elenini','abita','iyami','epe','elenu']],
 ['Abikú','àbíkú · nascido para morrer','abiku',
  'A criança que desce comprometida a voltar cedo para o orun, ligada a um grupo que a reclama de volta. No tratado o assunto aparece como problema a resolver por ebó e marca, não como condição sem saída.',
  ['abiku','ibeyi','egbe','araonu','iku','nana']],
 ['Elementais','habitantes do lugar','aroni',
  'Não são orixás nem mortos: são seres do mato e das águas com domínio próprio. Aroni, o de uma perna só, guarda a floresta ao lado de Ozain e ensina folha a quem se submete. Iwin e Egbere confundem quem entra sem pedir licença.',
  ['aroni','iwin','ozain','iroko','oke','onile','oshumare']],
 ['Ajogun · osogbo','os que vêm contra','ajogun',
  'As forças de perda. Não são demônios nem castigo moral: são princípios que o ebó desvia, e o tratado os nomeia um a um para que se saiba o que exatamente se está evitando. Ikú é a morte, Arun a doença, Ofo a perda, Eyo a tragédia, Egba a paralisia, Ewon a prisão, Oran o processo, Akoba o acidente, Epe a maldição, Araye os inimigos, Ashelu a autoridade que prende, Elenu a má língua.',
  ['ajogun','iku','arun','ofo','eyo','egba','ewon','oran','akoba','epe','araye','ashelu','elenu']],
 ['Abita','a sombra dentro da criação','abita',
  'A contraparte escura, ligada ao pacto e ao que se obtém por caminho torto. Não é o oposto simétrico de Olofin — está dentro do mesmo mundo, e o tratado o narra como quem oferece atalho e depois cobra.',
  ['abita','elenini','iyami','epe','egunburu','ajogun','iku']],
 ['Elenini','o obstáculo com nome','elenini',
  'O que se posta na frente de um destino já escolhido. É a personificação da trava: nada foi retirado da pessoa, algo foi colocado no caminho dela. Aparece pouco, mas sempre nesse papel.',
  ['elenini','egba','abita','ewon','oran','ashelu','araye','ofo']],
 ['Iyami · Eleye','as mães ancestrais','iyami',
  'O poder feminino noturno, chamado no tratado também de Eleye, as donas do pássaro. Não se enfrentam, se aplacam — e boa parte da lógica do ebó existe por causa delas.',
  ['iyami','oshun','oya','yewa','obba','nana','abita','elenu']],
 ['Egbe','a companhia deixada no orun','egbe',
  'Os companheiros de antes do nascimento, que continuam reclamando quem desceu. Explica afastamentos, sonhos recorrentes e a sensação de pertencer a outro lugar.',
  ['egbe','abiku','araonu','egun','ibeyi']],
 ['Orun e Aye','ìkọlé ọ̀run · ìkọlé ayé · os dois mundos','orunaye',
  'O tratado não trata o mundo espiritual como lugar distante, e sim como a outra metade de um par. Aye é onde se nasce e se trabalha; orun é de onde se veio e para onde se volta, e foi lá que o destino se escolheu antes de haver corpo. Toda a mecânica do ebó depende dessa passagem estar aberta — o sacrifício se entrega de um lado e se recebe do outro. Por isso Ará Onú, literalmente gente do além, é o nome de quem já completou a travessia e não precisa mais ser resgatado.',
  ['orunaye','araonu','egun','ori','arabiti','olorun','egbe']],
 ['Corpos celestes','òṣùpá · ìràwọ̀ · òòrùn','oshupa',
  'Sol, Lua e estrelas aparecem como seres a quem se pede, não como cenário. Ogbe Sa registra a criação da Lua e manda pedir a Olorun e a Oshupa (Naveira p. 187 e 191), e há rezo próprio para saudar a primeira lua do ano. Irawo, as estrelas, acompanham Olorun e olham junto com ele. Oshupa nomeia também a menstruação, o que amarra o ciclo lunar ao ciclo do corpo dentro da mesma palavra.',
  ['oshupa','irawo','oorun','afefe','olorun','orunaye','igbaiwa']],
 ['Seres sem forma','o que age sem ter corpo','igbaiwa',
  'São raros, e é justamente por isso que o tratado os descreve com precisão física quando aparecem. Em Oyekun Osa (Naveira p. 441, Delgado p. 427) um ser perde a aparência de homem bonito e permanece como uma bola de luz brilhante, sem cabeça, braços nem pés, conservando as faculdades. Em Ogbe Irosun (Naveira p. 105) a tarde escurece e surge uma enorme esfera amarela com um olho no centro, que exige oferenda — é Odu se manifestando. Em Osa Meji (Naveira p. 1922, Delgado p. 1772) uma esfera chamada Eje Oruko Bale é criada e introduzida no sangue de Ará. Nos três casos o ser não tem forma humana e nos três ele age, decide e cobra.',
  ['igbaiwa','orunaye','egunburu','iyami','abita','oshupa']],
];

function renderTax(){ syncHash();
  document.documentElement.style.setProperty('--accent','#C9A227');
  document.getElementById('nowname').textContent = 'Tipos de seres';
  document.getElementById('nowdot').style.background = '#C9A227';
  const top = D.iruntop, mx = Math.max(...top.map(t => t[1]));
  let h = '<section class="ohead"><div class="eyebrow">Como o tratado classifica</div>'+
    '<h2 class="oname" style="color:#C9A227">Tipos de seres</h2>'+
    '<p class="taxintro">Nem tudo que age num patakí é orixá. Os tratados movem irunmoles, mortos, forças de perda, habitantes do mato, corpos celestes e seres sem forma nenhuma — e tratam cada categoria com regra própria. Abaixo, o que cada classe é e onde procurar no índice.</p></section>';
  h += '<div class="taxgrid">' + TAX.map(t => {
    const c = D.orishas[t[2]] ? D.orishas[t[2]].accent : '#C9A227';
    const links = t[4].filter(k => D.orishas[k]).map(k =>
      '<button class="taxlink" data-go="'+k+'"><i style="background:'+D.orishas[k].accent+'"></i>'+
      D.orishas[k].label+' · '+D.orishas[k].total+'</button>').join('');
    const ev = t[4].filter(k => D.orishas[k]).reduce((a,k) => a + D.orishas[k].total, 0);
    return '<div class="taxcard" style="--tc:'+c+'"><h3>'+t[0]+'</h3><div class="yor">'+t[1]+'</div>'+
      '<p>'+linkify(t[3])+'</p><div class="ev">'+ev+' patakís nas entradas ligadas a esta classe</div>'+
      '<div class="taxlinks">'+links+'</div></div>'; }).join('') + '</div>';

  h += '<div class="irunblock"><div class="eyebrow">Irunmoles declarados odu a odu</div>'+
    '<p class="taxintro" style="margin-top:10px">Campo fixo no alto de cada seção. Presente em '+D.irun.length+' dos 256 odus.</p>'+
    '<div class="irunbars">' + top.map(t =>
      '<span>'+t[0]+'</span><div class="bar" style="width:'+(100*t[1]/mx).toFixed(1)+'%"></div><span class="qt">'+t[1]+'</span>').join('') +
    '</div><input type="search" id="iq" placeholder="Filtrar por odu ou por irunmole…">'+
    '<div class="iruntable" id="itab"></div></div>';

  document.getElementById('panel').innerHTML = h;
  const draw = f => { const q = norm(f||'');
    document.getElementById('itab').innerHTML = D.irun.filter(r =>
      !q || norm(r.odu).includes(q) || r.l.some(x => norm(x).includes(q)))
      .map(r => '<div class="r"><span class="o">'+pA('N', r.p, esc(r.odu)+' · p.'+r.p, r.odu)+'</span><span>'+esc(r.l.join(' · '))+'</span></div>')
      .join('') || '<div class="r">Nada encontrado.</div>'; };
  draw('');
  document.getElementById('iq').addEventListener('input', e => draw(e.target.value));
  document.querySelectorAll('.taxlink').forEach(b => b.onclick = () => {
    cur = b.dataset.go; avF = null; q = ''; render();
    document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'}); });
}
document.getElementById('tax').onclick = () => { cur = '__tax'; renderTax(); paintMapOff();
  document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'}); };
function paintMapOff(){ [...mapEl.children].forEach(c => { delete c.dataset.n; c.style.background=''; c.style.opacity=1; });
  document.getElementById('sw').innerHTML=''; document.getElementById('mapmeta').textContent='escolha um ser para acender o mapa'; }

const DL={refran:'refranes',proverbio:'provérbios',diceifa:'dice Ifá',ireosobo:'ire / osobo',
 profecia:'profecia ética',totem:'tótem',cavilacion:'cavilação',dualidad:'dualidade',tizana:'tizana',eshu:'Eshu do signo'};
let wty=new Set(), wpu=new Set(), wmine=false, wq='';
const MINE=new Set(D.ita.reg.map(r=>r.c));
let WT=0; const CT={}, CP={};
Object.values(D.works.cells).forEach(v=>v.forEach(x=>{WT++;CT[x[0]]=(CT[x[0]]||0)+1;x[4].forEach(u=>CP[u]=(CP[u]||0)+1);}));

function renderWorks(){ syncHash();
 const W=D.works;
 document.documentElement.style.setProperty('--accent','#C9A227');
 document.getElementById('nowname').textContent='Obras e rezos';
 document.getElementById('nowdot').style.background='#C9A227';
 paintMapWorks();
 let h='<section class="ohead"><div class="eyebrow">Índice de procedimentos</div>'+
  '<h2 class="oname" style="color:#C9A227">Obras e rezos</h2>'+
  '<p class="taxintro">Todo cabeçalho de procedimento dos dois tratados, com a finalidade que ele próprio declara. '+
  WT.toLocaleString('pt-BR')+' entradas nos 256 odus.</p>'+
  '<div class="wfil"><div class="wrow"><span class="wl">Tipo</span>'+
   W.types.map((t,i)=>'<button class="wc" data-wt="'+i+'" aria-pressed="'+wty.has(i)+'">'+t+'<b>'+(CT[i]||0)+'</b></button>').join('')+'</div>'+
  '<div class="wrow"><span class="wl">Finalidade declarada</span>'+
   W.purps.map((p,i)=>'<button class="wc gr" data-wp="'+i+'" aria-pressed="'+wpu.has(i)+'">'+p+'<b>'+(CP[i]||0)+'</b></button>').join('')+'</div>'+
  '<div class="wrow"><span class="wl">Recorte</span>'+
   '<button class="wc gd" id="wm" aria-pressed="'+wmine+'">Só as casas do meu itá<b>'+MINE.size+'</b></button></div>'+
  '<input type="search" id="wq" placeholder="Buscar na finalidade: quitar iku, vencer, dinero, obini…" value="'+esc(wq)+'"></div></section>';

 const qq=norm(wq.trim()); let n=0, shown=0, body='';
 const cells=Object.keys(W.cells).sort((a,b)=>{const[x1,y1]=a.split('-').map(Number),[x2,y2]=b.split('-').map(Number);return x1-x2||y1-y2;});
 for(const c of cells){
  if(wmine&&!MINE.has(c))continue;
  let its=W.cells[c];
  if(wty.size)its=its.filter(x=>wty.has(x[0]));
  if(wpu.size)its=its.filter(x=>x[4].some(u=>wpu.has(u)));
  if(qq)its=its.filter(x=>norm(W.labs[x[1]]).includes(qq));
  if(!its.length)continue;
  n+=its.length;
  if(shown>=260)continue;
  shown+=its.length;
  const o=CELL[c], dd=W.doct[c]||{};
  body+='<section class="grp"><div class="grphead"><h4>'+esc(o.nav)+'</h4>'+
   (o.del!==o.nav?'<span class="altname">'+esc(o.del)+'</span>':'')+
   (MINE.has(c)?'<span class="mine">meu itá</span>':'')+
   '<span class="gn">'+its.length+' · '+oduPgs(o)+'</span></div><ul class="wit">'+
   its.map(x=>{const s=x[2]?'D':'N', lab=W.labs[x[1]];
    return '<li><span class="ty t'+x[0]+'">'+W.types[x[0]].split(' ')[0]+'</span>'+
    '<span class="lb">'+pA(s,x[3],hi(lab,wq.trim()),lab,'tl')+'</span>'+
    (x[4].length?'<span class="pu">'+x[4].map(u=>W.purps[u]).join(' · ')+'</span>':'')+
    '<span class="pg">'+tagPg(s,x[3],lab)+'</span></li>';}).join('')+
   '</ul>'+notaHTML(c)+(Object.keys(dd).length?'<div class="doct">'+Object.entries(dd).map(([k,v])=>
    '<span class="dchip">'+(DL[k]||k)+' <b>'+v.map(z=>pA(z[0],z[1],z[0]+' p.'+z[1],(DL[k]||k)+' · '+o.nav)).join(', ')+'</b></span>').join('')+'</div>':'')+'</section>';
 }
 h+='<div class="count">'+n.toLocaleString('pt-BR')+' procedimento'+(n===1?'':'s')+
   (n>shown?' · mostrando os '+shown+' primeiros, refine o filtro':'')+'</div>'+
   (body||'<p class="empty">Nada encontrado com esses filtros.</p>');
 document.getElementById('panel').innerHTML=h;
 document.querySelectorAll('[data-wt]').forEach(b=>b.onclick=()=>{const i=+b.dataset.wt;
  wty.has(i)?wty.delete(i):wty.add(i);renderWorks();});
 document.querySelectorAll('[data-wp]').forEach(b=>b.onclick=()=>{const i=+b.dataset.wp;
  wpu.has(i)?wpu.delete(i):wpu.add(i);renderWorks();});
 document.getElementById('wm').onclick=()=>{wmine=!wmine;renderWorks();};
 const wi=document.getElementById('wq');
 let tt; wi.addEventListener('input',e=>{wq=e.target.value;const p=e.target.selectionStart;
  clearTimeout(tt);tt=setTimeout(()=>{renderWorks();const nn=document.getElementById('wq');nn.focus();nn.setSelectionRange(p,p);},200);});
}
function paintMapWorks(){
 const W=D.works, cnt={};
 Object.entries(W.cells).forEach(([c,v])=>cnt[c]=v.length);
 const mx=Math.max(1,...Object.values(cnt));
 [...mapEl.children].forEach(c=>{const v=cnt[c.dataset.c]||0;
  if(v){c.dataset.n=v;c.style.background='#C9A227';c.style.opacity=(0.2+0.8*Math.sqrt(v/mx)).toFixed(3);}
  else{delete c.dataset.n;c.style.background='';c.style.opacity=1;}});
 document.getElementById('sw').innerHTML=[0.25,0.45,0.65,0.85,1].map(v=>
  '<div class="sw" style="background:#C9A227;opacity:'+v+'"></div>').join('');
 document.getElementById('mapmeta').textContent='densidade de obras por odu';
}
document.getElementById('obr').onclick=()=>{cur='__obr';renderWorks();
 document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'});};

/* ---------- odu math ---------- */
const FAM=['OGBE','OYEKU','IWORI','ODI','IROSO','OJUANI','OBARA','OKANA','OGUNDA','OSA','IKA','OTRUPON','OTURA','IRETE','OSHE','OFUN'];
const MK={OGBE:[1,1,1,1],OYEKU:[2,2,2,2],IWORI:[2,1,1,2],ODI:[1,2,2,1],IROSO:[1,1,2,2],OJUANI:[2,2,1,1],
OBARA:[1,2,2,2],OKANA:[2,2,2,1],OGUNDA:[1,1,1,2],OSA:[2,1,1,1],IKA:[2,1,2,2],OTRUPON:[2,2,1,2],
OTURA:[1,2,1,1],IRETE:[1,1,2,1],OSHE:[1,2,1,2],OFUN:[2,1,2,1]};
const INV={0:1,1:0,2:3,3:2,4:5,5:4,6:9,9:6,7:8,8:7,10:12,12:10,11:13,13:11,14:15,15:14};
const legs=c=>{const[f,p]=c.split('-').map(Number);return p===0?[f,f]:[f,(p-1<f?p-1:p)];};
const mkcell=(a,b)=>a===b?a+'-0':a+'-'+(b<a?b+1:b);
const figHTML=c=>{const[a,b]=legs(c);
 return '<div class="fig"><div class="leg">'+MK[FAM[b]].map(m=>'<div class="mk '+(m===1?'s':'d')+'">'+(m===1?'<i></i>':'<i></i><i></i>')+'</div>').join('')+
 '<div class="figlab">2ª perna</div></div><div class="leg">'+MK[FAM[a]].map(m=>'<div class="mk '+(m===1?'s':'d')+'">'+(m===1?'<i></i>':'<i></i><i></i>')+'</div>').join('')+
 '<div class="figlab">1ª perna</div></div></div>';};
const cellName=c=>CELL[c]?CELL[c].nav:c;
const cellOpts=sel=>D.odus.map(o=>'<option value="'+o.c+'"'+(o.c===sel?' selected':'')+'>'+o.nav+(o.del!==o.nav?' · '+o.del:'')+'</option>').join('');
const NL={comida:'sem comer',bebida:'sem beber',roupa:'roupa',prazo:'prazo de dias',
horário:'hora marcada',rua:'sem sair',nasce:'nasce aqui',visita:'sem visitar',
retira:'signo se retira',gratuito:'sem cobrar'};
function notaHTML(c){
 const d=D.nota.cells[c];if(!d)return '';
 const ks=Object.keys(d).sort((a,b)=>d[b][1]-d[a][1]);
 return '<div class="nota">'+ks.map(k=>'<span class="nt">'+(NL[k]||k)+' \u00d7'+d[k][1]+
  ' \u00b7 '+tagPg(d[k][2]?'D':'N',d[k][0],(NL[k]||k)+' \u00b7 '+cellName(c))+'</span>').join('')+'</div>';
}
function cellStats(c){
 const pk=(D.pk.cells[c]||[]).length, wk=(D.works.cells[c]||[]).length;
 const ents=D.order.map(k=>{const g=D.orishas[k].groups.find(x=>x.c===c);return g?[k,g.items.length]:null;})
  .filter(Boolean).sort((a,b)=>b[1]-a[1]).slice(0,6);
 return {pk,wk,ents,temas:D.osode.temas[c]||[]};
}
function dvHTML(role,desc,c,showFig){
 const o=CELL[c],st=cellStats(c),[a,b]=legs(c);
 return '<div class="dv"><div class="r">'+role+'</div><div class="nm">'+esc(o.nav)+'</div>'+
  '<div class="sub">'+(o.del!==o.nav?esc(o.del)+' · ':'')+oduPgs(o)+'</div>'+
  (showFig?figHTML(c):'')+
  '<p>'+esc(D.osode.gen[FAM[a]])+'</p>'+
  (st.temas.length?'<div class="temas">'+st.temas.map(t=>'<span class="tm">'+esc(t)+'</span>').join('')+'</div>':'')+
  notaHTML(c)+
  '<div class="sub" style="margin-top:9px">'+st.pk+' patakís · '+st.wk+' obras</div>'+
  (st.ents.length?'<div class="ents">'+st.ents.map(([k,n])=>'<button class="en" data-go="'+k+'"><i style="background:'+D.orishas[k].accent+'"></i>'+D.orishas[k].label+' '+n+'</button>').join('')+'</div>':'')+
  (desc?'<p style="margin-top:9px;opacity:.8">'+desc+'</p>':'')+'</div>';
}
function wireEnts(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{
 cur=b.dataset.go;avF=null;q='';render();document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'});});}
function pkList(c,filterEnt){
 let its=(D.pk.cells[c]||[]).map(x=>({t:D.pk.labs[x[0]],n:x[1],p:x[2],pe:x[3],s:x[4]?'D':'N'}));
 if(filterEnt){const set=new Set();
  const g=D.orishas[filterEnt].groups.find(x=>x.c===c);
  if(g)g.items.forEach(i=>set.add(norm(i.t).slice(0,40)));
  its=its.filter(i=>set.has(norm(i.t).slice(0,40)));}
 return its;
}
function pkHTML(c,filterEnt){
 const its=pkList(c,filterEnt);
 if(!its.length)return '<p class="empty">Nenhum patakí listado com esse filtro.</p>';
 return '<ol class="items">'+its.map(pkLi).join('')+'</ol>';
}
/* uma linha de patakí: título e página levam ao PDF */
function pkLi(i){
 return '<li><span class="num">'+(i.n||'·')+'</span><span class="ttl">'+pA(i.s,i.p,esc(i.t),i.t,'tl')+'</span>'+
  '<span class="pg"><span class="tag t'+i.s+'">'+i.s+'</span>'+pA(i.s,i.p,'p.'+i.p+(i.pe>i.p?'\u2013'+i.pe:''),i.t)+'</span></li>';
}

/* ---------- ire / osogbo vocabulary ---------- */
const IRE=[['Aikú','não ver a morte'],['Ashegun Otá','vencer as dificuldades'],
['Ashegun Otá Koleñio Adió','vencer dificuldades e inimigos'],['Omá','pela inteligência'],
['Motá Arí','loteria'],['Owó','dinheiro'],['Obalé','alcançar o poder'],['Abiti Iriná','escapar das armadilhas'],
['Shalé','de momento, provisória'],['Ilé Siwayú','progredir · casa do padrinho'],['Ayé Ikú','burlar a morte'],
['Oló Oyé','sabedoria'],['Oniyé','ter memória'],['Loshowó','negócios e comércio'],
['Eniron','vidência espiritual'],['Fishi Tiré','estar igualmente bem e mal'],
['Dede Wantolokun','que vem do mar para a terra'],['Betansi','bondade'],['Ayé Tebalé','que está no ar'],
['Nisideni','que pode prejudicar'],['Alajere','estar bem longe'],['Eleyó','que vem de dia'],
['Eyaré','que vem de noite'],['Oshonkelató','por um resguardo'],['Esé Lokun','cruzar o mar'],
['Abiloná','ter os caminhos abertos'],['Loná Iré','obter bons caminhos'],['Lalafia','felicidade'],
['Wañitolokun','que vem por terra'],['Onidá','liberdade'],['Omó','ter um filho'],['Ayé','de tudo'],
['Ilé Unshinshé','obter trabalho'],['Bawa Ilé','que vem à sua casa'],['Silemu','ser imune ao perigo'],
['Kirin Kirin','dar uma viagem'],['Ni Buyoko','assentamento'],['Didara','bem-estar'],
['Ajé','riqueza'],['Elesé Egun','através dos mortos'],['Antonowá','pelo assentamento'],
['Layé','bem pela terra'],['Obiní','bem através de mulher'],['Lesé Lerí','bem pela própria cabeça'],
['Yoko Ilé','bem pela sua casa'],['Iyami','bem pela mãe'],['Babami','bem pelo pai'],['Aleyo','proximidade de aleyos']];
const OSOGBO=[['Ikú','a morte','iku'],['Ikú Suayo','a morte diante da pessoa','iku'],
['Ikú Adó','a morte atrás da pessoa','iku'],['Ikú ni Ikú','morte certa · só Orunmila salva','iku'],
['Ikú Araye','morte pela gente má','araye'],['Ikú Egun','morte por um egun','egun'],
['Ikú Lesé Lerí','morte pela própria cabeça','ori'],['Arun','doença','arun'],
['Arun Anodí','doença congênita','arun'],['Arun Intikusara','doença indefinida','arun'],
['Arun Ná','doença instalada','arun'],['Arun Enimó','doença incurável','arun'],
['Ofo','perda','ofo'],['Ofo Aikú','perda de saúde','ofo'],['Ofo Laitoshu','perda de tudo','ofo'],
['Ofo Onirá','perda de liberdade','ewon'],['Ofo ni Buyoko','perda de estabilidade','ofo'],
['Ofo Loná','perda dos caminhos','ofo'],['Ofo ni Lalafia','perda da felicidade','ofo'],
['Ofo Dikué','perda completa','ofo'],['Ofo Talakao Owó','perda por esbanjar dinheiro','ofo'],
['Eyó','tragédia, revolução, problemas','eyo'],['Eyó Niwa Ilé','problemas na casa','eyo'],
['Iñá','má conversa, fofoca','elenu'],['Oná','couro, açoite, golpe da vida','ofo'],
['Okiki Akua Osun','inveja','iyami'],['Loná Buruku','caminho torto','elenini'],
['Ta Eyé','derramamento de sangre','ogun'],['Obesebí','fracasso','ofo'],
['Obesebí Lerí','fracasso pela própria cabeça','ori'],['Ogú','bruxaria direta','iyami'],
['Ashelú','polícia','ashelu'],['Akoba','algo imprevisto','akoba'],['Egba','paralisia','egba'],
['Shepé','maldições','epe'],['Oran','processo, papéis','oran'],['Ewon','prisão','ewon'],
['Bakura','bruxaria enterrada','egunburu'],['Apalayé','juízo','oran'],['Onilú','problemas de papéis','oran']];
const QUEM=[['Elesé Orunmila','ao pé de Orunmila',''],['Elesé Osha','ao pé de um santo',''],
['Elesé Orisha','ao pé de uma divindade',''],['Elesé Egun','ao pé de um morto','egun'],
['Nitosi Oré','por um amigo',''],['Nitosi Okuni','por um homem',''],['Nitosi Obiní','por uma mulher',''],
['Nitosi Omó','por um filho',''],['Nitosi Aburé','por um irmão',''],['Nitosi Orugbo','por um velho',''],
['Nitosi Egbon Iyá','por uma tia',''],['Nitosi Egbon Babá','por um tio',''],['Nitosi Iyá','pela mãe',''],
['Nitosi Babá','pelo pai',''],['Nitosi Iyá Tobí','pela madrinha',''],['Nitosi Babá Tobí','pelo padrinho',''],
['Nitosi Akisá','por um pobre',''],['Nitosi Omologuió','por um palero','egunburu'],
['Nitosi Kokomi Fuyé','pelos animais',''],['Nitosi Enimó','pelo espiritismo','egun'],
['Nitosi Anfani','por um benefício',''],['Nitosi Merilayé','pelos quatro ventos','afefe']];
const CAUSA=[['Otonowá','mão do céu · sua astrologia','orunaye'],['Kafeti Lerí','pela própria cabeça','ori'],
['Intori Iworo','por pessoa religiosa',''],['Intori Omologu','através de um palero','egunburu'],
['Intori Ogú','através de bruxaria','iyami'],['Intori Bakura','bruxaria enterrada','egunburu'],
['Intori Shekué','através de uma maldição','epe'],['Intori Egun','através de um morto','egun'],
['Intori Eruyá','através de uma guerra','ogun'],['Intori Ebora','através de feitiçaria','iyami'],
['Intori Yberu','através dos nervos',''],['Intori Araye','através dos inimigos','araye'],
['Intori Osha Nibo','desobediência ao santo',''],['Intori Akarakambuka','por prenda de palo','egunburu'],
['Intori Otí','através da bebida',''],['Lowó Okuni','por mão de homem',''],['Lowó Obiní','por mão de mulher',''],
['Lowó Omó Keké','por mão de criança',''],['Lowó Adodi','por mão de homossexual',''],
['Lowó Alakuata','por mão de lésbica',''],['Lowó Arae','por mão de familiares','egun']];
const EGUNT=[['Egun Elemí','guia protetor'],['Egun Shebó','protetor'],['Egun Arae','familiar'],
['Egun Oré','amigo'],['Egun Buruku','mau, escuro'],['Egun Motilowao','enviado'],
['Egun Aimá','pegado, recolhido'],['Egun Akarakambuka','cão de prenda'],['Egun Ikoko ni Egun','vem de prenda']];
const LUGAR=[['Kotowa Ilé','dentro da casa'],['Ilenwa','cárcere'],['Ilé Alerun','hospital'],
['Ilé Unshinshé','centro de trabalho'],['Ilé Loyade Edé','na rua'],['Ilé Merita Yagadá','nas esquinas']];
const SOLUC=[['Orunmila Lowá','seguir os conselhos de Orunmila',''],['Osha Lowá','seguir os conselhos dos santos',''],
['Orisha Lowá','seguir os conselhos das divindades',''],['Egun Lowá','seguir os conselhos do morto','egun'],
['Kabebona Orunmila','receber Orunmila',''],['Kabebona Osha','receber santos · determinar quais',''],
['Kabebona Orisha','receber divindades · determinar quais',''],['Onishé Ebó','fazer ebó',''],
['Onishé Ebó Paraldo','ebó e oparaldo ao mesmo tempo','oparaldo'],
['Onishé Ebó Kasheto','ebó com jio jio que morra dentro · odu Ika Fun',''],
['Onishé Ebó Akuayero','ebó sem animais',''],['Onishé Ebó Misi Misi','banhos com eyebale',''],
['Onishé Misi Misi','banhos sem eyebale',''],['Onishé Paraldo','espantar Ikú ou egun mau','oparaldo'],
['Onishé Sarayeye','limpar o corpo · perguntar com quê',''],
['Onishé Oborí Eledá','rogar a cabeça · perguntar com quê','eleda'],['Onishé Kauré','rogação',''],
['Onishé Adimú','presentes',''],['Onishé Alá Adimú','presentes que cubram a sopeira',''],
['Onishé Bebikan Tuto','coisas frescas ao santo ou egun',''],
['Onishé Unyen Eleyebale','dar de comer ao santo ou egun',''],
['Onishé Osha Kuakua Lerí','assentar santo na cabeça','eleda']];

let oT='4-1',o1='0-9',o2='0-3',oIre=true,oTerm=null,oQuem=null,oCausa=null,oEgun=null,oLugar=null,oSol=null,oFilt=null;

function derived(){
 const [ta,tb]=legs(oT), [m2a,m2b]=legs(o2);
 const amot=mkcell(ta,m2b);
 const boy=mkcell(INV[ta],INV[tb]);
 return {amot,boy};
}
function renderOsode(){ syncHash();
 document.documentElement.style.setProperty('--accent','#C9A227');
 document.getElementById('nowname').textContent='Osode';
 document.getElementById('nowdot').style.background='#C9A227';
 const {amot,boy}=derived();
 [...mapEl.children].forEach(c=>{const on=[oT,o1,o2,amot,boy].includes(c.dataset.c);
  if(on){c.dataset.n=1;c.style.background='#C9A227';c.style.opacity=c.dataset.c===oT?1:.55;}
  else{delete c.dataset.n;c.style.background='';c.style.opacity=1;}});
 document.getElementById('sw').innerHTML='';
 document.getElementById('mapmeta').textContent='as cinco casas do registro';

 let h='<section class="ohead"><div class="eyebrow">Auxílio de interpretação</div>'+
  '<h2 class="oname" style="color:#C9A227">Osode</h2>'+
  '<p class="taxintro">Marque o Toyale e os dois testemunhos. O Amotorun e o Boyuto Awó saem sozinhos, e cada casa traz o que os dois tratados registram dela.</p>'+
  '<div class="pickers">'+
   '<div class="pk"><label>Toyale Iwá</label><select id="sT">'+cellOpts(oT)+'</select></div>'+
   '<div class="pk"><label>1º testemunho · Okuta Kulá</label><select id="s1">'+cellOpts(o1)+'</select></div>'+
   '<div class="pk"><label>2º testemunho · Tomala Belanshe</label><select id="s2">'+cellOpts(o2)+'</select></div>'+
  '</div><div class="srcfilter" style="margin-top:6px"><button class="sf" id="useita">Usar o meu itá</button></div>'+
  '<div class="derived">'+
   dvHTML(D.osode.papeis[0][0],D.osode.papeis[0][1],oT,true)+
   dvHTML(D.osode.papeis[1][0],D.osode.papeis[1][1],o1,true)+
   dvHTML(D.osode.papeis[2][0],D.osode.papeis[2][1],o2,true)+
  '</div><div class="derived">'+
   dvHTML(D.osode.papeis[3][0],D.osode.papeis[3][1],amot,true)+
   dvHTML(D.osode.papeis[4][0],D.osode.papeis[4][1],boy,true)+
  '</div></section>';

 const row=(id,lab,arr,sel)=>'<div class="orow"><span class="wl">'+lab+'</span><div class="oterms" id="'+id+'">'+
  arr.map((t,i)=>'<button class="ot" data-k="'+id+'" data-i="'+i+'" aria-pressed="'+(sel===i)+'">'+esc(t[0])+'<b>'+esc(t[1])+'</b></button>').join('')+'</div></div>';

 h+='<div class="obuild"><div class="eyebrow">Particularidades da marca\u00e7\u00e3o</div>'+
  '<p class="taxintro" style="margin:10px 0 4px">Distin\u00e7\u00f5es que mudam o sentido do que se marca \u2014 e que passam despercebidas se n\u00e3o forem ditas.</p>'+
  D.nota.dist.map(x=>'<div class="dist"><h4>'+x[0]+'</h4><p>'+x[1]+'</p></div>').join('')+'</div>';
 h+='<div class="obuild"><div class="eyebrow">Marcar ire ou osogbo</div>'+
  '<div class="srcfilter" style="margin:12px 0 14px">'+
  '<button class="sf" data-io="ire" aria-pressed="'+oIre+'">Ire</button>'+
  '<button class="sf" data-io="oso" aria-pressed="'+(!oIre)+'">Osogbo</button></div>'+
  row('term',oIre?'Qual ire':'Qual osogbo',oIre?IRE:OSOGBO,oTerm)+
  (oIre?row('quem','Quem traz · elesé / nitosi',QUEM,oQuem)
       :row('causa','Causa · intori / lowó',CAUSA,oCausa))+
  ((!oIre&&oCausa!==null&&(CAUSA[oCausa][2]==='egun'||CAUSA[oCausa][2]==='egunburu'))||(oIre&&oQuem!==null&&QUEM[oQuem][2]==='egun')
    ?row('egunt','Que tipo de morto',EGUNT,oEgun):'')+
  row('lugar','Onde',LUGAR,oLugar)+
  row('sol','Solução · onishé',SOLUC,oSol)+'</div>';

 /* leitura montada */
 const parts=[];
 parts.push(cellName(oT));
 if(oTerm!==null)parts.push((oIre?'Ire ':'Osogbo ')+(oIre?IRE:OSOGBO)[oTerm][0]);
 if(oIre&&oQuem!==null)parts.push(QUEM[oQuem][0]);
 if(!oIre&&oCausa!==null)parts.push(CAUSA[oCausa][0]);
 if(oEgun!==null&&document.getElementById('egunt'))parts.push(EGUNT[oEgun][0]);
 if(oLugar!==null)parts.push(LUGAR[oLugar][0]);
 if(oSol!==null)parts.push(SOLUC[oSol][0]);
 const linked=[];
 if(!oIre&&oTerm!==null&&OSOGBO[oTerm][2])linked.push(OSOGBO[oTerm][2]);
 if(!oIre&&oCausa!==null&&CAUSA[oCausa][2])linked.push(CAUSA[oCausa][2]);
 if(oIre&&oQuem!==null&&QUEM[oQuem][2])linked.push(QUEM[oQuem][2]);
 if(oSol!==null&&SOLUC[oSol][2])linked.push(SOLUC[oSol][2]);
 const uniq=[...new Set(linked)].filter(k=>D.orishas[k]);
 h+='<div class="reading"><div class="rl">Leitura montada</div><div class="rt">'+esc(parts.join(' · '))+'</div>'+
  (oTerm!==null?'<div class="rx">'+esc((oIre?IRE:OSOGBO)[oTerm][1])+
   (oIre?'. Oyalé (seguro) e Tesí (perfeito) só se marcam em ire. Timbelayé só cabe em Ashegun Otá Koleñio Adió — em qualquer outro ire vira Timbelorun, a sorte depois de morta.':'')+'</div>':'')+
  (uniq.length?'<div class="ents" style="margin-top:12px">'+uniq.map(k=>'<button class="en" data-go="'+k+'"><i style="background:'+D.orishas[k].accent+'"></i>'+D.orishas[k].label+' · '+D.orishas[k].total+' patakís</button>').join('')+'</div>':'')+
  '</div>';

 h+='<div class="count">Patakís do Toyale — '+esc(cellName(oT))+'</div>'+pkHTML(oT,null);
 document.getElementById('panel').innerHTML=h;
 ['sT','s1','s2'].forEach((id,i)=>document.getElementById(id).onchange=e=>{
  if(i===0)oT=e.target.value;else if(i===1)o1=e.target.value;else o2=e.target.value;renderOsode();});
 document.getElementById('useita').onclick=()=>{oT='4-1';o1='0-9';o2='0-3';renderOsode();};
 document.querySelectorAll('[data-io]').forEach(b=>b.onclick=()=>{oIre=b.dataset.io==='ire';oTerm=null;oQuem=null;oCausa=null;oEgun=null;renderOsode();});
 document.querySelectorAll('.ot').forEach(b=>b.onclick=()=>{const i=+b.dataset.i,k=b.dataset.k;
  if(k==='term')oTerm=oTerm===i?null:i; else if(k==='quem')oQuem=oQuem===i?null:i;
  else if(k==='causa')oCausa=oCausa===i?null:i; else if(k==='egunt')oEgun=oEgun===i?null:i;
  else if(k==='lugar')oLugar=oLugar===i?null:i; else oSol=oSol===i?null:i;
  renderOsode();});
 wireEnts();
}
document.getElementById('osd').onclick=()=>{cur='__osd';renderOsode();
 document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'});};

let aEnt=new Set(), aQ='', aMine=false;
function renderAdimu(){ syncHash();
 const A=D.adimu, MINE=new Set(D.ita.reg.map(r=>r.c));
 document.documentElement.style.setProperty('--accent','#E0A92B');
 document.getElementById('nowname').textContent='Adim\u00fa';
 document.getElementById('nowdot').style.background='#E0A92B';
 const cnt={};Object.entries(A.by).forEach(([k,v])=>cnt[k]=v.length);
 const percell={};Object.values(A.by).forEach(v=>v.forEach(x=>percell[x[1]]=(percell[x[1]]||0)+1));
 const mx=Math.max(1,...Object.values(percell));
 [...mapEl.children].forEach(c=>{const n=percell[c.dataset.c]||0;
  if(n){c.dataset.n=n;c.style.background='#E0A92B';c.style.opacity=(0.25+0.75*Math.sqrt(n/mx)).toFixed(3);}
  else{delete c.dataset.n;c.style.background='';c.style.opacity=1;}});
 document.getElementById('sw').innerHTML=[0.3,0.55,0.8,1].map(v=>'<div class="sw" style="background:#E0A92B;opacity:'+v+'"></div>').join('');
 document.getElementById('mapmeta').textContent='adim\u00fa por odu';
 const ents=Object.keys(A.by).sort((a,b)=>cnt[b]-cnt[a]);
 let h='<section class="ohead"><div class="eyebrow">Oferendas registradas nos dois tratados</div>'+
  '<h2 class="oname" style="color:#E0A92B">Adim\u00fa</h2>'+
  '<p class="taxintro">O que cada ser recebe, em que odu est\u00e1 registrado e em que p\u00e1gina. Reaproveita as 65 entradas j\u00e1 mapeadas como destinat\u00e1rios.</p>'+
  '<div class="stats"><div class="stat"><b>'+A.n+'</b><span>adim\u00fas</span></div>'+
  '<div class="stat"><b>'+ents.length+'</b><span>destinat\u00e1rios</span></div>'+
  '<div class="stat"><b>'+Object.keys(percell).length+'</b><span>odus</span></div>'+
  '<div class="stat"><b>'+A.labs.length+'</b><span>oferendas distintas</span></div></div>'+
  '<div class="wfil"><div class="wrow"><span class="wl">Destinat\u00e1rio</span>'+
   ents.map(k=>'<button class="wc" data-ae="'+k+'" aria-pressed="'+aEnt.has(k)+'" style="'+(aEnt.has(k)?'background:'+D.orishas[k].accent+';border-color:'+D.orishas[k].accent+';color:#101E33':'')+'">'+
   D.orishas[k].label+'<b>'+cnt[k]+'</b></button>').join('')+'</div>'+
  '<div class="wrow"><span class="wl">Recorte</span><button class="wc gd" id="amine" aria-pressed="'+aMine+'">S\u00f3 as casas do meu it\u00e1<b>'+MINE.size+'</b></button></div>'+
  '<input type="search" id="aq" placeholder="Buscar oferenda: platano, adie, ochinchin, eyele\u2026" value="'+esc(aQ)+'"></div></section>';
 const qq=norm(aQ.trim());let tot=0,body='';
 ents.forEach(k=>{
  if(aEnt.size&&!aEnt.has(k))return;
  let its=A.by[k];
  if(aMine)its=its.filter(x=>MINE.has(x[1]));
  if(qq)its=its.filter(x=>norm(A.labs[x[0]]).includes(qq));
  if(!its.length)return;
  tot+=its.length;
  const o=D.orishas[k];
  body+='<section class="adg" style="--ac:'+o.accent+'"><div class="adh"><h4>'+esc(o.label)+'</h4>'+
   '<span class="n">'+its.length+' adim\u00fa'+(its.length===1?'':'s')+' \u00b7 '+esc(o.colors)+'</span>'+
   '<button class="en" data-go="'+k+'" style="margin-left:auto"><i style="background:'+o.accent+'"></i>ver patak\u00eds</button></div>'+
   '<ul class="adl">'+its.map(x=>{const s=x[3]?'D':'N', lab=A.labs[x[0]];
    return '<li><span class="it">'+pA(s,x[2],hi(lab,aQ.trim()),lab,'tl')+'</span>'+
    '<span class="od">'+esc(CELL[x[1]]?CELL[x[1]].nav:x[1])+(MINE.has(x[1])?' \u00b7 meu it\u00e1':'')+'</span>'+
    '<span class="pg">'+tagPg(s,x[2],lab)+'</span></li>';}).join('')+'</ul></section>';});
 h+='<div class="count">'+tot+' adim\u00fa'+(tot===1?'':'s')+'</div>'+(body||'<p class="empty">Nada com esse filtro.</p>');
 document.getElementById('panel').innerHTML=h;
 document.querySelectorAll('[data-ae]').forEach(b=>b.onclick=()=>{const k=b.dataset.ae;
  aEnt.has(k)?aEnt.delete(k):aEnt.add(k);renderAdimu();});
 document.getElementById('amine').onclick=()=>{aMine=!aMine;renderAdimu();};
 let tt;document.getElementById('aq').addEventListener('input',e=>{aQ=e.target.value;const p=e.target.selectionStart;
  clearTimeout(tt);tt=setTimeout(()=>{renderAdimu();const n=document.getElementById('aq');n.focus();n.setSelectionRange(p,p);},200);});
 wireEnts();
}
document.getElementById('adi').onclick=()=>{cur='__adi';renderAdimu();
 document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'});};

let eCat=new Set(), eFam='', eQ='', eOnly=false;
function renderEwe(){ syncHash();
 const E=D.ewe;
 document.documentElement.style.setProperty('--accent','#8CBF3F');
 document.getElementById('nowname').textContent='Ewe';
 document.getElementById('nowdot').style.background='#8CBF3F';
 [...mapEl.children].forEach(c=>{const n=(D.works.cells[c.dataset.c]||[]).filter(x=>x[0]===7).length;
  if(n){c.dataset.n=n;c.style.background='#8CBF3F';c.style.opacity=(0.25+0.75*Math.min(1,n/6)).toFixed(3);}
  else{delete c.dataset.n;c.style.background='';c.style.opacity=1;}});
 document.getElementById('sw').innerHTML='';
 document.getElementById('mapmeta').textContent='ewe registrado por odu nos tratados cubanos';
 const fams=[...new Set(E.rows.map(r=>r[1]))].sort();
 const cnt={};E.rows.forEach(r=>r[4].forEach(i=>cnt[i]=(cnt[i]||0)+1));
 let h='<section class="ohead"><div class="eyebrow">Verger · Ewé, o uso das plantas na sociedade iorubá</div>'+
  '<h2 class="oname" style="color:#8CBF3F">Ewe</h2>'+
  '<p class="taxintro">'+E.rows.length+' esp\u00e9cies com nome cient\u00edfico e fam\u00edlia bot\u00e2nica, '+E.nfam+
  ' fam\u00edlias, '+E.nyo+' com nome iorub\u00e1 recuperado. Cada linha traz a p\u00e1gina no Verger.</p>'+
  '<div class="stats"><div class="stat"><b>'+E.rows.length+'</b><span>esp\u00e9cies</span></div>'+
  '<div class="stat"><b>'+E.nfam+'</b><span>fam\u00edlias bot\u00e2nicas</span></div>'+
  '<div class="stat"><b>'+E.nyo+'</b><span>iorub\u00e1 validado</span></div>'+
  '<div class="stat"><b>'+E.nofo+'</b><span>encantamentos</span></div>'+
  '<div class="stat"><b>'+Object.values(D.works.cells).reduce((a,v)=>a+v.filter(x=>x[0]===7).length,0)+
  '</b><span>ewe nos tratados</span></div></div>'+
  '<div class="wfil"><div class="wrow"><span class="wl">Finalidade</span>'+
   E.cats.map((c,i)=>'<button class="wc gr" data-ec="'+i+'" aria-pressed="'+eCat.has(i)+'">'+c+'<b>'+(cnt[i]||0)+'</b></button>').join('')+'</div>'+
  '<div class="wrow"><span class="wl">Recorte</span>'+
   '<button class="wc gd" id="eofo" aria-pressed="'+eOnly+'">S\u00f3 com encantamento mapeado<b>'+
   E.rows.filter(x=>x[5]&&x[5].length).length+'</b></button></div>'+
  '<div class="wrow"><span class="wl">Fam\u00edlia bot\u00e2nica</span>'+
   '<select id="efam" style="background:var(--anil-850);border:1px solid var(--anil-700);color:var(--efun);font-family:var(--mono);font-size:12px;padding:7px;border-radius:2px">'+
   '<option value="">todas</option>'+fams.map(f=>'<option'+(f===eFam?' selected':'')+'>'+f+'</option>').join('')+'</select></div>'+
  '<input type="search" id="eq" placeholder="Buscar por nome cient\u00edfico, iorub\u00e1 ou fam\u00edlia\u2026" value="'+esc(eQ)+'"></div></section>';
 const qq=norm(eQ.trim());
 let rows=E.rows.filter(r=>{
  if(eCat.size&&!r[4].some(i=>eCat.has(i)))return false;
  if(eFam&&r[1]!==eFam)return false;
  if(eOnly&&!(r[5]&&r[5].length))return false;
  if(qq&&!(norm(r[0]).includes(qq)||norm(r[1]).includes(qq)||r[3].some(y=>norm(y).includes(qq))))return false;
  return true;});
 h+='<div class="count">'+rows.length+' esp\u00e9cie'+(rows.length===1?'':'s')+'</div>';
 h+=rows.slice(0,320).map(r=>'<div class="plant"><span class="sn">'+pA('V',r[2][0],esc(r[0]),r[0],'tl')+'</span><span class="bf">'+esc(r[1])+'</span>'+
  (r[3].length?'<div class="yo">iorub\u00e1: <b>'+r[3].map(esc).join(' \u00b7 ')+'</b></div>':'')+
  '<div class="mt">'+r[4].map(i=>'<span class="cat">'+E.cats[i]+'</span>').join('')+
  '<span class="vp">Verger p. '+pgList('V',r[2],r[0])+'</span></div>'+
  ((r[5]&&r[5].length)?'<div class="ofo"><div class="oh">'+r[5].length+' encantamento'+(r[5].length===1?'':'s')+' mapeado'+(r[5].length===1?'':'s')+'</div>'+
    r[5].map(o=>'<div class="or">'+(o[0]?'<span class="oy">'+pA('V',o[3],esc(o[0]),o[0],'tl')+'</span>':'<span class="oy">\u00b7</span>')+
     '<span class="op">'+esc(o[1]||'')+'</span>'+
     (o[2]&&o[2].length?'<span class="of">f\u00f3rm. '+o[2].join(', ')+'</span>':'')+
     '<span class="og">'+pA('V',o[3],'p.'+o[3],o[0]||r[0])+'</span></div>').join('')+'</div>':'')+
  '</div>').join('');
 if(rows.length>320)h+='<p class="empty">Mostrando as 320 primeiras \u2014 refine o filtro.</p>';
 h+='<div class="irunblock"><div class="eyebrow">Fam\u00edlias de odu citadas no Verger</div>'+
  '<p class="taxintro" style="margin-top:10px">Verger refere os odus por fam\u00edlia, n\u00e3o pelas 256 casas. As p\u00e1ginas abaixo s\u00e3o onde cada fam\u00edlia aparece.</p>'+
  '<div class="vfams">'+Object.entries(E.odu).sort((a,b)=>b[1].length-a[1].length)
   .map(([f,ps])=>'<details class="vfam"><summary>'+f+' \u00b7 '+ps.length+' p\u00e1gs</summary>'+
    '<div class="vpgs">'+ps.map(p=>pA('V',p,String(p),f)).join('')+'</div></details>').join('')+'</div>'+
  '<div class="ents" style="margin-top:16px"><button class="en" id="goewe"><i style="background:#8CBF3F"></i>Ver o ewe registrado nos dois tratados cubanos</button></div></div>';
 document.getElementById('panel').innerHTML=h;
 document.querySelectorAll('[data-ec]').forEach(b=>b.onclick=()=>{const i=+b.dataset.ec;
  eCat.has(i)?eCat.delete(i):eCat.add(i);renderEwe();});
 document.getElementById('efam').onchange=e=>{eFam=e.target.value;renderEwe();};
 document.getElementById('eofo').onclick=()=>{eOnly=!eOnly;renderEwe();};
 let tt;document.getElementById('eq').addEventListener('input',e=>{eQ=e.target.value;const p=e.target.selectionStart;
  clearTimeout(tt);tt=setTimeout(()=>{renderEwe();const n=document.getElementById('eq');n.focus();n.setSelectionRange(p,p);},200);});
 document.getElementById('goewe').onclick=()=>{wty=new Set([7]);wpu=new Set();wmine=false;wq='';cur='__obr';renderWorks();
  document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'});};
}
document.getElementById('ewe').onclick=()=>{cur='__ewe';renderEwe();
 document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'});};

let itaOnly=false;
function renderIta(){ syncHash();
 const I=D.ita;
 const isMine=(oT==='4-1'&&o1==='0-9'&&o2==='0-3');
 document.documentElement.style.setProperty('--accent','#C9A227');
 document.getElementById('nowname').textContent=isMine?'Meu it\u00e1':'It\u00e1';
 document.getElementById('nowdot').style.background='#C9A227';
 const {amot,boy}=derived();
 [...mapEl.children].forEach(c=>{const on=[oT,o1,o2,amot,boy].includes(c.dataset.c);
  const mine=isMine&&I.cells[c.dataset.c];
  if(on||mine){c.dataset.n=1;c.style.background='#C9A227';c.style.opacity=on?(c.dataset.c===oT?1:.7):.35;}
  else{delete c.dataset.n;c.style.background='';c.style.opacity=1;}});
 document.getElementById('sw').innerHTML='';
 document.getElementById('mapmeta').textContent=isMine?'as casas do seu it\u00e1':'as cinco casas do registro';

 let h='<section class="ohead"><div class="eyebrow">Recorte por registro</div>'+
  '<h2 class="oname" style="color:#C9A227">'+(isMine?'Meu it\u00e1':'It\u00e1')+'</h2>'+
  '<p class="taxintro">Troque as tr\u00eas casas para ler qualquer outro registro. O Amotorun e o Boyuto Aw\u00f3 s\u00e3o calculados a partir delas.</p>'+
  '<div class="pickers">'+
   '<div class="pk"><label>Odu de cabe\u00e7a · m\u00e3o de Orula</label><select id="jT">'+cellOpts(oT)+'</select></div>'+
   '<div class="pk"><label>1\u00ba testemunho</label><select id="j1">'+cellOpts(o1)+'</select></div>'+
   '<div class="pk"><label>2\u00ba testemunho</label><select id="j2">'+cellOpts(o2)+'</select></div>'+
  '</div>'+(isMine?'':'<div class="srcfilter" style="margin-top:6px"><button class="sf" id="backita">Voltar ao meu it\u00e1</button></div>')+
  '<div class="derived">'+
   dvHTML('Odu de cabe\u00e7a','',oT,true)+dvHTML('1\u00ba testemunho','',o1,true)+dvHTML('2\u00ba testemunho','',o2,true)+
  '</div><div class="derived">'+
   dvHTML('Amotorun Iw\u00e1',D.osode.papeis[3][1],amot,true)+
   dvHTML('Boyuto Aw\u00f3',D.osode.papeis[4][1],boy,true)+
  '</div></section>';

 if(isMine){
  const fm=Object.entries(I.fams),mx=Math.max(...fm.map(x=>x[1]));
  h+='<div class="eyebrow" style="margin-top:26px">Eixo das fam\u00edlias — contando as duas pernas de cada registro</div>'+
   '<div class="axis">'+fm.map(x=>'<span>'+x[0]+'</span><div class="b" style="width:'+(100*x[1]/mx).toFixed(1)+'%"></div><span class="q">'+x[1]+'</span>').join('')+'</div>'+
   '<div class="srcfilter" style="margin-top:14px"><button class="sf" data-io="0" aria-pressed="'+(!itaOnly)+'">Todos os patak\u00eds</button>'+
   '<button class="sf" data-io="1" aria-pressed="'+itaOnly+'">S\u00f3 os que citam o orix\u00e1</button></div>';
  h+=I.reg.map(r=>{
   const c=I.cells[r.c],st=cellStats(r.c);
   const ent=r.ent&&D.orishas[r.ent]?D.orishas[r.ent]:null;
   const col=ent?ent.accent:'#C9A227';
   const its=pkList(r.c,itaOnly&&r.ent?r.ent:null);
   const men=ent&&c.sec[r.ent]?(c.sec[r.ent][0]+c.sec[r.ent][1]):0;
   return '<section class="regcard" style="--rc:'+col+'">'+
    '<div class="regtop"><h3>'+esc(r.o)+'</h3>'+(r.d?'<span class="dt">'+r.d+'</span>':'')+'</div>'+
    '<div class="regodu">'+esc(r.odu)+' · <span class="tag tN">N</span> '+pA('N',c.navp,esc(c.nav)+' p.'+c.navp,c.nav)+
    ' <span class="tag tD">D</span> <span class="alt">'+pA('D',c.delp,esc(c.del)+' p.'+c.delp,c.del)+'</span></div>'+
    '<div class="regkind">'+esc(r.k)+' · '+its.length+' patak\u00ed'+(its.length===1?'':'s')+' · '+st.wk+' obras'+
    (ent?(men?' · '+esc(ent.label)+' citado '+men+'x na se\u00e7\u00e3o':' · '+esc(ent.label)+' n\u00e3o \u00e9 citado nesta casa'):'')+'</div>'+
    (st.temas.length?'<div class="temas" style="margin-bottom:10px">'+st.temas.map(t=>'<span class="tm">'+esc(t)+'</span>').join('')+'</div>':'')+
    notaHTML(r.c)+
    (its.length?'<ol class="items">'+its.map(pkLi).join('')+'</ol>'
     :'<p class="empty">Nenhum patak\u00ed desta casa cita o orix\u00e1 diretamente.</p>')+'</section>';}).join('');
 } else {
  h+='<div class="count">Patak\u00eds do odu de cabe\u00e7a — '+esc(cellName(oT))+'</div>'+pkHTML(oT,null);
 }
 document.getElementById('panel').innerHTML=h;
 ['jT','j1','j2'].forEach((id,i)=>document.getElementById(id).onchange=e=>{
  if(i===0)oT=e.target.value;else if(i===1)o1=e.target.value;else o2=e.target.value;renderIta();});
 const bk=document.getElementById('backita');
 if(bk)bk.onclick=()=>{oT='4-1';o1='0-9';o2='0-3';renderIta();};
 document.querySelectorAll('[data-io]').forEach(b=>b.onclick=()=>{itaOnly=b.dataset.io==='1';renderIta();});
 wireEnts();
}
function paintMapIta(){
  const set={};Object.keys(D.ita.cells).forEach(c=>set[c]=1);
  [...mapEl.children].forEach(c=>{ if(set[c.dataset.c]){c.dataset.n=D.ita.cells[c.dataset.c].items.length;
    c.style.background='#C9A227';c.style.opacity=1;} else {delete c.dataset.n;c.style.background='';c.style.opacity=1;}});
  document.getElementById('sw').innerHTML='';
  document.getElementById('mapmeta').textContent=Object.keys(set).length+' casas do seu itá';
}
document.getElementById('ita').onclick=()=>{cur='__ita';renderIta();
  document.querySelector('nav.pick').scrollIntoView({behavior:'smooth'});};

function render(){
  if(cur === '__adi') return renderAdimu();
  if(cur === '__ewe') return renderEwe();
  if(cur === '__osd') return renderOsode();
  if(cur === '__obr') return renderWorks();
  if(cur === '__ita') return renderIta();
  if(cur === '__tax') return renderTax();
  syncHash();
  const o = D.orishas[cur];
  document.documentElement.style.setProperty('--accent', o.accent);
  document.getElementById('nowname').textContent = o.label;
  document.getElementById('nowdot').style.background = o.accent;
  picker.querySelectorAll('.ob').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === cur));
  paintMap();

  const avs = Object.entries(o.avatars).filter(([,n]) => n > 0), nace = o.nace || [];
  let h = '<section class="ohead"><div class="eyebrow">'+o.colors+'</div>'+
    '<h2 class="oname">'+o.label+'</h2><p class="osub">'+o.sub+'</p><div class="stats">'+
    '<div class="stat"><b>'+o.total+'</b><span>patakís</span></div>'+
    '<div class="stat"><b>'+o.totN+'</b><span>em Naveira</span></div>'+
    '<div class="stat"><b>'+o.totD+'</b><span>em Delgado</span></div>'+
    '<div class="stat"><b>'+o.odus+'</b><span>odus</span></div>'+
    '<div class="stat"><b>'+avs.length+'</b><span>caminhos citados</span></div>'+
    '<div class="stat"><b>'+nace.length+'</b><span>“nasce neste odu”</span></div></div></section>';

  h += '<div class="filters"><input type="search" id="q" placeholder="Filtrar por título do patakí ou por odu…" value="'+esc(q)+'">'+
    '<div class="srcfilter">'+[['all','Ambos'],['N','Só Naveira'],['D','Só Delgado']].map(x =>
      '<button class="sf" data-src="'+x[0]+'" aria-pressed="'+(src===x[0])+'">'+x[1]+'</button>').join('')+'</div>';
  if(avs.length) h += '<div class="chips">'+avs.map(([n,c]) =>
    '<button class="chip" data-av="'+esc(n)+'" aria-pressed="'+(avF===n)+'">'+esc(n)+'<i>'+c+'</i></button>').join('')+'</div>';
  h += '</div>';

  if(nace.length) h += '<div class="nace"><h3>Nasce neste odu</h3><ul>'+nace.map(x =>
    '<li><span class="od">'+pA('N',x.p,esc(x.odu)+' · p.'+x.p,x.t.replace(/^\d+\.-\s*/,''))+'</span>'+
    '<span>'+pA('N',x.p,esc(x.t),x.t.replace(/^\d+\.-\s*/,''),'tl')+'</span></li>').join('')+'</ul></div>';

  const qq = norm(q.trim());
  const groups = o.groups.map(g => { let it = g.items.filter(keep);
    if(avF) it = it.filter(i => i.av.includes(avF));
    if(qq && !norm(both(g.c)).includes(qq)) it = it.filter(i => norm(i.t).includes(qq));
    return {c:g.c, items:it}; }).filter(g => g.items.length);
  const shown = groups.reduce((a,g) => a+g.items.length, 0);
  h += '<div class="count">'+shown+' patakí'+(shown===1?'':'s')+' em '+groups.length+' odu'+(groups.length===1?'':'s')+'</div>';

  h += groups.length ? groups.map(g => {
    const o2 = CELL[g.c];
    return '<section class="grp" id="g-'+g.c.replace('-','_')+'">'+
      '<div class="grphead"><h4>'+hi(o2.nav,q.trim())+'</h4>'+
      (o2.del !== o2.nav ? '<span class="altname">'+hi(o2.del,q.trim())+'</span>' : '')+
      '<span class="gn">'+g.items.length+' · '+oduPgs(o2)+'</span></div><ol class="items">'+
      g.items.map(i => '<li><span class="num">'+(i.n||'·')+'</span><span class="ttl">'+pA(i.s,i.p[0],hi(i.t,q.trim()),i.t,'tl')+
        i.av.map(a => '<span class="av">'+esc(a)+'</span>').join('')+'</span>'+
        '<span class="pg"><span class="tag t'+i.s+'">'+i.s+'</span> p. '+pgList(i.s,i.p,i.t)+'</span></li>').join('')+
      '</ol></section>'; }).join('')
    : '<p class="empty">Nada encontrado com esse filtro. Limpe a busca ou o caminho selecionado.</p>';

  document.getElementById('panel').innerHTML = h;
  const qi = document.getElementById('q');
  qi.addEventListener('input', e => { q = e.target.value; const p = e.target.selectionStart;
    render(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(p,p); });
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => { avF = (avF===c.dataset.av)?null:c.dataset.av; render(); });
  document.querySelectorAll('.sf[data-src]').forEach(b => b.onclick = () => { src = b.dataset.src; render(); });
}

/* ---------- vista atual no endereço (#elegua, #obras, #ewe…) ---------- */
const VIEWS = {__adi:'adimu', __ewe:'ewe', __osd:'osode', __obr:'obras', __ita:'ita', __tax:'tipos'};
const VIEWS_INV = Object.fromEntries(Object.entries(VIEWS).map(([k,v]) => [v,k]));
function syncHash(){
  const h = '#' + (VIEWS[cur] || cur);
  if(location.hash !== h) try { history.replaceState(null, '', h); } catch(e) {}
  lsSet('ifa.view', VIEWS[cur] || cur);
}
function viewFromHash(h){
  if(h == null) h = decodeURIComponent(location.hash.slice(1));
  if(VIEWS_INV[h]) return VIEWS_INV[h];
  if(D.orishas[h]) return h;
  return null;
}
window.addEventListener('hashchange', () => { const v = viewFromHash(); if(v && v !== cur){ cur = v; avF = null; q = ''; render(); } });

/* ---------- seletor: onde abrir as páginas ---------- */
const MODO_TXT = {
  leitor: 'Abre o <b>leitor embutido</b> já na página, com o título destacado. Funciona no celular. Se o PDF não estiver na pasta <code>pdf/</code>, o leitor pede o arquivo uma vez e guarda no aparelho.',
  nativo: 'Abre <code>pdf/…pdf#page=N</code> no <b>visualizador do próprio navegador</b> (Chrome, Edge, Firefox no computador). No celular prefira o leitor embutido.'
};
function paintModo(){
  document.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.modo === MODO));
  const ef = modoEf(), auto = MODO === 'auto';
  document.getElementById('modohint').innerHTML = (auto ? 'Automático: ' + (location.protocol === 'file:' ?
    'aberto direto do disco, então usa o PDF do navegador. ' : 'servido por http, então usa o leitor embutido. ') : '') + MODO_TXT[ef];
  document.querySelectorAll('a[data-doc]').forEach(a => {
    a.href = pdfHref(a.dataset.doc, a.dataset.p, a.dataset.t || ''); a.target = pdfTarget(); });
}
document.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => {
  MODO = b.dataset.modo; lsSet('ifa.modo', MODO); paintModo(); render(); });

/* sem # no endereço (ex.: voltando do leitor), reabre a última vista */
cur = viewFromHash() || viewFromHash(lsGet('ifa.view') || '') || cur;
paintModo();
render();
