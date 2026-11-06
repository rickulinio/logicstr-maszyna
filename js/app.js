const CN=['teal','amber','coral','violet','mint'];   /* kolejność kolorów kategorii */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$('#logo').src = CONFIG.logo;
$('#foot').textContent = CONFIG.stopka;
document.title = CONFIG.nazwa;

/* losowa postać (bez powtórzenia poprzedniej) */
function pickChar(){
  const l = CONFIG.postacie; if(!l.length) return null;
  let last = -1; try{ last = +localStorage.getItem('plr_last'); }catch(e){}
  let i; do{ i = Math.floor(Math.random()*l.length); }while(l.length>1 && i===last);
  try{ localStorage.setItem('plr_last', i); }catch(e){}
  return l[i];
}
const CHAR = pickChar();
window.ph = () => { const d=document.createElement('div'); d.className='ph'; d.innerHTML='<div>Tu będzie postać<small>Wrzuć PNG do folderu img/ i wpisz ścieżkę w CONFIG, sekcja postacie</small></div>'; return d; };

function toast(t){ const e=$('#toast'); e.textContent=t; e.classList.add('show'); setTimeout(()=>e.classList.remove('show'),3200); }
window.copyIp = () => { const t=CONFIG.connect; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Skopiowano: '+t)).catch(()=>toast(t)); };

/* ikony SVG (zamiast emoji) – w configu wpisujesz nazwę, np. ikona: "car" */
const ICONS = {
  siren:'<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1M2 12h1M12 2v1M4.9 4.9l.7.7M19.1 4.9l-.7.7M12 12v6"/>',
  city:'<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>',
  car:'<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  scroll:'<path d="M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  scale:'<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  discord:['0 -28.5 256 256','<path fill="currentColor" stroke="none" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"/>']
};
const ico = (n,c='') => { const v=ICONS[n]; if(!v) return esc(n||'');
  const vb=Array.isArray(v)?v[0]:'0 0 24 24', body=Array.isArray(v)?v[1]:v;
  return `<svg class="svg ${c}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`; };

/* STRONA GŁÓWNA */
const IC = n => `<img src="img/${n}.svg" alt="" class="ico">`;
function home(){
  const c = CHAR;
  const stats = (CONFIG.statystyki||[]).map(s=>{const m=String(s.wartosc).match(/^(\d+)(\D*)$/);return `<div><b ${m?`data-n="${m[1]}" data-s="${esc(m[2])}"`:''}>${esc(m?'0':s.wartosc)}</b><small>${esc(s.opis)}</small></div>`}).join('');
  const feats = CONFIG.cechy.map(f=>`<div class="card tilt rv c-${esc(f.kolor||'teal')}"><div class="ic">${ico(f.ikona)}</div><h3>${esc(f.tytul)}</h3><p>${esc(f.opis)}</p></div>`).join('');
  const steps = CONFIG.jakDolaczyc.map((f,i)=>`<div class="card step tilt rv c-${CN[(i+1)%CN.length]}"><h3>${esc(f.tytul)}</h3><p>${esc(f.opis)}</p></div>`).join('');
  const faq = (CONFIG.faq||[]).map((f,i)=>`<details class="rv c-${CN[i%CN.length]}"><summary>${esc(f.p)}</summary><p>${esc(f.o)}</p></details>`).join('');
  return `
  <div class="hero">
    <div>
      <h1>Witaj w<br><span>Los Santos</span></h1>
      <p>${esc(CONFIG.haslo)}</p>
      <div class="cta">
        <a class="btn fivem" href="${esc(CONFIG.fivem||'#')}" onclick="copyIp()">${IC('fivem')} Połącz</a>
        <a class="btn dc" href="${esc(CONFIG.discord)}" target="_blank" rel="noopener">${IC('discord')} Discord</a>
      </div>
      <div class="stats live">
        <div class="srv" id="srv" data-state="load"><span class="dot" aria-hidden="true"></span><div><b id="srvn">…</b><small id="srvt">Sprawdzam status</small></div></div>
        ${stats}
      </div>
    </div>
    <div class="char" id="char">
      <div class="bigtxt" id="bigtxt">LOGIC</div>
      <div class="pimg" id="pimg">${c ? `<img src="${esc(c.img)}" alt="${esc(c.nazwa||'')}" onerror="this.replaceWith(ph())">` : ''}</div>
      ${c && c.nazwa ? `<div class="cname">${esc(c.nazwa)}</div>` : ''}
    </div>
  </div>
  <section><div class="grid q">
    <a class="card tilt rv link c-amber" href="/regulaminy"><div class="ic">${ico('scroll')}</div><h3>Regulaminy ${ico('arrow','ar')}</h3><p>Regulamin serwera oraz regulamin Crime.</p></a>
    <a class="card tilt rv link c-coral" href="/taryfikator"><div class="ic">${ico('scale')}</div><h3>Taryfikator ${ico('arrow','ar')}</h3><p>Sprawdź, jakie kary grożą za łamanie zasad.</p></a>
    <a class="card tilt rv link c-violet" href="${esc(CONFIG.discord)}" target="_blank" rel="noopener"><div class="ic dc">${ico('discord')}</div><h3>Discord ${ico('arrow','ar')}</h3><p>Dołącz do społeczności i bądź na bieżąco z serwerem.</p></a>
  </div></section>
  <section class="c-amber"><div class="sh rv"><h2>Dlaczego my?</h2></div><div class="grid">${feats}</div></section>
  <section class="c-coral"><div class="sh rv"><h2>Jak dołączyć?</h2></div><div class="grid steps">${steps}</div></section>
  <section class="banner rv"><h2>Gotowy na <span>Los Santos</span>?</h2><p>Dołącz do nas i stwórz swoją historię.</p>
    <div class="cta" style="justify-content:center"><a class="btn fivem" href="${esc(CONFIG.fivem||'#')}" onclick="copyIp()">${IC('fivem')} Połącz z serwerem</a><a class="btn dc" href="${esc(CONFIG.discord)}" target="_blank" rel="noopener">${IC('discord')} Wbijaj na Discord</a></div></section>
  <section class="c-violet"><div class="sh rv"><h2>FAQ</h2></div><div class="faq">${faq}</div></section>`;
}

/* status serwera (dane z /api/status – serwer odpytuje FiveM, więc działa też na HTTPS) */
let statusTimer = null;
function initHome(){
  clearInterval(statusTimer);
  const box = $('#srv'); if(!box) return;
  const draw = d => {
    if(!box.isConnected){ clearInterval(statusTimer); return; }
    if(d && d.online){ box.dataset.state = 'on'; $('#srvn').textContent = d.players + ' / ' + d.max; $('#srvt').textContent = 'Graczy online'; }
    else { box.dataset.state = 'off'; $('#srvn').textContent = 'Offline'; $('#srvt').textContent = 'Serwer niedostępny'; }
  };
  const poll = async () => {
    try{ const r = await fetch('/api/status', { credentials:'same-origin' }); draw(r.ok ? await r.json() : null); }
    catch(e){ draw(null); }
  };
  poll(); statusTimer = setInterval(poll, 30000);
}

/* efekty: liczniki, tilt kart, parallax postaci */
function fx(){
  document.querySelectorAll('[data-n]').forEach(el=>{const n=+el.dataset.n,s=el.dataset.s||'',t0=performance.now();
    const step=t=>{const p=Math.min((t-t0)/1400,1);el.textContent=Math.round(n*(1-Math.pow(1-p,3)))+s;if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);});
  if(matchMedia('(hover:hover)').matches) document.querySelectorAll('.tilt').forEach(el=>{
    el.addEventListener('mousemove',e=>{const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      el.style.transform=`perspective(700px) rotateY(${x*10}deg) rotateX(${-y*10}deg) translateY(-6px)`;});
    el.addEventListener('mouseleave',()=>el.style.transform='');
  });
}
addEventListener('mousemove',e=>{
  const s=$('#spot'); if(s) s.style.transform=`translate(${e.clientX-300}px,${e.clientY-300}px)`;
  const p=$('#pimg'),b=$('#bigtxt'); if(p){const x=e.clientX/innerWidth-.5,y=e.clientY/innerHeight-.5;
    p.style.transform=`translate(${x*-24}px,${y*-14}px)`; b.style.transform=`translate(calc(-50% + ${x*40}px),calc(-50% + ${y*22}px))`;}
});
const NAVEL=document.querySelector('.nav');
const onScroll=()=>{$('#prog').style.width=(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)*100)+'%'; if(NAVEL) NAVEL.classList.toggle('scrolled',scrollY>12);};
addEventListener('scroll',onScroll,{passive:true}); onScroll();
$('#nd').href=CONFIG.discord; $('#nf').href=CONFIG.fivem||'#'; $('#nf').onclick=()=>copyIp();
$('#slogo').src=CONFIG.logo;
/* ekran startowy: poświata + pierścień, logo z połyskiem (maska = kształt logo), pasek ładowania */
(()=>{
  const sp=$('#splash'), im=$('#slogo'); if(!sp||!im) return;
  const w=document.createElement('div'); w.className='sp-logo';
  try{ w.style.setProperty('--logo','url("'+new URL(CONFIG.logo,location.href).href.replace(/"/g,'%22')+'")'); }catch(e){}
  im.replaceWith(w); w.appendChild(im); w.insertAdjacentHTML('beforeend','<i class="sp-shine"></i>');
  sp.insertAdjacentHTML('afterbegin','<div class="sp-aura"></div>');
  sp.insertAdjacentHTML('beforeend','<div class="sp-bar"><i></i></div>');
})();
setTimeout(()=>{const s=$('#splash'); if(!s) return; s.classList.add('out'); setTimeout(()=>s.remove(),700);},1750);

/* pojedynczy punkt regulaminu: numer -> etykieta, "- " -> wypunktowanie, "SKR (Nazwa) - opis" -> skrót */
function ruleHTML(p,j){
  const d = `style="animation-delay:${Math.min(j*30,600)}ms"`;
  let m = p.match(/^(\d+(?:\.\d+)+)\s+([\s\S]*)$/);
  if(m){ const lvl = Math.min(m[1].split('.').length-2,2); return `<div class="rule ${lvl>0?'sub'+lvl:''}" ${d}><b>${m[1]}</b><span>${esc(m[2])}</span></div>`; }
  m = p.match(/^([A-Z]{2,3})\s+\(([^)]+)\)\s*[-–]\s*([\s\S]*)$/);
  if(m) return `<div class="rule" ${d}><b>${m[1]}</b><span><strong>${esc(m[2])}</strong> – ${esc(m[3])}</span></div>`;
  if(/^[-•]\s+/.test(p)) return `<div class="rule sub1" ${d}><b>•</b><span>${esc(p.replace(/^[-•]\s+/,''))}</span></div>`;
  return `<div class="note ${p.endsWith(':')?'h':''}" ${d}>${esc(p)}</div>`;
}

/* pasek kategorii: na desktopie lista obok, na telefonie przycisk z aktualną kategorią rozwijający listę */
function sideHTML(labels,cur,q,ph){
  const lab = q ? 'Wyniki wyszukiwania' : labels[cur];
  return `<input class="search" id="q" type="search" placeholder="${ph}" value="${esc(q)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">`+
    `<button type="button" class="catbar c-${CN[cur%CN.length]}" id="catbar"><span><small>Kategoria</small>${esc(lab)}</span>${ico('arrow','chev')}</button>`+
    `<div class="catlist">`+labels.map((l,i)=>`<button class="c-${CN[i%CN.length]} ${!q&&i===cur?'on':''}" data-i="${i}">${esc(l)}</button>`).join('')+`</div>`;
}

/* odświeża tylko listę kategorii – pole szukania zostaje (na telefonie klawiatura nie znika po każdej literze) */
function putSide(side,labels,cur,q,ph){
  const html = sideHTML(labels,cur,q,ph);
  if(!side.querySelector('#q')){ side.innerHTML = html; return; }
  const t = document.createElement('div'); t.innerHTML = html;
  side.querySelectorAll('.catbar,.catlist').forEach(e=>e.remove());
  t.querySelectorAll('.catbar,.catlist').forEach(e=>side.appendChild(e));
}

/* REGULAMINY: wybór między regulaminem serwera (/regulaminy) a regulaminem Crime (/regulaminy/crime) */
const REGS = [
  { id:'',      label:'Regulamin serwera', key:'regulamin' },
  { id:'crime', label:'Regulamin Crime',   key:'regulaminCrime' }
];
const curReg = () => REGS.find(r => r.id === (segs()[1] || '')) || REGS[0];
function regulaminy(){
  const r = curReg();
  return `<div class="ph1"><h1>Regu<span>laminy</span></h1></div>
  <div class="ptabs" id="regtabs" style="margin-top:20px">${REGS.map(x=>`<button type="button" data-t="${x.id}" class="${x===r?'on':''}">${esc(x.label)}</button>`).join('')}</div>
  <div class="doc" style="margin-top:12px"><div class="side" id="side"></div><div id="body"></div></div>`;
}
/* rysuje wybrany regulamin w #side i #body; zwraca funkcję sprzątającą (zdejmuje nasłuch przewijania) */
function mountReg(reg){
  const data = CONFIG[reg.key] || []; let cur = 0, q = '', lock = false, lockT = 0;
  const side = $('#side'), body = $('#body');
  side.innerHTML = '';                                           // czyste pole szukania przy zmianie regulaminu
  const labels = data.map((k,i)=>`§${i+1}. ${k.kategoria}`), PH = `Szukaj w: ${reg.label.toLowerCase()}…`;
  if(!data.length){ body.innerHTML = '<div class="empty">Ten regulamin nie został jeszcze dodany.</div>'; return () => {}; }
  /* ile pikseli od góry ekranu zajmuje to, co przyklejone (nawigacja + pasek wyszukiwarki) */
  const offset = () => {
    const nav = NAVEL ? NAVEL.offsetHeight : 58;
    if(innerWidth > 860) return nav + 24;
    return (parseFloat(getComputedStyle(side).top) || nav) + side.offsetHeight + 12;
  };
  /* podświetla aktualny dział w spisie treści bez przerysowywania całej strony */
  const setCur = i => {
    if(i === cur) return; cur = i;
    side.querySelectorAll('.catlist button').forEach((b,k)=>b.classList.toggle('on',k===i));
    const cb = $('#catbar');
    if(cb){ cb.className = `catbar c-${CN[i%CN.length]}`; cb.firstElementChild.innerHTML = `<small>Kategoria</small>${esc(labels[i])}`; }
  };
  /* scroll-spy: aktywny jest ostatni dział, którego początek minął linię pod przyklejonym paskiem */
  const spy = () => {
    if(q || !body.isConnected) return;
    const secs = body.querySelectorAll('.cat'); if(!secs.length) return;
    const line = offset() + 24; let i = 0;
    secs.forEach((s,k)=>{ if(s.getBoundingClientRect().top <= line) i = k; });
    if(innerHeight + scrollY >= document.documentElement.scrollHeight - 4) i = secs.length - 1;
    setCur(i);
  };
  const onScroll = () => {
    if(!body.isConnected){ removeEventListener('scroll',onScroll); return; }      // użytkownik wyszedł z podstrony
    if(lock){ clearTimeout(lockT); lockT = setTimeout(()=>{ lock = false; spy(); },160); return; }   // trwa przewijanie po kliknięciu w spis
    spy();
  };
  addEventListener('scroll',onScroll,{passive:true});

  const draw = () => {
    putSide(side,labels,cur,q,PH);
    const ql = q.toLowerCase();
    const all = data.map((k,i)=>({k,i}));
    const cats = q ? all.filter(o=>o.k.punkty.some(p=>p.toLowerCase().includes(ql))) : all;     // bez wyszukiwania: cały regulamin w jednym ciągu
    body.innerHTML = cats.length ? cats.map(({k,i},n)=>`<div class="cat c-${CN[i%CN.length]}" data-i="${i}"${n?' style="margin-top:56px"':''}><h2>§${i+1}. ${esc(k.kategoria)}</h2>` +
      k.punkty.filter(p=>!q||p.toLowerCase().includes(ql)).map((p,j)=>ruleHTML(p,j)).join('') + `</div>`).join('') : '<div class="empty">Brak wyników.</div>';
    side.querySelectorAll('.catlist button').forEach(b=>b.onclick=()=>{
      const i = +b.dataset.i; side.classList.remove('open');
      if(q){ q = ''; $('#q').value = ''; cur = i; draw(); } else setCur(i);
      const el = body.querySelector(`.cat[data-i="${i}"]`); if(!el) return;
      lock = true; clearTimeout(lockT); lockT = setTimeout(()=>{ lock = false; },250);
      scrollTo({top:Math.max(0,el.getBoundingClientRect().top + scrollY - offset()),behavior:'smooth'});
    });
    $('#catbar').onclick=()=>side.classList.toggle('open');
    const inp=$('#q'); inp.oninput=e=>{
      side.classList.remove('open'); q=e.target.value.trim(); const p=e.target.selectionStart; draw();
      const n=$('#q'); n.focus(); n.setSelectionRange(p,p);
      const t = $('.doc').getBoundingClientRect().top + scrollY - offset(); if(scrollY > t) scrollTo({top:Math.max(0,t),behavior:'instant'});
    };
    spy();
  };
  draw();
  return () => { clearTimeout(lockT); removeEventListener('scroll',onScroll); };
}
/* przełączanie regulaminów bez przeładowania widoku: zanikanie -> podmiana treści -> płynne wejście */
function initRegulaminy(){
  const tabs = $('#regtabs'), doc = $('.doc'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let teardown = mountReg(curReg()), busy = false;
  tabs.querySelectorAll('button').forEach(b => b.onclick = () => {
    if(busy || b.classList.contains('on')) return;
    busy = true;
    tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    const url = '/regulaminy' + (b.dataset.t ? '/' + b.dataset.t : '');
    const swap = () => {
      if(!doc.isConnected) return;                               // użytkownik zdążył wyjść z podstrony
      teardown(); history.pushState(null,'',url); teardown = mountReg(curReg());
      const top = tabs.getBoundingClientRect().top + scrollY - (NAVEL ? NAVEL.offsetHeight : 58) - 12;
      if(scrollY > top) scrollTo({top:Math.max(0,top),behavior:'instant'});     // przewinięte głęboko -> wracamy do początku (niewidoczne, bo treść jest zanikła)
      doc.classList.replace('swap-out','swap-in');
      setTimeout(() => { doc.classList.remove('swap-in'); busy = false; }, reduce ? 0 : 380);
    };
    if(reduce){ doc.classList.add('swap-out'); swap(); } else { doc.classList.add('swap-out'); setTimeout(swap, 170); }
  });
}

/* TARYFIKATOR */
function taryfikator(){
  return `<div class="ph1"><h1>Tary<span>fikator</span></h1></div>
  <div class="doc"><div class="side" id="side"></div><div id="body"></div></div>`;
}
function initTaryfikator(){
  const T = CONFIG.taryfikator, data = T.kategorie; let cur = 0, q = '';
  const side = $('#side'), body = $('#body');
  const draw = () => {
    putSide(side,data.map(k=>k.kategoria),cur,q,'Szukaj przewinienia…');
    const ql = q.toLowerCase();
    const cats = q ? data.filter(k=>k.wiersze.some(r=>r.join(' ').toLowerCase().includes(ql))) : [data[cur]];
    const ref = T.kolumny.findIndex((c,i)=>i>0&&/punkt|regulamin|§/i.test(c));
    const pen = r => `<div class="pen"><div class="pen-h"><b>${esc(r[0])}</b>${ref>0&&r[ref]?`<span class="pt">${esc(r[ref])}</span>`:''}</div><div class="pen-b">${
      r.map((c,i)=>({c,i})).filter(o=>o.i!==0&&o.i!==ref&&o.c).map(o=>`<div class="pen-r"><small>${esc(T.kolumny[o.i]||'')}</small><span>${esc(o.c)}</span></div>`).join('')}</div></div>`;
    body.innerHTML = cats.length ? cats.map(k=>`<div class="cat c-${CN[data.indexOf(k)%CN.length]}"><h2>${esc(k.kategoria)}</h2><div class="pen-grid">${
      k.wiersze.filter(r=>!q||r.join(' ').toLowerCase().includes(ql)).map(pen).join('')}</div></div>`).join('') : '<div class="empty">Brak wyników.</div>';
    side.querySelectorAll('.catlist button').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;side.classList.remove('open');if(i===cur&&!q)return;cur=i;q='';draw();window.scrollTo({top:0,behavior:'smooth'});});
    $('#catbar').onclick=()=>side.classList.toggle('open');
    const inp=$('#q'); inp.oninput=e=>{side.classList.remove('open');q=e.target.value.trim();const p=e.target.selectionStart;draw();const n=$('#q');n.focus();n.setSelectionRange(p,p);};
  };
  draw();
}

/* ROUTER – czyste adresy (/start, /regulamin, /podania/administracja…) na History API; serwer oddaje index.html dla każdej z tych ścieżek */
/* Bezpieczne sprawdzenie funkcji podań (jeśli plik podania.js jest tylko na serwerze) */
const safePodania = typeof podania !== 'undefined' ? podania : () => `<div class="ph1"><h1>Po<span>dania</span></h1><p>Moduł podań ładowany z serwera.</p></div>`;
const safeInitPodania = typeof initPodania !== 'undefined' ? initPodania : null;

/* ROUTER – czyste adresy */
const routes = { 
  start: [home, initHome], 
  regulaminy: [regulaminy, initRegulaminy], 
  taryfikator: [taryfikator, initTaryfikator], 
  podania: [safePodania, safeInitPodania], 
  postacie: [postacieView, initPostacie],
  panel: [panel, initPanel] 
};
const segs = () => location.pathname.split('/').filter(Boolean);
function route(){
  const s = segs(); let r = s[0] || 'start';
  if(r === 'home') r = 'start';                                  // stary adres /home
  if(r === 'regulamin'){ r = 'regulaminy'; history.replaceState(null,'','/regulaminy' + location.search); }   // stary adres /regulamin
  if(!routes[r] || !s.length || s[0] === 'home'){ history.replaceState(null,'','/start' + (routes[r] ? location.search : '')); if(!routes[r]) return route(); }
  const [view,init] = routes[r];
  const app = $('#app'); app.style.animation='none'; app.offsetHeight; app.style.animation='';
  app.innerHTML = view(); if(init) init();
  document.querySelectorAll('.nav .links a').forEach(a=>a.classList.toggle('on',a.dataset.r===r));
  $('#links').classList.remove('open'); closeAcct(); window.scrollTo(0,0);
  const io = new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const t=e.target;t.classList.add('in');io.unobserve(t);setTimeout(()=>t.style.transitionDelay='',1300);}}),{threshold:.15});
  fx();
  document.querySelectorAll('.rv').forEach((el,i)=>{el.style.transitionDelay=(i%4)*90+'ms';io.observe(el);});
}
function go(url){ history.pushState(null,'',url); route(); }
/* kliknięcia w wewnętrzne linki (/regulamin, /podania/…) nie przeładowują strony; /auth/… i linki zewnętrzne działają normalnie */
document.addEventListener('click', e => {
  if(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href^="/"]');
  if(!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const u = new URL(a.href, location.origin);
  if(u.origin !== location.origin || !routes[u.pathname.split('/').filter(Boolean)[0] || 'start']) return;
  e.preventDefault();
  const url = u.pathname + u.search;
  const nav = () => { window.onbeforeunload = null;
    if(url === location.pathname + location.search){ try{ sessionStorage.setItem('plr_ns','1'); }catch(e){} location.reload(); return; }   // ta sama podstrona: pełne odświeżenie (bez ekranu startowego)
    go(url); };
  if(window.onbeforeunload) uiConfirm('Masz niezapisane zmiany. Opuścić stronę bez zapisywania?', { title:'Niezapisane zmiany', ok:'Opuść bez zapisu', cancel:'Zostań', danger:true }).then(ok => { if(ok) nav(); });
  else nav();
});
/* KONTO: „Zaloguj się”; po zalogowaniu avatar + nick = bezpośredni link do panelu (bez menu). Wylogowanie jest w panelu i na stronie Podania */
const AUTH = { me:null };
function closeAcct(){ const m=$('#acctm'), b=$('#acctb'); if(m) m.hidden=true; if(b) b.setAttribute('aria-expanded','false'); }
function renderAcct(){
  const box = $('#acct'); if(!box) return;
  const u = AUTH.me && AUTH.me.user;
  if(!u){
    box.innerHTML = `<a class="btn sm" id="acctl" href="/auth/discord?next=/start">Zaloguj się</a>`;
    $('#acctl').onclick = () => { $('#acctl').href = '/auth/discord?next=' + encodeURIComponent(location.pathname); };   // po zalogowaniu wracasz na tę samą podstronę
    return;
  }
  const name = u.nick || u.name, canPanel = (AUTH.me.perms||[]).includes('panel.access'), pend = AUTH.me.pendingReview || 0;
  const av = u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" alt="">` : `<span class="av0">${esc((name||'?')[0].toUpperCase())}</span>`;
  const href = canPanel ? '/panel' : '/podania';
  box.innerHTML = `<a class="acct-btn" id="acctb" href="${href}" title="${canPanel ? 'Otwórz panel' : 'Moje podania'}${pend ? ' – ' + pend + ' do sprawdzenia' : ''}">${av}<span class="acct-name">${esc(name)}</span>${pend ? `<i class="dotb">${pend > 99 ? '99+' : pend}</i>` : ''}</a>`;
}
async function refreshAuth(){
  try{ const r = await fetch('/api/me',{credentials:'same-origin'}); AUTH.me = r.ok ? await r.json() : null; }catch(e){ AUTH.me = null; }
  renderAcct();
}
document.addEventListener('click', e => { if(!e.target.closest('#acct') || e.target.closest('.acct-menu a')) closeAcct(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeAcct(); });
renderAcct(); refreshAuth();
setInterval(() => { const m = $('#acctm'); if(AUTH.me && AUTH.me.user && !document.hidden && !(m && !m.hidden)) refreshAuth(); }, 60000);   // odświeża oznaczenie „do sprawdzenia”
(() => {
  const b = $('#burger'), l = $('#links');
  b.setAttribute('aria-expanded','false'); b.setAttribute('aria-controls','links');
  b.onclick = () => l.classList.toggle('open');
  const sync = () => { const o = l.classList.contains('open'); b.setAttribute('aria-expanded', String(o)); document.body.classList.toggle('nav-open', o); };
  new MutationObserver(sync).observe(l, { attributes:true, attributeFilter:['class'] });     // też gdy router sam zamyka menu
  document.addEventListener('click', e => { if(l.classList.contains('open') && !e.target.closest('#links,#burger')) l.classList.remove('open'); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') l.classList.remove('open'); });
  addEventListener('resize', () => { if(innerWidth > 860) l.classList.remove('open'); });
})();
/* regulamin i taryfikator edytowane w panelu (jeśli są) nadpisują wersję z config.js; brak serwera = zostaje config.js */
addEventListener('popstate', route);

// Bezpieczne pobieranie bez wywalania błędu gdy brak serwera API
fetch('/api/content', { credentials: 'same-origin' })
  .then(r => r.ok ? r.json() : null)
  .then(c => {
    if(c){
      if(Array.isArray(c.regulamin) && c.regulamin.length) CONFIG.regulamin = c.regulamin;
      if(Array.isArray(c.regulaminCrime) && c.regulaminCrime.length) CONFIG.regulaminCrime = c.regulaminCrime;
      if(c.taryfikator && Array.isArray(c.taryfikator.kategorie) && c.taryfikator.kategorie.length) CONFIG.taryfikator = c.taryfikator;
    }
  })
  .catch(() => {})
  .finally(() => {
    route(); // Wyrenderuj stronę zawsze, niezależnie od tego czy API odpowiada
  });