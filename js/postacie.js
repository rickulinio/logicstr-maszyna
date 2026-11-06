/* POSTACIE – frontend (lista postaci z bazy, właściciel z Discorda, karta postaci ze zdjęciem) */
function postacieView(){
  return `<div class="ph1"><div class="eyebrow">Mieszkańcy</div><h1>Postacie</h1><div class="pmeta" id="pmeta"></div></div>
  <div id="postacie-content"><div class="empty">Ładowanie postaci…</div></div>`;
}

function initPostacie(){
  const box = $('#postacie-content'); if(!box) return;
  const meta = t => { const m = $('#pmeta'); if(m) m.textContent = t || ''; };
  let list = [], q = '', job = '', totals = null;
  const big = v => { try { return BigInt(v).toLocaleString('pl-PL'); } catch(e){ return '–'; } };
  const money = v => big(v) + ' $';
  const durBig = v => { try { const m = BigInt(v), h = m / 60n; return h ? `${h.toLocaleString('pl-PL')} h ${m % 60n} min` : `${m} min`; } catch(e){ return '–'; } };
  const compact = v => { const n = Number(v); return n >= 1e9 ? new Intl.NumberFormat('pl-PL', { notation:'compact', maximumFractionDigits:2 }).format(n) : null; };
  const ICO = {
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4c2 .7 3.5 2.5 3.5 5.6"/>',
    pulse:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    cash:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v.01M18 14.5v.01"/>',
    bank:'<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    hour:'<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>'
  };
  let statsDone = false;
  const statsHTML = () => {
    if(!totals) return '';
    const n = BigInt(totals.characters || 0), avg = n ? String(BigInt(totals.playtime) / n) : '0';
    const tiles = [
      { l:'Postaci',           v:totals.characters, k:'int',   c:'teal',   i:'users' },
      { l:'Aktywne 24 h',      v:totals.active24 || 0, k:'int', c:'coral', i:'pulse', live:true },
      { l:'Gotówka łącznie',   v:totals.cash, k:'money', c:'amber',  i:'cash', wide:true },
      { l:'Pieniądze w banku', v:totals.bank, k:'money', c:'mint',   i:'bank', wide:true },
      { l:'Łączny czas gry',   v:totals.playtime, k:'dur', c:'violet', i:'clock' },
      { l:'Średnio na postać', v:avg, k:'dur', c:'teal', i:'hour' }
    ];
    return `<div class="chstats${statsDone ? ' still' : ''}">` + tiles.map((t, i) => {
      const cp = t.k === 'money' ? compact(t.v) : null;
      return `<div class="card nohover chs c-${t.c}${t.wide ? ' wide' : ''}" style="--i:${i}">
        <svg class="chi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[t.i]}</svg>
        <small>${t.live ? '<i class="chlive"></i>' : ''}${esc(t.l)}</small>
        <b data-v="${esc(t.v)}" data-k="${t.k}"${cp ? ' data-cp="1"' : ''}>${esc(fmtStat(t.k, t.v, !!cp))}</b>
        ${cp ? `<em>${esc(money(t.v))}</em>` : ''}</div>`;
    }).join('') + `</div>`;
  };
  function fmtStat(k, v, cp){
    if(k === 'money'){ if(cp){ const c = compact(v); if(c) return c + ' $'; } return money(v); }
    return k === 'dur' ? durBig(v) : big(v);
  }
  /* licznik: liczby „dobijają” do wartości (z zachowaniem dokładnego wyniku na końcu) */
  const animateStats = () => {
    const els = box.querySelectorAll('.chstats b[data-v]');
    if(statsDone || matchMedia('(prefers-reduced-motion: reduce)').matches){ statsDone = true; return; }
    statsDone = true;
    els.forEach((el, i) => {
      const v = el.dataset.v, k = el.dataset.k, cp = !!el.dataset.cp, target = Number(v), t0 = performance.now() + 180 + i * 90, D = 1300;
      if(!(target > 0)) return;
      const step = t => {
        if(!el.isConnected) return;
        const p = Math.max(0, Math.min((t - t0) / D, 1)), e = 1 - Math.pow(1 - p, 4);
        el.textContent = p >= 1 ? fmtStat(k, v, cp) : fmtStat(k, String(Math.floor(target * e)), cp);
        if(p < 1) requestAnimationFrame(step);
      };
      el.textContent = fmtStat(k, '0', false);
      requestAnimationFrame(step);
    });
  };

  const fullName = c => ((c.firstname + ' ' + c.lastname).trim()) || ('Postać #' + c.id);
  const JOBS = { unemployed:'Bezrobotny', police:'LSPD', ambulance:'EMS' };
  const jobName = j => j ? (JOBS[String(j).toLowerCase()] || j.charAt(0).toUpperCase() + j.slice(1)) : '–';
  const sexName = s => s === 'm' ? 'Mężczyzna' : s === 'f' ? 'Kobieta' : (s || '–');
  const dur = m => { m = Number(m) || 0; const h = Math.floor(m / 60); return h ? `${h} h ${m % 60} min` : `${m} min`; };
  const ownerName = o => !o ? 'Brak Discorda' : (o.name || ('ID ' + o.id));

  const photo = c => c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">`
    : (c.owner && c.owner.avatarUrl) ? `<img src="${esc(c.owner.avatarUrl)}" alt="" loading="lazy">`
    : `<span>${esc(fullName(c)[0].toUpperCase())}</span>`;

  const card = c => `<button type="button" class="chcard" data-id="${c.id}">
    <span class="chph">${photo(c)}</span>
    <span class="chb"><b>${esc(fullName(c))}</b>
      <small>${esc(jobName(c.job))}${c.grade ? ' · stopień ' + esc(c.grade) : ''}${(c.vehicles||[]).length ? ' · ' + c.vehicles.length + ' poj.' : ''}</small>
      <span class="chown">${c.owner && c.owner.avatarUrl ? `<img src="${esc(c.owner.avatarUrl)}" alt="">` : ''}<i>${esc(ownerName(c.owner))}</i></span>
    </span></button>`;

  const drawList = () => {
    const el = $('#chlist'); if(!el) return;
    const ql = q.toLowerCase();
    const items = list.filter(c => (!job || c.job === job) && (!ql ||
      [fullName(c), c.ssn, c.job, c.phone, c.steamName, (c.vehicles||[]).map(v => v.plate + ' ' + (v.model||'')).join(' '), c.owner && c.owner.name, c.owner && c.owner.username, c.owner && c.owner.id].join(' ').toLowerCase().includes(ql)));
    meta(`${items.length} z ${list.length}`);
    el.innerHTML = items.length ? items.map(card).join('') : `<div class="empty">Brak postaci pasujących do wyszukiwania.</div>`;
    el.querySelectorAll('[data-id]').forEach(b => { b.onclick = () => openChar(Number(b.dataset.id)); });
  };

  const render = () => {
    const jobs = [...new Set(list.map(c => c.job))].sort();
    box.innerHTML = `${statsHTML()}<div class="ptool"><label class="psearch"><svg class="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="pin" id="chq" type="search" placeholder="Szukaj: imię, SSN, Discord, rejestracja…" value="${esc(q)}" autocomplete="off"></label>
      <select class="pin grow" id="chjob"><option value="">Wszystkie prace</option>${jobs.map(j => `<option value="${esc(j)}" ${j === job ? 'selected' : ''}>${esc(jobName(j))}</option>`).join('')}</select></div>
      <div class="chgrid" id="chlist"></div>`;
    $('#chq').oninput = e => { q = e.target.value.trim(); drawList(); };
    $('#chjob').onchange = e => { job = e.target.value; drawList(); };
    drawList();
    animateStats();
  };

  const VT = { car:'Samochód', boat:'Łódź', bike:'Motocykl', aircraft:'Powietrzny', helicopter:'Helikopter', plane:'Samolot' };
  const VS = { garage:['W garażu','t-ok'], out:['Poza garażem','t-warn'], impound:['Na parkingu policyjnym','t-ban'] };
  const bar = (l, v) => `<span class="vbar" title="${esc(l)} ${v}%"><small>${esc(l)}</small><i><u style="width:${v}%" class="${v < 30 ? 'lo' : v < 60 ? 'mid' : ''}"></u></i><em>${v}%</em></span>`;
  const vehCard = v => { const st = VS[v.status] || VS.out;
    return `<div class="chveh"><div class="vh"><div class="vt"><b>${v.favorite ? '★ ' : ''}${esc(v.model || 'Nieznany model')}</b>${v.nickname ? `<small>„${esc(v.nickname)}”</small>` : ''}</div><span class="chip mono">${esc(v.plate)}</span></div>
      <div class="chips"><span class="tag ${st[1]}">${st[0]}</span><span class="tag t-inne">${esc(VT[v.type] || v.type)}</span>${v.financed ? '<span class="tag t-warn">Na kredyt</span>' : ''}${v.job ? `<span class="tag t-kick">Służbowy: ${esc(v.job)}</span>` : ''}</div>
      <div class="vm"><span><small>Przebieg</small>${esc(v.mileage)} km</span></div>
      <div class="vbars">${bar('Paliwo', v.fuel)}${bar('Silnik', v.engine)}${bar('Karoseria', v.body)}</div></div>`; };
  const vehSection = c => { const vs = c.vehicles || [];
    return `<div class="chsec"><h4>Pojazdy (${vs.length})</h4>${vs.length ? `<div class="chvg">${vs.map(vehCard).join('')}</div>` : '<span class="muted">Postać nie posiada pojazdów.</span>'}</div>`; };

  const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v === null || v === undefined || v === '' ? '–' : esc(v)}</dd></div>`;
  const STAT = { strenght:'Siła', driving:'Jazda', condition:'Kondycja', flying:'Latanie', shooting:'Strzelanie' };

  const openChar = id => {
    const c = list.find(x => x.id === id); if(!c) return;
    const o = c.owner;
    meta('');
    box.innerHTML = `<div class="card nohover c-teal" style="max-width:860px;margin:32px auto 0">
      <div class="frow"><button type="button" class="btn ghost sm" id="chback">← Wróć do listy</button></div>
      <div class="chhead"><div class="chbig">${photo(c)}</div>
        <div><h2>${esc(fullName(c))}</h2>
          <div class="chips"><span class="tag">${esc(jobName(c.job))}${c.grade ? ' · ' + esc(c.grade) : ''}</span>${c.injail > 0 ? `<span class="tag t-ban">W więzieniu: ${esc(c.injail)} min</span>` : ''}</div></div></div>
      <div class="ucard" style="margin:18px 0">
        <div class="av">${o && o.avatarUrl ? `<img src="${esc(o.avatarUrl)}" alt="">` : `<span>?</span>`}</div>
        <div class="un"><b>${esc(ownerName(o))}</b><small>${o ? (o.username ? '@' + esc(o.username) + ' · ' : '') + 'ID ' + esc(o.id) : 'Postać nie ma przypisanego konta Discord'}</small></div>
        <span class="tag">Właściciel</span></div>
      <div class="chsec"><h4>Dane postaci</h4><dl>${row('SSN', c.ssn)}${row('Data urodzenia', c.dob)}${row('Płeć', sexName(c.sex))}${row('Wzrost', c.height ? c.height + ' cm' : '')}${row('Narodowość', c.nationality)}${row('Grupa krwi', c.blood)}</dl></div>
      <div class="chsec"><h4>Praca</h4><dl${c.badge ? '' : ' class="ctr"'}>${row('Praca', jobName(c.job))}${row('Stopień', c.grade)}${c.badge ? row('Odznaka', c.badge) : ''}</dl></div>
      <div class="chsec"><h4>Aktywność</h4><dl>${row('Utworzono', c.createdAt ? fmtT(c.createdAt) : '')}${row('Ostatnio widziany', c.lastSeen ? fmtT(c.lastSeen) : '')}${row('Czas gry', dur(c.playtime))}</dl></div>
      <div class="chsec"><h4>Kontakt i identyfikatory</h4><dl>${row('Telefon', c.phone)}${row('Nick Steam', c.steamName)}</dl></div>
      ${c.stats ? `<div class="chsec"><h4>Statystyki</h4><dl>${Object.entries(c.stats).map(([k, v]) => row(STAT[k] || k, v)).join('')}</dl></div>` : ''}
      ${vehSection(c)}
    </div>`;
    $('#chback').onclick = render; window.scrollTo({ top: 0 });
  };

  (async () => {
    try{
      const r = await fetch('/api/postacie', { credentials: 'same-origin' });
      if(r.status === 401){ box.innerHTML = loginCard(new URLSearchParams(location.search).get('err')); return; }
      if(r.status === 403){ box.innerHTML = `<div class="empty">Nie masz uprawnień do przeglądania postaci.</div>`; return; }
      if(!r.ok) throw new Error();
      const data = await r.json();
      list = data.characters || []; totals = data.totals || null;
      render();
    }catch(e){ box.innerHTML = `<div class="empty">Nie udało się załadować postaci. Spróbuj ponownie za chwilę.</div>`; }
  })();
}