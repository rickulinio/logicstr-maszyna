/* Moduły panelu: edycja regulaminu, gracze (podgląd profili członków serwera Discord).
   Dane trzymane w data/*.json (zapis atomowy), kopie regulaminu w data/backups/.
   Każda trasa sprawdza uprawnienie po stronie serwera (need) i zapisuje wpis do logu audytowego. */
const fs = require('fs'), path = require('path'), vm = require('vm');

module.exports = function (app, { need, audit, cfg, root, DATA, discord }) {
  const BACKUPS = path.join(DATA, 'backups');
  const now = () => new Date().toISOString();
  const str = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';
  const bad = (res, code = 'bad_request') => res.status(400).json({ error: code });
  const notFound = res => res.status(404).json({ error: 'not_found' });

  function store(name, init) {
    const file = path.join(DATA, name + '.json');
    let data; try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = init(); }
    const s = { data, save() { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s.data)); fs.renameSync(tmp, file); } };
    return s;
  }

  /* =====================  EDYCJA REGULAMINU  ===================== */
  const content = store('content', () => ({ regulamin: null, regulaminCrime: null, taryfikator: null, updated: null, by: null }));

  /* domyślna treść = to, co jest w js/config.js (wykonywane w odizolowanym vm, bez dostępu do niczego) */
  function siteDefaults() {
    try {
      const src = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
      const c = new vm.Script(src + '\n;CONFIG').runInNewContext({}, { timeout: 1000 });
      return JSON.parse(JSON.stringify({ regulamin: c.regulamin, regulaminCrime: c.regulaminCrime || null, taryfikator: c.taryfikator }));
    } catch (e) { console.error('[panel] js/config.js:', e.message); return null; }
  }
  function current() {
    const d = siteDefaults(), c = content.data;
    return {
      regulamin:      c.regulamin      || (d && d.regulamin),
      regulaminCrime: c.regulaminCrime || (d && d.regulaminCrime) || [],
      taryfikator:    c.taryfikator    || (d && d.taryfikator),
      custom: !!(c.regulamin || c.regulaminCrime || c.taryfikator)
    };
  }
  function backup(tag, snapshot) {
    try {
      fs.mkdirSync(BACKUPS, { recursive: true });
      fs.writeFileSync(path.join(BACKUPS, `content-${Date.now()}-${tag}.json`), JSON.stringify(snapshot, null, 1));
      const files = fs.readdirSync(BACKUPS).filter(f => f.startsWith('content-')).sort();
      files.slice(0, Math.max(0, files.length - 30)).forEach(f => fs.unlink(path.join(BACKUPS, f), () => {}));
    } catch (e) { console.error('[panel] backup:', e.message); }
  }
  function cleanRegulamin(a) {
    if (!Array.isArray(a) || !a.length || a.length > 60) return null;
    const out = []; let n = 0;
    for (const k of a) {
      const name = str(k && k.kategoria, 120);
      if (!name || !Array.isArray(k.punkty) || k.punkty.length > 400) return null;
      const punkty = k.punkty.map(p => str(p, 1500)).filter(Boolean);
      n += punkty.length; out.push({ kategoria: name, punkty });
    }
    return n > 3000 ? null : out;
  }
  function cleanTaryfikator(t, kolumny) {
    if (!t || !Array.isArray(t.kategorie) || !t.kategorie.length || t.kategorie.length > 60) return null;
    const out = [];
    for (const k of t.kategorie) {
      const name = str(k && k.kategoria, 120);
      if (!name || !Array.isArray(k.wiersze) || k.wiersze.length > 400) return null;
      const wiersze = [];
      for (const r of k.wiersze) {
        if (!Array.isArray(r) || r.length !== kolumny.length) return null;
        const row = r.map(c => str(c, 200));
        if (row.some(Boolean)) wiersze.push(row);
      }
      out.push({ kategoria: name, wiersze });
    }
    return { kolumny, kategorie: out };
  }

  /* publiczne: strona pobiera stąd edytowaną wersję (null = użyj js/config.js) */
  app.get('/api/content', (req, res) => res.json({ regulamin: content.data.regulamin, regulaminCrime: content.data.regulaminCrime, taryfikator: content.data.taryfikator }));

  app.get('/api/admin/regulamin', need('regulamin.edit'), (req, res) => {
    const cur = current();
    if (!cur.regulamin || !cur.taryfikator) return res.status(500).json({ error: 'no_defaults' });
    res.json({ ...cur, updated: content.data.updated, by: content.data.by });
  });

  app.put('/api/admin/regulamin', need('regulamin.edit'), (req, res) => {
    const cur = current();
    if (!cur.taryfikator) return res.status(500).json({ error: 'no_defaults' });
    const reg = cleanRegulamin(req.body.regulamin), tar = cleanTaryfikator(req.body.taryfikator, cur.taryfikator.kolumny);
    /* regulamin crime: gdy klient go nie przysłał (starsza wersja panelu), zostaje bez zmian */
    const crime = req.body.regulaminCrime === undefined ? (cur.regulaminCrime && cur.regulaminCrime.length ? cur.regulaminCrime : null) : cleanRegulamin(req.body.regulaminCrime);
    if (!reg || !tar || !crime) return bad(res);
    backup('edit', { regulamin: cur.regulamin, regulaminCrime: cur.regulaminCrime, taryfikator: cur.taryfikator });
    Object.assign(content.data, { regulamin: reg, regulaminCrime: crime, taryfikator: tar, updated: now(), by: req.s.user.name });
    content.save();
    const cnt = a => a.reduce((s, k) => s + k.punkty.length, 0);
    audit('regulamin_edit', req.s.user, `regulamin: ${reg.length} kat. / ${cnt(reg)} pkt; crime: ${crime.length} kat. / ${cnt(crime)} pkt; taryfikator: ${tar.kategorie.length} kat.`);
    res.json({ ok: true, regulamin: reg, regulaminCrime: crime, taryfikator: tar, custom: true, updated: content.data.updated, by: content.data.by });
  });

  app.delete('/api/admin/regulamin', need('regulamin.edit'), (req, res) => {
    const cur = current();
    if (cur.regulamin && cur.taryfikator) backup('reset', { regulamin: cur.regulamin, regulaminCrime: cur.regulaminCrime, taryfikator: cur.taryfikator });
    Object.assign(content.data, { regulamin: null, regulaminCrime: null, taryfikator: null, updated: null, by: null });
    content.save();
    audit('regulamin_reset', req.s.user, 'przywrócono wersję z js/config.js');
    res.json({ ok: true });
  });

  /* =====================  GRACZE (członkowie serwera Discord, bez botów – tylko podgląd profili)  ===================== */
  /* Lista pobierana botem z Discorda (GET /guilds/{id}/members + /roles) i trzymana w pamięci 5 min.
     Wymaga BOT_TOKEN w .env oraz włączonego „Server Members Intent” w Developer Portal. Nic nie jest zapisywane na dysku. */
  const SNOW = /^\d{17,20}$/;
  const CDN = 'https://cdn.discordapp.com';
  const ext = h => h.startsWith('a_') ? 'gif' : 'png';
  const hex = n => n ? '#' + n.toString(16).padStart(6, '0') : '';
  const created = id => new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString();

  const avatarOf = m => m.avatar ? `${CDN}/guilds/${cfg.guildId}/users/${m.user.id}/avatars/${m.avatar}.${ext(m.avatar)}?size=128`
    : m.user.avatar ? `${CDN}/avatars/${m.user.id}/${m.user.avatar}.${ext(m.user.avatar)}?size=128`
    : `${CDN}/embed/avatars/${Number((BigInt(m.user.id) >> 22n) % 6n)}.png`;
  const slim = m => ({ id: m.user.id, username: m.user.username || '', nick: m.nick || '', name: m.nick || m.user.global_name || m.user.username || m.user.id,
    avatar: avatarOf(m), joined: m.joined_at || null, roles: m.roles || [], boost: m.premium_since || null, timeout: m.communication_disabled_until || null });

  async function dfetch(url) {
    if (!discord.token) throw Object.assign(new Error('no_bot'), { code: 'no_bot' });
    for (let i = 0; i < 3; i++) {
      const r = await fetch(discord.api + url, { headers: { Authorization: 'Bot ' + discord.token } });
      if (r.status === 429) {
        const j = await r.json().catch(() => ({}));
        await new Promise(ok => setTimeout(ok, Math.min(5000, (Number(j.retry_after) || 1) * 1000)));
        continue;
      }
      if (!r.ok) throw Object.assign(new Error('discord ' + r.status), { status: r.status });
      return r.json();
    }
    throw Object.assign(new Error('discord 429'), { status: 429 });
  }

  let cache = { at: 0, list: [], map: new Map(), roles: new Map() }, inflight = null;
  function guildMembers(force) {
    const age = Date.now() - cache.at;
    if (cache.at && (age < 300000 && !force || age < 30000)) return Promise.resolve(cache);   // wymuszone odświeżenie nie częściej niż co 30 s
    if (inflight) return inflight;
    inflight = (async () => {
      const roles = new Map((await dfetch(`/guilds/${cfg.guildId}/roles`)).filter(r => r.id !== cfg.guildId).map(r => [r.id, { id: r.id, name: r.name, color: hex(r.color), position: r.position }]));
      const list = []; let after = '0';
      for (let page = 0; page < 200; page++) {
        const batch = await dfetch(`/guilds/${cfg.guildId}/members?limit=1000&after=${after}`);
        for (const m of batch) if (m.user && !m.user.bot) list.push(slim(m));
        if (batch.length < 1000) break;
        after = batch[batch.length - 1].user.id;
      }
      cache = { at: Date.now(), list, map: new Map(list.map(m => [m.id, m])), roles };
      return cache;
    })().finally(() => { inflight = null; });
    return inflight;
  }
  async function findMember(id) {
    const c = await guildMembers(false);
    if (c.map.has(id)) return c.map.get(id);
    try { const m = await dfetch(`/guilds/${cfg.guildId}/members/${id}`); return m.user && !m.user.bot ? slim(m) : null; }   // np. ktoś, kto dołączył przed odświeżeniem listy
    catch (e) { if (e.status === 404) return null; throw e; }
  }
  const ah = fn => (req, res) => fn(req, res).catch(e => {
    if (e.code === 'no_bot') return res.status(503).json({ error: 'no_bot' });
    console.error('[panel] gracze:', e.message); res.status(502).json({ error: 'discord' });
  });
  /* role członka od najwyższej; kolor nazwy = kolor najwyższej roli, która go ma */
  const rolesOf = (m, c) => m.roles.map(id => c.roles.get(id)).filter(Boolean).sort((a, b) => b.position - a.position);
  const brief = (m, c) => { const rs = rolesOf(m, c), col = rs.find(r => r.color);
    return { id: m.id, name: m.name, username: m.username, avatar: m.avatar, joined: m.joined, top: rs[0] ? rs[0].name : '', color: col ? col.color : '' }; };

  app.get('/api/gracze', need('gracze.view'), ah(async (req, res) => {
    const q = str(req.query.q, 80).toLowerCase(), role = SNOW.test(req.query.role) ? req.query.role : '';
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 60));
    const c = await guildMembers(req.query.refresh === '1');
    let rows = c.list;
    if (role) rows = rows.filter(m => m.roles.includes(role));
    if (q) rows = rows.filter(m => [m.name, m.username, m.nick, m.id].some(v => v.toLowerCase().includes(q)));
    rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    const counts = new Map(); for (const m of c.list) for (const r of m.roles) counts.set(r, (counts.get(r) || 0) + 1);
    const roles = [...c.roles.values()].filter(r => counts.has(r.id)).sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.color, count: counts.get(r.id) }));
    res.json({ all: c.list.length, total: rows.length, fetchedAt: new Date(c.at).toISOString(), roles, players: rows.slice(0, limit).map(m => brief(m, c)) });
  }));

  app.get('/api/gracze/:id', need('gracze.view'), ah(async (req, res) => {
    const id = req.params.id;
    if (!SNOW.test(id)) return notFound(res);
    const m = await findMember(id); if (!m) return notFound(res);
    const c = await guildMembers(false);
    let u = null; try { u = await dfetch('/users/' + id); } catch (e) { if (e.code === 'no_bot') throw e; }   // baner jest tylko w pełnym profilu użytkownika
    const rs = rolesOf(m, c), col = rs.find(r => r.color);
    res.json({ player: {
      id, name: m.name, nick: m.nick, username: m.username, display: (u && u.global_name) || '', avatar: m.avatar.replace('size=128', 'size=256'),
      banner: u && u.banner ? `${CDN}/banners/${id}/${u.banner}.${ext(u.banner)}?size=600` : '',
      accent: u && u.accent_color ? hex(u.accent_color) : '', roleColor: col ? col.color : '',
      joined: m.joined, created: created(id), boost: m.boost,
      timeout: m.timeout && new Date(m.timeout) > new Date() ? m.timeout : null,
      roles: rs.map(r => ({ id: r.id, name: r.name, color: r.color }))
    } });
  }));
};