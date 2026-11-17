# Nuvola Personale — Personal Cloud

Your own private cloud, Google Drive style, but it lives **on your computer**: upload files and folders, download them, rename or delete them from any device, protected by username and password.

---

## 🇬🇧 English Description & Setup

### What is this?

**Nuvola Personale** is a self-hosted, single-user personal cloud server built with **Node.js + Express**. Everything is stored on your machine, in the `uploads/` folder. You can reach it from your browser at home (local network) or from anywhere in the world through an encrypted **Tailscale Funnel** link — no router ports to open, no subscriptions.

### Features

- **Single-user login** with session cookie (lasts 7 days, then it asks again)
- **Upload files and folders** — drag & drop or buttons, up to 50 files per batch
- **Download** any file, and **any folder as a ZIP** built on the fly
- Create, **rename**, delete files and folders (delete asks for confirmation)
- **Full-screen image preview** (lightbox) — just click an image
- Instant **search** box
- **Auto-refreshing interface**: if another device uploads or deletes something, your screen updates itself after a few seconds
- **Brute-force protection**: after 10 failed logins, the account locks for 15 minutes
- Responsive **dark UI**
- **English interface** — short, clear labels on every device

### Requirements

- [Node.js](https://nodejs.org) **version 16 or newer** (LTS recommended) — that's all
- Windows, macOS or Linux

### Quick start

1. **Install Node.js** (once): download the LTS version from https://nodejs.org and install it with default options.
2. **Set your credentials**: open `config.json` with any text editor and change `username` and `password` (see [Configuration](#configuration--configjson)).
3. **Start the cloud**:
   - Windows: double-click **`avvia-windows.bat`**
   - macOS / Linux: `./avvia-mac-linux.sh`

   The first start downloads the dependencies automatically (~30 seconds, needs internet). A console window opens: the cloud runs **as long as that window stays open** (or as a background service, if you set that up).
4. Open **http://localhost:3000** on that computer and log in.

### Configuration — `config.json`

```json
{
  "nomeCloud": "Nuvola Personale",
  "username": "your-username",
  "password": "your-password",
  "porta": 3000,
  "maxFileMB": 2048
}
```

| Key | What it does |
|---|---|
| `nomeCloud` | The name shown in the interface |
| `username` | **Your login username — change it here** (default in this repository: `Username`) |
| `password` | **Your login password — change it here** (default in this repository: `Password`) |
| `porta` | Server port (default `3000`; change it if the port is busy) |
| `maxFileMB` | Maximum size of a single uploaded file, in MB (default 2048 = 2 GB) |

**To change username or password:** edit `config.json`, save, then **restart the cloud** (close the console window and start it again). The repository ships with default credentials just so the cloud starts: **change both to your own values before real use** — they are public on GitHub. Built-in safety: if you ever leave `username` or `password` empty, the server refuses login until you set them again. The login screen shows the same limits automatically.

> ⚠️ Use a **long, unique password** — especially if you enable access from outside your home (see below).

### Connecting from other devices

| Where from | Address | Notes |
|---|---|---|
| Same computer | `http://localhost:3000` | Always works when the cloud is running |
| Same Wi-Fi network | `http://192.168.x.x:3000` | The exact address is printed by the server at startup ("From a phone/PC on the same Wi-Fi"). Allow Node.js in the firewall if asked |
| **Any network in the world** | `https://your-pc-name.ts.net` | **Tailscale Funnel** — see below |

**Access from anywhere (Tailscale Funnel):** run **`attiva-link-fisso.bat`**. It installs/uses [Tailscale](https://tailscale.com) (free), creates an encrypted tunnel and publishes a **permanent HTTPS address** like `https://nome-tuo-pc.ts.net`. Save that address in your phone's bookmarks: it never changes, and it works on mobile data, school Wi-Fi, a friend's house — with **just a browser, no app needed** on the other device. The link stays alive across reboots if you also run `imposta-avvio-automatico.bat` (once per computer).

### Helper scripts

| Script | Purpose |
|---|---|
| `avvia-windows.bat` | Start the cloud on Windows (first run: auto-installs dependencies) |
| `avvia-mac-linux.sh` | Start the cloud on macOS / Linux |
| `attiva-link-fisso.bat` | Activate the permanent public link (Tailscale Funnel, port 3000) |
| `link-automatico.cmd` | Used by auto-start: waits for Tailscale, then activates the link |
| `imposta-avvio-automatico.bat` | Once per computer: registers the link auto-start at boot |
| `rimuovi-avvio-automatico.bat` | Removes the auto-start |
| `controllo-diagnostico.bat` | Runs 4 checks (Tailscale, funnel, cloud, public link) and explains failures |

### How it works under the hood

- **Server**: Node.js + Express, single process. The static interface lives in `public/`, your files live in `uploads/` on the server machine's disk.
- **Authentication**: session cookie signed with an auto-generated secret (`.session-secret`). Every API route is protected by a `requireLogin` middleware; the login route has an anti-brute-force middleware (10 failed attempts → 15-minute lock).
- **Uploads**: handled by `multer` (up to 50 files per request), with the size limit read from `maxFileMB` in `config.json`.
- **Folder download**: `archiver` streams a ZIP file on the fly, directly to the browser — no temporary files.
- **Interface**: plain HTML/CSS/JS in `public/`, which polls the server every few seconds so multiple devices stay in sync.

Main API endpoints:

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/login` | Login (rate-limited) |
| POST | `/api/logout` | Logout |
| GET | `/api/session` | Check if logged in |
| GET | `/api/files` | List files/folders of a path |
| POST | `/api/upload` | Upload up to 50 files |
| POST | `/api/folder` | Create a folder |
| GET | `/api/download` | Download a file (or a folder as ZIP) |
| GET | `/api/raw` | Raw content (used by the image lightbox) |
| POST | `/api/delete` | Delete a file/folder |
| POST | `/api/rename` | Rename a file/folder |
| GET | `/api/tree` | Folder tree for the sidebar |
| GET | `/api/stats` | Storage statistics |

### Security — what is protected and what to watch out for

- All remote access goes through an **encrypted HTTPS tunnel** (Tailscale): nobody on the network can read your data.
- **Brute-force protection**: 10 wrong attempts lock the login for 15 minutes.
- Without your credentials, whoever finds the link only reaches the login screen.
- **Real risks to know**: anyone with physical access to the PC can read `config.json`; a malware-infected PC or phone can steal the password; beware of fake links that look like your cloud — use only your saved address.
- `config.json` contains the credentials **in plain text**: if you publish this project on GitHub, **change the username and password to safe values first** (or keep the repository private).

### Troubleshooting

| Problem | Solution |
|---|---|
| "Port 3000 already in use" | Change `"porta"` in `config.json` (e.g. 3001) and restart |
| Phone doesn't connect on Wi-Fi | Same Wi-Fi? Allow Node.js in the firewall |
| The `ts.net` link doesn't respond | Is the PC on? Is the cloud window open? Run `controllo-diagnostico.bat` and check the Tailscale icon near the clock |
| "File too large" | Raise `maxFileMB` in `config.json` |
| Too many wrong passwords | Wait 15 minutes from the last error: you get 10 more attempts |
| Forgotten password | Set it again in `config.json` and restart |
| "node is not recognized" | Install Node.js and reopen the window |
| Antivirus deletes the ZIP/scripts | Add your project folder to the antivirus exclusions (false positives on `.bat`/`.js` are common) |

---

## 🇮🇹 Descrizione e Configurazione in Italiano

Il tuo cloud privato, in stile Google Drive ma solo tuo: carichi file e cartelle, li scarichi, li rinomini o li elimini da qualsiasi dispositivo, protetti da username e password. Tutto vive sul tuo computer.

### 1. Avviare il cloud (la prima volta e tutte le volte)

1. **Installa Node.js** (una volta sola): scarica la versione LTS da https://nodejs.org e installala con le opzioni predefinite.
2. **Imposta le tue credenziali**: apri il file `config.json` con un editor di testo e cambia `username` e `password`. Usa una password lunga e unica, soprattutto se accedi anche da fuori casa.
3. **Avvia il cloud**:
   - Windows: doppio clic su **`avvia-windows.bat`**
   - Mac/Linux: `./avvia-mac-linux.sh`

   La prima volta scarica da solo le dipendenze (~30 secondi, serve Internet). Si apre una finestra: il cloud funziona finché quella finestra è aperta (o come servizio in background, se lo hai impostato).
4. Apri **http://localhost:3000** su quel computer ed entra con le credenziali.

### 2. Dove si cambiano username e password

Tutto sta in **`config.json`**:

| Chiave | A cosa serve |
|---|---|
| `nomeCloud` | Il nome mostrato nell'interfaccia |
| `username` | **Il tuo username di accesso — si cambia qui** (default su GitHub: `Username`) |
| `password` | **La tua password — si cambia qui** (default su GitHub: `Password`) |
| `porta` | Porta del server (default `3000`) |
| `maxFileMB` | Peso massimo di un singolo file caricato, in MB (default 2048 = 2 GB) |

Dopo ogni modifica: **salva il file e riavvia il cloud** (chiudi e riapri la finestra del server). Su GitHub le credenziali sono valori provvisori solo per far partire il cloud: **cambiali entrambi prima del primo uso vero** — sono pubblici. Protezione integrata: se un giorno lasci `username` o `password` vuoti, il server rifiuta il login finché non li reimposti.

### 3. Connettersi dal PC che ha avviato il cloud

Sul computer dove hai avviato il cloud, apri il browser su:

```
http://localhost:3000
```

Il login dura 7 giorni, poi te le ridomanda.

### 4. Connettersi dalla STESSA rete Wi-Fi

(casa, ufficio: telefono, tablet o PC collegati allo stesso modem/router)

1. Il cloud deve essere attivo sul computer principale.
2. All'avvio, il server stampa un indirizzo tipo `http://192.168.x.x:3000` — cerca nel testo della finestra la riga «From a phone/PC on the same Wi-Fi».
3. Dal telefono (con lo stesso Wi-Fi), apri il browser e scrivi quell'indirizzo.
4. Se non si connette: consenti Node.js nel firewall quando Windows lo chiede, e controlla che telefono e PC siano davvero sullo stesso Wi-Fi.

Nota: l'indirizzo `192.168...` può cambiare se il router riassegna gli IP — in quel caso ri-guardalo nella finestra del server.

### 5. Connettersi da una rete DIVERSA (fuori casa: dati mobili, scuola, un amico)

Doppio clic su **`attiva-link-fisso.bat`**:

**La prima volta (una sola):**
1. Lo script installa Tailscale (gratuito, senza carta di credito), se manca.
2. Si apre il browser: accedi con Google, Microsoft o GitHub.
3. Alla fine ti mostra il tuo **indirizzo permanente**, tipo `https://nome-tuo-pc.ts.net`.
4. **Salva subito quell'indirizzo** sul telefono: resta sempre lo stesso.

**Dopo:** con `imposta-avvio-automatico.bat` (esegui una volta per PC) il link si riattiva **da solo a ogni accensione** — non dovrai più lanciare niente a mano. Poi apri il tuo indirizzo `https://nome-tuo-pc.ts.net` da qualsiasi dispositivo e qualsiasi rete: basta il browser, nessuna app dall'altra parte.

**Condizioni perché il link funzioni:** il PC principale acceso e con Internet. Funziona anche cambiando Wi-Fi, perché passa da un tunnel criptato — senza aprire porte sul router.

**Differenza col punto 4:** l'indirizzo `192.168.x.x` esiste solo dentro casa tua; il link `ts.net` raggiunge il tuo PC da qualsiasi rete del mondo.

### 6. Come si usa

| Azione | Come si fa |
|:---|:---|
| Caricare file o cartelle | Pulsanti «Upload file» e «Upload folder» nella barra laterale, oppure trascinali nella pagina |
| Creare una cartella | Pulsante «New folder» |
| Scaricare un file | Clic sul file; per una cartella usa l'icona di download sulla scheda (viene scaricata come ZIP) |
| Rinominare / eliminare | Icone sulla scheda del file (l'eliminazione chiede conferma) |
| Vedere un'immagine | Clic sull'immagine → anteprima a schermo intero |
| Cercare | Casella in alto a destra |
| Mostrare la password al login | Icona a occhio nel campo password |
| Uscire | Pulsante rosso «Sign out» in basso nella barra laterale |

L'interfaccia è in inglese: «Sign in» = accedi, «Upload file» = carica file, «Upload folder» = carica cartella, «New folder» = nuova cartella, «Rename» = rinomina, «Delete» = elimina, «Cancel» = annulla, «Confirm» = conferma, «Sign out» = esci.

Se più dispositivi usano il cloud insieme, le schermate si aggiornano da sole ogni pochi secondi.

### 7. Come funziona tutto (sotto il cofano)

- **Server**: Node.js + Express, un solo processo. L'interfaccia sta in `public/`, i tuoi file in `uploads/` sul disco del computer server.
- **Accesso**: sessione firmata con un segreto generato automaticamente (`.session-secret`). Ogni API richiede il login; il login è protetto da anti-forza-bruta (10 tentativi sbagliati → blocco di 15 minuti).
- **Caricamenti**: gestiti da `multer` (fino a 50 file per volta), con limite letto da `maxFileMB`.
- **Scaricamento cartelle**: `archiver` crea lo ZIP al volo e lo manda direttamente al browser, senza file temporanei.
- **Interfaccia**: HTML/CSS/JS in `public/`, che interroga il server ogni pochi secondi — per questo più dispositivi restano sincronizzati.

Le API principali: `/api/login`, `/api/logout`, `/api/session`, `/api/files`, `/api/upload`, `/api/folder`, `/api/download`, `/api/raw`, `/api/delete`, `/api/rename`, `/api/tree`, `/api/stats`.

### 8. File e impostazioni importanti

- **`config.json`** — username, password, porta e limite di peso per singolo file. Dopo una modifica, riavvia il cloud.
- **`uploads/`** — qui vivono tutti i tuoi file. **Fai dei backup di questa cartella**: se porti il cloud su un altro PC, porta con te anche questa.
- **Limite di caricamento**: se un file supera `maxFileMB` il sistema lo rifiuta e ti mostra il limite esatto.

### 9. Problemi comuni

| Problema | Soluzione |
|:---|:---|
| «Port 3000 already in use» | Cambia `"porta"` in `config.json` (es. 3001) e riavvia |
| Il telefono non si connette in Wi-Fi | Stesso Wi-Fi? Firewall: consenti Node.js |
| Il link `ts.net` non risponde | PC acceso? Cloud attivo? Lancia `controllo-diagnostico.bat` e controlla l'icona Tailscale vicino all'orologio |
| «File too large» | Alza `maxFileMB` in `config.json` |
| Ho sbagliato troppo la password | Attendi 15 minuti dall'ultimo errore: poi tornano 10 tentativi |
| Password dimenticata | Rimettila in `config.json` e riavvia |
| «node is not recognized» | Installa Node.js e riapri la finestra |
| L'antivirus elimina ZIP o script | Aggiungi la cartella del progetto alle esclusioni (falsi positivi sui `.bat`/`.js` molto comuni) |

### 10. Sicurezza — cosa è protetto e cosa attenzione

- Tutti gli accessi da fuori casa passano da un **tunnel criptato HTTPS**: sulla rete (anche Wi-Fi pubblici) nessuno può leggere i tuoi dati.
- **Anti forza bruta**: dopo 10 tentativi sbagliati, il login si blocca per 15 minuti dall'ultimo errore.
- Senza le tue credenziali, chi trova il link arriva solo alla schermata di login.
- **Rischi reali da conoscere**: chi ha accesso fisico al PC può leggere `config.json`; un PC o telefono infettato da malware può registrare la password; diffida di link "finti" che sembrano il tuo cloud — usa solo il tuo indirizzo salvato.
- `config.json` contiene le credenziali **in chiaro**: se pubblichi il progetto su GitHub, **prima cambia username e password con valori sicuri** (oppure tieni il repository privato).
- Per questo: **password lunga e unica**, solo tua.
