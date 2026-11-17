/* Nuvola Personale — Frontend logic */

'use strict';

const $ = (s) => document.querySelector(s);

const LIMITE_MB = { valore: 0 }; // set by the server via /api/session

const state = {
  percorso: '',            // current folder (relative to uploads)
  elementi: [],            // contents of the current folder
  filtro: '',              // search text
  albero: [],              // folder tree for the sidebar
  espansi: new Set([''])   // folders expanded in the tree ('' = root)
};

const ICONE_TIPI = {
  cartella: { i: 'folder', c: '#f6c453' },
  video: { i: 'film', c: '#f472b6' },
  audio: { i: 'music', c: '#34d399' },
  pdf: { i: 'book', c: '#f87171' },
  archivio: { i: 'archive', c: '#a78bfa' },
  documento: { i: 'fileText', c: '#60a5fa' },
  file: { i: 'file', c: '#8b93a5' }
};

/* ============================ Utilities ============================ */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtSize(bytes) {
  if (!bytes) return '0 B';
  const unita = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(unita.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return val.toFixed(i === 0 ? 0 : 1) + ' ' + unita[i];
}

function fmtData(ms) {
  const d = new Date(ms);
  const data = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const ora = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return data + ' ' + ora;
}

async function api(url, opzioni = {}) {
  const res = await fetch(url, opzioni);
  let dati = null;
  try { dati = await res.json(); } catch (_) { /* response without JSON */ }
  if (!res.ok) throw new Error((dati && dati.error) || ('Error ' + res.status));
  return dati;
}

function toast(msg, tipo) {
  const t = document.createElement('div');
  t.className = 'toast' + (tipo === 'errore' ? ' toast-errore' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('mostra'), 10);
  setTimeout(() => {
    t.classList.remove('mostra');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

/* ============================ Static icons ============================ */

function iniettaIconeStatiche() {
  $('#login-logo').innerHTML = icona('cloud', 42);
  $('#login-ico-user').innerHTML = icona('user', 18);
  $('#login-ico-lock').innerHTML = icona('lock', 18);
  $('#sidebar-logo').innerHTML = icona('cloud', 22);
  $('#sidebar-close').innerHTML = icona('x', 18);
  $('#nav-ico-home').innerHTML = icona('home', 18);
  $('#spazio-ico').innerHTML = icona('database', 16);
  $('#ricerca-ico').innerHTML = icona('search', 17);
  $('#vuoto-icona').innerHTML = icona('folder', 64);
  $('#dropzone-icona').innerHTML = icona('uploadCloud', 46);
  $('#upload-close').innerHTML = icona('x', 16);
  $('#lightbox-close').innerHTML = icona('x', 18);
  $('#btn-menu').innerHTML = icona('menu', 21);

  $('#btn-upload-file').insertAdjacentHTML('afterbegin', icona('uploadCloud', 18));
  $('#btn-upload-folder').insertAdjacentHTML('afterbegin', icona('upload', 18));
  $('#btn-new-folder').insertAdjacentHTML('afterbegin', icona('folderPlus', 18));
  $('#btn-logout').insertAdjacentHTML('afterbegin', icona('logout', 18));
}

/* ============================ Login ============================ */

async function controllaSessione() {
  try {
    const d = await api('/api/session');
    $('#brand-name').textContent = d.nomeCloud;
    $('#login-title').textContent = d.nomeCloud;
    document.title = d.nomeCloud;
    if (d.maxFileMB) LIMITE_MB.valore = d.maxFileMB;
    if (d.loggedIn) mostraApp();
    else mostraLogin();
  } catch (_) {
    mostraLogin();
  }
}

function mostraLogin() {
  $('#login-view').classList.remove('hidden');
  $('#app-view').classList.add('hidden');
  $('#login-user').value = '';
  $('#login-pass').value = '';
  $('#login-pass').type = 'password';
  $('#toggle-pass').innerHTML = icona('eye', 17);
  $('#toggle-pass').title = 'Show password';
  $('#login-error').classList.add('nascosto');
  setTimeout(() => $('#login-user').focus(), 50);
}

function mostraApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  naviga(state.percorso);
  caricaAlbero();
  caricaStats();
}

/* Eye icon: show/hide the password */
$('#toggle-pass').innerHTML = icona('eye', 17);
$('#toggle-pass').addEventListener('click', () => {
  const inp = $('#login-pass');
  const visibile = inp.type === 'password';
  inp.type = visibile ? 'text' : 'password';
  $('#toggle-pass').innerHTML = icona(visibile ? 'eyeOff' : 'eye', 17);
  $('#toggle-pass').title = visibile ? 'Hide password' : 'Show password';
  inp.focus();
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  $('#login-error').classList.add('nascosto');
  try {
    await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: $('#login-user').value.trim(),
        password: $('#login-pass').value
      })
    });
    mostraApp();
  } catch (err) {
    const el = $('#login-error');
    el.innerHTML = icona('alert', 16) + '<span>' + escapeHtml(err.message) + '</span>';
    el.classList.remove('nascosto');
    // shakes the whole card, once only, without re-triggering inner animations
    const card = $('.login-card');
    card.classList.remove('scuoti');
    void card.offsetWidth;
    card.classList.add('scuoti');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

$('#btn-logout').addEventListener('click', async () => {
  const btn = $('#btn-logout');
  btn.disabled = true;
  btn.classList.add('uscita');
  btn.innerHTML = icona('logout', 18) + '<span>Signing out…</span>';
  try { await api('/api/logout', { method: 'POST' }); } catch (_) { /* ignora */ }
  await new Promise(r => setTimeout(r, 450)); // let the feedback be seen
  state.percorso = '';
  chiudiSidebar();
  btn.disabled = false;
  btn.classList.remove('uscita');
  btn.innerHTML = icona('logout', 18) + '<span>Sign out</span>';
  mostraLogin();
});

/* ============================ Mobile sidebar ============================ */

function apriSidebar() {
  $('#sidebar').classList.add('aperta');
  $('#sidebar-backdrop').classList.remove('hidden');
}

function chiudiSidebar() {
  $('#sidebar').classList.remove('aperta');
  $('#sidebar-backdrop').classList.add('hidden');
}

$('#btn-menu').addEventListener('click', apriSidebar);
$('#sidebar-close').addEventListener('click', chiudiSidebar);
$('#sidebar-backdrop').addEventListener('click', chiudiSidebar);

$('#nav-home').addEventListener('click', (e) => {
  e.preventDefault();
  naviga('');
  chiudiSidebar();
});

/* ============================ Navigation ============================ */

async function naviga(percorso) {
  state.percorso = percorso;
  espandiPercorso(percorso);
  const grid = $('#grid');
  $('#empty-state').classList.add('hidden');
  grid.innerHTML = '<div class="caricamento"><div class="spinner"></div>Loading…</div>';
  try {
    const d = await api('/api/files?path=' + encodeURIComponent(percorso));
    state.elementi = d.elementi;
    renderBreadcrumb();
    renderGriglia();
    evidenziaAlbero();
  } catch (err) {
    if (percorso) return naviga(''); // the folder no longer exists: go back home
    grid.innerHTML = '<div class="caricamento">Error: ' + escapeHtml(err.message) + '</div>';
  }
}

function espandiPercorso(percorso) {
  if (!percorso) return;
  const parti = percorso.split('/');
  let accumulo = '';
  for (const p of parti) {
    accumulo = accumulo ? accumulo + '/' + p : p;
    state.espansi.add(accumulo);
  }
}

function renderBreadcrumb() {
  const bc = $('#breadcrumb');
  bc.innerHTML = '';
  const aggiungi = (etichetta, percorso, iconaNome) => {
    if (bc.children.length) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.innerHTML = icona('chevronRight', 14);
      bc.appendChild(sep);
    }
    const a = document.createElement('a');
    a.href = '#';
    if (iconaNome) a.insertAdjacentHTML('afterbegin', icona(iconaNome, 15));
    a.appendChild(document.createTextNode(etichetta));
    if (percorso === state.percorso) a.classList.add('attuale');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (percorso !== state.percorso) naviga(percorso);
    });
    bc.appendChild(a);
  };
  aggiungi('My files', '', 'home');
  if (state.percorso) {
    const parti = state.percorso.split('/');
    let accumulo = '';
    parti.forEach((p) => {
      accumulo = accumulo ? accumulo + '/' + p : p;
      aggiungi(p, accumulo, null);
    });
  }
}

/* ============================ Folder tree (sidebar) ============================ */

async function caricaAlbero() {
  try {
    const d = await api('/api/tree');
    state.albero = d.albero;
    renderAlbero();
  } catch (_) { /* tree unavailable */ }
}

function renderAlbero() {
  const contenitore = $('#albero-cartelle');
  contenitore.innerHTML = '';
  if (!state.albero.length) {
    contenitore.innerHTML = '<div class="albero-vuoto">No folders yet</div>';
    return;
  }
  contenitore.appendChild(costruisciRamo(state.albero, 0));
}

function costruisciRamo(nodi, livello) {
  const frag = document.createDocumentFragment();
  for (const nodo of nodi) {
    const voce = document.createElement('div');
    voce.className = 'voce-albero' + (nodo.percorso === state.percorso ? ' attiva' : '');
    voce.style.paddingLeft = (10 + livello * 15) + 'px';
    voce.title = nodo.nome;

    const freccia = document.createElement('button');
    freccia.className = 'freccia' +
      (state.espansi.has(nodo.percorso) ? ' aperta' : '') +
      (nodo.figli.length ? '' : ' invisibile');
    freccia.innerHTML = icona('chevronRight', 13);
    freccia.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.espansi.has(nodo.percorso)) state.espansi.delete(nodo.percorso);
      else state.espansi.add(nodo.percorso);
      renderAlbero();
    });
    voce.appendChild(freccia);

    const etichetta = document.createElement('span');
    etichetta.className = 'voce-etichetta';
    etichetta.innerHTML = '<span style="color:#f6c453;display:inline-flex;margin-right:2px">' + icona('folder', 14) + '</span>' + escapeHtml(nodo.nome);
    voce.appendChild(etichetta);

    voce.addEventListener('click', () => {
      naviga(nodo.percorso);
      if (window.innerWidth <= 900) chiudiSidebar();
    });
    frag.appendChild(voce);

    if (state.espansi.has(nodo.percorso) && nodo.figli.length) {
      frag.appendChild(costruisciRamo(nodo.figli, livello + 1));
    }
  }
  return frag;
}

function evidenziaAlbero() {
  document.querySelectorAll('.voce-albero').forEach((el) => {
    el.classList.toggle('attiva', el.title === state.percorso.split('/').pop());
  });
  $('#nav-home').classList.toggle('attiva', state.percorso === '');
}

/* ============================ Storage stats ============================ */

async function caricaStats() {
  try {
    const d = await api('/api/stats');
    $('#spazio-usato').innerHTML =
      '<strong>' + escapeHtml(fmtSize(d.dimensione)) + '</strong> · ' +
      d.file + ' files · ' + d.cartelle + ' folders';
  } catch (_) {
    $('#spazio-usato').textContent = 'Storage info unavailable';
  }
}

/* ============================ Grid ============================ */

function renderGriglia() {
  const grid = $('#grid');
  const filtro = state.filtro.trim().toLowerCase();
  const elementi = filtro
    ? state.elementi.filter((e) => e.nome.toLowerCase().includes(filtro))
    : state.elementi;
  grid.innerHTML = '';
  $('#empty-state').classList.toggle('hidden', elementi.length > 0);
  elementi.forEach((el, i) => {
    const card = creaCard(el);
    card.style.setProperty('--i', Math.min(i, 20)); // growing delay, capped for huge folders
    grid.appendChild(card);
  });
}

function creaCard(el) {
  const card = document.createElement('div');
  card.className = 'card';
  card.title = el.nome;

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  if (el.tipo === 'immagine') {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = '/api/raw?path=' + encodeURIComponent(el.percorso);
    img.alt = el.nome;
    thumb.appendChild(img);
  } else {
    const conf = ICONE_TIPI[el.tipo] || ICONE_TIPI.file;
    const div = document.createElement('div');
    div.className = 'thumb-icona';
    div.style.color = conf.c;
    div.innerHTML = icona(conf.i, 40);
    thumb.appendChild(div);
  }
  card.appendChild(thumb);

  const nome = document.createElement('div');
  nome.className = 'nome';
  nome.textContent = el.nome;
  card.appendChild(nome);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = el.isDir ? 'Folder' : (fmtSize(el.dimensione) + ' · ' + fmtData(el.modificato));
  card.appendChild(meta);

  const azioni = document.createElement('div');
  azioni.className = 'azioni';
  azioni.appendChild(btnAzione('download', el.isDir ? 'Download folder (ZIP)' : 'Download', null, () => scarica(el)));
  azioni.appendChild(btnAzione('edit', 'Rename', null, () => rinomina(el)));
  azioni.appendChild(btnAzione('trash', 'Delete', 'rosso', () => elimina(el)));
  card.appendChild(azioni);

  card.addEventListener('click', (e) => {
    if (e.target.closest('.azioni')) return;
    if (el.isDir) naviga(el.percorso);
    else if (el.tipo === 'immagine') apriLightbox(el);
    else scarica(el);
  });

  return card;
}

function btnAzione(nomeIcona, titolo, classeExtra, fn) {
  const b = document.createElement('button');
  b.className = 'btn-azione' + (classeExtra ? ' ' + classeExtra : '');
  b.title = titolo;
  b.innerHTML = icona(nomeIcona, 15);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    fn();
  });
  return b;
}

/* ============================ Dialog ============================ */

let chiudiDialogo = null;

function apriDialogo(opzioni) {
  // opzioni: { titolo, testo, valore, icona, coloreIcona, bottoneOk, pericolo }
  return new Promise((risolvi) => {
    const box = $('#dialogo');
    $('#dialogo-titolo').textContent = opzioni.titolo;
    const testo = $('#dialogo-testo');
    if (opzioni.testo) {
      testo.textContent = opzioni.testo;
      testo.classList.remove('hidden');
    } else testo.classList.add('hidden');

    const wrap = $('#dialogo-campo-wrap');
    const inp = $('#dialogo-input');
    if (opzioni.valore !== undefined) {
      wrap.classList.remove('hidden');
      inp.value = opzioni.valore;
    } else wrap.classList.add('hidden');

    const ico = $('#dialogo-icona');
    ico.innerHTML = icona(opzioni.icona || 'edit', 26);
    ico.style.color = opzioni.pericolo ? 'var(--pericolo)' : 'var(--accento)';
    ico.className = 'dialogo-icona' + (opzioni.pericolo ? ' pericolo' : '');

    $('#dialogo-ok').textContent = opzioni.bottoneOk || 'Confirm';
    $('#dialogo-ok').className = 'btn ' + (opzioni.pericolo ? 'btn-pericolo' : 'btn-primario');
    box.classList.remove('hidden');

    chiudiDialogo = (risultato) => {
      box.classList.add('hidden');
      chiudiDialogo = null;
      risolvi(risultato);
    };

    setTimeout(() => {
      if (opzioni.valore !== undefined) {
        inp.focus();
        inp.select();
      } else $('#dialogo-ok').focus();
    }, 60);
  });
}

$('#dialogo-annulla').addEventListener('click', () => chiudiDialogo && chiudiDialogo(null));
function risultatoOk() {
  // if the text field is hidden (yes/no confirmations) the result is "yes"
  if ($('#dialogo-campo-wrap').classList.contains('hidden')) return true;
  return $('#dialogo-input').value;
}
$('#dialogo-ok').addEventListener('click', () => chiudiDialogo && chiudiDialogo(risultatoOk()));
$('#dialogo-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chiudiDialogo) chiudiDialogo(risultatoOk());
});
$('#dialogo').addEventListener('click', (e) => {
  if (e.target === $('#dialogo') && chiudiDialogo) chiudiDialogo(null);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && chiudiDialogo) chiudiDialogo(null);
});

/* ============================ Actions ============================ */

function scarica(el) {
  const a = document.createElement('a');
  a.href = '/api/download?path=' + encodeURIComponent(el.percorso);
  a.download = el.nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function elimina(el) {
  const cosa = el.isDir
    ? 'the folder "' + el.nome + '" with all of its contents'
    : 'the file "' + el.nome + '"';
  const ok = await apriDialogo({
    titolo: 'Delete ' + (el.isDir ? 'this folder?' : 'this file?'),
    testo: 'You are about to delete ' + cosa + '. This action cannot be undone.',
    icona: 'trash',
    bottoneOk: 'Delete',
    pericolo: true
  });
  if (!ok) return;
  try {
    const r = await api('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percorso: el.percorso })
    });
    toast(r.giaAssente ? el.nome + ' was already deleted from another device' : 'Deleted: ' + el.nome);
    naviga(state.percorso);
    caricaAlbero();
    caricaStats();
  } catch (err) {
    toast(err.message, 'errore');
    naviga(state.percorso);
  }
}

async function rinomina(el) {
  const nuovo = await apriDialogo({
    titolo: 'Rename',
    valore: el.nome,
    icona: 'edit',
    bottoneOk: 'Rename'
  });
  if (nuovo === null) return;
  const pulito = nuovo.trim();
  if (!pulito || pulito === el.nome) return;
  try {
    await api('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percorso: el.percorso, nuovoNome: pulito })
    });
    toast('Renamed to: ' + pulito);
    naviga(state.percorso);
    caricaAlbero();
  } catch (err) {
    toast(err.message, 'errore');
  }
}

$('#btn-new-folder').addEventListener('click', async () => {
  const nome = await apriDialogo({
    titolo: 'New folder',
    valore: '',
    icona: 'folderPlus',
    bottoneOk: 'Create'
  });
  if (nome === null) return;
  const pulito = nome.trim();
  if (!pulito) return;
  try {
    await api('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percorso: state.percorso, nome: pulito })
    });
    toast('Folder created: ' + pulito);
    naviga(state.percorso);
    caricaAlbero();
    caricaStats();
  } catch (err) {
    toast(err.message, 'errore');
  }
});

/* ============================ File upload ============================ */

$('#btn-upload-file').addEventListener('click', () => $('#input-file').click());


$('#input-file').addEventListener('change', (e) => {
  const lista = [...e.target.files].map((f) => ({ file: f, rel: f.name }));
  e.target.value = '';
  avviaCaricamento(lista);
});

/* Recursively reads a folder chosen with the modern picker */
async function leggiDirectory(dirHandle, base) {
  const lista = [];
  for await (const voce of dirHandle.values()) {
    if (voce.kind === 'file') {
      const f = await voce.getFile();
      lista.push({ file: f, rel: base + f.name });
    } else if (voce.kind === 'directory') {
      lista.push(...await leggiDirectory(voce, base + voce.name + '/'));
    }
  }
  return lista;
}

async function confermaCartella(nome, lista) {
  if (!lista.length) {
    toast('The folder "' + nome + '" is empty', 'errore');
    return false;
  }
  const peso = lista.reduce((s, x) => s + x.file.size, 0);
  return await apriDialogo({
    titolo: 'Upload this folder?',
    testo: '"' + nome + '" — ' + lista.length + ' files, ' + fmtSize(peso) + '. It will be uploaded keeping its subfolders.',
    icona: 'uploadCloud',
    bottoneOk: 'Upload'
  });
}

$('#btn-upload-folder').addEventListener('click', async () => {
  // Modern picker (Chrome/Edge): avoids the default browser window
  if (window.showDirectoryPicker) {
    let dir;
    try {
      dir = await window.showDirectoryPicker({ mode: 'read' });
    } catch (_) { return; } // cancelled
    // paths start with the folder name: the folder itself is recreated too
    const lista = await leggiDirectory(dir, dir.name + '/');
    if (!await confermaCartella(dir.name, lista)) return;
    avviaCaricamento(lista);
  } else {
    $('#input-folder').click(); // fallback: legacy picker
  }
});

$('#input-folder').addEventListener('change', async (e) => {
  const lista = [...e.target.files].map((f) => ({ file: f, rel: f.webkitRelativePath || f.name }));
  e.target.value = '';
  const nome = (lista[0] && lista[0].rel.includes('/')) ? lista[0].rel.split('/')[0] : 'folder';
  if (!await confermaCartella(nome, lista)) return;
  avviaCaricamento(lista);
});

$('#upload-close').addEventListener('click', () => $('#upload-bar').classList.add('hidden'));

function leggiLimite() {
  const mb = LIMITE_MB.valore;
  if (!mb) return 'the allowed limit';
  return mb >= 1024 ? (mb / 1024).toString() + ' GB' : mb + ' MB';
}

function dirDestinazione(rel) {
  const i = rel.lastIndexOf('/');
  const dirRel = i === -1 ? '' : rel.slice(0, i);
  if (!dirRel) return state.percorso;
  return state.percorso ? state.percorso + '/' + dirRel : dirRel;
}

function uploadUno(file, dirDest, onProgresso) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('percorso', dirDest); // fields must be appended BEFORE the files
    fd.append('file', file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgresso(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = 'Error ' + xhr.status;
      try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) { /* ignora */ }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(fd);
  });
}

async function avviaCaricamento(lista) {
  if (!lista || !lista.length) return;
  const percorsoIniziale = state.percorso;
  const bar = $('#upload-bar');
  const testo = $('#upload-text');
  const riemp = $('#upload-progress');

  bar.classList.remove('hidden');
  riemp.classList.remove('errore');
  let completati = 0;
  let falliti = 0;

  for (const { file, rel } of lista) {
    testo.textContent = 'Uploading ' + (completati + 1) + '/' + lista.length + ' — ' + rel;
    const limite = LIMITE_MB.valore * 1024 * 1024;
    if (limite && file.size > limite) {
      falliti++;
      riemp.classList.add('errore');
      toast('"' + rel + '" is too large: it exceeds the limit of ' + leggiLimite(), 'errore');
      completati++;
      continue;
    }
    try {
      await uploadUno(file, dirDestinazione(rel), (p) => {
        riemp.style.width = Math.round(((completati + p) / lista.length) * 100) + '%';
      });
    } catch (err) {
      falliti++;
      riemp.classList.add('errore');
      toast(err.message, 'errore');
    }
    completati++;
  }

  riemp.style.width = '100%';
  testo.textContent = falliti
    ? 'Upload completed with ' + falliti + ' errors'
    : 'Upload completed';
  setTimeout(() => {
    bar.classList.add('hidden');
    riemp.style.width = '0%';
  }, 1600);

  if (state.percorso === percorsoIniziale) naviga(state.percorso);
  caricaAlbero();
  caricaStats();
}

/* ============================ Drag & drop ============================ */

let trascinamenti = 0;

function appVisibile() {
  return !$('#app-view').classList.contains('hidden');
}

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if (!appVisibile()) return;
  trascinamenti++;
  $('#dropzone').classList.remove('hidden');
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  trascinamenti--;
  if (trascinamenti <= 0) {
    trascinamenti = 0;
    $('#dropzone').classList.add('hidden');
  }
});
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  trascinamenti = 0;
  $('#dropzone').classList.add('hidden');
  if (!appVisibile()) return;
  const lista = await daDropALista(e.dataTransfer);
  avviaCaricamento(lista);
});

/* Reads entries (folders too) from the drop, recursively */
function leggiVoce(entry, base) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (f) => resolve([{ file: f, rel: base + f.name }]),
        () => resolve([])
      );
    } else if (entry.isDirectory) {
      const lettore = entry.createReader();
      const tutte = [];
      const leggiBatch = () => {
        lettore.readEntries(async (batch) => {
          if (!batch.length) {
            const risultati = [];
            for (const b of tutte) {
              risultati.push(...await leggiVoce(b, base + entry.name + '/'));
            }
            return resolve(risultati);
          }
          tutte.push(...batch);
          leggiBatch();
        }, () => resolve([]));
      };
      leggiBatch();
    } else {
      resolve([]);
    }
  });
}

async function daDropALista(dataTransfer) {
  const items = [...(dataTransfer.items || [])];
  const voci = items.map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  const lista = [];
  if (voci.length) {
    for (const v of voci) lista.push(...await leggiVoce(v, ''));
  } else {
    for (const f of dataTransfer.files) lista.push({ file: f, rel: f.name });
  }
  return lista;
}

/* ============================ Search ============================ */

$('#search').addEventListener('input', (e) => {
  state.filtro = e.target.value;
  renderGriglia();
});

/* ============================ Image lightbox ============================ */

function apriLightbox(el) {
  $('#lightbox-img').src = '/api/raw?path=' + encodeURIComponent(el.percorso);
  $('#lightbox-name').textContent = el.nome;
  $('#lightbox').classList.remove('hidden');
}

function chiudiLightbox() {
  $('#lightbox').classList.add('hidden');
  $('#lightbox-img').src = '';
}

$('#lightbox-close').addEventListener('click', chiudiLightbox);
$('#lightbox').addEventListener('click', (e) => {
  if (e.target === $('#lightbox')) chiudiLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    chiudiLightbox();
    chiudiSidebar();
  }
});

/* ============================ Startup ============================ */

/* Click ripple: the glow starts where you press */
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.btn-primario, #login-btn');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  btn.style.setProperty('--x', ((e.clientX - r.left) / r.width * 100) + '%');
  btn.style.setProperty('--y', ((e.clientY - r.top) / r.height * 100) + '%');
});

/* Multi-device sync: when someone changes the files
   (upload, delete, rename), the other screens refresh on their own */
setInterval(async () => {
  if (!appVisibile()) return;
  if (!$('#upload-bar').classList.contains('hidden')) return; // upload in progress
  if (chiudiDialogo) return; // dialog open: do not disturb
  if (document.hidden) return;
  try {
    const d = await api('/api/files?path=' + encodeURIComponent(state.percorso));
    if (JSON.stringify(d.elementi) !== JSON.stringify(state.elementi)) {
      state.elementi = d.elementi;
      renderBreadcrumb();
      renderGriglia();
    }
  } catch (_) { /* offline or folder gone: ignore */ }
}, 4000);

iniettaIconeStatiche();
controllaSessione();
