// Functional flow test: simulate keyboard input through
//   TITLE -> (new game) -> LANGUAGE -> TUTORIAL -> CREATOR
// and assert that the tutorial screen actually renders its heading text.
// We capture text drawn to the canvas by intercepting fillText.
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

let drawn = [];        // strings drawn this frame window
function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  const target = {
    canvas: { width: 160, height: 144 },
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    measureText: (s) => ({ width: ("" + s).length * 5 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    fillText: (s) => { drawn.push("" + s); },
    strokeText: (s) => { drawn.push("" + s); },
    save: noop, restore: noop,
  };
  return new Proxy(target, {
    get(t, p) { return p in t ? t[p] : (typeof p === "string" ? noop : undefined); },
    set() { return true; },
  });
}

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    class P { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
    class N { connect() { return this; } start() {} stop() {} }
    window.AudioContext = window.webkitAudioContext = class {
      constructor() { this.currentTime = 0; this.destination = new N(); this.state = "running"; }
      createOscillator() { const n = new N(); n.frequency = new P(); n.type = ""; return n; }
      createGain() { const n = new N(); n.gain = new P(); return n; }
      createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
      createBufferSource() { const n = new N(); n.buffer = null; return n; }
      createBiquadFilter() { const n = new N(); n.frequency = new P(); n.type = ""; n.Q = new P(); return n; }
      resume() { return Promise.resolve(); }
    };
    window.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
    // controllable RAF
    let rafQ = [];
    window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
    window.__frame = (t) => { const q = rafQ; rafQ = []; q.forEach((cb) => cb(t)); };
  },
});

const { window } = dom;

// helper: dispatch a keydown+keyup for a physical code, then advance frames
function press(code, tRef) {
  window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
  window.__frame(tRef.t); tRef.t += 20;
  window.dispatchEvent(new window.KeyboardEvent("keyup", { code }));
  window.__frame(tRef.t); tRef.t += 20;
}
function tick(tRef, n = 1) { for (let i = 0; i < n; i++) { window.__frame(tRef.t); tRef.t += 20; } }
function frameText(tRef) { drawn = []; window.__frame(tRef.t); tRef.t += 20; return drawn.join(" | "); }

window.addEventListener("load", () => {
  try {
    const tRef = { t: 1000 };
    tick(tRef, 3);

    // TITLE: no save -> pressing START/A starts a new game and opens language select
    let t = frameText(tRef);
    if (!/PREMI START|PRESS START|CONTINUA|NUOVA PARTITA|NEW GAME/i.test(t)) {
      throw new Error("Title screen text not found. Got: " + t);
    }
    press("Enter", tRef); // START -> new game (no save) -> language select
    tick(tRef, 2);

    t = frameText(tRef);
    if (!/LINGUA|LANGUAGE/i.test(t)) throw new Error("Language screen not reached. Got: " + t);

    // choose Italian (already default) and confirm with A -> should open TUTORIAL
    press("KeyZ", tRef); // A
    tick(tRef, 2);

    t = frameText(tRef);
    if (!/COME SI GIOCA|HOW TO PLAY/i.test(t)) {
      throw new Error("Tutorial screen did not appear after language select. Got: " + t);
    }
    // page 1 should mention the goal heading
    if (!/SCOPO|GOAL/i.test(t)) throw new Error("Tutorial page 1 (goal) heading missing. Got: " + t);

    // advance through all tutorial pages with A; last A should finish -> creator
    let sawDpad = false, sawAB = false;
    for (let i = 0; i < 8; i++) {
      press("KeyZ", tRef); // A = next
      tick(tRef, 1);
      const s = frameText(tRef);
      if (/DIREZIONALE|D-PAD/i.test(s)) sawDpad = true;
      if (/TASTO A|A BUTTON|TASTO B|B BUTTON/i.test(s)) sawAB = true;
      if (!/COME SI GIOCA|HOW TO PLAY/i.test(s)) break; // left the tutorial (reached creator)
    }
    if (!sawDpad) throw new Error("Never saw the D-pad tutorial page.");
    if (!sawAB) throw new Error("Never saw the A/B tutorial page.");

    console.log("PASS: TITLE -> LANGUAGE -> TUTORIAL flow works; tutorial shows goal, D-pad and A/B pages.");
    process.exit(0);
  } catch (e) {
    console.error("FAIL: " + e.message);
    process.exit(1);
  }
});

setTimeout(() => { console.error("TIMEOUT"); process.exit(2); }, 10000);
