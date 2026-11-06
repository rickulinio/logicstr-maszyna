/* POSTACIE – lista postaci z bazy MySQL (tabela users) + właściciel z Discorda.
   Dostęp: uprawnienie "postacie.view" (dodaj je w server/config.js -> permissions). */
const mysql = require('mysql2/promise');
const MODELS = (() => { try { return require('./vehicle-models.json'); } catch { return {}; } })();   // hash modelu (uint32) -> nazwa; brakujące modele pokażą się jako „Model #hash”

module.exports = (app, { need, discord }) => {
  const URL = process.env.MYSQL_CONNECTION_STRING;
  if (!URL) console.warn('[postacie] Brak MYSQL_CONNECTION_STRING w .env – zakładka „Postacie” nie będzie działać.');

  const pool = URL ? mysql.createPool({ uri: URL, connectionLimit: 4, dateStrings: true, connectTimeout: 5000 }) : null;
  if (pool) pool.pool.on('connection', c => c.query("SET time_zone = '+00:00'"));   // znaczniki czasu zawsze w UTC

  /* ---- cache użytkowników Discorda (nazwa + avatar właściciela postaci) ---- */
  const duCache = new Map();                       // id -> { at, user|null }
  const DU_TTL = 6 * 3600e3;
  const avatar = u => u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;
  async function resolveDiscord(ids) {
    if (!discord.token) return;
    const todo = ids.filter(id => { const c = duCache.get(id); return !c || Date.now() - c.at > DU_TTL; }).slice(0, 40);
    let stop = false;
    const worker = async () => {
      while (todo.length && !stop) {
        const id = todo.pop();
        try {
          const r = await fetch(`${discord.api}/users/${id}`, { headers: { Authorization: 'Bot ' + discord.token }, signal: AbortSignal.timeout(4000) });
          if (r.status === 429) { stop = true; break; }
          if (!r.ok) { duCache.set(id, { at: Date.now(), user: null }); continue; }
          const u = await r.json();
          duCache.set(id, { at: Date.now(), user: { id, name: u.global_name || u.username, username: u.username, avatarUrl: avatar(u) } });
        } catch { /* spróbujemy przy następnym zapytaniu */ }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  /* ---- pomocnicze ---- */
  const parseJson = s => { try { return JSON.parse(s); } catch { return null; } };
  const iso = s => s ? String(s).replace(' ', 'T') + 'Z' : null;
  const discordId = v => { const m = /(\d{17,20})/.exec(v || ''); return m ? m[1] : null; };
  const photoUrl = v => (typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(v.trim()) && v.length < 500) ? v.trim() : null;   // tylko https (bez data:/javascript:)

  let cache = { at: 0, rows: null };
  async function loadRows() {
    if (cache.rows && Date.now() - cache.at < 15000) return cache.rows;       // chroni bazę przed zalewem zapytań
    const [rows] = await pool.query(`SELECT identifier, id, ssn, firstname, lastname, dateofbirth, sex, height, job, job_grade, injail,
        created_at, last_seen, phone_number, badge, statistics, license, steam, steamName, discord, fivem,
        blood, blood_type, lastActive, playtime, nationality, gptPhoto
      FROM users ORDER BY id DESC LIMIT 3000`);
    cache = { at: Date.now(), rows };
    return rows;
  }

  /* statystyki z całej tabeli users (nie tylko z 3000 wierszy listy); kwoty jako tekst, żeby nie tracić precyzji przy dużych liczbach */
  let totalsCache = { at: 0, data: null };
  async function loadTotals() {
    if (totalsCache.data && Date.now() - totalsCache.at < 15000) return totalsCache.data;
    const [[t]] = await pool.query(`SELECT COUNT(*) AS characters,
        CAST(COALESCE(SUM(CAST(JSON_VALUE(accounts, '$.money') AS DECIMAL(38,0))), 0) AS CHAR) AS cash,
        CAST(COALESCE(SUM(CAST(JSON_VALUE(accounts, '$.bank')  AS DECIMAL(38,0))), 0) AS CHAR) AS bank,
        CAST(COALESCE(SUM(playtime), 0) AS CHAR) AS playtime,
        COALESCE(SUM(last_seen >= UTC_TIMESTAMP() - INTERVAL 24 HOUR), 0) AS active24
      FROM users`);
    const data = { characters: Number(t.characters), cash: String(t.cash), bank: String(t.bank), playtime: String(t.playtime), active24: Number(t.active24) };
    totalsCache = { at: Date.now(), data };
    return data;
  }

  /* pojazdy postaci: owned_vehicles.owner == users.identifier; błąd/brak tabeli nie psuje listy postaci */
  let vCache = { at: 0, map: new Map() };
  async function loadVehicles() {
    if (Date.now() - vCache.at < 15000) return vCache.map;
    const map = new Map();
    try {
      const [rows] = await pool.query(`SELECT COALESCE(owner, identifier) AS owner, plate, JSON_VALUE(vehicle, '$.model') AS model, type, job, stored, in_garage,
          parking, garage, pound, state, nickname, favorite, mileage, fuel, body, engine, is_impounded, impound_name, financed, price
        FROM owned_vehicles ORDER BY favorite DESC, plate LIMIT 20000`);
      for (const v of rows) {
        const h = v.model != null && v.model !== '' ? Number(v.model) : null;
        const name = h != null && !Number.isNaN(h) ? (MODELS[String(h >>> 0)] || null) : null;
        const pct = x => Math.max(0, Math.min(100, Math.round((Number(x) || 0) / 10)));
        const item = {
          plate: v.plate, type: v.type || 'car',
          model: name ? name.charAt(0).toUpperCase() + name.slice(1) : (h != null && !Number.isNaN(h) ? 'Model #' + h : null),
          nickname: v.nickname || null, favorite: !!v.favorite,
          status: v.is_impounded ? 'impound' : (v.stored || v.in_garage) ? 'garage' : 'out',
          place: v.is_impounded ? (v.impound_name || v.pound || null) : (v.parking || v.garage || null),
          mileage: Math.round((Number(v.mileage) || 0) * 10) / 10,
          fuel: Math.max(0, Math.min(100, Math.round(Number(v.fuel) || 0))),
          engine: pct(v.engine), body: pct(v.body),
          financed: !!v.financed, job: v.job || null
        };
        if (!map.has(v.owner)) map.set(v.owner, []);
        map.get(v.owner).push(item);
      }
    } catch (e) { console.error('[postacie] pojazdy:', e.message); }
    vCache = { at: Date.now(), map };
    return map;
  }

  app.get('/api/postacie', need('postacie.view'), async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'db_config' });
    try {
      const [rows, totals, vmap] = await Promise.all([loadRows(), loadTotals(), loadVehicles()]);
      const ids = [...new Set(rows.map(r => discordId(r.discord)).filter(Boolean))];
      await resolveDiscord(ids);
      res.json({
        total: rows.length,
        totals,
        characters: rows.map(r => {
          const did = discordId(r.discord), c = did && duCache.get(did);
          return {
            id: r.id, ssn: r.ssn,
            firstname: r.firstname || '', lastname: r.lastname || '',
            dob: r.dateofbirth, sex: r.sex, height: r.height, nationality: r.nationality,
            blood: r.blood || r.blood_type || null,
            job: r.job || 'unemployed', grade: r.job_grade, badge: r.badge,
            injail: r.injail || 0, playtime: r.playtime || 0,
            createdAt: iso(r.created_at), lastSeen: iso(r.last_seen),
            phone: r.phone_number, steam: r.steam, steamName: r.steamName, license: r.license, fivem: r.fivem,
            stats: parseJson(r.statistics),
            photo: photoUrl(r.gptPhoto),
            vehicles: vmap.get(r.identifier) || [],
            owner: did ? { id: did, ...((c && c.user) || {}) } : null
          };
        })
      });
    } catch (e) { console.error('[postacie]', e.message); res.status(500).json({ error: 'server' }); }
  });
};