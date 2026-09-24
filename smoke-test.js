// Boot/smoke test for Game Boy Fishing using jsdom.
// jsdom has no canvas 2D backend, so we install a no-op CanvasRenderingContext2D
// stub. This does NOT test rendering pixels — it verifies that:
//   1) the game script parses and boots with no runtime error,
//   2) both control sets carry data-key attributes and are wired,
//   3) requestAnimationFrame loop can tick without throwing,
//   4) the landscape overlay and PWA hooks exist.
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");

// --- Canvas 2D stub: every method is a no-op, gradients return a stub too. ---
function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  return new Proxy(
    {
      canvas: { width: 160, height: 144 },
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      measureText: (s) => ({ width: ("" + s).length * 5 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      save: noop, restore: noop,
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        // any unknown property is treated as a no-op function or writable field
        return typeof prop === "string" ? noop : undefined;
      },
      set() { return true; },
    }
  );
}

let errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  beforeParse(window) {
    // stub canvas
    window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    // stub AudioContext (WebAudio) so SFX setup never throws
    class FakeParam { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
    class FakeNode { connect() { return this; } start() {} stop() {} }
    window.AudioContext = window.webkitAudioContext = class {
      constructor() { this.currentTime = 0; this.destination = new FakeNode(); this.state = "running"; }
      createOscillator() { const n = new FakeNode(); n.frequency = new FakeParam(); n.type = ""; return n; }
      createGain() { const n = new FakeNode(); n.gain = new FakeParam(); return n; }
      createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
      createBufferSource() { const n = new FakeNode(); n.buffer = null; return n; }
      createBiquadFilter() { const n = new FakeNode(); n.frequency = new FakeParam(); n.type = ""; n.Q = new FakeParam(); return n; }
      resume() { return Promise.resolve(); }
    };
    // stub matchMedia (jsdom lacks it; real browsers always have it)
    window.matchMedia = window.matchMedia || function () {
      return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
    };
    // capture runtime errors
    window.addEventListener("error", (e) => errors.push(e.error || e.message));
    window.onerror = (msg) => { errors.push(msg); };
    // localStorage stub is provided by jsdom
    // requestAnimationFrame: run a few frames synchronously via our own driver
    let rafQ = [];
    window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
    window.__drainRAF = (frames, t0) => {
      for (let i = 0; i < frames; i++) {
        const q = rafQ; rafQ = [];
        q.forEach((cb) => cb(t0 + i * 16.7));
      }
    };
  },
});

const { window } = dom;

function run() {
  const problems = [];

  // 1) no boot errors
  if (errors.length) problems.push("Runtime errors at boot: " + JSON.stringify(errors.map(String)));

  // 2) control sets
  const keys = Array.from(window.document.querySelectorAll("[data-key]"))
    .map((b) => b.getAttribute("data-key"));
  const required = ["up", "down", "left", "right", "a", "b", "start", "select"];
  required.forEach((k) => {
    if (!keys.includes(k)) problems.push("Missing a control with data-key=" + k);
  });
  // both shells: expect the 8 vertical + landscape duplicates -> count >= 15
  if (keys.length < 15) problems.push("Expected vertical + landscape controls, got " + keys.length + " buttons");

  // 3) landscape overlay + mirror canvas exist
  ["lscape-overlay", "lscape-canvas", "lscape-dpad", "lscape-ab"].forEach((id) => {
    if (!window.document.getElementById(id)) problems.push("Missing landscape element #" + id);
  });

  // 4) PWA hooks
  if (!window.document.querySelector('link[rel="manifest"]')) problems.push("Missing manifest <link>");
  if (!window.document.querySelector('link[rel="apple-touch-icon"]')) problems.push("Missing apple-touch-icon");

  // 5) tick the game loop a handful of frames (should not throw)
  try {
    window.__drainRAF(10, 1000);
  } catch (e) {
    problems.push("Game loop threw: " + e.message);
  }
  if (errors.length) problems.push("Runtime errors during loop: " + JSON.stringify(errors.map(String)));

  return problems;
}

// jsdom loads scripts asynchronously; wait for load then assert.
window.addEventListener("load", () => {
  const problems = run();
  if (problems.length) {
    console.error("FAIL:\n - " + problems.join("\n - "));
    process.exit(1);
  } else {
    console.log("PASS: boot OK, " +
      window.document.querySelectorAll("[data-key]").length +
      " controls wired, landscape overlay present, PWA hooks present, loop ticked 10 frames.");
    process.exit(0);
  }
});

// Safety timeout
setTimeout(() => { console.error("TIMEOUT waiting for load"); process.exit(2); }, 10000);
