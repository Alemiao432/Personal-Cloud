/**
 * Nuvola Personale — Server
 * ---------------------------------------------------------------
 * Personal cloud: upload, download, organize and delete files,
 * folders, compressed archives and images from any device,
 * protected by username and password.
 *
 * Stack: Node.js + Express — plain HTML/CSS/JS frontend.
 */

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const crypto = require('crypto');

/* ------------------------------------------------------------------ */
/* Configuration (config.json)                                        */
/* ------------------------------------------------------------------ */
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PORTA = Number(process.env.PORT) || Number(config.porta) || 3000;
const NOME_CLOUD = config.nomeCloud || 'Personal Cloud';
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_FILE_MB = Number(config.maxFileMB) || 2048;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* Session secret, stable across restarts (generated once) */
function leggiSegretoSessione() {
  const file = path.join(__dirname, '.session-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch (_) {
    const segreto = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, segreto, { mode: 0o600 });
    return segreto;
  }
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use(session({
  secret: leggiSegretoSessione(),
  name: 'nuvola.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

/* ------------------------------------------------------------------ */
/* Security                                                           */
/* ------------------------------------------------------------------ */

/* Converts a relative path to an absolute one, preventing escapes from uploads */
function safePath(rel) {
  const pulito = path.normalize(String(rel || ''));
  const abs = path.resolve(UPLOADS_DIR, pulito);
  if (abs !== UPLOADS_DIR && !abs.startsWith(UPLOADS_DIR + path.sep)) return null;
  return abs;
}

function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
}

/* Max 10 failed login attempts, then a 15-minute lock counted from
   the LAST wrong attempt (who keeps failing waits longer and
   longer; who waits quietly sees the counter reset) */
const tentativi = { count: 0, ultimo: 0 };
const FINESTRA_MS = 15 * 60 * 1000;
function antiBruteForce(req, res, next) {
  const adesso = Date.now();
  if (adesso - tentativi.ultimo > FINESTRA_MS) tentativi.count = 0;
  if (tentativi.count >= 10) {
    const minuti = Math.max(1, Math.ceil((FINESTRA_MS - (adesso - tentativi.ultimo)) / 60000));
    return res.status(429).json({ error: 'Too many failed attempts. Try again in ' + minuti + ' minutes.' });
  }
  next();
}

function nomeValido(nome) {
  return Boolean(nome) && !/[\\/:*?"<>|]/.test(nome) && nome !== '.' && nome !== '..';
}

/* Cache for the folder tree and stats (invalidated on every change) */
let cacheAlbero = { dati: [], ora: 0 };
let cacheStats = { dati: null, ora: 0 };
function invalidaCache() {
  cacheAlbero = { dati: [], ora: 0 };
  cacheStats = { dati: null, ora: 0 };
}

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */
app.post('/api/login', antiBruteForce, (req, res) => {
  if (!config.username || !config.password) {
    return res.status(503).json({ error: 'Credentials not set: fill in username and password in config.json and restart the server.' });
  }
  const { username, password } = req.body || {};
  if (username === config.username && password === config.password) {
    tentativi.count = 0;
    req.session.loggedIn = true;
    return res.json({ ok: true, nomeCloud: NOME_CLOUD });
  }
  tentativi.count++;
  tentativi.ultimo = Date.now();
  return res.status(401).json({ error: 'Incorrect username or password.' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({
    loggedIn: Boolean(req.session && req.session.loggedIn),
    nomeCloud: NOME_CLOUD,
    maxFileMB: MAX_FILE_MB
  });
});

/* ------------------------------------------------------------------ */
/* File helpers                                                         */
/* ------------------------------------------------------------------ */
const IMG_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif', '.heic'];
const ARCH_EXT = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz'];

function tipoElemento(nome, isDir) {
  if (isDir) return 'cartella';
  const ext = path.extname(nome).toLowerCase();
  if (IMG_EXT.includes(ext)) return 'immagine';
  if (ARCH_EXT.includes(ext)) return 'archivio';
  if (['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.flac', '.m4a'].includes(ext)) return 'audio';
  if (ext === '.pdf') return 'pdf';
  return 'file';
}

function intestazioneDownload(nome) {
  const ascii = nome.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return 'attachment; filename="' + ascii + '"; filename*=UTF-8\'\'' + encodeURIComponent(nome);
}

/* ------------------------------------------------------------------ */
/* API — List the contents of a folder                               */
/* ------------------------------------------------------------------ */
app.get('/api/files', requireLogin, async (req, res) => {
  try {
    const rel = String(req.query.path || '').replace(/^\/+/, '');
    const abs = safePath(rel);
    if (abs === null) return res.status(400).json({ error: 'Invalid path.' });

    const voci = await fsp.readdir(abs, { withFileTypes: true });
    const elementi = [];

    for (const voce of voci) {
      if (voce.name.startsWith('.')) continue; // hides hidden files
      const pieno = path.join(abs, voce.name);
      let st;
      try { st = await fsp.stat(pieno); } catch (_) { continue; }
      elementi.push({
        nome: voce.name,
        tipo: tipoElemento(voce.name, voce.isDirectory()),
        isDir: voce.isDirectory(),
        percorso: rel ? rel + '/' + voce.name : voce.name,
        dimensione: st.size,
        modificato: st.mtimeMs
      });
    }

    elementi.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'en', { sensitivity: 'base', numeric: true });
    });

    res.json({ percorso: rel, elementi });
  } catch (err) {
    res.status(404).json({ error: 'Folder not found.' });
  }
});

/* ------------------------------------------------------------------ */
/* API — File upload (multipart)                                  */
/* ------------------------------------------------------------------ */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const abs = safePath(req.body.percorso || '');
    if (abs === null) return cb(new Error('Invalid path.'));
    fs.mkdir(abs, { recursive: true }, (err) => cb(err, abs));
  },
  filename(req, file, cb) {
    // Fixes the encoding of file names with accented characters
    const nome = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const abs = safePath(req.body.percorso || '');
    if (abs === null) return cb(new Error('Invalid path.'));
    // If the file already exists, do not overwrite it: append " (1)", " (2)"...
    let finale = nome;
    let n = 1;
    while (fs.existsSync(path.join(abs, finale))) {
      const ext = path.extname(nome);
      finale = path.basename(nome, ext) + ' (' + n + ')' + ext;
      n++;
    }
    cb(null, finale);
  }
});

const upload = multer({ storage, limits: { fileSize: MAX_FILE_MB * 1024 * 1024 } });

app.post('/api/upload', requireLogin, upload.array('file', 50), (req, res) => {
  invalidaCache();
  res.json({ ok: true, caricati: req.files ? req.files.length : 0 });
});

/* ------------------------------------------------------------------ */
/* API — Folder creation                                            */
/* ------------------------------------------------------------------ */
app.post('/api/folder', requireLogin, async (req, res) => {
  try {
    const base = safePath(req.body.percorso || '');
    const nome = String(req.body.nome || '').trim();
    if (base === null || !nomeValido(nome)) {
      return res.status(400).json({ error: 'Invalid folder name.' });
    }
    await fsp.mkdir(path.join(base, nome), { recursive: false });
    invalidaCache();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: 'Could not create the folder (does it already exist?).' });
  }
});

/* ------------------------------------------------------------------ */
/* API — Download (single file, or folder compressed as ZIP)           */
/* ------------------------------------------------------------------ */
app.get('/api/download', requireLogin, (req, res) => {
  const abs = safePath(req.query.path || '');
  if (abs === null || !fs.existsSync(abs)) {
    return res.status(404).json({ error: 'Item not found.' });
  }

  if (fs.statSync(abs).isDirectory()) {
    // Folder → ZIP on the fly
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', intestazioneDownload(path.basename(abs) + '.zip'));
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('ZIP error:', err);
      res.destroy();
    });
    archive.pipe(res);
    archive.directory(abs + path.sep, path.basename(abs));
    archive.finalize();
  } else {
    res.setHeader('Content-Disposition', intestazioneDownload(path.basename(abs)));
    res.sendFile(abs);
  }
});

/* ------------------------------------------------------------------ */
/* API — Raw content (for image previews)                     */
/* ------------------------------------------------------------------ */
app.get('/api/raw', requireLogin, (req, res) => {
  const abs = safePath(req.query.path || '');
  if (abs === null || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    return res.status(404).end();
  }
  res.sendFile(abs);
});

/* ------------------------------------------------------------------ */
/* API — Delete (file or folder with all contents)         */
/* ------------------------------------------------------------------ */
app.post('/api/delete', requireLogin, async (req, res) => {
  try {
    const abs = safePath(req.body.percorso || '');
    if (abs === null || abs === UPLOADS_DIR) {
      return res.status(400).json({ error: 'Invalid path.' });
    }
    /* If another device has already deleted it, that is fine too
       (the goal of the operation is achieved) */
    if (!fs.existsSync(abs)) {
      invalidaCache();
      return res.json({ ok: true, giaAssente: true });
    }
    /* Windows blocks deleting files that are momentarily in use
       (e.g. another device is downloading it): retry a few times */
    let ultimoErrore = null;
    for (let tentativo = 0; tentativo < 4; tentativo++) {
      try {
        await fsp.rm(abs, { recursive: true, force: true });
        ultimoErrore = null;
        break;
      } catch (e) {
        ultimoErrore = e;
        await new Promise(r => setTimeout(r, 400 * (tentativo + 1)));
      }
    }
    if (ultimoErrore) throw ultimoErrore;
    invalidaCache();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'The file is temporarily in use on another device: please try again shortly.' });
  }
});

/* ------------------------------------------------------------------ */
/* API — Rename                                                      */
/* ------------------------------------------------------------------ */
app.post('/api/rename', requireLogin, async (req, res) => {
  try {
    const { percorso, nuovoNome } = req.body || {};
    const abs = safePath(percorso);
    const nome = String(nuovoNome || '').trim();
    if (abs === null || abs === UPLOADS_DIR || !nomeValido(nome)) {
      return res.status(400).json({ error: 'Invalid name.' });
    }
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Item not found.' });
    const dest = path.join(path.dirname(abs), nome);
    if (fs.existsSync(dest)) return res.status(400).json({ error: 'An item with this name already exists.' });
    await fsp.rename(abs, dest);
    invalidaCache();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error while renaming.' });
  }
});

/* ------------------------------------------------------------------ */
/* API — Folder tree (for the sidebar)                 */
/* ------------------------------------------------------------------ */
async function leggiAlbero(dir, rel) {
  const voci = await fsp.readdir(dir, { withFileTypes: true });
  const cartelle = [];
  for (const voce of voci) {
    if (!voce.isDirectory() || voce.name.startsWith('.')) continue;
    const relFiglio = rel ? rel + '/' + voce.name : voce.name;
    const figli = await leggiAlbero(path.join(dir, voce.name), relFiglio);
    cartelle.push({ nome: voce.name, percorso: relFiglio, figli });
  }
  cartelle.sort((a, b) => a.nome.localeCompare(b.nome, 'en', { sensitivity: 'base', numeric: true }));
  return cartelle;
}

app.get('/api/tree', requireLogin, async (req, res) => {
  try {
    if (Date.now() - cacheAlbero.ora > 10000) {
      cacheAlbero = { dati: await leggiAlbero(UPLOADS_DIR, ''), ora: Date.now() };
    }
    res.json({ albero: cacheAlbero.dati });
  } catch (_) {
    res.json({ albero: [] });
  }
});

/* ------------------------------------------------------------------ */
/* API — Used storage statistics                                      */
/* ------------------------------------------------------------------ */
async function calcolaStats(dir) {
  let dimensione = 0, file = 0, cartelle = 0;
  const voci = await fsp.readdir(dir, { withFileTypes: true });
  for (const voce of voci) {
    if (voce.name.startsWith('.')) continue;
    const pieno = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      cartelle++;
      const sotto = await calcolaStats(pieno);
      dimensione += sotto.dimensione;
      file += sotto.file;
      cartelle += sotto.cartelle;
    } else {
      file++;
      try { dimensione += (await fsp.stat(pieno)).size; } catch (_) { /* moved meanwhile */ }
    }
  }
  return { dimensione, file, cartelle };
}

app.get('/api/stats', requireLogin, async (req, res) => {
  try {
    if (!cacheStats.dati || Date.now() - cacheStats.ora > 15000) {
      cacheStats = { dati: await calcolaStats(UPLOADS_DIR), ora: Date.now() };
    }
    res.json(cacheStats.dati);
  } catch (_) {
    res.json({ dimensione: 0, file: 0, cartelle: 0 });
  }
});

/* ------------------------------------------------------------------ */
/* Static frontend                                                    */
/* ------------------------------------------------------------------ */
app.use(express.static(PUBLIC_DIR));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API not found.' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/* Error handling (e.g. file too large) */
app.use((err, req, res, _next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'File too large. Limit: ' + (MAX_FILE_MB >= 1024 ? (MAX_FILE_MB / 1024) + ' GB' : MAX_FILE_MB + ' MB') + '.'
      : 'Upload error (' + err.code + ').';
    return res.status(400).json({ error: msg });
  }
  return res.status(500).json({ error: 'Internal server error.' });
});

/* ------------------------------------------------------------------ */
/* Startup                                                               */
/* ------------------------------------------------------------------ */
app.listen(PORTA, '0.0.0.0', () => {
  console.log('');
  console.log('  ' + NOME_CLOUD + ' is running!');
  console.log('  ➜  On this PC:  http://localhost:' + PORTA);
  /* Show only the real local network addresses (Wi-Fi/cable),
     skipping the Tailscale internal ones (100.x.x.x) and duplicates */
  const giaVisti = new Set();
  const interfacce = os.networkInterfaces();
  for (const nome of Object.keys(interfacce)) {
    for (const iface of interfacce[nome] || []) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      if (iface.address.startsWith('100.')) continue; // Tailscale internal network
      if (giaVisti.has(iface.address)) continue;
      giaVisti.add(iface.address);
      console.log('  ➜  From a phone/PC on the same Wi-Fi:  http://' + iface.address + ':' + PORTA);
    }
  }
  console.log('');
  console.log('  From outside home (any network): run attiva-link-fisso.bat');
  console.log('  Keep this window open: the cloud works while it is running.');
  console.log('');
});
