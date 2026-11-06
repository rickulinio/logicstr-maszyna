/* PANEL – frontend. Pokazuje tylko to, co zwraca serwer (/api/me).
   Prawdziwe uprawnienia egzekwuje server/server.js – ukrycie czegoś tutaj NIE jest zabezpieczeniem.
   Ładowany PRZED app.js (korzysta z jego $, esc, CN, IC, ico w momencie wywołania). */

/* ----- dane demo (podgląd bez serwera: window.PANEL_DEMO = true) ----- */
let demoIn = true;
const DEMO_MODS = [
  { id:'overview', title:'Przegląd', ikona:'shield', kolor:'teal', opis:'Twoje konto, role i dostępne moduły.' },
  { id:'roles', title:'Role i uprawnienia', ikona:'scale', kolor:'amber', opis:'Mapowanie ról Discorda na uprawnienia.' },
  { id:'logs', title:'Logi panelu', ikona:'scroll', kolor:'coral', opis:'Logowania i akcje w panelu.' },
  { id:'regulamin', title:'Regulaminy', ikona:'scroll', kolor:'violet', opis:'Zmiany w regulaminie, regulaminie Crime i taryfikatorze.' },
  { id:'gracze', title:'Gracze', ikona:'city', kolor:'mint', opis:'Członkowie serwera Discord i ich profile.' }
];
const DEMO_DB = {
  '/me': () => demoIn ? { user:{ id:'1', name:'Demo Admin', avatarUrl:'' }, roles:['admin'],
      perms:['panel.access','roles.view','roles.edit','logs.view','regulamin.edit','gracze.view'], modules:DEMO_MODS } : { user:null },
  '/admin/roles': () => ({ canEdit:true, owners:['1'],
    roles:[{name:'zarzad',id:'111111111111111111',mine:false},{name:'admin',id:'222222222222222222',mine:true},{name:'moderator',id:'333333333333333333',mine:false}],
    permissions:[{perm:'panel.access',roles:['zarzad','admin','moderator']},{perm:'roles.view',roles:['zarzad','admin']},
                 {perm:'logs.view',roles:['zarzad','admin']},{perm:'roles.edit',roles:[]}] }),
  '/admin/logs': () => ({ logs:[
    {t:new Date().toISOString(),event:'login',name:'Demo Admin',detail:''},
    {t:new Date(Date.now()-3600e3).toISOString(),event:'login',name:'Jan Kowalski',detail:''},
    {t:new Date(Date.now()-7200e3).toISOString(),event:'login_denied',name:'Anna Nowak',detail:'brak na serwerze'},
    {t:new Date(Date.now()-9000e3).toISOString(),event:'logout',name:'Jan Kowalski',detail:''}] })
};
const demoErr = () => Object.assign(new Error('demo'), { status:0, demo:true });
async function api(p){
  if(window.PANEL_DEMO){ const f = DEMO_DB[p.split('?')[0]]; if(!f) throw demoErr(); return f(); }
  const r = await fetch('/api'+p, { credentials:'same-origin' });
  if(!r.ok){ let d = null; try{ d = await r.json(); }catch(x){} const e = new Error('HTTP '+r.status); e.status = r.status; e.code = d && d.error; throw e; }
  return r.json();
}

/* zmiany (POST/PUT/PATCH/DELETE) – JSON; błąd niesie status i kod z serwera */
async function send(method, p, body){
  if(window.PANEL_DEMO) throw demoErr();
  const r = await fetch('/api'+p, { method, credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  let d = null; try{ d = await r.json(); }catch(e){}
  if(!r.ok){ const e = new Error((d && d.error) || 'HTTP '+r.status); e.status = r.status; e.code = d && d.error; e.data = d; throw e; }
  return d;
}
const fail = e => toast(
  e.demo ? 'Tryb demo – zapis wymaga uruchomionego serwera.' :
  e.status === 401 ? 'Sesja wygasła – zaloguj się ponownie.' :
  e.code === 'self' ? 'Nie możesz rozpatrywać własnego podania.' :
  e.code === 'closed' ? 'Ten formularz jest zamknięty.' :
  e.status === 403 ? 'Brak uprawnień do tej operacji.' :
  e.code === 'no_bot' ? 'Serwer nie ma ustawionego BOT_TOKEN w .env.' :
  e.code === 'discord' ? 'Nie udało się połączyć z Discordem. Spróbuj ponownie.' :
  e.code === 'self_owner' ? 'Nie możesz usunąć siebie z listy właścicieli.' :
  e.code === 'decided' ? 'To podanie zostało już rozpatrzone przez kogoś innego.' :
  e.code === 'self' ? 'Nie możesz rozpatrywać własnego podania.' :
  e.code === 'pending' ? 'Masz już oczekujące podanie tego typu – poczekaj na decyzję.' :
  e.code === 'missing' ? 'Uzupełnij wszystkie wymagane pola.' :
  e.code === 'rate' ? 'Chwileczkę – spróbuj ponownie za kilka sekund.' :
  e.code === 'bad_request' ? 'Niepoprawne dane – sprawdź pola.' :
  'Nie udało się zapisać. Spróbuj ponownie.');

/* okienko potwierdzenia w UI strony (zamiast systemowego confirm); zwraca Promise<boolean> */
function uiConfirm(msg, o = {}){
  return new Promise(done => {
    const prev = document.activeElement;
    const w = document.createElement('div'); w.className = 'umodal';
    w.innerHTML = `<div class="umbox" role="alertdialog" aria-modal="true" aria-labelledby="umt"><h3 id="umt">${esc(o.title || 'Potwierdź')}</h3><p>${esc(msg)}</p>
      <div class="uma"><button type="button" class="btn ghost sm" data-r="0">${esc(o.cancel || 'Anuluj')}</button><button type="button" class="btn sm ${o.danger ? 'danger' : ''}" data-r="1">${esc(o.ok || 'Potwierdź')}</button></div></div>`;
    const bs = [...w.querySelectorAll('button')];
    const end = v => { document.removeEventListener('keydown', key, true); w.remove(); document.documentElement.style.overflow = ''; try{ prev && prev.focus && prev.focus(); }catch(e){} done(v); };
    const key = e => {
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); end(false); }
      else if(e.key === 'Tab'){ e.preventDefault(); const i = bs.indexOf(document.activeElement); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); }
    };
    document.addEventListener('keydown', key, true);
    w.onclick = e => { if(e.target === w) end(false); };
    bs.forEach(b => b.onclick = () => end(b.dataset.r === '1'));
    document.body.appendChild(w); document.documentElement.style.overflow = 'hidden';   // tło pod okienkiem się nie przewija
    bs[o.danger ? 0 : 1].focus();
  });
}
const pluralPod = n => n === 1 ? 'podanie czeka' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 'podania czekają' : 'podań czeka';
/* role pokazywane użytkownikowi: role z panelu + rola „rozpatrujący” (przypisana do formularzy) */
const myRoles = me => [...(me.roles || []), ...(me.reviewAll ? ['Rozpatrywanie: wszystkie podania'] : (me.reviewForms || []).map(f => 'Rozpatrywanie: ' + f.name))];

/* ----- widok strony ----- */
function panel(){
  return `<div class="ph1"><h1>Pa<span>nel</span></h1><p></p></div>
  <div id="pnl"><div class="empty">Ładowanie…</div></div>`;
}

const PERR = {
  state:'Sesja logowania wygasła. Spróbuj zalogować się ponownie.',
  guild:'Nie jesteś na naszym serwerze Discord – dołącz, a potem zaloguj się ponownie.',
  oauth:'Logowanie przez Discord nie powiodło się. Spróbuj jeszcze raz.'
};
const EVT = { login:'Logowanie', logout:'Wylogowanie', login_denied:'Odmowa logowania', forbidden:'Odmowa dostępu',
  regulamin_edit:'Regulamin: zapis', regulamin_reset:'Regulamin: reset', access_edit:'Role i właściciele: zapis',
  podanie_submit:'Podanie: złożone', podanie_accept:'Podanie: zaakceptowane', podanie_reject:'Podanie: odrzucone',
  podanie_notify_fail:'Podanie: błąd wysyłki wiadomości', podania_edit:'Podania: edycja formularzy', podania_role_create:'Podania: nowa rola na Discordzie',
  podania_open:'Podania: otwarto formularz', podania_close:'Podania: zamknięto formularz', podania_image:'Podania: wgrano zdjęcie' };

async function panelLogout(){
  if(window.PANEL_DEMO){ demoIn = false; return initPanel(); }
  try{ await fetch('/auth/logout', { method:'POST', credentials:'same-origin' }); }catch(e){}
  location.href = '/panel';
}

async function initPanel(){
  window.onbeforeunload = null;
  const box = $('#pnl'); if(!box) return;
  let me;
  try{ me = await api('/me'); }
  catch(e){
    if(!$('#pnl')) return;
    box.innerHTML = `<div class="card"><h3>Brak połączenia z serwerem panelu</h3>
      <p>Panel wymaga uruchomionego serwera (folder <b>server/</b>). Sprawdź, czy działa, i spróbuj ponownie.</p>
      <div class="cta"><a class="btn ghost" href="#panel" id="pretry">Spróbuj ponownie</a></div></div>`;
    $('#pretry').onclick = ev => { ev.preventDefault(); initPanel(); };
    return;
  }
  if(!$('#pnl')) return;
  const err = new URLSearchParams(location.search).get('err');
  if(!me.user) return loginView(box, err);
  if(!me.perms.includes('panel.access')) return noAccessView(box, me);
  dashView(box, me);
}

/* jedna karta logowania dla podstron Podania i Panel – po zalogowaniu wraca na tę samą podstronę */
function loginCard(err){
  return `<div class="card plogin nohover c-teal" style="max-width:560px;margin:auto">
    <div class="ic">${ico('shield')}</div><h3>Wymagane logowanie</h3>
    <p>Zaloguj się przyciskiem w prawym górnym rogu strony, aby kontynuować.</p>
    ${err && PERR[err] ? `<div class="perr">${esc(PERR[err])}</div>` : ''}</div>`;
}
function loginView(box, err){
  box.innerHTML = loginCard(err);
  const pl = $('#plogin'); if(pl) pl.onclick = ev => { if(window.PANEL_DEMO){ ev.preventDefault(); demoIn = true; initPanel(); } };
}

const userBlock = (me, extra='') => {
  const u = me.user, av = u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" alt="">` : `<span>${esc((u.name||'?')[0].toUpperCase())}</span>`;
  return `<div class="ucard"><div class="av">${av}</div><div class="un"><b>${esc(u.name)}</b><small>${myRoles(me).length ? myRoles(me).map(esc).join(' · ') : 'brak ról z panelu'}</small></div>
    <a href="#" class="mini" id="plogout">Wyloguj</a></div>${extra}`;
};
const bindLogout = () => { const l = $('#plogout'); if(l) l.onclick = async ev => { ev.preventDefault(); if(await leave()) panelLogout(); }; };

function noAccessView(box, me){
  box.innerHTML = `<div class="card plogin c-coral">${userBlock(me)}
    <h3 style="margin-top:16px">Brak dostępu do panelu</h3>
    <p>Twoje role na Discordzie nie dają uprawnień do panelu. Jeśli to błąd, napisz do administracji i spróbuj zalogować się ponownie.</p></div>`;
  bindLogout();
}

/* ----- panel po zalogowaniu ----- */
const chips = (arr, empty) => arr.length ? arr.map(x => `<span class="chip">${esc(x)}</span>`).join('') : `<span class="muted">${esc(empty)}</span>`;
const fmtT = t => { try{ return new Date(t).toLocaleString('pl-PL'); }catch(e){ return t; } };

/* ----- pomocnicze dla modułów edycyjnych ----- */
const fmtD = t => { try{ return new Date(t).toLocaleDateString('pl-PL'); }catch(e){ return t || ''; } };
const opts = (arr, sel) => arr.map(x => `<option value="${esc(x)}" ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
const ptabs = (items, cur) => `<div class="ptabs">${items.map(([id, label]) => `<button type="button" data-t="${id}" class="${id === cur ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
const loadErr = e => e.demo ? 'Ten moduł wymaga uruchomionego serwera (tryb demo go nie obsługuje).'
  : e.code === 'no_bot' ? 'Serwer nie ma ustawionego BOT_TOKEN w .env – listę członków pobiera bot Discorda.'
  : e.code === 'discord' ? 'Nie udało się pobrać członków z Discorda. Sprawdź, czy bot jest na serwerze i ma włączony „Server Members Intent”.'
  : e.status === 403 ? 'Brak uprawnień do tego modułu.' : 'Nie udało się załadować danych.';

const RENDER = {
  overview(m, me, el, go){
    const others = me.modules.filter(x => x.id !== 'overview');
    const pend = me.pendingReview || 0;
    el.innerHTML = `${pend ? `<a href="#" class="pnotice" data-m="podania"><b>${pend}</b><span>${pluralPod(pend)} na Twoją decyzję</span><i>Przejdź do podań →</i></a>` : ''}
      <div class="grid pstat">
        <div class="card"><h3>Twoje role</h3><div class="chips">${chips(myRoles(me), 'brak')}</div></div>
        <div class="card"><h3>Uprawnienia</h3><div class="chips">${chips(me.perms, 'brak')}</div></div></div>
      <div class="note h">Dostępne moduły</div>
      <div class="grid">${others.map(x => `<a href="#" class="card link c-${esc(x.kolor||'teal')}" data-m="${esc(x.id)}">
        <div class="ic">${ico(x.ikona)}</div><h3>${esc(x.title)} ${ico('arrow','ar')}</h3><p>${esc(x.opis||'')}${x.soon ? ' <i class="soon">wkrótce</i>' : ''}</p></a>`).join('') || '<div class="empty">Brak dodatkowych modułów.</div>'}</div>`;
    el.querySelectorAll('[data-m]').forEach(a => a.onclick = ev => { ev.preventDefault(); go(a.dataset.m); });
  },
  async roles(m, me, el){
    const SN = /^\d{17,20}$/;
    const view = d => {
      const can = !!d.canEdit;
      el.innerHTML = `<div class="note">${can
        ? 'Możesz zmienić ID ról Discorda i listę właścicieli. Zmiany zapisują się w <b>data/access.json</b> i działają od razu, bez restartu serwera. Nazwy ról i przypisanie uprawnień nadal definiuje <b>server/config.js</b>.'
        : 'Role Discorda przypisane do nazw w <b>server/config.js</b>. Edytować ID ról mogą tylko właściciele.'} „Ty” oznacza role, które aktualnie posiadasz.</div>
        <div class="rl">${d.roles.map(r => `<div class="rr"><div class="rc"><small>Rola</small><b>${esc(r.name)}</b></div><div class="rc w2"><small>ID roli</small>${can ? `<input class="pin mono" data-role="${esc(r.name)}" maxlength="20" inputmode="numeric" autocomplete="off" value="${esc(r.id)}">` : `<span class="mono allowsel">${esc(r.id)}</span>`}</div><div class="rc"><small>Ty</small><span>${r.mine ? '<span class="tag t-ok">tak</span>' : '–'}</span></div></div>`).join('')}</div>
        ${can ? `<div class="note h">Właściciele (owners)</div>
          <div class="note">Właściciele mają wszystkie uprawnienia niezależnie od ról, jako jedyni edytują tę stronę. Wpisz ID użytkowników Discord, po jednym w linii. Nie możesz usunąć samego siebie.</div>
          <div class="pf"><textarea class="pin mono" id="rown" rows="4" spellcheck="false" placeholder="np. 123456789012345678">${esc((d.owners || []).join('\n'))}</textarea></div>` : ''}
        <div class="note h">Uprawnienia</div>
        <div class="rl">${d.permissions.map(p => `<div class="rr"><div class="rc"><small>Uprawnienie</small><span class="mono">${esc(p.perm)}</span></div><div class="rc w2"><small>Role</small>${p.roles.length ? `<div class="chips" style="margin:0">${p.roles.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : '<span class="muted">tylko właściciele</span>'}</div></div>`).join('')}</div>
        ${can ? `<div class="savebar" id="rbar" hidden><span class="dirty">● Niezapisane zmiany</span><span class="grow"></span><button type="button" class="btn ghost sm" id="rrev">Odrzuć zmiany</button><button type="button" class="btn sm" id="rsv">Zapisz</button></div>` : ''}`;
      if(!can) return;
      const showBar = () => { $('#rbar').hidden = false; };
      el.querySelectorAll('[data-role]').forEach(i => i.oninput = showBar);
      $('#rown').oninput = showBar;
      $('#rrev').onclick = () => view(d);
      $('#rsv').onclick = async () => {
        const roles = {}; el.querySelectorAll('[data-role]').forEach(i => roles[i.dataset.role] = i.value.trim());
        const bad = Object.keys(roles).find(n => !SN.test(roles[n]));
        if(bad) return toast(`Niepoprawne ID roli „${bad}” – to 17–20 cyfr.`);
        const owners = [...new Set($('#rown').value.split(/[\s,;]+/).filter(Boolean))];
        const badO = owners.find(x => !SN.test(x));
        if(badO) return toast(`Niepoprawne ID właściciela: ${badO}`);
        if(!owners.includes(me.user.id)) return toast('Nie możesz usunąć siebie z listy właścicieli.');
        if(!await uiConfirm('Zapisać zmiany w rolach i właścicielach? Wpłyną od razu na dostęp wszystkich do panelu.', { title:'Zapisać zmiany?', ok:'Zapisz' })) return;
        const btn = $('#rsv'); btn.disabled = true;
        try{ await send('PUT', '/admin/roles', { roles, owners }); toast('Zapisano.'); initPanel(); }
        catch(e){ fail(e); btn.disabled = false; }
      };
    };
    view(await api('/admin/roles'));
  },
  async logs(m, me, el){
    const d = await api('/admin/logs');
    el.innerHTML = d.logs.length ? `<div class="rl">${d.logs.map(l => `<div class="rr"><div class="rc"><small>Czas</small><span>${esc(fmtT(l.t))}</span></div><div class="rc"><small>Zdarzenie</small><b>${esc(EVT[l.event]||l.event)}</b></div><div class="rc"><small>Użytkownik</small><span>${esc(l.name||'–')}</span></div>${l.detail ? `<div class="rc w2"><small>Szczegóły</small><span>${esc(l.detail)}</span></div>` : ''}</div>`).join('')}</div>`
      : '<div class="empty">Brak wpisów.</div>';
  },
  /* ===== EDYCJA REGULAMINU I TARYFIKATORA ===== */
  async regulamin(m, me, el){
    const d = await api('/admin/regulamin');
    const clone = o => JSON.parse(JSON.stringify(o));
    const S = { reg: clone(d.regulamin), crime: clone(d.regulaminCrime || []), tar: clone(d.taryfikator) }, cols = S.tar.kolumny;
    let meta = d, tab = 'reg'; const ci = { reg:0, crime:0, tar:0 };
    const L = () => tab === 'reg' ? S.reg : tab === 'crime' ? S.crime : S.tar.kategorie;
    const dirty = () => !!window.onbeforeunload;
    const mark = v => { window.onbeforeunload = v ? () => '' : null; const b = $('.savebar'); if(b) b.hidden = !v; };

    const draw = () => {
      const list = L(); ci[tab] = Math.max(0, Math.min(ci[tab], list.length - 1));
      const i = ci[tab], k = list[i];
      let body;
      if(!k) body = '<div class="empty">Brak kategorii – dodaj pierwszą.</div>';
      else if(tab !== 'tar') body = `<div class="pf"><label>Nazwa kategorii</label><input class="pin" id="rname" maxlength="120" value="${esc(k.kategoria)}"></div>
        <div class="pf" style="margin-top:14px"><label>Punkty – każdy w osobnej linii</label>
          <textarea class="pin" id="rpts" rows="16" spellcheck="false">${esc(k.punkty.join('\n'))}</textarea>
          <small class="muted">Numeracja: <span class="mono">1.1 Treść</span>, podpunkty <span class="mono">1.1.1 Treść</span>, wypunktowanie <span class="mono">- treść</span>, skrót <span class="mono">SKR (Nazwa) - opis</span>. Linia zakończona dwukropkiem staje się nagłówkiem.</small></div>`;
      else body = `<div class="pf"><label>Nazwa kategorii</label><input class="pin" id="rname" maxlength="120" value="${esc(k.kategoria)}"></div>
        <div class="rl" style="margin-top:14px">${k.wiersze.map((r, x) => `<div class="rr">${r.map((c, y) => `<div class="pf rc"><small>${esc(cols[y])}</small><input class="pin" data-r="${x}" data-c="${y}" maxlength="200" value="${esc(c)}"></div>`).join('')}<div class="rc end"><button type="button" class="btn danger sm" data-del="${x}">Usuń</button></div></div>`).join('')}</div>
        <div class="frow" style="margin:14px 0 0"><button type="button" class="btn ghost sm" id="rrow">+ Dodaj wiersz</button></div>`;

      el.innerHTML = `<div class="note">${meta.custom ? `Wersja edytowana – zapisana ${esc(fmtT(meta.updated))} przez ${esc(meta.by || '?')}.` : 'Strona używa jeszcze wersji domyślnej z <b>js/config.js</b>. Po pierwszym zapisie przejdzie na wersję edytowaną tutaj.'} Zapisane zmiany są od razu widoczne na stronie, a przed każdym zapisem serwer robi kopię zapasową.</div>
        ${ptabs([['reg', 'Regulamin'], ['crime', 'Regulamin Crime'], ['tar', 'Taryfikator']], tab)}
        <div class="pcard"><div class="frow">
          <select class="pin grow" id="rcat">${list.map((x, j) => `<option value="${j}" ${j === i ? 'selected' : ''}>${tab !== 'tar' ? '§' + (j + 1) + '. ' : ''}${esc(x.kategoria)}</option>`).join('')}</select>
          <button type="button" class="btn ghost sm" id="rup" ${i < 1 ? 'disabled' : ''} title="Przesuń wyżej">↑</button>
          <button type="button" class="btn ghost sm" id="rdn" ${i >= list.length - 1 ? 'disabled' : ''} title="Przesuń niżej">↓</button>
          <button type="button" class="btn ghost sm" id="radd">+ Kategoria</button>
          <button type="button" class="btn danger sm" id="rdel" ${k ? '' : 'disabled'}>Usuń kategorię</button></div>
          ${body}</div>
        ${meta.custom ? '<div class="frow"><button type="button" class="btn danger sm" id="rreset">Przywróć domyślne</button></div>' : ''}
        <div class="savebar" ${dirty() ? '' : 'hidden'}><span class="dirty" id="rdirty">● Niezapisane zmiany</span><span class="grow"></span>
          <button type="button" class="btn ghost sm" id="rrevert">Odrzuć zmiany</button>
          <button type="button" class="btn sm" id="rsave">Zapisz</button></div>`;

      el.querySelectorAll('.ptabs button').forEach(b => b.onclick = () => { if(b.dataset.t === tab) return; tab = b.dataset.t; draw(); });
      $('#rcat').onchange = ev => { ci[tab] = +ev.target.value; draw(); };
      $('#radd').onclick = () => {
        list.push(tab !== 'tar' ? { kategoria:'Nowa kategoria', punkty:[] } : { kategoria:'Nowa kategoria', wiersze:[] });
        ci[tab] = list.length - 1; mark(true); draw(); const n = $('#rname'); if(n){ n.focus(); n.select(); }
      };
      $('#rdel').onclick = async () => { if(!k || !await uiConfirm(`Usunąć kategorię „${k.kategoria}” razem z całą zawartością?`, { title:'Usunąć kategorię?', ok:'Usuń', danger:true })) return; list.splice(i, 1); mark(true); draw(); };
      $('#rup').onclick = () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; ci[tab] = i - 1; mark(true); draw(); };
      $('#rdn').onclick = () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; ci[tab] = i + 1; mark(true); draw(); };
      if(k){
        $('#rname').oninput = ev => { k.kategoria = ev.target.value; $('#rcat').options[i].textContent = (tab !== 'tar' ? '§' + (i + 1) + '. ' : '') + k.kategoria; mark(true); };
        if(tab !== 'tar') $('#rpts').oninput = ev => { k.punkty = ev.target.value.split('\n').map(s => s.trim()).filter(Boolean); mark(true); };
        else {
          el.querySelectorAll('input[data-r]').forEach(inp => inp.oninput = ev => { k.wiersze[+inp.dataset.r][+inp.dataset.c] = ev.target.value; mark(true); });
          el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { k.wiersze.splice(+b.dataset.del, 1); mark(true); draw(); });
          $('#rrow').onclick = () => { k.wiersze.push(cols.map(() => '')); mark(true); draw(); const ins = el.querySelectorAll('.rl .rr:last-child input'); if(ins[0]) ins[0].focus(); };
        }
      }
      $('#rsave').onclick = async () => {
        if([...S.reg, ...S.crime, ...S.tar.kategorie].some(c => !c.kategoria.trim())) return toast('Każda kategoria musi mieć nazwę.');
        if(!S.reg.length || !S.crime.length || !S.tar.kategorie.length) return toast('Regulamin, regulamin Crime i taryfikator muszą mieć co najmniej jedną kategorię.');
        const btn = $('#rsave'); btn.disabled = true;
        try{
          const r = await send('PUT', '/admin/regulamin', { regulamin:S.reg, regulaminCrime:S.crime, taryfikator:S.tar });
          S.reg = clone(r.regulamin); S.crime = clone(r.regulaminCrime); S.tar = clone(r.taryfikator); meta = r; mark(false); toast('Zapisano – zmiany są już na stronie.'); draw();
        }catch(e){ fail(e); btn.disabled = false; }
      };
      $('#rrevert').onclick = async () => { if(dirty() && !await uiConfirm('Odrzucić wszystkie niezapisane zmiany?', { title:'Niezapisane zmiany', ok:'Odrzuć', danger:true })) return; mark(false); RENDER.regulamin(m, me, el).catch(e => { el.innerHTML = `<div class="empty">${loadErr(e)}</div>`; }); };
      const rs = $('#rreset');
      if(rs) rs.onclick = async () => {
        if(!await uiConfirm('Przywrócić domyślną treść regulaminów i taryfikatora z js/config.js? Wersja edytowana zostanie usunięta (kopia zapasowa zostaje na serwerze).', { title:'Przywrócić domyślne?', ok:'Przywróć', danger:true })) return;
        try{ await send('DELETE', '/admin/regulamin'); mark(false); toast('Przywrócono wersję domyślną.'); RENDER.regulamin(m, me, el).catch(e => { el.innerHTML = `<div class="empty">${loadErr(e)}</div>`; }); }
        catch(e){ fail(e); }
      };
    };
    draw();
  },

  /* ===== GRACZE: członkowie serwera Discord (bez botów) – lista i profile ===== */
  gracze(m, me, el){
    const alive = () => el.isConnected;
    let q = '', role = '', limit = 60, timer = null;
    const dot = c => `style="--rc:${esc(c || '#99aab5')}"`;

    const listView = () => {
      el.innerHTML = `<div class="frow"><input class="search" id="gq" placeholder="Szukaj: nick, nazwa Discord, ID…" autocomplete="off" value="${esc(q)}">
        <select class="pin grow" id="grole"><option value="">Wszystkie role</option></select>
        <button type="button" class="btn ghost sm" id="gref">↻ Odśwież</button></div><div id="glist"><div class="empty">Ładowanie…</div></div>`;
      const load = async refresh => {
        let d; try{ d = await api('/gracze?limit=' + limit + '&q=' + encodeURIComponent(q) + (role ? '&role=' + role : '') + (refresh ? '&refresh=1' : '')); }
        catch(e){ if(alive() && $('#glist')) $('#glist').innerHTML = `<div class="empty">${loadErr(e)}</div>`; return; }
        const box = $('#glist'); if(!alive() || !box) return;
        const sel = $('#grole'); sel.innerHTML = '<option value="">Wszystkie role</option>' + d.roles.map(r => `<option value="${esc(r.id)}" ${r.id === role ? 'selected' : ''}>${esc(r.name)} (${r.count})</option>`).join('');
        sel.onchange = ev => { role = ev.target.value; limit = 60; load(); };
        box.innerHTML = `<div class="chips" style="margin:0 0 14px"><span class="chip">Członków: ${d.all}</span>${q || role ? `<span class="chip">Pasuje: ${d.total}</span>` : ''}<span class="chip">Pobrano: ${esc(fmtT(d.fetchedAt))}</span></div>` +
          (d.players.length ? `<div class="mgrid">${d.players.map(p => `<button type="button" class="mcard" data-id="${esc(p.id)}"><img src="${esc(p.avatar)}" alt="" loading="lazy">
            <span class="mi"><b ${p.color ? `style="color:${esc(p.color)}"` : ''}>${esc(p.name)}</b><small>@${esc(p.username)}</small>${p.top ? `<span class="rchip" ${dot(p.color)}><i></i>${esc(p.top)}</span>` : ''}</span></button>`).join('')}</div>
            ${d.total > d.players.length ? `<div class="frow" style="margin-top:14px"><button type="button" class="btn ghost sm" id="gmore">Pokaż więcej (${d.players.length} z ${d.total})</button></div>` : ''}`
            : `<div class="empty">${q || role ? 'Nikogo nie znaleziono.' : 'Brak członków do wyświetlenia.'}</div>`);
        box.querySelectorAll('.mcard').forEach(b => b.onclick = () => openPlayer(b.dataset.id));
        const more = $('#gmore'); if(more) more.onclick = () => { limit += 60; load(); };
      };
      $('#gq').oninput = ev => { q = ev.target.value.trim(); limit = 60; clearTimeout(timer); timer = setTimeout(load, 250); };
      $('#gref').onclick = () => { $('#glist').innerHTML = '<div class="empty">Ładowanie…</div>'; load(true); };
      load();
    };

    const openPlayer = async id => {
      let p; try{ p = (await api('/gracze/' + id)).player; }catch(e){ return toast(loadErr(e)); }
      if(!alive()) return;
      const bg = p.banner ? `background-image:url('${esc(p.banner)}')` : `--bc:${esc(p.accent || p.roleColor || '#1f3a3f')}`;
      const row = (k, v) => v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : '';
      el.innerHTML = `<div class="frow"><button type="button" class="btn ghost sm" id="gback">← Lista graczy</button></div>
        <div class="prof"><div class="ban" style="${bg}"></div>
          <div class="pb"><img class="pav" src="${esc(p.avatar)}" alt="">
            <h3 ${p.roleColor ? `style="color:${esc(p.roleColor)}"` : ''}>${esc(p.name)}</h3>
            <div class="muted">@${esc(p.username)}${p.display && p.display !== p.name ? ' · ' + esc(p.display) : ''}</div>
            ${p.timeout ? `<div class="chips"><span class="tag t-ban">Wyciszony do ${esc(fmtT(p.timeout))}</span></div>` : ''}
            <div class="sec"><dl>
              ${row('Nick na serwerze', p.nick)}${row('Na serwerze od', p.joined ? fmtD(p.joined) : '')}${row('Konto utworzone', fmtD(p.created))}${row('Boostuje serwer od', p.boost ? fmtD(p.boost) : '')}
              <div><dt>ID Discord</dt><dd class="mono allowsel">${esc(p.id)}</dd></div></dl></div>
            <div class="sec"><h4>Role (${p.roles.length})</h4><div class="chips" style="margin:0">${p.roles.length ? p.roles.map(r => `<span class="rchip" ${dot(r.color)}><i></i>${esc(r.name)}</span>`).join('') : '<span class="muted">brak ról</span>'}</div></div>
          </div></div>`;
      $('#gback').onclick = listView;
    };
    listView();
  },
  /* ===== PODANIA: rozpatrywanie + konfiguracja formularzy, pytań i ról rozpatrujących ===== */
  podania(m, me, el){
    const pendN = me.pendingReview || 0;
    const canRev = me.perms.includes('podania.review') || me.perms.includes('podania.reviewer');
    const canMan = me.perms.includes('podania.manage');   // bez niego rozpatrujący edytuje swój formularz w trybie ograniczonym
    let tab = canRev ? 'rev' : 'forms';
    const alive = () => el.isConnected;
    const clone = o => JSON.parse(JSON.stringify(o));
    const run = fn => fn().catch(e => { if(alive()) ($('#pbox') || el).innerHTML = `<div class="empty">${loadErr(e)}</div>`; });
    const STL = { pending:['Oczekujące','t-warn'], accepted:['Zaakceptowane','t-ok'], rejected:['Odrzucone','t-ban'] };
    const tag = s => `<span class="tag ${STL[s][1]}">${STL[s][0]}</span>`;
    const avatar = (u, n) => u ? `<img src="${esc(u)}" alt="">` : `<span>${esc((n || '?')[0].toUpperCase())}</span>`;

    /* ---------- rozpatrywanie ---------- */
    let st = 'pending', form = '';
    const reviewView = async () => {
      const d = await api('/admin/podania?status=' + st + (form ? '&form=' + encodeURIComponent(form) : ''));
      const box = $('#pbox'); if(!alive() || !box) return;
      const dec = st !== 'pending';
      const openRows = d.forms.length ? `<div class="note h" style="margin-top:0">Przyjmowanie podań</div><div class="rl" style="margin-bottom:22px">${d.forms.map(f => `<div class="rr" style="--a:var(--${f.open ? 'mint' : 'coral'})">
          <div class="rc w2"><small>Formularz</small><b>${esc(f.name)}</b></div>
          <div class="rc"><small>Status</small><span>${f.open ? '<span class="tag t-ok">Otwarte</span>' : '<span class="tag t-ban">Zamknięte</span>'}</span></div>
          <div class="rc end"><label class="sw"><input type="checkbox" data-open="${esc(f.id)}" ${f.open ? 'checked' : ''}><span>Przyjmuj podania</span></label></div></div>`).join('')}</div>` : '';
      box.innerHTML = `${openRows}${ptabs(Object.keys(STL).map(k => [k, STL[k][0] + ' (' + d.counts[k] + ')']), st).replace('class="ptabs"', 'class="ptabs sub"')}
        <div class="frow"><select class="pin grow" id="pform"><option value="">Wszystkie formularze</option>${d.forms.map(f => `<option value="${esc(f.id)}" ${f.id === form ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>
          <button type="button" class="btn ghost sm" id="pref">↻ Odśwież</button></div>
        ${d.rows.length ? `<div class="rl">${d.rows.map(r => `<div class="rr clk" data-id="${esc(r.id)}">
            <div class="rc"><small>Gracz</small><b>${esc(r.userName)}</b></div>
            <div class="rc"><small>Formularz</small><span>${esc(r.formName)}</span></div>
            <div class="rc"><small>Złożono</small><span>${esc(fmtT(r.createdAt))}</span></div>
            ${dec ? `<div class="rc"><small>Rozpatrzył(a)</small><span>${esc(r.decidedByName || '–')}</span></div>` : ''}</div>`).join('')}</div>`
          : '<div class="empty">Brak podań w tej kategorii.</div>'}`;
      box.querySelectorAll('[data-open]').forEach(c => c.onchange = async () => {
        c.disabled = true;
        try{ await send('POST', '/admin/podania-forms/' + encodeURIComponent(c.dataset.open) + '/open', { open:c.checked }); toast(c.checked ? 'Formularz otwarty – gracze mogą składać podania.' : 'Formularz zamknięty.'); run(reviewView); }
        catch(e){ fail(e); c.checked = !c.checked; c.disabled = false; }
      });
      box.querySelectorAll('.ptabs button').forEach(b => b.onclick = () => { if(b.dataset.t === st) return; st = b.dataset.t; run(reviewView); });
      $('#pform').onchange = ev => { form = ev.target.value; run(reviewView); };
      $('#pref').onclick = () => run(reviewView);
      box.querySelectorAll('.rr.clk').forEach(r => r.onclick = () => run(() => detailView(r.dataset.id)));
    };

    const detailView = async id => {
      const s = (await api('/admin/podania/' + encodeURIComponent(id))).sub;
      const box = $('#pbox'); if(!alive() || !box) return;
      const pend = s.status === 'pending';
      const notif = x => x === 'ok' ? 'wysłano' : x === 'skipped' ? 'pominięto' : x === 'pending' ? 'w toku' : 'nie udało się';
      box.innerHTML = `<div class="frow"><button type="button" class="btn ghost sm" id="pback">← Lista podań</button></div>
        <div class="ucard" style="margin-bottom:14px"><div class="av">${avatar(s.avatarUrl, s.userName)}</div>
          <div class="un"><b>${esc(s.userName)}</b><small>ID Discord: ${esc(s.userId)}${s.discord && s.discord.username ? ' · @' + esc(s.discord.username) : ''}</small></div>${tag(s.status)}</div>
        <div class="chips" style="margin:0 0 16px"><span class="chip">${esc(s.formName)}</span><span class="chip">Złożono: ${esc(fmtT(s.createdAt))}</span></div>
        ${s.answers.filter(a => a.a).map(a => `<div class="pitem"><small>${esc(a.q)}</small><p class="allowsel">${esc(a.a)}</p></div>`).join('')}
        ${pend ? `<div class="pcard" style="margin-top:18px"><div class="pf"><label>Wiadomość dla gracza (opcjonalnie)</label>
            <textarea class="pin" id="preason" rows="3" maxlength="1000" placeholder="Powód odrzucenia lub wiadomość od administracji"></textarea>
            <small class="muted">Gracz dostanie decyzję w wiadomości prywatnej na Discordzie (i na kanale decyzji, jeśli jest ustawiony).</small></div></div>
          <div class="savebar"><span class="grow"></span><button type="button" class="btn danger sm" id="prej">Odrzuć</button><button type="button" class="btn sm" id="pacc">Akceptuj</button></div>`
        : `<div class="pcard" style="margin-top:18px"><div class="chips" style="margin:0 0 10px">${tag(s.status)}<span class="chip">${esc(s.decidedByName || '?')}</span><span class="chip">${esc(fmtT(s.decidedAt))}</span></div>
            ${s.reason ? `<div class="muted" style="margin-bottom:8px">${esc(s.reason)}</div>` : ''}
            <div class="muted">Powiadomienie: DM – ${notif(s.dm)}, kanał – ${notif(s.ch)}</div></div>`}`;
      $('#pback').onclick = () => run(reviewView);
      if(!pend) return;
      const decide = async d => {
        const reason = $('#preason').value.trim();
        const acc = d === 'accepted';
        if(!await uiConfirm(`${acc ? 'Zaakceptować' : 'Odrzucić'} podanie gracza ${s.userName}? Gracz zostanie powiadomiony na Discordzie.${!acc && !reason ? '\n\nNie wpisano powodu odrzucenia.' : ''}`,
          { title: acc ? 'Zaakceptować podanie?' : 'Odrzucić podanie?', ok: acc ? 'Akceptuj' : 'Odrzuć', danger: !acc })) return;
        const bs = [$('#pacc'), $('#prej')]; bs.forEach(b => b.disabled = true);
        try{
          const r = await send('POST', '/admin/podania/' + encodeURIComponent(id) + '/decision', { decision:d, reason });
          toast(r.dm === 'ok' ? 'Decyzja zapisana, gracz powiadomiony.' : 'Decyzja zapisana, ale nie udało się wysłać wiadomości prywatnej (gracz ma ją zablokowaną).');
          me.pendingReview = Math.max(0, (me.pendingReview || 0) - 1); if(window.refreshAuth) refreshAuth();
          run(() => detailView(id));
        }catch(e){ fail(e); if(e.code === 'decided') run(() => detailView(id)); else bs.forEach(b => b.disabled = false); }
      };
      $('#pacc').onclick = () => decide('accepted');
      $('#prej').onclick = () => decide('rejected');
    };

    /* ---------- formularze, pytania i role rozpatrujące ---------- */
    let S = [], fi = 0, GR = [], bot = false, GC = [], botCh = false, limited = false;
    const dirty = () => !!window.onbeforeunload;
    const mark = v => { window.onbeforeunload = v ? () => '' : null; const b = $('.savebar'); if(b) b.hidden = !v; };
    const roleOf = id => GR.find(r => r.id === id);
    const newForm = () => ({ name:'Nowe podanie', desc:'', icon:'', open:false, notifyChannelId:'', reviewRoles:[], questions:[{ label:'Dlaczego chcesz dołączyć?', type:'long', required:true }] });

    const formsView = async () => {
      const d = await api('/admin/podania-forms');
      let rd = { bot:false, roles:[] }; try{ rd = await api('/admin/podania-roles'); }catch(e){}
      let cd = { bot:false, channels:[] }; try{ cd = await api('/admin/podania-channels'); }catch(e){}
      if(!alive() || !$('#pbox')) return;
      S = clone(d.forms); limited = !!d.limited; GR = rd.roles || []; bot = !!rd.bot; GC = cd.channels || []; botCh = !!cd.bot; fi = Math.min(fi, Math.max(0, S.length - 1));
      mark(false); drawForms();
    };

    const drawForms = () => {
      const box = $('#pbox'); if(!box) return;
      const f = S[fi];
      let body = `<div class="empty">${limited ? 'Brak formularzy przypisanych do Twojej roli.' : 'Brak podań – dodaj pierwsze.'}</div>`;
      if(f){
        const free = GR.filter(r => !f.reviewRoles.includes(r.id));
        body = `${limited ? '' : `<div class="fgrid">
            <div class="pf"><label>Nazwa podania</label><input class="pin" id="fname" maxlength="80" value="${esc(f.name)}"></div>
            <div class="pf"><label>Kanał powiadomień o nowych podaniach</label>${botCh
              ? `<select class="pin" id="fnch"><option value="">Brak powiadomień na Discordzie</option>${GC.map(c => `<option value="${esc(c.id)}" ${c.id === f.notifyChannelId ? 'selected' : ''}>#${esc(c.name)}</option>`).join('')}${f.notifyChannelId && !GC.some(c => c.id === f.notifyChannelId) ? `<option value="${esc(f.notifyChannelId)}" selected>ID ${esc(f.notifyChannelId)} (niedostępny dla bota)</option>` : ''}</select>`
              : `<input class="pin mono" id="fnch" maxlength="20" inputmode="numeric" placeholder="ID kanału (puste = bez powiadomień)" value="${esc(f.notifyChannelId || '')}">`}
              <small class="muted">Bot wyśle tu wiadomość z oznaczeniem ról rozpatrujących, gdy ktoś złoży to podanie.</small></div></div>
          <div class="pf" style="margin-top:12px"><label>Ikona / logo podania (widoczne na liście podań)</label>
            <div class="icoedit"><span class="pi" id="ficon">${f.icon ? `<img src="${esc(f.icon)}" alt="">` : ico('scroll')}</span>
              <div class="icoctl"><div class="frow" style="margin:0"><label class="btn ghost sm" for="ffile">Wgraj obrazek</label><input type="file" id="ffile" accept="image/*" hidden>${f.icon ? '<button type="button" class="btn danger sm" id="ficonrm">Usuń ikonę</button>' : ''}</div>
                <input class="pin" id="ficonurl" maxlength="300" placeholder="…albo wklej link do obrazka (https://…)" value="${f.icon && /^https:/i.test(f.icon) ? esc(f.icon) : ''}">
                <small class="muted">Dowolny obrazek (PNG, JPG, WebP, SVG) – sam zmniejszę go do 256 px. Pamiętaj o „Zapisz zmiany”.</small></div></div></div>
          <div class="pf" style="margin-top:12px"><label>Opis (widoczny dla graczy)</label><textarea class="pin" id="fdesc" rows="3" maxlength="600">${esc(f.desc || '')}</textarea></div>

          <div class="note h" style="margin-top:24px">Role rozpatrujące to podanie</div>
          <div class="note">Osoby z tymi rolami Discorda zobaczą w panelu tylko podania z tego formularza i mogą je akceptować lub odrzucać. Zarząd widzi wszystkie.</div>
          <div class="chips" style="margin:0 0 12px">${f.reviewRoles.length ? f.reviewRoles.map(id => { const r = roleOf(id); return `<span class="rchip" style="--rc:${esc((r && r.color) || '#8fa7aa')}"><i></i>${esc(r ? r.name : id)}<button type="button" class="x" data-rm="${esc(id)}" title="Usuń rolę">×</button></span>`; }).join('')
            : '<span class="muted">brak – rozpatrywać mogą tylko osoby z uprawnieniem „podania.review” (zarząd)</span>'}</div>
          <div class="frow">${bot ? `<select class="pin grow" id="frole"><option value="">Dodaj istniejącą rolę z serwera…</option>${free.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select>`
              : `<input class="pin mono grow" id="frole" maxlength="20" inputmode="numeric" placeholder="ID roli Discorda (bez BOT_TOKEN nie ma listy ról)">`}
            <button type="button" class="btn ghost sm" id="fradd">+ Dodaj</button></div>
          ${bot ? `<div class="frow"><input class="pin grow" id="frnew" maxlength="60" placeholder="…albo utwórz nową rolę na Discordzie, np. Zarząd LSPD"><button type="button" class="btn ghost sm" id="frcreate">Utwórz rolę</button></div>` : ''}`}

          <div class="note h" style="margin-top:${limited ? 0 : 24}px">Pytania (${f.questions.length})</div>
          ${f.questions.map((q, j) => `<div class="pq"><div class="frow" style="margin-bottom:10px"><b class="pqn">${j + 1}</b><span class="grow"></span>
              <button type="button" class="btn ghost sm" data-up="${j}" ${j < 1 ? 'disabled' : ''} title="Wyżej">↑</button><button type="button" class="btn ghost sm" data-dn="${j}" ${j >= f.questions.length - 1 ? 'disabled' : ''} title="Niżej">↓</button>
              <button type="button" class="btn danger sm" data-qdel="${j}">Usuń</button></div>
            <div class="pf"><label>Treść pytania</label><input class="pin" data-q="${j}" data-k="label" maxlength="300" value="${esc(q.label)}"></div>
            <div class="fgrid" style="margin-top:10px"><div class="pf"><label>Typ odpowiedzi</label><select class="pin" data-q="${j}" data-k="type">
                <option value="short" ${q.type === 'short' ? 'selected' : ''}>Krótka odpowiedź</option><option value="long" ${q.type === 'long' ? 'selected' : ''}>Długa odpowiedź</option><option value="choice" ${q.type === 'choice' ? 'selected' : ''}>Wybór z listy</option></select></div>
              <label class="sw"><input type="checkbox" data-q="${j}" data-k="required" ${q.required ? 'checked' : ''}><span>Pytanie wymagane</span></label></div>
            ${q.type === 'choice' ? `<div class="pf" style="margin-top:10px"><label>Opcje – każda w osobnej linii (min. 2)</label><textarea class="pin" rows="4" data-q="${j}" data-k="options">${esc((q.options || []).join('\n'))}</textarea></div>` : ''}</div>`).join('')}
          <div class="frow" style="margin-top:6px"><button type="button" class="btn ghost sm" id="fqadd">+ Dodaj pytanie</button></div>
          <div class="muted">Rubryka „Discord” (nick i ID) jest dodawana do każdego podania automatycznie.</div>`;
      }
      box.innerHTML = `<div class="note">${limited ? 'Możesz edytować pytania swojego formularza. Pozostałe ustawienia (nazwę, opis, kanał powiadomień i role rozpatrujące) ustawia zarząd.' : 'Tutaj tworzysz i edytujesz podania – np. do administracji, LSPD czy EMS. Każde ma własne pytania, role rozpatrujące i kanał powiadomień. Otwieranie i zamykanie przyjmowania podań ustawiają osoby z rolą rozpatrującą w zakładce „Rozpatrywanie”.'}</div>
        <div class="pcard"><div class="frow"><select class="pin grow" id="fsel">${S.map((x, i) => `<option value="${i}" ${i === fi ? 'selected' : ''}>${esc(x.name || '(bez nazwy)')}${x.open ? '' : ' · zamknięte'}</option>`).join('')}</select>
          ${limited ? '' : `<button type="button" class="btn ghost sm" id="fadd">+ Nowe podanie</button><button type="button" class="btn danger sm" id="fdel" ${f ? '' : 'disabled'}>Usuń podanie</button>`}</div>${body}</div>
        <div class="savebar" ${dirty() ? '' : 'hidden'}><span class="dirty" id="fdirty">● Niezapisane zmiany</span><span class="grow"></span>
          <button type="button" class="btn ghost sm" id="frev">Odrzuć zmiany</button><button type="button" class="btn sm" id="fsave">Zapisz</button></div>`;

      const label = () => { const o = $('#fsel').options[fi]; if(o) o.textContent = (f.name || '(bez nazwy)') + (f.open ? '' : ' · zamknięte'); };
      $('#fsel').onchange = ev => { fi = +ev.target.value; drawForms(); };
      if(!limited) $('#fadd').onclick = () => { S.push(newForm()); fi = S.length - 1; mark(true); drawForms(); const n = $('#fname'); if(n){ n.focus(); n.select(); } };
      if(!limited) $('#fdel').onclick = async () => {
        if(!f || !await uiConfirm(`Usunąć podanie „${f.name}” razem z pytaniami? Już złożone podania zostają w archiwum (widzi je zarząd).`, { title:'Usunąć podanie?', ok:'Usuń', danger:true })) return;
        S.splice(fi, 1); fi = Math.max(0, fi - 1); mark(true); drawForms();
      };
      if(f){
        if(!limited){
          $('#fname').oninput = ev => { f.name = ev.target.value; label(); mark(true); };
          $('#fnch').oninput = $('#fnch').onchange = ev => { f.notifyChannelId = ev.target.value.trim(); mark(true); };
          $('#fdesc').oninput = ev => { f.desc = ev.target.value; mark(true); };
          $('#ficonurl').onchange = ev => { const v = ev.target.value.trim(); if(v && !/^https:\/\/\S{4,290}$/i.test(v)) return toast('Link musi zaczynać się od https://'); f.icon = v; mark(true); drawForms(); };
          $('#ffile').onchange = async ev => { const file = ev.target.files[0]; if(!file) return;
            try{ const r = await send('POST', '/admin/podania-image', { data: await shrinkImg(file) }); f.icon = r.url; mark(true); toast('Ikona wgrana – kliknij „Zapisz zmiany”.'); drawForms(); }
            catch(e){ e.code === 'too_big' ? toast('Obrazek jest za duży.') : e.message === 'bad' ? toast('Wybierz plik graficzny.') : fail(e); } };
          const irm = $('#ficonrm'); if(irm) irm.onclick = () => { f.icon = ''; mark(true); drawForms(); };
          box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { f.reviewRoles = f.reviewRoles.filter(x => x !== b.dataset.rm); mark(true); drawForms(); });
          $('#fradd').onclick = () => {
            const v = $('#frole').value.trim(); if(!v) return;
            if(!/^\d{17,20}$/.test(v)) return toast('Niepoprawne ID roli – to 17–20 cyfr.');
            if(!f.reviewRoles.includes(v)) f.reviewRoles.push(v);
            mark(true); drawForms();
          };
        }
        const cr = $('#frcreate');
        if(cr) cr.onclick = async () => {
          const name = $('#frnew').value.trim(); if(!name) return toast('Wpisz nazwę nowej roli.');
          cr.disabled = true;
          try{ const r = await send('POST', '/admin/podania-roles', { name }); GR.push(r.role); f.reviewRoles.push(r.role.id); mark(true); toast('Rola utworzona na Discordzie i dodana do tego podania.'); drawForms(); }
          catch(e){ fail(e); cr.disabled = false; }
        };
        box.querySelectorAll('[data-q]').forEach(inp => {
          const q = f.questions[+inp.dataset.q], k = inp.dataset.k;
          inp.oninput = inp.onchange = ev => {
            if(k === 'required') q.required = ev.target.checked;
            else if(k === 'options') q.options = ev.target.value.split('\n').map(x => x.trim()).filter(Boolean);
            else if(k === 'type'){ if(q.type === ev.target.value) return; q.type = ev.target.value; if(q.type === 'choice' && !(q.options || []).length) q.options = ['Tak', 'Nie']; mark(true); return drawForms(); }
            else q[k] = ev.target.value;
            mark(true);
          };
        });
        const mv = (j, d) => { const a = f.questions; [a[j], a[j + d]] = [a[j + d], a[j]]; mark(true); drawForms(); };
        box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => mv(+b.dataset.up, -1));
        box.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => mv(+b.dataset.dn, 1));
        box.querySelectorAll('[data-qdel]').forEach(b => b.onclick = () => {
          if(f.questions.length < 2) return toast('Podanie musi mieć co najmniej jedno pytanie.');
          f.questions.splice(+b.dataset.qdel, 1); mark(true); drawForms();
        });
        $('#fqadd').onclick = () => { f.questions.push({ label:'', type:'short', required:true }); mark(true); drawForms(); const ins = box.querySelectorAll('.pq:last-of-type input[data-k="label"]'); if(ins[0]) ins[0].focus(); };
      }
      $('#fsave').onclick = async () => {
        for(const x of S){
          if(!x.name.trim()) return toast('Każde podanie musi mieć nazwę.');
          if(x.notifyChannelId && !/^\d{17,20}$/.test(x.notifyChannelId)) return toast(`Podanie „${x.name}”: niepoprawne ID kanału powiadomień.`);
          for(const q of x.questions){
            if(!q.label.trim()) return toast(`Podanie „${x.name}”: każde pytanie musi mieć treść.`);
            if(q.type === 'choice' && (q.options || []).length < 2) return toast(`Podanie „${x.name}”: pytanie z listą wymaga min. 2 opcji.`);
          }
        }
        const btn = $('#fsave'); btn.disabled = true;
        try{
          if(limited){ const out = []; for(const x of S){ const r = await send('PUT', '/admin/podania-forms/' + encodeURIComponent(x.id), { questions:x.questions }); out.push(r.form); } S = clone(out); }
          else { const r = await send('PUT', '/admin/podania-forms', { forms:S }); S = clone(r.forms); }
          mark(false); toast('Zapisano – zmiany są już na stronie.'); drawForms(); }
        catch(e){ fail(e); btn.disabled = false; }
      };
      $('#frev').onclick = async () => { if(dirty() && !await uiConfirm('Odrzucić wszystkie niezapisane zmiany?', { title:'Niezapisane zmiany', ok:'Odrzuć', danger:true })) return; mark(false); run(formsView); };
    };

    const shell = () => {
      el.innerHTML = (canRev ? ptabs([['rev', 'Rozpatrywanie' + (pendN ? ' (' + pendN + ')' : '')], ['forms', canMan ? 'Formularze i role' : 'Mój formularz']], tab) : '') + '<div id="pbox"></div>';
      el.querySelectorAll('.ptabs button').forEach(b => b.onclick = async () => { if(b.dataset.t === tab || !await leave()) return; tab = b.dataset.t; shell(); });
      run(tab === 'rev' ? reviewView : formsView);
    };
    shell();
  },
  soon(m, me, el){
    el.innerHTML = `<div class="card plogin"><div class="ic">${ico(m.ikona)}</div><h3>${esc(m.title)}</h3><p>${esc(m.opis||'')}</p>
      <p class="muted">Ten moduł jest w przygotowaniu. Dostęp do niego mają już tylko osoby z uprawnieniem do tej sekcji.</p></div>`;
  }
};

/* obrazek wybrany z dysku -> zmniejszony do 256 px (WebP/PNG, data URL) */
function shrinkImg(file){
  return new Promise((ok, no) => {
    if(!/^image\//.test(file.type) || file.size > 12e6) return no(new Error('bad'));
    const url = URL.createObjectURL(file), im = new Image();
    im.onerror = () => { URL.revokeObjectURL(url); no(new Error('bad')); };
    im.onload = () => {
      URL.revokeObjectURL(url);
      const S = 256, w = im.naturalWidth || S, h = im.naturalHeight || S, k = /svg/.test(file.type) ? S / Math.max(w, h) : Math.min(1, S / Math.max(w, h));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      let d = c.toDataURL('image/webp', .92); if(!d.startsWith('data:image/webp')) d = c.toDataURL('image/png');
      ok(d);
    };
    im.src = url;
  });
}

/* czy można opuścić moduł (edytor regulaminu ustawia window.onbeforeunload, gdy są niezapisane zmiany) */
const leave = async () => !window.onbeforeunload || (await uiConfirm('Masz niezapisane zmiany. Opuścić moduł bez zapisywania?', { title:'Niezapisane zmiany', ok:'Opuść bez zapisu', cancel:'Zostań', danger:true }) && !(window.onbeforeunload = null));

function dashView(box, me){
  const mods = me.modules; let cur = mods[0] && mods[0].id;
  document.addEventListener('click', e => { const w = $('#pmwrap'); if(w && w.classList.contains('open') && !e.target.closest('#pmwrap')) w.classList.remove('open'); });
  const colorOf = (m, i) => m.kolor || CN[i % CN.length];
  const draw = () => {
    const i = Math.max(0, mods.findIndex(x => x.id === cur)), m = mods[i], c = colorOf(m, i);
    const nav = `<div class="pmwrap c-${esc(c)}" id="pmwrap"><button type="button" class="pcatbar" id="pcatbar" aria-expanded="false" aria-controls="pmods"><span class="mi">${ico(m.ikona || 'scroll')}</span><span class="pct"><small>Moduł</small>${esc(m.title)}</span>${me.pendingReview && m.id !== 'podania' ? `<i class="nb">${me.pendingReview}</i>` : ''}${ico('arrow', 'chev')}</button><nav class="pmods" id="pmods" aria-label="Moduły panelu">${mods.map((x, j) => `<button type="button" class="c-${esc(colorOf(x, j))} ${x.id === cur ? 'on' : ''}" data-m="${esc(x.id)}"><span class="mi">${ico(x.ikona || 'scroll')}</span><span class="ml">${esc(x.title)}${x.soon ? ' · wkrótce' : ''}</span>${x.id === 'podania' && me.pendingReview ? `<i class="nb">${me.pendingReview}</i>` : ''}</button>`).join('')}</nav></div>`;
    box.innerHTML = `<div class="pdash"><aside class="pnav">${userBlock(me, nav)}</aside>
      <div id="pbody"><div class="cat c-${esc(c)}"><div class="phead"><span class="mi">${ico(m.ikona || 'scroll')}</span><div><h2>${esc(m.title)}</h2>${m.opis ? `<p class="muted">${esc(m.opis)}</p>` : ''}</div></div><div id="pcont"><div class="empty">Ładowanie…</div></div></div></div></div>`;
    bindLogout();
    $('#pcatbar').onclick = () => { const w = $('#pmwrap'), o = w.classList.toggle('open'); $('#pcatbar').setAttribute('aria-expanded', String(o)); }; box.querySelectorAll('.pmods button').forEach(b => b.onclick = async () => { if(b.dataset.m === cur){ $('#pmwrap').classList.remove('open'); return; } if(!await leave()) return; cur = b.dataset.m; draw(); window.scrollTo({ top:0, behavior:'smooth' }); });
    const on = box.querySelector('.pmods button.on'); if(on && on.scrollIntoView) on.scrollIntoView({ block:'nearest', inline:'center' });
    const el = $('#pcont'), R = m.soon ? RENDER.soon : (RENDER[m.id] || RENDER.soon);
    Promise.resolve(R(m, me, el, async id => { if(id === cur) return; if(!await leave()) return; cur = id; draw(); window.scrollTo({ top:0 }); }))
      .catch(e => { if($('#pcont') === el) el.innerHTML = `<div class="empty">${loadErr(e)}</div>`; });
  };
  draw();
}