// Behavioural test: verifies the CORE mechanics actually produce effects, by
// inspecting the persisted save (localStorage "crudoFishing.save.v1") which the
// game autosaves after each catch and on shop/zone actions.
// Checks:
//   * after enough fishing cycles, the aquarium becomes non-empty (a fish was caught)
//   * the collection (caught) records at least one species
//   * coins increased above the starting value at some point
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const SAVE_KEY = "crudoFishing.save.v1";
const errors = [];
let drawn = [];
function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  const target = {
    canvas: { width: 160, height: 144 },
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => ({}),
    measureText: (s) => ({ width: ("" + s).length * 5 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData: noop,
    fillText: (s) => { drawn.push("" + s); }, strokeText: (s) => { drawn.push("" + s); },
    drawImage: noop, save: noop, restore: noop,
  };
  return new Proxy(target, { get(t, p){ return p in t ? t[p] : (typeof p==="string"?noop:undefined); }, set(){ return true; } });
}
const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true,
  url: "https://localhost/index.html",   // enables window.localStorage in jsdom
  beforeParse(window) {
    window.__GBF_DEBUG = true;   // opt in to the read-only state hook
    window.HTMLCanvasElement.prototype.getContext = function(){ return makeCtx(); };
    class P { setValueAtTime(){} linearRampToValueAtTime(){} exponentialRampToValueAtTime(){} setTargetAtTime(){} }
    class N { connect(){ return this; } start(){} stop(){} disconnect(){} }
    window.AudioContext = window.webkitAudioContext = class {
      constructor(){ this.currentTime=0; this.destination=new N(); this.state="running"; this.sampleRate=44100; }
      createOscillator(){ const n=new N(); n.frequency=new P(); n.type=""; return n; }
      createGain(){ const n=new N(); n.gain=new P(); return n; }
      createBuffer(){ return { getChannelData:()=>new Float32Array(64) }; }
      createBufferSource(){ const n=new N(); n.buffer=null; n.playbackRate=new P(); return n; }
      createBiquadFilter(){ const n=new N(); n.frequency=new P(); n.type=""; n.Q=new P(); return n; }
      createStereoPanner(){ const n=new N(); n.pan=new P(); return n; }
      resume(){ return Promise.resolve(); }
    };
    window.navigator.vibrate = () => true;
    window.prompt = () => "TESTER";   // creator name entry (real browsers have prompt)
    window.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
    let rafQ = [];
    window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
    window.__frame = (t) => { const q=rafQ; rafQ=[]; q.forEach(cb=>{ try{cb(t);}catch(e){errors.push(e);} }); };
    window.onerror = (m,s,l,c,err)=>{ errors.push(err||m); };
  },
});
const { window } = dom;
function fail(m){ console.error("FAIL: " + m); process.exit(1); }
function save(){ try { return JSON.parse(window.localStorage.getItem(SAVE_KEY) || "null"); } catch(e){ return null; } }

window.addEventListener("load", () => {
  let T = 1000;
  const step = (n=1)=>{ for(let i=0;i<n;i++){ window.__frame(T); T+=20; } };
  const tap = (code, h=1)=>{ window.dispatchEvent(new window.KeyboardEvent("keydown",{code})); step(h); window.dispatchEvent(new window.KeyboardEvent("keyup",{code})); step(1); };
  const hold = (code, f)=>{ window.dispatchEvent(new window.KeyboardEvent("keydown",{code})); step(f); window.dispatchEvent(new window.KeyboardEvent("keyup",{code})); step(1); };
  const txt = ()=>{ drawn=[]; window.__frame(T); T+=20; return drawn.join(" | "); };

  try {
    step(3);
    // new game -> language(IT) -> tutorial (skip) -> creator
    tap("Enter"); step(2);
    tap("KeyZ"); step(2);                 // choose IT
    tap("ShiftLeft"); step(2);            // SELECT = skip tutorial
    // CREATOR: navigate down to the CONFERMA row (row 7 of CREATOR_ROWS) then B.
    for (let i=0;i<7;i++){ tap("ArrowDown"); step(1); }
    tap("KeyX"); step(2);                 // B on CONFERMA -> saveGame + intro story
    // dismiss the intro story with B until we reach the map
    for (let i=0;i<40;i++){ const s=txt(); if (!/PROLOG|PROLOGUE/i.test(s)) break; tap("KeyX"); step(1); }
    // On the MAP: enter the first (unlocked) location -> town
    for (let i=0;i<25;i++){ const s=txt(); if (/CABINA|NEGOZIO|ACQUARIO|MOLO|PARTENZE|CABIN|SHOP|TANK|CREEK/i.test(s)) break; tap("KeyZ"); step(2); tap("Enter"); step(2); tap("KeyX"); step(1); }

    // TOWN: walker starts at col 9,row 6. Fishing jetty end "E" is at col 2-3,row 10.
    // Walk LEFT to col ~2, then DOWN onto the jetty; stepping onto E enters fishing.
    // Each move is one tile with a short animation, so hold direction a few frames.
    const walkTo = (code, times) => { for (let i=0;i<times;i++){ hold(code, 3); step(4); } };
    walkTo("ArrowLeft", 8);    // reach the left column
    walkTo("ArrowDown", 8);    // walk down the planks onto the fishing jetty end
    // Fallback: also try interacting (A) while facing down to start fishing.
    tap("KeyZ"); step(3);

    // DIAGNOSTIC: what screen are we on right before fishing?
    console.error("DIAG pre-fishing frame text: " + txt().slice(0,200));

    const before = save();
    const coinsBefore = before ? (before.coins||0) : 0;

    const gbf = window.__gbf;
    if (!gbf) fail("debug hook window.__gbf not present (is __GBF_DEBUG set before load?)");
    if (gbf.screen !== "game") fail("expected to be in the game screen, but screen=" + gbf.screen);

    const down = (code)=>window.dispatchEvent(new window.KeyboardEvent("keydown",{code}));
    const up   = (code)=>window.dispatchEvent(new window.KeyboardEvent("keyup",{code}));
    let maxCoins = coinsBefore;
    const seen = {};

    for (let cast=0; cast<40; cast++){
      // AIM -> hold A to charge, release to cast
      hold("KeyZ", 6); step(3);
      if (gbf.state === "FLYING" || gbf.state === "WAITING") seen.cast = 1;

      // wait for a BITE, then strike with a B tap
      let struck = false;
      for (let w=0; w<200 && !struck; w++){
        step(1);
        if (gbf.state === "BITE") { seen.bite = 1; tap("KeyX"); }
        if (gbf.state === "FIGHT") { seen.fight = 1; struck = true; }
        if (gbf.state === "AIM") break; // missed the bite window -> recast
      }
      if (!struck) continue;

      // FIGHT: feedback control. Hold B when tension is below the safe-zone
      // center, release when above -> keeps tension inside the moving safe band,
      // which raises catchProg until the fish is landed.
      let holding = false;
      for (let k=0;k<1500;k++){
        const f = gbf.fight;
        if (!f || gbf.state !== "FIGHT") break;
        const lo = (f.safeLo != null ? f.safeLo : 0.35);
        const hi = (f.safeHi != null ? f.safeHi : 0.65);
        const center = (lo + hi) / 2;
        const want = (f.tension || 0) < center;   // below center -> pull (hold B)
        if (want && !holding) { down("KeyX"); holding = true; }
        else if (!want && holding) { up("KeyX"); holding = false; }
        step(1);
      }
      if (holding) up("KeyX");
      step(30);  // let HOOKED/LOST resolve + autosave

      if (gbf.aquariumLen > 0 && gbf.caughtCount > 0) seen.caught = 1;
      if (gbf.coins > maxCoins) maxCoins = gbf.coins;

      if (gbf.aquariumLen > 0 && gbf.caughtCount > 0){
        if (errors.length) fail("errors while fishing: " + errors.map(String).join(" ;; "));
        // primary check: the mechanic produced a catch in memory
        const sv = save();
        const persisted = !!(sv && (sv.aquarium||[]).length > 0 && sv.caught && Object.keys(sv.caught).length > 0);
        const coinsUp = gbf.coins > coinsBefore;
        console.log(
          `PASS: fishing mechanic works -> aquarium=${gbf.aquariumLen}, species=${gbf.caughtCount}, ` +
          `coins ${coinsBefore}->${gbf.coins} (increased: ${coinsUp}) after ${cast+1} casts. ` +
          `states seen=${JSON.stringify(seen)}. save persisted=${persisted}.`
        );
        if (!coinsUp) fail("caught a fish but coins did not increase — reward logic broken.");
        if (!persisted) fail("caught a fish but localStorage save was not written — persistence broken.");
        process.exit(0);
      }
      if (errors.length) fail("errors during cast " + cast + ": " + errors.map(e=>e&&e.stack?e.stack.split("\n").slice(0,4).join(" / "):String(e)).join(" ;; "));
    }
    fail("no fish caught after 40 casts. states seen=" + JSON.stringify(seen) + " last save=" + JSON.stringify(save()));
  } catch(e){ fail(e && e.stack ? e.stack : String(e)); }
});
setTimeout(()=>{ console.error("TIMEOUT"); process.exit(2); }, 40000);
