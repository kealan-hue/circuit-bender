/* ══════════════════════════════════════════════════════════════
   CIRCUIT BENDER // SHELL — APPLICATION LOGIC (CB-0)

   Multi-build hardware desktop environment running on a single
   shared WebGL2 video engine context.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

/* ── DOM utilities ────────────────────────────────────────── */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ── unit serial & seed ────────────────────────────────────── */
const SERIAL = (() => {
  let s = localStorage.getItem('circuitbender.serial');
  if (!s) {
    s = 'CB' + Math.floor(Math.random() * 9000 + 1000) + '-' +
        String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
        Math.floor(Math.random() * 90 + 10);
    localStorage.setItem('circuitbender.serial', s);
  }
  return s;
})();
const SEED = [...SERIAL].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/* ── neutral parameter set ─────────────────────────────────── */
const NEUTRAL = {
  gain: 0.5, bias: 0.5, mix: 1,
  axis: 0.34, sat: 0, con: 0, duo: 0,
  mosh: 0, feed: 0, orbit: 0.5, droste: 0,
  sort: 0, gateLo: 0.25, gateHi: 0.85, sortKey: 0, sortSpan: 1, sortAxis: 0, sortOrder: 0,
  ntsc: 0, ntscSat: 0.5, headsw: 0, chromaLoss: 0, ghost: 0, wave: 0,
  rutt: 0, ruttLines: 0.5, scope: 0, scopeLines: 0.5, scopeGlow: 0.5, water: 0, waterBleed: 0.5,
  slit: 0, slitMode: 0, ctime: 0, echo: 0, delay: 0.35, delayMix: 0,
  streak: 0, streakAngle: 0, s8: 0, s8Dust: 0.5, s8Burn: 0.5,
  tear: 0, tearRate: 0.5, warp: 0, kal: 0,
  addr: 0, clock: 0, bitSwap: 0, bus: 0, starve: 0, smear: 0, bitAmt: 0,
  tile: 0, tileSpeed: 0.5, tileAngle: 0, split: 0, splitCount: 0.4, splitAngle: 0,
  stretch: 0, stretchWave: 0, stretchJag: 0, w3d: 0, w3dPitch: 0.5, w3dYaw: 0.5, w3dRoll: 0.5,
  bulge: 0.5, bulgeRadius: 0.5, push: 0, pushAngle: 0, wave2: 0, waveFreq: 0.5, waveAngle: 0,
  tx: 0.5, ty: 0.5, tScale: 0.5, tRot: 0.5, strobe: 0, strobeRate: 0.5, grain: 0, grainSize: 0.5,
  sharpen: 0, blur: 0, bleach: 0, ccLift: 0.5, ccGamma: 0.5, ccGain: 0.5, ccTemp: 0.5,
  cga: 0, cgaPal: 0, ascii: 0, asciiTint: 0, key: 0, keyHue: 0.33, keyTol: 0.3,
  mask: 0, maskSize: 0.5, maskSpeed: 0.5, over: 0, overMode: 0,
  post: 0, dither: 0, half: 0, scan: 0, noise: 0, inv: 0,
  time: 0, bend: 0, frame: 0, ntscPhase: 0, bitMask: [0, 0, 0]
};

/* ── active runtime parameters ────────────────────────────── */
const activeParams = Object.assign({}, NEUTRAL);

/* ── the build definitions & useful region presets ────────── */
const BUILDS = {
  mosh: {
    name: 'MOSH',
    path: '/builds/datamosh',
    tag: 'CBX-MOSH',
    defaults: { mosh: 0.55, feed: 0.35, orbit: 0.52 },
    controls: [
      { id: 'mosh',  label: 'MOSH',  kind: 'knob', value: 0.55, def: 0 },
      { id: 'feed',  label: 'FEED',  kind: 'knob', value: 0.35, def: 0 },
      { id: 'orbit', label: 'ORBIT', kind: 'knob', value: 0.52, def: 0.5, detent: [0.5] }
    ]
  },
  sort: {
    name: 'SORT',
    path: '/builds/pixelsort',
    tag: 'CBX-SORT',
    defaults: { sort: 0.45, gateLo: 0.20, gateHi: 0.75, sortKey: 0, sortSpan: 1 },
    controls: [
      { id: 'sort',    label: 'PASSES', kind: 'knob',  value: 0.45, def: 0 },
      { id: 'gateLo',  label: 'GATE ↓', kind: 'knob',  value: 0.20, def: 0.25, detent: [0.25] },
      { id: 'gateHi',  label: 'GATE ↑', kind: 'knob',  value: 0.75, def: 0.85, detent: [0.85] },
      { id: 'sortKey', label: 'KEY',    kind: 'slide', positions: ['LUMA', 'DARK', 'RGB', 'VAL'], value: 0, def: 0 }
    ]
  },
  ntsc: {
    name: 'NTSC',
    path: '/builds/composite',
    tag: 'CBX-NTSC',
    defaults: { ntsc: 0.75, ntscSat: 0.65, headsw: 0.30, chromaLoss: 0.25 },
    controls: [
      { id: 'ntsc',       label: 'ENCODE',  kind: 'knob', value: 0.75, def: 0 },
      { id: 'ntscSat',    label: 'BURST',   kind: 'knob', value: 0.65, def: 0.5, detent: [0.5] },
      { id: 'headsw',     label: 'HEAD SW', kind: 'knob', value: 0.30, def: 0 },
      { id: 'chromaLoss', label: 'CH LOSS', kind: 'knob', value: 0.25, def: 0 }
    ]
  },
  raster: {
    name: 'RASTER',
    path: '/builds/rutt_etra',
    tag: 'CBX-RAST',
    defaults: { rutt: 0.55, ruttLines: 0.50, scope: 0.45, scopeLines: 0.50, scopeGlow: 0.60 },
    controls: [
      { id: 'rutt',       label: 'RUTT',   kind: 'knob', value: 0.55, def: 0 },
      { id: 'ruttLines',  label: 'LINES',  kind: 'knob', value: 0.50, def: 0.5, detent: [0.5] },
      { id: 'scope',      label: 'SCOPE',  kind: 'knob', value: 0.45, def: 0 },
      { id: 'scopeLines', label: 'TRACES', kind: 'knob', value: 0.50, def: 0.5, detent: [0.5] }
    ]
  },
  time: {
    name: 'TIME',
    path: '/builds/frame_ring',
    tag: 'CBX-TIME',
    defaults: { slit: 0.60, slitMode: 0, ctime: 0.45, echo: 0.35 },
    controls: [
      { id: 'slit',     label: 'SPREAD', kind: 'knob',  value: 0.60, def: 0 },
      { id: 'slitMode', label: 'FIELD',  kind: 'slide', positions: ['X', 'Y', 'RAD', 'LUM', 'GRD'], value: 0, def: 0 },
      { id: 'ctime',    label: 'CH TIME',kind: 'knob',  value: 0.45, def: 0 },
      { id: 'echo',     label: 'ECHO',   kind: 'knob',  value: 0.35, def: 0 }
    ]
  },
  duo: {
    name: 'DUO',
    path: '/builds/two_pole',
    tag: 'CBX-DUO',
    defaults: { duo: 0.75, axis: 0.34, sat: 0.60 },
    controls: [
      { id: 'duo',  label: 'DUOTONE', kind: 'knob', value: 0.75, def: 0 },
      { id: 'axis', label: 'AXIS',    kind: 'knob', value: 0.34, def: 0.34, detent: [0.34] },
      { id: 'sat',  label: 'COLOUR',  kind: 'knob', value: 0.60, def: 0 }
    ]
  },
  streak: {
    name: 'STREAK',
    path: '/builds/light_streak',
    tag: 'CBX-FILM',
    defaults: { streak: 0.55, streakAngle: 0.15, s8: 0.45, s8Dust: 0.50, s8Burn: 0.40 },
    controls: [
      { id: 'streak',      label: 'STREAK',  kind: 'knob', value: 0.55, def: 0 },
      { id: 'streakAngle', label: 'ANGLE',   kind: 'knob', value: 0.15, def: 0 },
      { id: 's8',          label: 'SUPER 8', kind: 'knob', value: 0.45, def: 0 },
      { id: 's8Dust',      label: 'DUST',    kind: 'knob', value: 0.50, def: 0.5, detent: [0.5] }
    ]
  }
};

/* ── active build state ───────────────────────────────────── */
let activeBuild = 'duo';
const buildValues = {};
const widgetMap = {};

for (const b in BUILDS) {
  buildValues[b] = Object.assign({}, BUILDS[b].defaults);
}

/* ── WebGL2 Engine boot — exactly one canvas in DOM ────────── */
const stage = $('#stage');
let engine;
try {
  engine = new Engine(stage);
} catch (err) {
  console.error('Fatal WebGL2 Engine fault:', err);
}

/* ── bench pattern fallback generator (offscreen canvas) ──── */
const bench = (() => {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 480;
  const x = c.getContext('2d');
  let f = 0;
  c.tick = () => {
    f++;
    const g = x.createLinearGradient(0, 0, 640, 0);
    ['#ff0033', '#ff9500', '#ffe000', '#00e070', '#0090ff', '#7b3cff', '#ffffff']
      .forEach((col, i) => g.addColorStop(i / 6, col));
    x.fillStyle = g;
    x.fillRect(0, 0, 640, 264);
    x.fillStyle = '#0a0a0a';
    x.fillRect(0, 264, 640, 216);
    for (let i = 0; i < 10; i++) {
      x.fillStyle = 'rgb(' + (i * 28) + ',' + (i * 28) + ',' + (i * 28) + ')';
      x.fillRect(i * 64, 264, 64, 44);
    }
    x.save();
    x.translate(320, 388);
    x.rotate(Math.sin(f / 40) * 0.12);
    x.fillStyle = '#e9ecef';
    x.font = '700 36px ui-monospace,Menlo,monospace';
    x.textAlign = 'center';
    x.fillText('CIRCUIT BENDER // SHELL', 0, 14);
    x.restore();
    x.strokeStyle = '#d8232a';
    x.lineWidth = 6;
    x.beginPath();
    x.arc(320 + Math.cos(f / 26) * 210, 132 + Math.sin(f / 17) * 88, 40, 0, 6.2832);
    x.stroke();
    x.fillStyle = '#9aa2aa';
    x.font = '600 18px ui-monospace,Menlo,monospace';
    x.textAlign = 'left';
    x.fillText('NO SENSOR · BENCH PATTERN · ' + String(f).padStart(5, '0'), 16, 468);
  };
  c.tick();
  return c;
})();

/* ── camera stream management ─────────────────────────────── */
const video = document.createElement('video');
video.playsInline = true;
video.muted = true;
video.autoplay = true;

let stream = null, ready = false, source = null, opening = false;
let facing = 'user';
let quality = 1; /* 0 lo · 1 mid · 2 hi */
const QUAL = [[448, 336], [640, 480], [800, 600]];

function sizeTo(vw, vh) {
  const [maxW, maxH] = QUAL[quality];
  const a = (vw || 4) / (vh || 3);
  let w = maxW, h = Math.round(maxW / a);
  if (h > maxH) { h = maxH; w = Math.round(maxH * a); }
  if (engine) engine.resize(w & ~1, h & ~1);
  const resEl = $('#sys-res');
  if (resEl) resEl.textContent = (w & ~1) + '×' + (h & ~1);
}

function updateSensorStatus(str) {
  const sEl = $('#sys-sensor');
  if (sEl) sEl.textContent = str;
}

async function openCamera(reqFacing) {
  if (opening) return;
  opening = true;
  const old = stream;
  ready = false;
  facing = reqFacing || facing;
  updateSensorStatus('OPENING…');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    source = bench; ready = true; opening = false;
    sizeTo(bench.width, bench.height);
    updateSensorStatus('BENCH (NO API)');
    return;
  }

  const withTimeout = pr => Promise.race([
    pr,
    new Promise((_, rej) => setTimeout(() => rej(new Error('SensorTimeout')), 9000))
  ]);

  try {
    stream = await withTimeout(navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }
    }));
  } catch (e) {
    try {
      stream = await withTimeout(navigator.mediaDevices.getUserMedia({ audio: false, video: true }));
    } catch (e2) {
      source = bench; ready = true; opening = false;
      sizeTo(bench.width, bench.height);
      updateSensorStatus('BENCH (REFUSED)');
      return;
    }
  }

  if (old) old.getTracks().forEach(t => t.stop());
  video.srcObject = stream;
  await video.play().catch(() => {});

  const st = stream.getVideoTracks()[0] && stream.getVideoTracks()[0].getSettings
           ? stream.getVideoTracks()[0].getSettings() : {};
  facing = st.facingMode || facing;

  await new Promise(r => {
    if (video.videoWidth) return r();
    video.onloadedmetadata = r;
  });

  sizeTo(video.videoWidth, video.videoHeight);
  source = video;
  ready = true;
  opening = false;
  updateSensorStatus('LOCKED (' + (facing === 'user' ? 'FRONT' : 'REAR') + ')');
}

function toggleCamera() {
  const nextFacing = facing === 'user' ? 'environment' : 'user';
  openCamera(nextFacing);
}

function cycleQuality() {
  quality = (quality + 1) % QUAL.length;
  const labels = ['LO', 'MID', 'HI'];
  const btn = $('#sys-qual-btn');
  if (btn) btn.innerHTML = '<b>QUAL: ' + labels[quality] + '</b>';
  if (source === video && video.videoWidth) {
    sizeTo(video.videoWidth, video.videoHeight);
  } else {
    sizeTo(bench.width, bench.height);
  }
}

/* ── activate a build & reset other effect params to zero ─── */
function activateBuild(buildId, silent) {
  if (!BUILDS[buildId]) return;
  activeBuild = buildId;

  /* Reset all parameters back to NEUTRAL */
  for (const k in activeParams) {
    if (k in NEUTRAL) {
      activeParams[k] = NEUTRAL[k];
    } else {
      activeParams[k] = 0;
    }
  }

  /* Apply this build's active values */
  const vals = buildValues[buildId];
  for (const k in vals) {
    activeParams[k] = vals[k];
  }

  /* Custom defaults for complex effects */
  if (buildId === 'sort') activeParams.sortSpan = 1;
  if (buildId === 'streak') activeParams.s8Burn = 0.40;
  if (buildId === 'raster') activeParams.scopeGlow = 0.60;

  /* Update all panel UI active states */
  $$('.shell-panel').forEach(panel => {
    const isThis = panel.dataset.build === buildId;
    panel.classList.toggle('is-active', isThis);
    const btn = panel.querySelector('.shell-panel__act-btn');
    if (btn) {
      btn.textContent = isThis ? 'ACTIVE' : 'SELECT';
      btn.classList.toggle('on', isThis);
    }
  });

  /* Update top bar active path and system status readout */
  const activeLabel = $('#shell-active-label');
  if (activeLabel) activeLabel.textContent = BUILDS[buildId].path;

  const sysBuild = $('#sys-build');
  if (sysBuild) sysBuild.textContent = BUILDS[buildId].path;
}

function updateParam(buildId, paramId, val) {
  if (!buildValues[buildId]) buildValues[buildId] = {};
  buildValues[buildId][paramId] = val;

  if (activeBuild !== buildId) {
    activateBuild(buildId);
  } else {
    activeParams[paramId] = val;
  }
}

function resetActiveParams() {
  if (!BUILDS[activeBuild]) return;
  buildValues[activeBuild] = Object.assign({}, BUILDS[activeBuild].defaults);

  /* Reset widget controls for active build */
  BUILDS[activeBuild].controls.forEach(ctl => {
    const w = widgetMap[activeBuild + '_' + ctl.id];
    if (w) w.set(buildValues[activeBuild][ctl.id], false);
  });

  activateBuild(activeBuild);
}

/* ── build widgets into panel DOMs ────────────────────────── */
function buildPanelWidgets() {
  for (const b in BUILDS) {
    const container = $('#body-' + b);
    if (!container) continue;
    container.innerHTML = '';

    BUILDS[b].controls.forEach(ctl => {
      let w;
      const common = {
        label: ctl.label,
        value: buildValues[b][ctl.id],
        def: ctl.def,
        detent: ctl.detent,
        scale: 100,
        dp: 0,
        onchange: val => updateParam(b, ctl.id, val)
      };

      if (ctl.kind === 'knob') {
        w = UI.knob(Object.assign({}, common, { lo: 0, hi: 1 }));
      } else if (ctl.kind === 'slide') {
        w = UI.slide({
          label: ctl.label,
          positions: ctl.positions,
          value: buildValues[b][ctl.id],
          def: ctl.def,
          onchange: idx => updateParam(b, ctl.id, idx)
        });
      }

      if (w && w.el) {
        widgetMap[b + '_' + ctl.id] = w;
        container.appendChild(w.el);
      }
    });
  }
}

/* ── desktop dragging & bring-to-front ────────────────────── */
let topZ = 20;

function bringToFront(panel) {
  topZ++;
  panel.style.zIndex = topZ;
}

function initDraggable(panel, handle) {
  let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;

  handle.addEventListener('pointerdown', e => {
    if (window.innerWidth <= 900) return; /* Mobile: drag disabled */
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest('button, a, input, select')) return;

    bringToFront(panel);
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = panel.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;

    handle.setPointerCapture(e.pointerId);
    panel.classList.add('is-dragging');
    e.preventDefault();
  });

  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let nx = origX + dx;
    let ny = origY + dy;

    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;

    /* Clamp strictly inside desktop bounds */
    nx = Math.max(0, Math.min(maxW - pw, nx));
    ny = Math.max(42, Math.min(maxH - ph, ny));

    panel.style.left = nx + 'px';
    panel.style.top = ny + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-dragging');
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  panel.addEventListener('pointerdown', () => {
    bringToFront(panel);
  });
}

function layoutDesktopPanels() {
  if (window.innerWidth <= 900) {
    $$('.shell-panel').forEach(p => {
      p.style.left = '';
      p.style.top = '';
      p.style.right = '';
      p.style.bottom = '';
      p.style.zIndex = '';
    });
    return;
  }

  const panels = $$('.shell-desktop .shell-panel');
  const padX = 20, padY = 54, gapX = 16, gapY = 16;
  const colW = 280;
  const numCols = Math.max(1, Math.min(4, Math.floor((window.innerWidth - padX * 2 + gapX) / (colW + gapX))));
  const colHeights = new Array(numCols).fill(padY);

  panels.forEach((p, idx) => {
    const col = idx % numCols;
    const x = padX + col * (colW + gapX);
    const y = colHeights[col];

    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.right = 'auto';
    p.style.bottom = 'auto';
    p.style.zIndex = 10 + idx;

    const h = p.offsetHeight || 220;
    colHeights[col] += h + gapY;
  });
}

/* ── telemetry updates ────────────────────────────────────── */
let frameCount = 0, ntscPhase = 0;
let lastTime = performance.now(), fpsTime = lastTime, fpsFrames = 0, currentFps = 60;

function updateTelemetry() {
  const fpsEl = $('#shell-fps');
  if (fpsEl) fpsEl.textContent = String(currentFps).padStart(2, '0');

  const sysFps = $('#sys-fps');
  if (sysFps) sysFps.textContent = currentFps;

  if (engine) {
    const stats = engine.stats();
    const sysMs = $('#sys-ms');
    if (sysMs) sysMs.textContent = stats.frameMs.toFixed(1) + 'ms';
  }
}

/* ── main render loop ─────────────────────────────────────── */
function loop(now) {
  requestAnimationFrame(loop);
  const dt = now - lastTime;
  lastTime = now;
  frameCount++;
  ntscPhase = (ntscPhase + 1) % 4;

  fpsFrames++;
  if (now - fpsTime > 500) {
    currentFps = Math.round(fpsFrames * 1000 / (now - fpsTime));
    fpsFrames = 0;
    fpsTime = now;
    updateTelemetry();
  }

  if (ready && source) {
    if (source === bench) source.tick();
    if (source !== video || video.readyState >= 2) {
      engine.upload(source);
      engine.ingest(source === video && facing === 'user');
    }
  }

  activeParams.time = now / 1000;
  activeParams.frame = frameCount;
  activeParams.ntscPhase = ntscPhase;
  activeParams.bitMask = [0, 0, 0];

  if (engine) {
    engine.render(activeParams, dt);
  }
}

/* ── initialization on DOM ready ──────────────────────────── */
function init() {
  /* Populate serial */
  const serEl = $('#shell-serial');
  if (serEl) serEl.textContent = SERIAL;

  /* Draw procedural sigil brandmark and etched rule */
  if (window.Sigil) {
    const mark = $('#shell-brandmark');
    if (mark) Sigil.paint(mark, { seed: SEED, arms: 2, depth: 2, cells: 1, scale: 0.65, w: 24, h: 24 });

    const rule = $('#shell-rule');
    if (rule) rule.innerHTML = Sigil.rule(SEED, 1200);
  }

  /* Build widgets inside panels */
  buildPanelWidgets();

  /* Wire select buttons */
  $$('.shell-panel').forEach(panel => {
    const bId = panel.dataset.build;
    const btn = panel.querySelector('.shell-panel__act-btn');
    if (btn && bId && BUILDS[bId]) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        activateBuild(bId);
      });
    }

    const header = panel.querySelector('.shell-panel__header');
    if (header) {
      initDraggable(panel, header);
    }
  });

  /* Initial layout */
  layoutDesktopPanels();
  window.addEventListener('resize', () => {
    layoutDesktopPanels();
  });

  /* System action buttons */
  const camBtn = $('#shell-cam-btn');
  if (camBtn) camBtn.addEventListener('click', toggleCamera);

  const sysCam = $('#sys-cam-btn');
  if (sysCam) sysCam.addEventListener('click', toggleCamera);

  const sysQual = $('#sys-qual-btn');
  if (sysQual) sysQual.addEventListener('click', cycleQuality);

  const sysReset = $('#sys-reset-btn');
  if (sysReset) sysReset.addEventListener('click', resetActiveParams);

  /* Activate initial build */
  activateBuild('duo');

  /* Open camera */
  openCamera('user');

  /* Start loop */
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})(window);
