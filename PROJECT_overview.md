# PROJECT OVERVIEW — Game Boy Fishing

## In breve

Gioco di pesca retro in stile **Game Boy**, pensato per il telefono. L'intero
gioco vive in un unico file `index.html` (HTML + CSS + JavaScript inline, canvas
2D a risoluzione nativa 160×144, palette verde in stile LCD). Da questa versione
è anche una **PWA installabile e giocabile offline**.

- Scopo: catturare **tutti i pesci di ogni mare e di ogni località** e diventare
  Leggenda del Mare.
- Nessun framework, nessuna dipendenza a runtime: si apre e gira nel browser.
- Progressi salvati in `localStorage`.

## Struttura del progetto

```
gameboy-fishing/
├── index.html                 # Il gioco completo (HTML + CSS + JS inline)
├── manifest.webmanifest       # Metadati PWA
├── sw.js                      # Service worker (cache offline)
├── favicon.png                # Favicon 64x64
├── icons/                     # Icone PWA (192, 512, maskable 512, apple-touch 180)
├── tools/
│   ├── gen-icons.js           # Rigenera le icone (Node, senza dipendenze)
│   ├── smoke-test.js          # Test di boot (jsdom): nessun errore, controlli, PWA
│   └── flow-test.js           # Test flusso TITLE -> LINGUA -> TUTORIAL
├── README.md                  # Guida utente/installazione
└── PROJECT_overview.md        # Questo documento
```

## Comandi (D-pad e tasti)

- **Frecce (D-pad):** muovi il pescatore in città, regola la mira del lancio,
  scegli lo slancio (su/giù) e navighi i menu.
- **A:** lancia la lenza (tieni premuto per caricare la potenza); nei menu conferma / indietro.
- **B:** ritira la lenza e dà lo **strattone** quando il pesce abbocca; durante la
  lotta tienilo per recuperare e molla per non spezzare la lenza.
- **START:** pausa, musica on/off, uscita al menu.
- **SELECT:** apre il menu (acquario, collezione, negozio, città).

Da tastiera (test desktop): frecce/`WASD`, `Z`/`K` = A, `X`/`L` = B, `Invio` = START, `Shift` = SELECT.

## Ciclo di gioco (il "ritmo di pesca")

1. **Mira** con le frecce.
2. **Tieni A** per caricare la potenza e **molla** per lanciare.
3. **Attendi**: al segnale `ABBOCCA!` premi subito **B** per lo strattone.
4. **Lotta** dosando **B** (tensione della lenza) finché non porti il pesce a riva.
5. Il pesce catturato entra nell'**acquario** e nella **collezione** (Fishdex);
   guadagni monete in base a categoria e taglia.

Esiti possibili: `PRESO!`, oppure fallimento (`TROPPO TARDI`, `LENZA SPEZZATA!`,
`LENZA LASCA!`).

## Struttura degli schermi (flusso)

```
title  ->  lang  ->  tutorial  ->  creator  ->  story (prologo)  ->  map
                                                                      │
                                          town  <───────────────────┘
                                          (negozio, capanna/avatar, NPC)
                                          │
                                          └─> game (pesca nella località)
```

- Con un salvataggio esistente, dal `title` si può scegliere **Continua**.
- `tutorial`, `lang` e `story` sono schermi testuali; `map` mostra la carta
  nautica con le località; `town` è l'hub esplorabile con negozio e capanna.

## Progressione, località e mari

Ordine di sblocco delle **10 località** (il primo è gratuito, poi il biglietto
costa 50, 100, 150 … monete a salire):

| # | Località          | Mare / Area        |
|---|-------------------|--------------------|
| 1 | Napoli            | Mar Mediterraneo   |
| 2 | Lofoten           | Mare di Norvegia   |
| 3 | Bijagos           | Africa Occidentale |
| 4 | Grandi Antille    | USA / Caraibi      |
| 5 | Rio delle Amazzoni| Brasile            |
| 6 | Grande Barriera   | Australia          |
| 7 | Monte Fuji        | Giappone           |
| 8 | Kamchatka         | Russia             |
| 9 | Patagonia         | Argentina / Cile   |
| 10| Mare di Ross      | Antartide          |

Ogni località ha pesci suddivisi in **4 categorie (tier)**:

- Tier 1 — **Comuni**
- Tier 2 — **Pregiati**
- Tier 3 — **Ottimi**
- Tier 4 — **Rari**

**Sblocco della località successiva:** servono almeno 3 specie di tier 1, 2 di
tier 2 e 2 di tier 3 catturate nella località corrente.

**Medaglie (Amo) per località:**
- 🥉 **Bronzo:** completati i tier 1, 2 e 3.
- 🥈 **Argento:** come bronzo + almeno un pesce di tier 4.
- 🥇 **Oro:** catturati **tutti** i pesci della località (tutti e 4 i tier).

**Titolo del pescatore** in base alle medaglie d'oro totali: Novizio → Pescatore
→ Pescatore Esperto → Maestro Pescatore → **Leggenda del Mare**. L'Amo d'Oro al
Mare di Ross conclude il viaggio (epilogo).

## Esche (negozio)

| Esca            | Costo | Probabilità [T1,T2,T3,T4] | Note              |
|-----------------|-------|---------------------------|-------------------|
| Verme           | 0     | 0.60 / 0.25 / 0.12 / 0.03 | illimitata        |
| Esca Profumata  | 15    | 0.15 / 0.45 / 0.32 / 0.08 | consumabile       |
| Esca Ottima     | 35    | 0.08 / 0.25 / 0.55 / 0.12 | consumabile       |
| Esca viva       | 60    | 0.05 / 0.12 / 0.08 / 0.75 | consumabile, rari |

Esche migliori aumentano la probabilità di pescare pesci di categoria alta.

## Sistemi tecnici

- **Rendering:** canvas 2D a 160×144, `image-rendering: pixelated`; scene di sfondo
  disegnate a mano per ogni località (Vesuvio, fiordi/aurora, giungla, reef, Fuji,
  ecc.).
- **Input:** stato tasti centralizzato (`setKey` / `consumePress` / `holdMs` /
  `wasTap`) con distinzione tap vs hold (`TAP_MAX_MS`); supporto tastiera per il
  desktop.
- **Audio:** effetti e musica generati via WebAudio (nessun file audio).
- **i18n:** italiano e inglese (oggetto `T`, funzione `t(key)`).
- **Salvataggio:** `localStorage` (monete, specie catturate, avatar, zone
  sbloccate, esche).

## Funzionalità aggiunte in questa versione

### 1. Modalità orizzontale (landscape) su mobile
Ruotando il telefono in orizzontale il gioco passa a **schermo intero**: la
grafica viene ingrandita al centro e compaiono i controlli touch ai lati (D-pad +
SELECT a sinistra, A/B + START a destra), che usano gli stessi tasti della
modalità verticale.
- Attivazione via media query `orientation: landscape` con `max-height: 600px`
  (così scatta sui telefoni ma non su desktop/tablet).
- **Input touch riscritto** con tracciamento multi-dito globale: gestisce
  correttamente le pressioni simultanee (es. direzione + A), il dito che scivola
  tra i tasti e gli eventi `touchend` persi, così nessun tasto resta "incastrato".
  Vale sia per la shell verticale sia per l'overlay landscape.
- Aggiunto supporto `safe-area` per i notch e migliorata la leggibilità dei
  controlli.

### 2. Tutorial alla nuova partita
Schermata **"COME SI GIOCA / HOW TO PLAY"** con 7 pagine sfogliabili, mostrata
dopo la selezione della lingua e prima della creazione del personaggio (solo per
una nuova partita). Spiega lo scopo del gioco e ogni tasto, con piccole icone
disegnate e il ritmo di pesca passo-passo.
- Navigazione: **A** avanti, **B** indietro, **SELECT** salta.
- Testi completi in italiano e inglese (chiavi `tut_*` in `T`).
- Implementazione: stato `screen = "tutorial"`, funzioni `openTutorial`,
  `updateTutorial`, `drawTutorial`, `drawTutorialIcon`, tabella `TUTORIAL_PAGES`.

### 3. PWA giocabile offline
- `manifest.webmanifest` (nome, icone, colori, display fullscreen, orientation any).
- `sw.js`: service worker **cache-first** dell'app shell; cache versionata
  (`CACHE_VERSION`) per gli aggiornamenti.
- Icone generate via codice (`tools/gen-icons.js`, nessuna dipendenza): 192, 512,
  maskable 512, apple-touch 180, favicon 64.
- `index.html` aggiornato con i meta/link PWA e la registrazione del SW (disattivata
  su `file://` così l'apertura locale continua a funzionare).

## Avvio e test

Servi la cartella con un server statico (i service worker richiedono http/https):

```bash
python3 -m http.server 3000   # poi apri http://localhost:3000/
```

Test (richiedono `jsdom` installato temporaneamente con `npm i --no-save jsdom`):

```bash
node tools/smoke-test.js   # boot senza errori, controlli e hook PWA presenti
node tools/flow-test.js    # flusso TITLE -> LINGUA -> TUTORIAL
node tools/gen-icons.js    # rigenera le icone
```

## Idee / possibili sviluppi futuri

- Voce "Come si gioca" richiamabile anche dal menu SELECT (rivedere il tutorial).
- Ulteriori località / specie e obiettivi secondari.
- Statistiche di cattura (record di taglia per specie) più dettagliate nel Fishdex.
- Effetti meteo/ora del giorno per località.
