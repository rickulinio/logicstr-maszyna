/* PODANIA – frontend (widok gracza: logowanie Discord, lista formularzy z wyszukiwarką i filtrami, składanie i statusy) */
function podania(){
  return `<div class="ph1"><div class="eyebrow">Nabór</div><h1>Podania</h1>
    <div class="pmeta" id="pmeta"></div><div class="pact" id="pact"></div></div>
  <div id="podania-content"><div class="empty">Ładowanie formularzy…</div></div>`;
}

function initPodania(){
  const box = $('#podania-content');
  if(!box) return;

  const head = (meta, act) => { const m = $('#pmeta'), a = $('#pact'); if(m) m.innerHTML = meta || ''; if(a) a.innerHTML = act || ''; };

  const avatar = u => u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" alt="">` : `<span>${esc((u.name || '?')[0].toUpperCase())}</span>`;
  const profile = (u, logout) => `<div class="ucard" style="margin-bottom:18px"><div class="av">${avatar(u)}</div>
    <div class="un"><b>${esc(u.nick || u.name)}</b><small>@${esc(u.username || u.name)} · ID ${esc(u.id)}</small></div>
    ${logout ? '<a href="#" class="mini" id="plogout">Wyloguj</a>' : '<span class="tag">Zalogowano</span>'}</div>`;

  const getMe = async () => {
    const r = await fetch('/api/me', { credentials: 'same-origin' });
    if(!r.ok) throw new Error();
    return await r.json();
  };

  const loginView = err => { head('', ''); box.innerHTML = loginCard(err); };   // ta sama karta co w panelu (js/panel.js)

  const STL = { pending:['Oczekujące','t-warn'], accepted:['Zaakceptowane','t-ok'], rejected:['Odrzucone','t-ban'] };
  const tag = s => `<span class="tag ${(STL[s] || STL.pending)[1]}">${(STL[s] || STL.pending)[0]}</span>`;
  const left = iso => {                                           // „5 h 12 min” do końca cooldownu
    const m = Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / 60000)), h = Math.floor(m / 60);
    return h ? `${h} h ${m % 60} min` : `${m} min`;
  };

  /* ikona formularza: obrazek (pole icon/img/logo/image z serwera) albo domyślna ikona */
  const iconOf = f => {
    const v = f.icon || f.img || f.logo || f.image || '';
    if(/^(https?:)?\/|\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(v)) return `<img src="${esc(v)}" alt="">`;
    if(typeof ICONS !== 'undefined' && ICONS[v]) return ico(v);
    return ico('scroll');
  };

  /* szkic: odpowiedzi zapisują się w przeglądarce (osobno dla konta i formularza), dopóki podanie nie zostanie wysłane */
  const dKey = (uid, fid) => 'plr_draft_' + uid + '_' + fid;
  const getDraft = (uid, fid) => { try{ return JSON.parse(localStorage.getItem(dKey(uid, fid)) || 'null'); }catch(e){ return null; } };
  const hasDraft = (uid, fid) => { const d = getDraft(uid, fid); return !!(d && d.a && Object.values(d.a).some(v => String(v).trim())); };
  const setDraft = (uid, fid, a) => { try{ localStorage.setItem(dKey(uid, fid), JSON.stringify({ a, t: Date.now() })); }catch(e){} };
  const clearDraft = (uid, fid) => { try{ localStorage.removeItem(dKey(uid, fid)); }catch(e){} };

  const bindLogout = () => {
    const l = $('#plogout'); if(!l) return;
    l.onclick = async ev => {
      ev.preventDefault();
      try{ await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); }catch(e){}
      cache = null; load();
    };
  };

  /* stan widoku listy */
  let cache = null, mode = 'forms', q = '';

  const load = async () => {
    let me;
    try { me = await getMe(); }
    catch(e){ head('', ''); box.innerHTML = `<div class="empty">Nie udało się połączyć z serwerem. Spróbuj ponownie za chwilę.</div>`; return; }
    const u = (me && me.user) || null;

    try {
      const r = await fetch('/api/podania', { credentials: 'same-origin' });
      if(!r.ok) throw new Error();
      cache = { me, u, d: await r.json() };
      if(!u) mode = 'forms';
      render();
    } catch(e) {
      head('', '');
      box.innerHTML = `<div class="empty">Nie udało się załadować podań. Spróbuj ponownie za chwilę.</div>`;
    }
  };

  /* komunikat „zaloguj się” nad listą formularzy (widoczna dla wszystkich) */
  const loginNotice = () => {
    const err = new URLSearchParams(location.search).get('err');
    return `<div class="lnotice"><span class="li">${ico('shield')}</span>
      <div class="lt"><b>Zaloguj się, aby złożyć podanie</b>
      ${err && typeof PERR !== 'undefined' && PERR[err] ? `<em>${esc(PERR[err])}</em>` : ''}</div>
      <a class="btn" href="/auth/discord?next=/podania">${ico('discord')} Zaloguj przez Discord</a></div>`;
  };

  const render = () => {
    const { me, u, d } = cache;
    const mine = d.mine || [];
    if(!u){ head('', ''); mode = 'forms'; }
    else head(`<div class="pacts"><button type="button" class="btn ${mode === 'forms' ? '' : 'ghost'}" id="pall">Wszystkie podania</button>` +
      `<button type="button" class="btn ${mode === 'mine' ? '' : 'ghost'}" id="pmine">Moje podania${mine.length ? `<span class="cnt">${mine.length}</span>` : ''}</button></div>`);
    if(u){
      bindLogout();
      $('#pmine').onclick = () => { if(mode !== 'mine'){ mode = 'mine'; render(); } };
      $('#pall').onclick = () => { if(mode !== 'forms'){ mode = 'forms'; render(); } };
    }

    const pend = (me && me.pendingReview) || 0;
    const notice = pend ? `<a href="/panel" class="pnotice" style="margin-top:28px"><b>${pend}</b><span>${pluralPod(pend)} na Twoją decyzję</span><i>Otwórz panel →</i></a>` : '';

    if(mode === 'mine'){
      box.innerHTML = notice + `<div class="note h" style="margin-top:32px">Twoje podania</div>` + (mine.length
        ? `<div class="rl">` + mine.map(s => `<div class="rr">
            <div class="rc w2"><small>Formularz</small><b>${esc(s.formName)}</b></div>
            <div class="rc"><small>Status</small><span>${tag(s.status)}</span></div>
            <div class="rc"><small>Data</small><span>${esc(fmtT(s.createdAt))}</span></div>
            <div class="rc end"><button type="button" class="btn ghost sm" data-sub="${esc(s.id)}">Szczegóły</button></div>
          </div>`).join('') + `</div>`
        : `<div class="empty">Nie złożyłeś jeszcze żadnego podania.</div>`);
      box.querySelectorAll('button[data-sub]').forEach(b => { b.onclick = () => openSub(b.dataset.sub); });
      return;
    }

    box.innerHTML = (u ? notice : loginNotice()) + `
      <div class="ptool"><label class="psearch"><svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="pin" id="pq" type="search" enterkeyhint="search" placeholder="Szukaj podania…" value="${esc(q)}" autocomplete="off"></label></div>
      <div class="plist" id="plist"></div>`;

    $('#pq').oninput = e => { q = e.target.value.trim(); drawList(); };
    drawList();
  };

  const row = f => {
    const st = !f.open ? ['Zamknięte', true]
      : (cache.u && f.retryAt) ? ['Za ' + left(f.retryAt), true]
      : !cache.u ? ['Zaloguj się', false]
      : [hasDraft(cache.u.id, f.id) ? 'Kontynuuj szkic' : 'Wypełnij', false];
    return `<button type="button" class="prow" data-form="${esc(f.id)}" ${st[1] ? 'disabled' : ''}>
      <span class="pi">${iconOf(f)}</span>
      <span class="pbody"><b>${esc(f.name)}</b>${f.desc ? `<small>${esc(f.desc)}</small>` : ''}</span>
      <span class="go">${st[0]}${st[1] ? '' : ico('arrow', 'ar')}</span>
    </button>`;
  };

  const drawList = () => {
    const el = $('#plist'); if(!el) return;
    const ql = q.toLowerCase();
    const items = (cache.d.forms || []).filter(f =>
      (!ql || (f.name + ' ' + (f.desc || '')).toLowerCase().includes(ql)));
    el.innerHTML = items.length ? items.map(row).join('')
      : `<div class="empty">${(cache.d.forms || []).length ? 'Brak podań pasujących do wyszukiwania.' : 'Brak formularzy rekrutacyjnych.'}</div>`;
    el.querySelectorAll('[data-form]').forEach(b => { b.onclick = () => cache.u ? openForm(b.dataset.form) : (location.href = '/auth/discord?next=/podania'); });
  };

  /* szczegóły własnego podania: odpowiedzi, status, decyzja */
  const openSub = async id => {
    try {
      const r = await fetch('/api/podania/mine/' + encodeURIComponent(id), { credentials: 'same-origin' });
      if(r.status === 401){ toast('Sesja wygasła – zaloguj się ponownie.'); return load(); }
      if(!r.ok){ toast('Nie udało się otworzyć podania.'); return; }
      const s = (await r.json()).sub;
      head('', '');
      box.innerHTML = `<div class="card nohover c-teal" style="max-width:800px; margin:32px auto 0">
        <div class="frow"><button type="button" class="btn ghost sm" id="fback">← Wróć do listy</button></div>
        <h2 style="margin-top:14px">${esc(s.formName)}</h2>
        <div class="chips" style="margin:10px 0 18px">${tag(s.status)}<span class="chip">Złożono: ${esc(fmtT(s.createdAt))}</span>${s.decidedAt ? `<span class="chip">Rozpatrzono: ${esc(fmtT(s.decidedAt))}</span>` : ''}</div>
        ${s.status === 'pending' ? '<div class="note">Podanie czeka na rozpatrzenie przez administrację.</div>'
          : s.reason ? `<div class="pitem" style="--a:var(--${s.status === 'accepted' ? 'mint' : 'coral'})"><small>${s.status === 'accepted' ? 'Wiadomość od administracji' : 'Powód odrzucenia'}</small><p>${esc(s.reason)}</p></div>` : ''}
        <div class="note h" style="margin-top:18px">Twoje odpowiedzi</div>
        ${s.answers.filter(a => a.a).map(a => `<div class="pitem"><small>${esc(a.q)}</small><p>${esc(a.a)}</p></div>`).join('')}
      </div>`;
      $('#fback').onclick = load;
      window.scrollTo({ top: 0 });
    } catch(e) { toast('Nie udało się otworzyć podania.'); }
  };

  const openForm = async formId => {
    try {
      const r = await fetch('/api/podania/form/' + encodeURIComponent(formId), { credentials: 'same-origin' });
      if(r.status === 401){ toast('Sesja wygasła – zaloguj się ponownie.'); return load(); }
      if(r.status === 403){ toast('Ten formularz jest zamknięty.'); return load(); }
      if(r.status === 429){ const j = await r.json().catch(() => ({})); toast('Kolejne podanie możesz złożyć za ' + (j.retryAt ? left(j.retryAt) : '24 h') + '.'); return load(); }
      if(!r.ok){ toast('Nie udało się otworzyć formularza.'); return; }
      const d = await r.json(), f = d.form, u = d.user;
      head('', '');

      box.innerHTML = `<div class="card nohover c-teal" style="max-width:800px; margin:32px auto 0">
        <div class="frow"><button type="button" class="btn ghost sm" id="fback">← Wróć do listy</button></div>
        <h2 style="margin-top:14px">${esc(f.name)}</h2>
        ${f.desc ? `<p>${esc(f.desc)}</p>` : ''}
        <div class="note h" style="margin-top:18px">Twoje konto Discord</div>
        ${profile(u, false)}
        <form id="pform" style="margin-top:6px">
          <div class="pf" style="margin-bottom:16px">
            <label style="display:block; font-weight:600; margin-bottom:6px">Discord <span style="color:var(--coral)">*</span></label>
            <input class="pin" type="text" value="${esc(d.discord)}" readonly tabindex="-1">
            <small class="muted">Uzupełnione automatycznie z Twojego konta – nie można tego zmienić.</small>
          </div>
          ${f.questions.map(q => `
            <div class="pf" style="margin-bottom:16px">
              <label style="display:block; font-weight:600; margin-bottom:6px">${esc(q.label)} ${q.required ? '<span style="color:var(--coral)">*</span>' : ''}</label>
              ${q.type === 'long' ? `<textarea class="pin" name="${esc(q.id)}" rows="4" ${q.required ? 'required' : ''}></textarea>` :
                q.type === 'choice' ? `<select class="pin" name="${esc(q.id)}" ${q.required ? 'required' : ''}><option value="">Wybierz opcję...</option>${q.options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>` :
                `<input class="pin" type="text" autocomplete="off" enterkeyhint="next" name="${esc(q.id)}" ${q.required ? 'required' : ''}>`}
            </div>`).join('')}
          <div class="cta" style="margin-top:20px"><button type="submit" class="btn">Wyślij podanie</button><span class="muted" id="dstate" style="align-self:center"></span></div>
        </form>
      </div>`;

      $('#fback').onclick = load;
      window.scrollTo({ top: 0 });

      /* przywróć i zapisuj szkic */
      const form = $('#pform'), dstate = $('#dstate');
      const dr = getDraft(u.id, formId);
      if(dr && dr.a){
        let n = 0;
        for(const [k, v] of Object.entries(dr.a)){ const el = form.elements[k]; if(el && v){ el.value = v; n++; } }
        if(n) dstate.textContent = 'Przywrócono szkic z ' + fmtT(dr.t);
      }
      let dtimer = null;
      const saveDraft = () => {
        const a = {}; for(const [k, v] of new FormData(form).entries()) a[k] = v;
        if(Object.values(a).some(v => String(v).trim())){ setDraft(u.id, formId, a); dstate.textContent = 'Szkic zapisany'; }
        else { clearDraft(u.id, formId); dstate.textContent = ''; }
      };
      const onEdit = () => { dstate.textContent = 'Zapisywanie szkicu…'; clearTimeout(dtimer); dtimer = setTimeout(saveDraft, 400); };
      form.addEventListener('input', onEdit); form.addEventListener('change', onEdit);

      $('#pform').onsubmit = async ev => {
        ev.preventDefault();
        const answers = {};
        for(const [k, v] of new FormData(ev.target).entries()) answers[k] = v;
        const subBtn = ev.target.querySelector('button[type="submit"]');
        subBtn.disabled = true;
        try {
          const res = await fetch('/api/podania/form/' + encodeURIComponent(formId), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
            body: JSON.stringify({ answers })
          });
          const js = await res.json().catch(() => ({}));
          if(!res.ok){
            if(res.status === 401){ toast('Sesja wygasła – zaloguj się ponownie.'); return load(); }
            if(js.error === 'closed'){ toast('Ten formularz został właśnie zamknięty.'); return load(); }
            if(js.error === 'cooldown'){ toast('Kolejne podanie możesz złożyć za ' + (js.retryAt ? left(js.retryAt) : '24 h') + '.'); return load(); }
            toast(js.error === 'pending' ? 'Masz już oczekujące podanie tego typu!'
              : js.error === 'rate' ? 'Zbyt szybko! Odczekaj chwilę.'
              : 'Wypełnij wszystkie wymagane pola.');
            subBtn.disabled = false;
            return;
          }
          clearTimeout(dtimer); clearDraft(u.id, formId);
          toast('Podanie zostało wysłane pomyślnie!');
          mode = 'mine';
          load();
        } catch(err) {
          toast('Błąd wysyłania podania.');
          subBtn.disabled = false;
        }
      };
    } catch(err) {
      toast('Nie udało się otworzyć formularza.');
    }
  };

  load();
}