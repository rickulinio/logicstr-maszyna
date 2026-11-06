const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch {}

const cfg     = require(path.join(__dirname, 'config'));

const {
  DISCORD_CLIENT_ID: CID, DISCORD_CLIENT_SECRET: SECRET, REDIRECT_URI, BOT_TOKEN,
  PORT = 10268, SESSION_HOURS = 12, NODE_ENV
} = process.env;
const PROD = NODE_ENV === 'production';
const DISCORD = process.env.DISCORD_API || 'https://discord.com/api/v10';
const TTL = Number(SESSION_HOURS) * 3600;

if (!BOT_TOKEN) console.warn('[panel] Brak BOT_TOKEN w .env – moduł „Gracze” (lista członków serwera) nie będzie działał.');
if (!CID || !SECRET || !REDIRECT_URI) console.warn('[panel] Uzupełnij DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET / REDIRECT_URI w .env');
if (/WPISZ/.test(cfg.guildId) || Object.values(cfg.roles).some(id => /WPISZ/.test(id))) console.warn('[panel] Uzupełnij guildId i ID ról w server/config.js');

const app = express();
app.disable('x-powered-by');
if (PROD) app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});

/* ---------- cookies i sesje (w pamięci – restart serwera = wylogowanie) ---------- */
const safeDecode = v => { try { return decodeURIComponent(v); } catch { return ''; } };
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim()).filter(Boolean)
  .map(c => { const i = c.indexOf('='); return i < 0 ? [c, ''] : [c.slice(0, i), safeDecode(c.slice(i + 1))]; }));
const setCookie = (res, name, val, maxAge) =>
  res.append('Set-Cookie', `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${PROD ? '; Secure' : ''}`);
const sessions = new Map();
setInterval(() => { const n = Date.now(); for (const [k, s] of sessions) if (s.exp < n) sessions.delete(k); }, 600000).unref();

/* ---------- log audytowy (data/audit.log, JSON w linijkach) ---------- */
const DATA = path.join(__dirname, 'data');
const LOG = path.join(DATA, 'audit.log');
fs.mkdirSync(path.join(DATA, 'backups'), { recursive: true });
/* role (ID) i właściciele edytowalne z panelu: data/access.json nadpisuje wartości z config.js */
const SNOW   = /^\d{17,20}$/;
const ACCESS = path.join(DATA, 'access.json');
const access = { roles: { ...cfg.roles }, owners: [...cfg.owners] };
try {
  const a = JSON.parse(fs.readFileSync(ACCESS, 'utf8'));
  for (const n of Object.keys(access.roles)) if (a.roles && SNOW.test(a.roles[n])) access.roles[n] = a.roles[n];
  if (Array.isArray(a.owners)) access.owners = a.owners.filter(x => SNOW.test(x));
} catch {}
const saveAccess = () => { const tmp = ACCESS + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(access, null, 1)); fs.renameSync(tmp, ACCESS); };
const PERMS = { ...cfg.permissions, 'roles.edit': [] };   // roles.edit tylko dla właścicieli

const audit = (event, user, detail = '') =>
  fs.appendFile(LOG, JSON.stringify({ t: new Date().toISOString(), event, id: user.id, name: user.global_name || user.username || user.name, detail }) + '\n', () => {});

/* ---------- Discord API ---------- */
async function dget(url, auth) {
  const r = await fetch(DISCORD + url, { headers: { Authorization: auth } });
  if (!r.ok) throw Object.assign(new Error('discord ' + r.status), { status: r.status });
  return r.json();
}
const avatarUrl = u => u.avatar
  ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
  : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;

/* role użytkownika: z botem (BOT_TOKEN) – zawsze aktualne, bez bota – z tokenu użytkownika */
async function fetchMember(s) {                          // zwraca członka serwera (role + nick na serwerze)
  return BOT_TOKEN
    ? await dget(`/guilds/${cfg.guildId}/members/${s.user.id}`, 'Bot ' + BOT_TOKEN)
    : await dget(`/users/@me/guilds/${cfg.guildId}/member`, s.bearer);
}
async function currentRoles(s) {                         // odświeżane co 60 s
  if (Date.now() - s.rolesAt < 60000) return s.roles;
  try { const m = await fetchMember(s); s.roles = m.roles || []; s.user.nick = m.nick || ''; }
  catch (e) {
    if (e.status === 404) s.roles = [];                  // wyszedł z serwera
    else if (e.status === 401 || e.status === 403) s.exp = 0;   // token wygasł -> trzeba zalogować ponownie
    /* inne błędy (np. chwilowa awaria Discorda): zostają poprzednie role */
  }
  s.rolesAt = Date.now();
  return s.roles;
}
const roleNames = ids => Object.entries(access.roles).filter(([, id]) => ids.includes(id)).map(([n]) => n);
const permsOf = (user, names) => access.owners.includes(user.id)
  ? Object.keys(PERMS)
  : Object.entries(PERMS).filter(([, rs]) => rs.some(r => names.includes(r))).map(([p]) => p);

/* ---------- OAuth2 ---------- */
/* po logowaniu wracamy na podaną podstronę (np. /podania/administracja); tylko lokalne ścieżki typu /abc/def */
const safeNext = v => typeof v === 'string' && /^\/(?:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)?$/i.test(v) ? v : '/panel';
app.get('/auth/discord', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  setCookie(res, 'oauth_state', state, 600);
  setCookie(res, 'oauth_next', safeNext(req.query.next), 600);
  res.redirect('https://discord.com/oauth2/authorize?' + new URLSearchParams({
    client_id: CID || '', redirect_uri: REDIRECT_URI || '', response_type: 'code',
    scope: 'identify guilds.members.read', state, prompt: 'none'
  }));
});

app.get('/auth/discord/callback', async (req, res) => {
  const c = cookies(req), next = safeNext(c.oauth_next);
  const back = err => res.redirect(next + '?err=' + err);
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== c.oauth_state) return back('state');
    setCookie(res, 'oauth_state', '', 0); setCookie(res, 'oauth_next', '', 0);

    const tr = await fetch(DISCORD + '/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CID, client_secret: SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI })
    });
    if (!tr.ok) throw new Error('token ' + tr.status);
    const bearer = 'Bearer ' + (await tr.json()).access_token;
    const user = await dget('/users/@me', bearer);

    let roles, nick = '';
    try { const m = await fetchMember({ user, bearer }); roles = m.roles || []; nick = m.nick || ''; }
    catch (e) { if (e.status === 404) { audit('login_denied', user, 'brak na serwerze'); return back('guild'); } throw e; }

    const sid = crypto.randomBytes(32).toString('hex');
    sessions.set(sid, {
      user: { id: user.id, name: user.global_name || user.username, username: user.username, nick, avatarUrl: avatarUrl(user) },
      bearer, roles, rolesAt: Date.now(), exp: Date.now() + TTL * 1000
    });
    setCookie(res, 'sid', sid, TTL);
    audit('login', user);
    res.redirect(next === '/' ? '/start' : next);
  } catch (e) { console.error('[panel] oauth:', e.message); back('oauth'); }
});

app.post('/auth/logout', (req, res) => {
  const sid = cookies(req).sid, s = sessions.get(sid);
  if (s) audit('logout', s.user);
  sessions.delete(sid); setCookie(res, 'sid', '', 0);
  res.json({ ok: true });
});

/* ---------- API: JSON + ochrona przed zapytaniami z obcych stron ---------- */
app.use('/api', express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {          // zmiany tylko z tej samej witryny (Origin = Host)
    const o = req.headers.origin;
    if (o) { let ok = false; try { ok = new URL(o).host === req.headers.host; } catch {} if (!ok) return res.status(403).json({ error: 'origin' }); }
  }
  next();
});

/* ---------- API: sesja + uprawnienia sprawdzane po stronie serwera ---------- */
app.use('/api', async (req, res, next) => {
  try {
    const sid = cookies(req).sid, s = sid && sessions.get(sid);
    req.s = null; req.roleIds = [];
    if (s) {
      const ids = await currentRoles(s);
      if (s.exp < Date.now()) sessions.delete(sid);
      else { req.s = s; req.roleIds = ids; req.roles = roleNames(ids); req.perms = permsOf(s.user, req.roles); hooks.perms.forEach(h => h(req)); }
    }
    res.set('Cache-Control', 'no-store');
    next();
  } catch (e) { console.error('[panel] api:', e.message); res.status(500).json({ error: 'server' }); }
});
const hooks = { perms: [] };                              // moduły mogą dodawać własne (dynamiczne) uprawnienia do req.perms
const need = perm => (req, res, next) =>
  !req.s ? res.status(401).json({ error: 'unauthorized' })
  : !req.perms.includes(perm) ? (audit('forbidden', req.s.user, perm + ' ' + req.originalUrl), res.status(403).json({ error: 'forbidden', need: perm }))
  : next();

app.get('/api/me', (req, res) => {
  if (!req.s) return res.json({ user: null });
  res.json({
    user: req.s.user, roles: req.roles, perms: req.perms,
    modules: cfg.modules.filter(m => req.perms.includes(m.perm)),
    reviewAll: !!req.reviewAll, reviewForms: req.reviewForms || [], pendingReview: req.pendingReview || 0   // dodawane przez server/podania.js
  });
});

app.get('/api/admin/roles', need('roles.view'), (req, res) => {
  const canEdit = req.perms.includes('roles.edit');
  res.json({
    roles: Object.entries(access.roles).map(([name, id]) => ({ name, id, mine: req.roles.includes(name) })),
    permissions: Object.entries(PERMS).map(([perm, roles]) => ({ perm, roles })),
    canEdit, owners: canEdit ? access.owners : undefined
  });
});

/* edycja ID ról i listy właścicieli – tylko właściciele (zmiana ról = zmiana tego, kto ma dostęp) */
app.put('/api/admin/roles', need('roles.edit'), (req, res) => {
  const b = req.body || {}, roles = {};
  for (const n of Object.keys(access.roles)) {
    const v = b.roles && typeof b.roles[n] === 'string' ? b.roles[n].trim() : '';
    if (!SNOW.test(v)) return res.status(400).json({ error: 'bad_request', field: n });
    roles[n] = v;
  }
  const owners = Array.isArray(b.owners) ? [...new Set(b.owners.map(x => typeof x === 'string' ? x.trim() : ''))] : null;
  if (!owners || owners.length > 50 || owners.some(x => !SNOW.test(x))) return res.status(400).json({ error: 'bad_request', field: 'owners' });
  if (!owners.includes(req.s.user.id)) return res.status(400).json({ error: 'self_owner' });   // ochrona przed utratą dostępu
  const changes = [
    ...Object.keys(roles).filter(n => roles[n] !== access.roles[n]).map(n => `${n}: ${access.roles[n]} -> ${roles[n]}`),
    ...owners.filter(x => !access.owners.includes(x)).map(x => `+owner ${x}`),
    ...access.owners.filter(x => !owners.includes(x)).map(x => `-owner ${x}`)
  ];
  Object.assign(access, { roles, owners }); saveAccess();
  audit('access_edit', req.s.user, changes.join('; ') || 'bez zmian');
  res.json({ ok: true });
});

app.get('/api/admin/logs', need('logs.view'), (req, res) => {
  fs.readFile(LOG, 'utf8', (err, txt) => {
    const rows = (err ? '' : txt).split('\n').filter(Boolean).slice(-200).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
    res.json({ logs: rows });
  });
});

/* status serwera FiveM (publiczny, cache 15 s) – przeglądarka nie łączy się z serwerem gry bezpośrednio (mixed content / CORS) */
const FIVEM = (process.env.FIVEM_URL || 'http://147.79.62.78:30120').replace(/\/$/, '');
const FALLBACK_SLOTS = Number(process.env.FIVEM_SLOTS) || 128;
let statusCache = { at: 0, data: { online: false, players: 0, max: FALLBACK_SLOTS } };
async function fivemGet(p) {
  const r = await fetch(FIVEM + p, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error('fivem ' + r.status);
  return r.json();
}
app.get('/api/status', async (req, res) => {
  if (Date.now() - statusCache.at > 15000) {
    let data = { online: false, players: 0, max: statusCache.data.max };
    try {
      const list = await fivemGet('/players.json');
      data = { online: true, players: Array.isArray(list) ? list.length : 0, max: data.max };
      try { const dyn = await fivemGet('/dynamic.json'); const m = Number(dyn.sv_maxclients); if (m > 0) data.max = m; } catch {}
    } catch {}
    statusCache = { at: Date.now(), data };
  }
  res.json(statusCache.data);
});

/* moduły: regulamin, gracze (server/modules.js), podania (server/podania.js) */
const deps = { need, audit, cfg, hooks, root: path.join(__dirname, '..'), DATA, discord: { api: DISCORD, token: BOT_TOKEN } };
require('./modules')(app, deps);
require('./podania')(app, deps);
require('./postacie')(app, deps);
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

/* ---------- pliki strony (tylko jawnie dozwolone – nie wystawiamy server/, .env, data/) ---------- */
const root = path.join(__dirname, '..');
for (const d of ['css', 'js', 'img']) app.use('/' + d, express.static(path.join(root, d), { dotfiles: 'deny' }));
fs.mkdirSync(path.join(DATA, 'uploads'), { recursive: true });
app.use('/uploads', express.static(path.join(DATA, 'uploads'), { dotfiles: 'deny', maxAge: '7d', setHeaders: r => r.set('Content-Security-Policy', "default-src 'none'") }));
for (const f of ['favicon.png', 'logo.png']) app.get('/' + f, (q, r) => r.sendFile(path.join(root, f), e => e && r.status(404).end()));
/* czyste adresy (bez #): każda podstrona oddaje ten sam index.html, a router w js/app.js (History API) rysuje widok */
app.get('/', (q, r) => r.redirect('/start'));
app.get('/home', (q, r) => r.redirect(301, '/start'));   // stary adres
app.get('/regulamin', (q, r) => r.redirect(301, '/regulaminy'));   // stary adres
app.get(['/start', '/regulaminy', '/regulaminy/:id', '/taryfikator', '/panel', '/podania', '/podania/:id', '/postacie'], (q, r) => r.sendFile(path.join(root, 'index.html')));
app.use((req, res, next) => (req.method === 'GET' && !path.extname(req.path)) ? res.redirect('/start') : next());   // nieznana podstrona -> /start

app.use((err, req, res, next) => {                          // np. zepsuty JSON w zapytaniu
  if (res.headersSent) return next(err);
  const st = err.status && err.status < 500 ? err.status : 500;
  if (st === 500) console.error('[panel]', err.message);
  res.status(st).json({ error: st === 500 ? 'server' : 'bad_request' });
});

app.listen(PORT, () => console.log(`[panel] działa na http://localhost:${PORT}`));