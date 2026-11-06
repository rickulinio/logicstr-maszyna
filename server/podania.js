/* Podania (aplikacje): formularze edytowalne w panelu, składanie przez zalogowanych graczy,
   rozpatrywanie (akceptacja / odrzucenie) i wiadomość o decyzji: DM do gracza + post na kanale.
   Dane: data/applications.json (zapis atomowy), kopie formularzy w data/backups/.
   Uprawnienia: podania.review (rozpatrywanie), podania.manage (edycja formularzy i pytań). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

module.exports = function (app, { need, audit, cfg, DATA, discord, hooks }) {
  const BACKUPS = path.join(DATA, 'backups');
  const SNOW = /^\d{17,20}$/, FID = /^[a-z0-9][a-z0-9-]{1,39}$/, QID = /^[a-z0-9]{2,12}$/;
  const now = () => new Date().toISOString();
  const COOLDOWN = 24 * 3600 * 1000;   // odstęp między podaniami tego samego typu (od momentu złożenia)
  const rid = n => crypto.randomBytes(n).toString('hex');
  const str = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';
  const bad = (res, error = 'bad_request', extra = {}) => res.status(400).json({ error, ...extra });
  const notFound = res => res.status(404).json({ error: 'not_found' });
  const ah = fn => (req, res) => fn(req, res).catch(e => { console.error('[panel] podania:', e.message); res.status(500).json({ error: 'server' }); });

  function store(name, init) {
    const file = path.join(DATA, name + '.json');
    let data; try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = init(); }
    const s = { data, save() { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s.data)); fs.renameSync(tmp, file); } };
    return s;
  }

  /* formularz startowy – tylko przy pierwszym uruchomieniu; potem wszystko edytujesz w panelu (Podania > Formularze i pytania) */
  const defaults = () => ({
    forms: [{
      id: 'administracja', name: 'Podanie do administracji', open: true, notifyChannelId: '',
      desc: 'Chcesz pomagać w prowadzeniu serwera? Wypełnij formularz – odpowiedzi trafią do Zarządu.',
      questions: [
        { id: 'q1', label: 'Imię i wiek (OOC)', type: 'short', required: true },
        { id: 'q2', label: 'Ile godzin dziennie możesz poświęcić na serwer?', type: 'short', required: true },
        { id: 'q3', label: 'Czy znasz regulamin serwera?', type: 'choice', required: true, options: ['Tak, w całości', 'Częściowo', 'Nie'] },
        { id: 'q4', label: 'Opisz swoje doświadczenie w administrowaniu serwerami RP', type: 'long', required: true },
        { id: 'q5', label: 'Dlaczego chcesz dołączyć do administracji?', type: 'long', required: true }
      ]
    }],
    subs: []
  });
  const db = store('applications', defaults);
  if (!Array.isArray(db.data.forms)) db.data.forms = [];
  if (!Array.isArray(db.data.subs)) db.data.subs = [];
  /* migracja: każdy formularz ma własne role rozpatrujące (ID ról Discorda); dotychczasowy opiekun administracji przechodzi do formularza „administracja” */
  let migrated = false;
  for (const f of db.data.forms) if (!Array.isArray(f.reviewRoles)) {
    f.reviewRoles = f.id === 'administracja' && SNOW.test((cfg.roles && cfg.roles.opiekunadm) || '') ? [cfg.roles.opiekunadm] : []; migrated = true;
  }
  for (const f of db.data.forms) {                // migracja: kanał decyzji jest wspólny (config.js), formularz ma kanał powiadomień i zdjęcie
    if ('channelId' in f) { delete f.channelId; migrated = true; }
    if ('image' in f) { delete f.image; migrated = true; }
    if (typeof f.notifyChannelId !== 'string') { f.notifyChannelId = ''; migrated = true; }
  }
  if (migrated) db.save();

  const slug = s => (s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)) || 'podanie';

  /* walidacja i normalizacja formularzy z panelu; null = błąd */
  function cleanForms(a) {
    if (!Array.isArray(a) || a.length > 30) return null;
    const ids = new Set(), out = [];
    for (const f of a) {
      if (!f || typeof f !== 'object') return null;
      const name = str(f.name, 80); if (!name) return null;
      let id = typeof f.id === 'string' && FID.test(f.id) ? f.id : slug(name);
      if (id.length < 2) id = 'podanie';
      while (ids.has(id)) id = id.slice(0, 33) + '-' + rid(2);
      ids.add(id);
      if (!Array.isArray(f.questions) || !f.questions.length || f.questions.length > 40) return null;
      const qids = new Set(), questions = [];
      for (const q of f.questions) {
        const label = str(q && q.label, 300); if (!label) return null;
        const type = ['short', 'long', 'choice'].includes(q.type) ? q.type : 'short';
        let qid = typeof q.id === 'string' && QID.test(q.id) ? q.id : rid(3);
        while (qids.has(qid)) qid = rid(3);
        qids.add(qid);
        const o = { id: qid, label, type, required: !!q.required };
        if (type === 'choice') {
          const options = Array.isArray(q.options) ? [...new Set(q.options.map(x => str(x, 100)).filter(Boolean))].slice(0, 20) : [];
          if (options.length < 2) return null;
          o.options = options;
        }
        questions.push(o);
      }
      const icon = typeof f.icon === 'string' ? f.icon.trim() : '';
      if (icon && !/^(\/uploads\/[a-z0-9-]{4,60}\.(png|jpg|webp)|https:\/\/[^\s"'<>]{4,290})$/i.test(icon)) return null;
      const notifyChannelId = typeof f.notifyChannelId === 'string' ? f.notifyChannelId.trim() : '';
      if (notifyChannelId && !SNOW.test(notifyChannelId)) return null;
      const prev = db.data.forms.find(x => x.id === id);          // „otwarte/zamknięte” ustawiają tylko rozpatrujący – edycja formularza tego nie zmienia
      const reviewRoles = Array.isArray(f.reviewRoles) ? [...new Set(f.reviewRoles.filter(x => typeof x === 'string' && SNOW.test(x.trim())).map(x => x.trim()))].slice(0, 10) : [];
      out.push({ id, name, desc: str(f.desc, 600), icon, open: prev ? !!prev.open : false, notifyChannelId, reviewRoles, questions });
    }
    return out;
  }
  function backup(forms) {
    try {
      fs.mkdirSync(BACKUPS, { recursive: true });
      fs.writeFileSync(path.join(BACKUPS, `podania-${Date.now()}.json`), JSON.stringify(forms, null, 1));
      const files = fs.readdirSync(BACKUPS).filter(f => f.startsWith('podania-')).sort();
      files.slice(0, Math.max(0, files.length - 30)).forEach(f => fs.unlink(path.join(BACKUPS, f), () => {}));
    } catch (e) { console.error('[panel] backup podań:', e.message); }
  }

  /* ====================  PUBLICZNE (gracz)  ==================== */
  const mineView = s => ({ id: s.id, formName: s.formName, status: s.status, createdAt: s.createdAt, decidedAt: s.decidedAt || null, reason: s.status === 'pending' ? '' : (s.reason || '') });

  /* kiedy gracz może znów złożyć podanie tego typu (ISO) albo null, jeśli już może */
  const retryAt = (uid, formId) => {
    let last = 0;
    for (const s of db.data.subs) if (s.userId === uid && s.formId === formId) last = Math.max(last, Date.parse(s.createdAt) || 0);
    return last && Date.now() - last < COOLDOWN ? new Date(last + COOLDOWN).toISOString() : null;
  };

  app.get('/api/podania', (req, res) => {
    const forms = db.data.forms.map(f => ({ id: f.id, name: f.name, desc: f.desc, icon: f.icon || '', open: !!f.open, count: f.questions.length,
      retryAt: req.s && f.open ? retryAt(req.s.user.id, f.id) : null }));
    const mine = req.s ? db.data.subs.filter(s => s.userId === req.s.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20).map(mineView) : null;
    res.json({ forms, mine });
  });

  /* dane Discorda brane z sesji (serwer), nigdy z formularza – gracz nie może ich podmienić */
  const discordOf = u => ({ id: u.id, name: u.name, username: u.username || '', nick: u.nick || '', avatarUrl: u.avatarUrl || '' });
  const discordLine = d => `${d.nick || d.name}${d.username ? ' (@' + d.username + ')' : ''} · ID: ${d.id}`;

  /* szczegóły własnego podania (tylko właściciel) */
  app.get('/api/podania/mine/:id', (req, res) => {
    if (!req.s) return res.status(401).json({ error: 'unauthorized' });
    const s = db.data.subs.find(x => x.id === req.params.id && x.userId === req.s.user.id);
    if (!s) return notFound(res);
    res.json({ sub: { id: s.id, formName: s.formName, status: s.status, createdAt: s.createdAt, decidedAt: s.decidedAt || null,
      reason: s.status === 'pending' ? '' : (s.reason || ''), answers: s.answers } });
  });

  app.get('/api/podania/form/:id', (req, res) => {
    if (!req.s) return res.status(401).json({ error: 'unauthorized' });     // formularz tylko dla zalogowanych
    const f = db.data.forms.find(x => x.id === req.params.id);
    if (!f) return notFound(res);
    if (!f.open) return res.status(403).json({ error: 'closed' });
    const wait = retryAt(req.s.user.id, f.id);
    if (wait) return res.status(429).json({ error: 'cooldown', retryAt: wait });
    const d = discordOf(req.s.user);
    res.json({ form: { id: f.id, name: f.name, desc: f.desc, questions: f.questions }, user: d, discord: discordLine(d) });
  });

  const lastSubmit = new Map();
  app.post('/api/podania/form/:id', (req, res) => {
    if (!req.s) return res.status(401).json({ error: 'unauthorized' });
    const f = db.data.forms.find(x => x.id === req.params.id);
    if (!f) return notFound(res);
    if (!f.open) return res.status(403).json({ error: 'closed' });
    const uid = req.s.user.id;
    if (Date.now() - (lastSubmit.get(uid) || 0) < 5000) return res.status(429).json({ error: 'rate' });
    if (db.data.subs.some(s => s.userId === uid && s.formId === f.id && s.status === 'pending')) return res.status(409).json({ error: 'pending' });
    const wait = retryAt(uid, f.id);
    if (wait) return res.status(429).json({ error: 'cooldown', retryAt: wait });
    const given = req.body && req.body.answers;
    if (!given || typeof given !== 'object' || Array.isArray(given)) return bad(res);
    const answers = [];
    for (const q of f.questions) {
      const a = str(given[q.id], q.type === 'long' ? 2000 : q.type === 'short' ? 300 : 100);
      if (!a && q.required) return bad(res, 'missing', { field: q.id });
      if (a && q.type === 'choice' && !q.options.includes(a)) return bad(res, 'bad_request', { field: q.id });
      answers.push({ q: q.label, a });
    }
    lastSubmit.set(uid, Date.now());
    const dc = discordOf(req.s.user);
    answers.unshift({ q: 'Discord', a: discordLine(dc) });                    // pierwsza rubryka każdego podania
    const sub = { id: rid(5), formId: f.id, formName: f.name, userId: uid, userName: dc.nick || dc.name, avatarUrl: dc.avatarUrl,
      discord: dc, answers, status: 'pending', createdAt: now() };
    db.data.subs.push(sub); db.save();
    audit('podanie_submit', req.s.user, `${f.name} #${sub.id}`);
    notifyNew(sub, f).catch(e => { console.error('[panel] powiadomienie o podaniu:', e.message); audit('podanie_notify_fail', req.s.user, `#${sub.id} nowe podanie: ${e.message}`); });
    res.json({ ok: true, id: sub.id });
  });

  /* ====================  ROZPATRYWANIE (panel)  ==================== */
  /* kto rozpatruje: globalnie (uprawnienie podania.review) albo tylko podania z formularzy, w których ma jedną z „ról rozpatrujących” */
  const globalRev = req => req.perms.includes('podania.review');
  const canReview = (req, f) => globalRev(req) || !!(f && (f.reviewRoles || []).some(r => req.roleIds.includes(r)));
  const formOf = s => db.data.forms.find(f => f.id === s.formId);
  hooks.perms.push(req => {                      // dynamiczne uprawnienia: podania.reviewer (ma co rozpatrywać), podania.access (widzi moduł), panel.access
    if (!req.s) return;
    const add = p => { if (!req.perms.includes(p)) req.perms.push(p); };
    const rev = globalRev(req) || db.data.forms.some(f => (f.reviewRoles || []).some(r => req.roleIds.includes(r)));
    if (rev) add('podania.reviewer');
    if (rev || req.perms.includes('podania.manage')) { add('podania.access'); add('panel.access'); }
    req.reviewAll = globalRev(req);
    req.reviewForms = db.data.forms.filter(f => canReview(req, f)).map(f => ({ id: f.id, name: f.name }));
    Object.defineProperty(req, 'pendingReview', { get: () => db.data.subs.filter(s => s.status === 'pending' && canReview(req, formOf(s))
      && (s.userId !== req.s.user.id || req.perms.includes('roles.edit'))).length });
  });
  const needReviewer = (req, res, next) => !req.s ? res.status(401).json({ error: 'unauthorized' })
    : !req.perms.includes('podania.reviewer') ? (audit('forbidden', req.s.user, 'podania.reviewer ' + req.originalUrl), res.status(403).json({ error: 'forbidden' }))
    : next();
  /* formularze/role/kanały do edycji: pełny dostęp (podania.manage) albo ograniczony (rozpatrujący tylko swoje formularze) */
  const needFormsAccess = (req, res, next) => !req.s ? res.status(401).json({ error: 'unauthorized' })
    : !(req.perms.includes('podania.manage') || req.perms.includes('podania.reviewer')) ? (audit('forbidden', req.s.user, 'podania.forms ' + req.originalUrl), res.status(403).json({ error: 'forbidden' }))
    : next();
  const row = s => ({ id: s.id, formId: s.formId, formName: s.formName, userId: s.userId, userName: s.userName, status: s.status,
    createdAt: s.createdAt, decidedAt: s.decidedAt || null, decidedByName: s.decidedByName || '' });

  app.get('/api/admin/podania', needReviewer, (req, res) => {
    const status = ['pending', 'accepted', 'rejected'].includes(req.query.status) ? req.query.status : '';
    const form = str(req.query.form, 40);
    const counts = { pending: 0, accepted: 0, rejected: 0 };
    const vis = db.data.subs.filter(s => canReview(req, formOf(s)));
    for (const s of vis) counts[s.status]++;
    let rows = vis.filter(s => (!status || s.status === status) && (!form || s.formId === form));
    rows = rows.slice().sort((a, b) => status === 'pending' ? a.createdAt.localeCompare(b.createdAt) : (b.decidedAt || b.createdAt).localeCompare(a.decidedAt || a.createdAt));
    res.json({ counts, forms: db.data.forms.filter(f => canReview(req, f)).map(f => ({ id: f.id, name: f.name, open: !!f.open })), rows: rows.slice(0, 200).map(row) });
  });

  app.get('/api/admin/podania/:id', needReviewer, (req, res) => {
    const s = db.data.subs.find(x => x.id === req.params.id);
    if (!s || !canReview(req, formOf(s))) return notFound(res);
    res.json({ sub: s });
  });

  /* otwieranie i zamykanie przyjmowania podań – tylko osoby, które rozpatrują dany formularz (lub zarząd) */
  app.post('/api/admin/podania-forms/:id/open', needReviewer, (req, res) => {
    const f = db.data.forms.find(x => x.id === req.params.id);
    if (!f || !canReview(req, f)) return notFound(res);
    const open = !!(req.body && req.body.open);
    if (!!f.open !== open) { f.open = open; db.save(); audit(open ? 'podania_open' : 'podania_close', req.s.user, f.name); }
    res.json({ ok: true, open: !!f.open });
  });

  /* --- wiadomości na Discordzie (bot) --- */
  async function dpost(url, body) {
    if (!discord.token) throw new Error('no_bot');
    for (let i = 0; i < 3; i++) {
      const r = await fetch(discord.api + url, { method: 'POST', headers: { Authorization: 'Bot ' + discord.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(ok => setTimeout(ok, Math.min(5000, (Number(j.retry_after) || 1) * 1000))); continue; }
      if (!r.ok) throw new Error('discord ' + r.status);
      return r.json();
    }
    throw new Error('discord 429');
  }
  const embed = s => {
    const ok = s.status === 'accepted';
    return {
      title: ok ? '✅ Podanie zaakceptowane' : '❌ Podanie odrzucone',
      description: `Podanie: **${s.formName}**` + (s.reason ? `\n\n**${ok ? 'Wiadomość od administracji' : 'Powód'}:**\n${s.reason}` : ''),
      color: ok ? 0x57F287 : 0xED4245,
      fields: [{ name: 'Rozpatrzył(a)', value: s.decidedByName || '–', inline: true }],
      footer: { text: cfg.name || 'Project Logic Roleplay' }, timestamp: s.decidedAt
    };
  };
  const sendDM = async s => {
    const ch = await dpost('/users/@me/channels', { recipient_id: s.userId });
    await dpost(`/channels/${ch.id}/messages`, { embeds: [embed(s)] });
  };
  const sendChannel = (s, channelId) => dpost(`/channels/${channelId}/messages`, {
    content: `<@${s.userId}>`, embeds: [embed(s)], allowed_mentions: { users: [s.userId] }
  });

  /* nowe podanie: wiadomość na kanale ustawionym w formularzu, z oznaczeniem ról rozpatrujących */
  const panelUrl = () => { try { return new URL(process.env.REDIRECT_URI).origin + '/panel'; } catch { return ''; } };
  async function notifyNew(sub, f) {
    if (!f || !SNOW.test(f.notifyChannelId || '')) return;
    const roles = (f.reviewRoles || []).filter(r => SNOW.test(r)), url = panelUrl();
    await dpost(`/channels/${f.notifyChannelId}/messages`, {
      content: roles.map(r => `<@&${r}>`).join(' ') || undefined,
      embeds: [{
        title: '📥 Nowe podanie do rozpatrzenia',
        description: `Formularz: **${f.name}**\nGracz: <@${sub.userId}> (${sub.userName})` + (url ? `\n\n[Otwórz panel](${url})` : ''),
        color: 0x5B9DFF, footer: { text: cfg.name || 'Project Logic Roleplay' }, timestamp: sub.createdAt
      }],
      allowed_mentions: { roles }
    });
  }

  app.post('/api/admin/podania/:id/decision', needReviewer, ah(async (req, res) => {
    const s = db.data.subs.find(x => x.id === req.params.id);
    if (!s || !canReview(req, formOf(s))) return notFound(res);
    if (s.status !== 'pending') return res.status(409).json({ error: 'decided' });
    const d = req.body && req.body.decision;
    if (d !== 'accepted' && d !== 'rejected') return bad(res);
    if (s.userId === req.s.user.id && !req.perms.includes('roles.edit')) return res.status(403).json({ error: 'self' });   // własnego podania nie rozpatrujesz (poza właścicielami)

    /* decyzja zapisywana synchronicznie, zanim ruszy wysyłka – dwóch rozpatrujących naraz nie nadpisze się nawzajem */
    Object.assign(s, { status: d, reason: str(req.body.reason, 1000), decidedAt: now(), decidedBy: req.s.user.id, decidedByName: req.s.user.name, dm: 'pending', ch: 'pending' });
    db.save();
    audit(d === 'accepted' ? 'podanie_accept' : 'podanie_reject', req.s.user, `${s.formName} #${s.id} – ${s.userName}`);

    const channelId = (cfg.applications && cfg.applications.decisionChannelId) || '';   // jeden wspólny kanał decyzji (server/config.js)
    const [dm, ch] = await Promise.all([
      sendDM(s).then(() => 'ok', e => (console.error('[panel] podanie DM:', e.message), 'failed')),
      SNOW.test(channelId) ? sendChannel(s, channelId).then(() => 'ok', e => (console.error('[panel] podanie kanał:', e.message), 'failed')) : Promise.resolve('skipped')
    ]);
    s.dm = dm; s.ch = ch; db.save();
    if (dm !== 'ok' || ch === 'failed') audit('podanie_notify_fail', req.s.user, `#${s.id} dm:${dm} kanał:${ch}`);
    res.json({ ok: true, dm, channel: ch });
  }));

  /* ====================  EDYCJA FORMULARZY, PYTAŃ I RÓL  ==================== */
  /* role serwera Discord do wyboru jako „rola rozpatrująca” (bot; bez bota – wpisujesz ID ręcznie) */
  let rolesCache = { at: 0, list: [] };
  async function guildRoles() {
    if (!discord.token) throw Object.assign(new Error('no_bot'), { code: 'no_bot' });
    if (Date.now() - rolesCache.at < 60000) return rolesCache.list;
    const r = await fetch(`${discord.api}/guilds/${cfg.guildId}/roles`, { headers: { Authorization: 'Bot ' + discord.token } });
    if (!r.ok) throw new Error('discord ' + r.status);
    const list = (await r.json()).filter(x => x.id !== cfg.guildId && !x.managed).sort((a, b) => b.position - a.position)
      .map(x => ({ id: x.id, name: x.name, color: x.color ? '#' + x.color.toString(16).padStart(6, '0') : '' }));
    rolesCache = { at: Date.now(), list };
    return list;
  }
  app.get('/api/admin/podania-roles', needFormsAccess, async (req, res) => {
    try { res.json({ bot: true, roles: await guildRoles() }); }
    catch (e) {
      if (e.code === 'no_bot') return res.json({ bot: false, roles: [] });
      console.error('[panel] role serwera:', e.message); res.status(502).json({ error: 'discord' });
    }
  });
  /* tworzy nową (pustą, bez uprawnień) rolę na serwerze Discord – bot potrzebuje uprawnienia „Zarządzanie rolami” i roli wyżej w hierarchii */
  app.post('/api/admin/podania-roles', need('podania.manage'), ah(async (req, res) => {
    const name = str(req.body && req.body.name, 60);
    if (!name) return bad(res);
    let role;
    try { role = await dpost(`/guilds/${cfg.guildId}/roles`, { name, permissions: '0', mentionable: false }); }
    catch (e) { console.error('[panel] tworzenie roli:', e.message); return res.status(502).json({ error: e.message === 'no_bot' ? 'no_bot' : 'discord' }); }
    rolesCache.at = 0;
    audit('podania_role_create', req.s.user, `${name} (${role.id})`);
    res.json({ role: { id: role.id, name: role.name, color: '' } });
  }));

  /* kanały tekstowe serwera do wyboru jako „kanał powiadomień o nowych podaniach” */
  let chCache = { at: 0, list: [] };
  async function guildChannels() {
    if (!discord.token) throw Object.assign(new Error('no_bot'), { code: 'no_bot' });
    if (Date.now() - chCache.at < 60000) return chCache.list;
    const r = await fetch(`${discord.api}/guilds/${cfg.guildId}/channels`, { headers: { Authorization: 'Bot ' + discord.token } });
    if (!r.ok) throw new Error('discord ' + r.status);
    const list = (await r.json()).filter(c => c.type === 0 || c.type === 5).sort((a, b) => a.position - b.position).map(c => ({ id: c.id, name: c.name }));
    chCache = { at: Date.now(), list };
    return list;
  }
  app.get('/api/admin/podania-channels', needFormsAccess, async (req, res) => {
    try { res.json({ bot: true, channels: await guildChannels() }); }
    catch (e) {
      if (e.code === 'no_bot') return res.json({ bot: false, channels: [] });
      console.error('[panel] kanały serwera:', e.message); res.status(502).json({ error: 'discord' });
    }
  });

  app.get('/api/admin/podania-forms', needFormsAccess, (req, res) => {
    const full = req.perms.includes('podania.manage');
    res.json({ limited: !full, forms: full ? db.data.forms : db.data.forms.filter(f => canReview(req, f)) });
  });

  /* rozpatrujący edytuje SWÓJ formularz: tylko pytania (bez nazwy, opisu, kanału powiadomień, ról, usuwania) */
  app.put('/api/admin/podania-forms/:id', needReviewer, (req, res) => {
    const f = db.data.forms.find(x => x.id === req.params.id);
    if (!f || !canReview(req, f)) return notFound(res);
    const b = req.body || {};
    const c = cleanForms([{ ...f, questions: b.questions }]);
    if (!c) return bad(res);
    backup(db.data.forms);
    f.questions = c[0].questions;
    db.save();
    audit('podania_edit', req.s.user, `${f.name}: pytań ${f.questions.length} (rozpatrujący)`);
    res.json({ ok: true, form: f });
  });


  /* wgrywanie ikony podania: klient zmniejsza obrazek do 256 px (PNG/JPEG/WebP w base64); serwer sprawdza typ po nagłówku pliku */
  const UP = path.join(DATA, 'uploads');
  app.post('/api/admin/podania-image', need('podania.manage'), ah(async (req, res) => {
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(req.body && req.body.data || '');
    if (!m) return bad(res);
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 32 || buf.length > 600 * 1024) return bad(res, 'too_big');
    const ext = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? 'png'
      : buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpg'
      : buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null;
    if (!ext) return bad(res);
    fs.mkdirSync(UP, { recursive: true });
    const name = 'podanie-' + rid(8) + '.' + ext;
    fs.writeFileSync(path.join(UP, name), buf);
    audit('podania_image', req.s.user, name);
    res.json({ ok: true, url: '/uploads/' + name });
  }));

  app.put('/api/admin/podania-forms', need('podania.manage'), (req, res) => {
    const forms = cleanForms(req.body && req.body.forms);
    if (!forms) return bad(res);
    backup(db.data.forms);
    db.data.forms = forms; db.save();
    audit('podania_edit', req.s.user, `formularze: ${forms.length}; pytań: ${forms.reduce((n, f) => n + f.questions.length, 0)}`);
    res.json({ ok: true, forms });
  });
};