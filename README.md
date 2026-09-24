# Game Boy Fishing — PWA

Gioco di pesca retro in stile Game Boy. Cattura **tutti i pesci di ogni mare e di
ogni localita'**, sblocca nuove zone sulla mappa del mondo e diventa Leggenda del
Mare. Gira interamente nel browser, funziona **offline** ed e' installabile come
app sul telefono (PWA).

## Struttura dei file

```
gameboy-fishing/
├── index.html                 # Il gioco completo (HTML + CSS + JS inline)
├── manifest.webmanifest       # Metadati PWA (nome, icone, colori, display)
├── sw.js                      # Service worker (cache offline dell'app shell)
├── favicon.png                # Favicon 64x64
├── icons/
│   ├── icon-192.png           # Icona PWA 192x192
│   ├── icon-512.png           # Icona PWA 512x512
│   ├── icon-maskable-512.png  # Icona "maskable" per Android
│   └── apple-touch-icon.png   # Icona home screen iOS (180x180)
└── tools/
    └── gen-icons.js           # Rigenera le icone (Node, senza dipendenze)
```

## Come si gioca

- **Frecce (D-pad):** muovi il pescatore in citta' e regola la mira del lancio.
- **A:** lancia la lenza (tieni premuto per caricare la potenza); nei menu conferma/indietro.
- **B:** ritira la lenza e da' lo **strattone** quando il pesce abbocca; durante la
  lotta tieni premuto per recuperare e molla per non spezzare la lenza.
- **START:** pausa, musica, uscita al menu.
- **SELECT:** apre il menu (acquario, collezione, negozio, citta').

Alla prima "Nuova partita" viene mostrato un **tutorial** che spiega lo scopo del
gioco e ogni tasto.

### Da tastiera (test su desktop)

Frecce o `WASD` = direzioni · `Z`/`K` = A · `X`/`L` = B · `Invio` = START · `Shift` = SELECT.

## Modalita' orizzontale (landscape) su mobile

Ruotando il telefono in orizzontale il gioco passa automaticamente a **schermo
intero**: la grafica viene ingrandita al centro e compaiono i controlli touch ai
lati (D-pad + SELECT a sinistra, A/B + START a destra). I controlli usano gli
stessi tasti della modalita' verticale e supportano piu' dita contemporaneamente
(es. direzione + A insieme). Riportando il telefono in verticale si torna alla
classica shell Game Boy.

> La modalita' landscape a schermo intero si attiva sui telefoni
> (`orientation: landscape` con altezza schermo &le; 600px). Su tablet/desktop
> resta la shell verticale.

## Avvio in locale

I service worker richiedono `http(s)` (non funzionano aprendo il file con doppio
click via `file://`). Servi la cartella con un piccolo server statico:

```bash
# Python 3
python3 -m http.server 3000

# oppure Node
npx serve -l 3000
```

Poi apri `http://localhost:3000/`. Il gioco funziona anche senza server (doppio
click su `index.html`), ma **senza** capacita' offline/installazione.

## Installazione come app (offline)

1. Apri il gioco servito da un URL `https://` (o `http://localhost`).
2. Al primo caricamento il service worker mette in cache tutti i file.
3. **Android/Chrome:** menu ⋮ → *Installa app* / *Aggiungi a schermata Home*.
   **iOS/Safari:** *Condividi* → *Aggiungi a Home*.
4. Da quel momento il gioco parte anche **senza connessione**.

> Per il deploy in produzione basta caricare l'intera cartella su un qualsiasi
> hosting statico (GitHub Pages, Netlify, S3+CloudFront, ecc.) servito via HTTPS.

## Aggiornare il gioco

Il service worker usa una cache versionata. Quando modifichi `index.html` o altri
file in cache, incrementa `CACHE_VERSION` in `sw.js` (es. `gb-fishing-v1` →
`gb-fishing-v2`). Al successivo caricamento online i client scaricano la nuova
versione e cancellano la vecchia cache.

## Rigenerare le icone

Le icone sono generate via codice (nessuna dipendenza, solo Node):

```bash
node tools/gen-icons.js
```

## Salvataggi

I progressi (monete, pesci catturati, avatar, zone sbloccate) sono salvati in
`localStorage` del browser. Disinstallare la PWA o cancellare i dati del sito
azzera i progressi.
