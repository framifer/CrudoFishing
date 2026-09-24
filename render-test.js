// Rendering coverage test: draws EVERY location background and every top-level
// screen once, asserting no runtime error. Also boots with the landscape overlay
// ACTIVE (matchMedia -> true) to exercise the new touch-input code paths and the
// landscape mirror script.
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const errors = [];
function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  const target = {
    canvas: { width: 160, height: 144 },
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => ({}),
    measureText: (s) => ({ width: ("" + s).length * 5 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData: noop,
    fillText: noop, strokeText: noop, drawImage: noop, save: noop, restore: noop,
  };
  return new Proxy(target, { get(t,p){ return p in t ? t[p] : (typeof p==="string"?noop:undefined); }, set(){ return true; } });
}
function build(landscapeActive) {
  errors.length = 0;
  return new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/index.html",
    beforeParse(window) {
      window.__GBF_DEBUG = true;
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
      window.prompt = () => "TESTER";
      window.matchMedia = () => ({ matches: !!landscapeActive, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
      let rafQ = [];
      window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
      window.__frame = (t) => { const q=rafQ; rafQ=[]; q.forEach(cb=>{ try{cb(t);}catch(e){errors.push(e);} }); };
      window.onerror = (m,s,l,c,err)=>{ errors.push(err||m); };
    },
  });
}
function fail(m){ console.error("FAIL: " + m); process.exit(1); }
function errText(){ return errors.map(e=>e&&e.stack?e.stack.split("\n").slice(0,3).join(" / "):String(e)).join(" ;; "); }

// ---- Phase 1: portrait, draw all locations + all screens ----
const dom = build(false);
const { window } = dom;
window.addEventListener("load", () => {
  let T = 1000; const step=(n=1)=>{ for(let i=0;i<n;i++){ window.__frame(T); T+=20; } };
  try {
    step(3);
    const g = window.__gbf;
    if (!g) fail("debug hook missing");

    // Draw every top-level screen once.
    const screens = ["title","lang","tutorial","creator","story","map","town","game"];
    for (const s of screens) {
      g.setScreen(s);
      for (let i=0;i<3;i++){ g.drawOnce(); }
      if (errors.length) fail("drawing screen '" + s + "': " + errText());
    }

    // Draw every location background in the 'game' screen.
    g.setScreen("game");
    for (const loc of g.locations()) {
      if (!g.setLocation(loc)) fail("unknown location: " + loc);
      for (let i=0;i<4;i++){ g.drawOnce(); }
      if (errors.length) fail("drawing location '" + loc + "': " + errText());
    }

    console.log("PASS (portrait): drew " + screens.length + " screens and " + g.locations().length + " locations with no runtime error.");

    // ---- Phase 2: landscape overlay ACTIVE ----
    const dom2 = build(true);
    const w2 = dom2.window;
    w2.addEventListener("load", () => {
      let T2 = 1000; const step2=(n=1)=>{ for(let i=0;i<n;i++){ w2.__frame(T2); T2+=20; } };
      try {
        step2(5);
        // simulate a couple of resize/orientation events that drive the landscape layout()
        w2.dispatchEvent(new w2.Event("resize"));
        w2.dispatchEvent(new w2.Event("orientationchange"));
        step2(5);
        // exercise touch input on landscape controls via synthetic touch events
        const overlay = w2.document.getElementById("lscape-overlay");
        const btn = w2.document.querySelector('#lscape-ab [data-key="a"]');
        if (!overlay) fail("landscape overlay missing");
        if (!btn) fail("landscape A button missing");
        // jsdom lacks TouchEvent; dispatch a generic event to ensure listeners don't crash
        try {
          const ev = new w2.Event("touchstart", { bubbles: true });
          ev.touches = [{ identifier: 1, clientX: 10, clientY: 10 }];
          w2.document.dispatchEvent(ev);
          const ev2 = new w2.Event("touchend", { bubbles: true });
          ev2.touches = [];
          w2.document.dispatchEvent(ev2);
        } catch (e) { errors.push(e); }
        step2(3);
        if (errors.length) fail("landscape phase: " + errText());
        console.log("PASS (landscape): overlay active, resize/orientation/touch handled with no runtime error.");
        process.exit(0);
      } catch (e) { fail(e && e.stack ? e.stack : String(e)); }
    });
    setTimeout(()=>{ console.error("TIMEOUT phase2"); process.exit(2); }, 15000);
  } catch (e) { fail(e && e.stack ? e.stack : String(e)); }
});
setTimeout(()=>{ console.error("TIMEOUT phase1"); process.exit(2); }, 15000);
