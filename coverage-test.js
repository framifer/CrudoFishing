// Deep coverage test: drives the game through the MAJOR mechanics and captures
// any real runtime error (ReferenceError/TypeError/...) thrown while updating or
// rendering each screen and state. It does NOT assert pixels; it asserts "no
// exception was thrown while exercising this path".
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

const errors = [];
let drawn = [];
function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  const target = {
    canvas: { width: 160, height: 144 },
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => ({}),
    measureText: (s) => ({ width: ("" + s).length * 5 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
    fillText: (s) => { drawn.push("" + s); },
    strokeText: (s) => { drawn.push("" + s); },
    drawImage: noop, save: noop, restore: noop,
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
    class P { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime() {} }
    class N { connect() { return this; } start() {} stop() {} disconnect() {} }
    window.AudioContext = window.webkitAudioContext = class {
      constructor() { this.currentTime = 0; this.destination = new N(); this.state = "running"; this.sampleRate = 44100; }
      createOscillator() { const n = new N(); n.frequency = new P(); n.type = ""; return n; }
      createGain() { const n = new N(); n.gain = new P(); return n; }
      createBuffer() { return { getChannelData: () => new Float32Array(64) }; }
      createBufferSource() { const n = new N(); n.buffer = null; return n; }
      createBiquadFilter() { const n = new N(); n.frequency = new P(); n.type = ""; n.Q = new P(); return n; }
      createStereoPanner() { const n = new N(); n.pan = new P(); return n; }
      resume() { return Promise.resolve(); }
    };
    window.navigator.vibrate = () => true;
    window.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
    let rafQ = [];
    window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
    window.__frame = (t) => { const q = rafQ; rafQ = []; q.forEach((cb) => { try { cb(t); } catch (e) { errors.push(e); } }); };
    window.addEventListener("error", (e) => errors.push(e.error || e.message));
    window.onerror = (m, s, l, c, err) => { errors.push(err || m); };
  },
});
const { window } = dom;

function fail(msg) { console.error("FAIL: " + msg); process.exit(1); }

window.addEventListener("load", () => {
  let T = 1000;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { window.__frame(T); T += 20; } };
  const tap = (code, holdFrames = 1) => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    step(holdFrames);
    window.dispatchEvent(new window.KeyboardEvent("keyup", { code }));
    step(1);
  };
  const hold = (code, frames) => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
    step(frames);
    window.dispatchEvent(new window.KeyboardEvent("keyup", { code }));
    step(1);
  };
  const frameText = () => { drawn = []; window.__frame(T); T += 20; return drawn.join(" | "); };
  const checkErr = (where) => {
    if (errors.length) fail("Runtime error during [" + where + "]: " +
      errors.map(e => (e && e.stack) ? e.stack.split("\n").slice(0,3).join(" / ") : String(e)).join(" ;; "));
  };

  try {
    step(3); checkErr("boot");

    tap("Enter"); step(2); checkErr("title->new game");
    let s = frameText();
    if (!/LINGUA|LANGUAGE/i.test(s)) fail("language screen not reached: " + s);

    tap("KeyZ"); step(2); checkErr("lang confirm");
    s = frameText();
    if (!/COME SI GIOCA|HOW TO PLAY/i.test(s)) fail("tutorial not shown: " + s);

    for (let i = 0; i < 9; i++) {
      tap("KeyZ"); step(1); checkErr("tutorial page " + i);
      s = frameText();
      if (!/COME SI GIOCA|HOW TO PLAY/i.test(s)) break;
    }
    checkErr("tutorial->creator");

    ["ArrowDown","ArrowRight","ArrowLeft","ArrowUp","ArrowRight"].forEach(c => { tap(c); });
    checkErr("creator navigation");
    for (let i = 0; i < 40; i++) {
      tap("Enter"); step(1);
      tap("KeyZ"); step(1);
      s = frameText();
      checkErr("creator/story loop " + i);
      if (/MAR |SEA|Mediterraneo|A = |B = |LANCIA|CAST|WAITING|ATTESA|MENU/i.test(s)) break;
    }
    checkErr("post-creator");

    for (let i = 0; i < 30; i++) {
      tap("KeyX"); step(1);
      frameText();
      checkErr("story advance " + i);
    }

    ["ArrowRight","ArrowDown","ArrowLeft","ArrowUp"].forEach(c => { tap(c); step(1); });
    checkErr("map navigation");
    tap("KeyZ"); step(3); tap("Enter"); step(3);
    checkErr("enter location/town");

    for (let round = 0; round < 3; round++) {
      tap("ShiftLeft"); step(2);
      ["ArrowDown","ArrowDown","ArrowUp"].forEach(c => { tap(c); step(1); });
      tap("KeyX"); step(2);
      checkErr("menu round " + round + " enter");
      ["ArrowDown","ArrowUp","ArrowLeft","ArrowRight"].forEach(c => { tap(c); step(1); });
      tap("KeyX"); step(1);
      tap("KeyZ"); step(2);
      checkErr("menu round " + round + " browse");
    }

    tap("KeyZ"); step(2);
    for (let cast = 0; cast < 12; cast++) {
      tap("ArrowLeft"); tap("ArrowRight"); tap("ArrowUp"); tap("ArrowDown");
      hold("KeyZ", 8); step(2);
      checkErr("cast " + cast);
      step(120);
      checkErr("waiting " + cast);
      for (let k = 0; k < 40; k++) {
        tap("KeyX"); step(2);
        if (k % 3 === 0) step(3);
      }
      checkErr("fight/reel " + cast);
      step(60);
      checkErr("result " + cast);
    }

    tap("Enter"); step(2);
    ["ArrowDown","ArrowUp"].forEach(c => { tap(c); step(1); });
    tap("KeyX"); step(2);
    tap("Enter"); step(2);
    checkErr("pause menu");

    step(30); checkErr("final");

    console.log("PASS: deep coverage — title, language, tutorial, creator, story, map, town, menus, full fishing cycles and pause all ran with NO runtime errors.");
    process.exit(0);
  } catch (e) {
    fail((e && e.stack) ? e.stack : String(e));
  }
});

setTimeout(() => { console.error("TIMEOUT"); process.exit(2); }, 30000);
