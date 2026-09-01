/* ══════════════════════════════════════════════════════════════
   CIRCUIT BENDER — the instrument.

   A module is a STAGE of the signal path. Its rocker switches the stage in
   and out of circuit; its knobs are only reachable when the stage is in.
   Nothing is a preset — every control is a continuous parameter, and the
   interesting behaviour is in stages interfering with each other.
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const $ = s => document.querySelector(s);
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;

/* ── serial: the unit's identity, and the seed its panel sigils grow from ── */
const SERIAL = (() => {
  let s = localStorage.getItem('circuitbender.serial');
  if(!s){
    s = 'CB' + Math.floor(Math.random()*9000+1000) + '-' +
        String.fromCharCode(65+Math.floor(Math.random()*26)) +
        Math.floor(Math.random()*90+10);
    localStorage.setItem('circuitbender.serial', s);
  }
  return s;
})();
const SEED = [...SERIAL].reduce((a,c) => (a*31 + c.charCodeAt(0)) >>> 0, 7);

/* ── the parameter set ─────────────────────────────────────── */
/* Resting state: the SUBJECT stays readable and the damage is chromatic —
   hue pushed hard, colour banded, a fine scanline weave, a few pixels of edge
   fringe. Geometry-destroying stages (sort, mosh, warp, slit, fold) start at
   zero; they are where you go, not where you start. */
const V = {
  gain:0.5, bias:0.5, route:0, duo:0.62, axis:0.34, sat:0.42, con:0.26, mix:1,
  slit:0, slitMode:0, ctime:0, echo:0, delay:0.35, delayMix:0,
  tear:0.05, tearRate:0.5, warp:0, kal:0, rutt:0, ruttLines:0.5,
  water:0, waterBleed:0.5, scope:0, scopeLines:0.5, scopeGlow:0.5,
  mosh:0, feed:0, orbit:0.5, droste:0,
  ntsc:0, ntscSat:0.5, headsw:0, wave:0, chromaLoss:0, ghost:0, smear:0, bitAmt:0,
  addr:0, clock:0, bitSwap:0, bus:0, starve:0,
  tile:0, tileSpeed:0.5, tileAngle:0,
  split:0, splitCount:0.4, splitAngle:0,
  stretch:0, stretchWave:0, stretchJag:0,
  w3d:0, w3dPitch:0.5, w3dYaw:0.5, w3dRoll:0.5,
  cga:0, cgaPal:0, ascii:0, asciiTint:0, key:0, keyHue:0.33, keyTol:0.3, mask:0, maskSize:0.5, maskSpeed:0.5,
  sort:0, gateLo:0.25, gateHi:0.85, sortAxis:0, sortOrder:0, sortKey:0, sortSpan:1,
  streak:0, streakAngle:0, s8:0, s8Dust:0.5, s8Burn:0.5, over:0, overMode:0,
  post:0, dither:0.14, half:0, scan:0.42, noise:0.04, inv:0
};
/* KILL restores NEUTRAL — a kill switch that resets to a damaged picture is
   a lie. The resting look is applied once at boot and is not what KILL means. */
const NEUTRAL = Object.assign({}, V, {
  bias:0.5, route:0, duo:0, axis:0.34, sat:0, con:0, tear:0, post:0, dither:0, scan:0, noise:0,
  water:0, waterBleed:0.5, scope:0, scopeLines:0.5, scopeGlow:0.5,
  tile:0, tileSpeed:0.5, tileAngle:0,
  split:0, splitCount:0.4, splitAngle:0,
  stretch:0, stretchWave:0, stretchJag:0,
  w3d:0, w3dPitch:0.5, w3dYaw:0.5, w3dRoll:0.5,
  cga:0, cgaPal:0, ascii:0, asciiTint:0, key:0, keyHue:0.33, keyTol:0.3, mask:0, maskSize:0.5, maskSpeed:0.5,
  streak:0, streakAngle:0, s8:0, s8Dust:0.5, s8Burn:0.5, over:0, overMode:0
});
const DEF = NEUTRAL;

/* stage → the params it owns. the rocker zeroes them without losing them */
const STAGE = {
  time:   ['slit','ctime','echo','delayMix'],
  space:  ['tear','warp','kal'],
  raster: ['rutt'],
  mosh:   ['mosh'],
  regen:  ['feed','droste'],
  tape:   ['headsw','wave','chromaLoss'],
  comp:   ['ntsc','ghost'],
  sensor: ['smear','bitAmt'],
  bend:   ['addr','clock','bitSwap','bus','starve'],
  geom:   ['tile','tileSpeed','tileAngle','split','splitCount','splitAngle','stretch','stretchWave','stretchJag','w3d','w3dPitch','w3dYaw','w3dRoll'],
  beam:   ['water','waterBleed','scope','scopeLines','scopeGlow'],
  sort:   ['sort'],
  redraw: ['cga','cgaPal','ascii','asciiTint','key','keyHue','keyTol','mask','maskSize','maskSpeed'],
  film:   ['s8','s8Dust','s8Burn','streak','streakAngle','over','overMode'],
  out:    ['post','dither','half','scan','noise','sat','con','route','duo']
};
const ON = {}; Object.keys(STAGE).forEach(k => ON[k] = true);

/* ── modulation: a patch source bound to a destination knob.
      this is the only place where two controls can fight each other ── */
const SOURCES = {
  lfoA:  { label:'LFO A', color:'#39d353', fn: t => Math.sin(t*0.9) },
  lfoB:  { label:'LFO B', color:'#f0a020', fn: t => Math.sin(t*0.21) * Math.sin(t*3.7) },
  drift: { label:'DRIFT', color:'#4fc8ff', fn: t => Math.sin(t*0.07) + Math.sin(t*0.113)*0.6 },
  shock: { label:'SHOCK', color:'#d8232a', fn: t => (Math.sin(t*13.3)>0.93 ? 1 : -0.15) }
};
/* ── THE TWELVE ────────────────────────────────────────────────────────
   Bends already found and soldered down. That is what a finished bent
   instrument is: someone probed, kept what worked, and wired it in. Each is
   labelled by the two pins it shorts, so the front door and the chip behind
   the swipe speak one language and using one teaches the other.
   No descriptions anywhere. You find out by pointing it at your own face. */
/* DEVICE VOICE — scanline, fringe, dither, hiss. Formerly forced under every
   bend at fixed strength, which made twelve bends converge on one texture and
   buried the detail that distinguishes them. Kept as a capability, no longer
   compulsory: these are ordinary controls, and a bend may name its own amount
   when that texture IS part of its character. Applied nowhere by default. */
const VOICE = { scan:0.42, con:0.26, sat:0.42, tear:0.05, dither:0.14, noise:0.04,
                duo:0.62, axis:0.34 };
const BENDS = [
  { a:'BITS',  b:'COLOR', p:{ axis:0.34, bitSwap:0.38, duo:0.35, dither:0.14 } },
  { a:'CLOCK', b:'TIME',  p:{ axis:0.50, slit:0.44, slitMode:1, clock:0.20, wave:0.16 } },
  { a:'BITS',  b:'BUS',   p:{ axis:0.08, bus:0.42, dither:0.28, post:0.22 } },
  { a:'POWER', b:'LOOP',  p:{ axis:0.72, feed:0.42, orbit:0.58, con:0.36 } },
  { a:'ADDR',  b:'TIME',  p:{ axis:0.25, delayMix:0.48, delay:0.40, addr:0.22, ctime:0.20 } },
  { a:'BUS',   b:'COLOR', p:{ axis:0.58, route:0.65, con:0.38, bus:0.18, dither:0.12 } },
  { a:'ADDR',  b:'CLOCK', p:{ axis:0.00, addr:0.44, clock:0.22, tear:0.08 } },
  { a:'BITS',  b:'TIME',  p:{ axis:0.42, echo:0.48, ctime:0.30, bitSwap:0.14 } },
  { a:'POWER', b:'COLOR', p:{ axis:0.83, starve:0.36, sat:0.42, con:0.28, noise:0.06 } },
  { a:'BUS',   b:'LOOP',  p:{ axis:0.17, droste:0.46, feed:0.28, bus:0.16 } },
  { a:'CLOCK', b:'POWER', p:{ axis:0.92, clock:0.50, headsw:0.45, wave:0.35, con:0.24 } },
  { a:'ADDR',  b:'LOOP',  p:{ axis:0.66, mosh:0.52, addr:0.20, delayMix:0.20, con:0.28 } }
];

const PATCH = {};                      /* param → { src, depth } */
let armed = null;

/* ── REWIRE: the sensor chip's pins, and the bridges shorted across them.
      Every pin is a REAL parameter of the signal path. A wire between two
      pins shorts them: both stages are forced live regardless of their
      rocker, the bridge injects its own wandering current, and the pair is
      cross-coupled so each drives the other. This is the one control that
      overrides a switch instead of obeying it — which is what bending is.
      8 pins = 28 possible bridges, and each pair has its own character. ── */
const PINS = [
  { side:'l', name:'BITS',  long:'data lines',   p:'bitSwap', k:0.80, was:'impossible colour' },
  { side:'l', name:'BUS',   long:'shared wire',  p:'bus',     k:0.75, was:'signals fight' },
  { side:'l', name:'ADDR',  long:'address bus',  p:'addr',    k:0.70, was:'wrong pixel fetched' },
  { side:'l', name:'CLOCK', long:'row clock',    p:'clock',   k:0.68, was:'rows misread' },
  { side:'r', name:'POWER', long:'supply rail',  p:'starve',  k:0.72, was:'chip half-fails' },
  { side:'r', name:'COLOR', long:'chroma path',  p:'route',   k:0.80, was:'two-tone palette' },
  { side:'r', name:'TIME',  long:'frame store',  p:'slit',    k:0.70, was:'pixels from the past' },
  { side:'r', name:'LOOP',  long:'output feed',  p:'feed',    k:0.58, was:'image eats itself' }
];
PINS.forEach((pin, i) => pin.id = i);
const WIRES = [];                      /* [{a,b}] — pin index pairs */

/* param → the stage that owns it, so a bridge can force that stage live */
const OWNER = {};
for(const st in STAGE) STAGE[st].forEach(pr => OWNER[pr] = st);

const state = {
  bend:0, bendTarget:0, hold:false, facing:'user',
  ntscPhase:0, bitMask:[0,0,0], burst:0, frame:0,
  pick:0, intensity:0.5, colour:0.5,
  surge:[]                              /* extra shorts thrown while BEND is held */
};

/* ══ engine boot ═══════════════════════════════════════════ */
const canvas = $('#glass');
let engine;
try { engine = new Engine(canvas); }
catch(err){ fail(err); return; }

/* a lost GPU context silently freezes the picture; say so instead */
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  document.body.classList.add('is-fault');
  crt('GPU CONTEXT LOST — RELOAD');
}, false);
canvas.addEventListener('webglcontextrestored', () => location.reload(), false);

function fail(err){
  const s = $('#crt');
  if(s) s.textContent = 'FAULT — ' + (err && err.message ? err.message.split('\n')[0] : err);
  document.body.classList.add('is-fault');
  console.error(err);
}

const video = document.createElement('video');
video.playsInline = true; video.muted = true; video.autoplay = true;
let stream = null, ready = false, source = null;

/* ── BENCH PATTERN — what the unit shows with no sensor attached.
      a dead black rectangle tells you nothing about whether the signal path
      is alive; a moving test card tells you everything ── */
const bench = (() => {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 480;
  const x = c.getContext('2d');
  let f = 0;
  c.tick = () => {
    f++;
    const g = x.createLinearGradient(0,0,640,0);
    ['#ff0033','#ff9500','#ffe000','#00e070','#0090ff','#7b3cff','#ffffff']
      .forEach((col,i) => g.addColorStop(i/6, col));
    x.fillStyle = g; x.fillRect(0,0,640,264);
    x.fillStyle = '#0a0a0a'; x.fillRect(0,264,640,216);
    for(let i=0;i<10;i++){
      x.fillStyle = 'rgb(' + (i*28) + ',' + (i*28) + ',' + (i*28) + ')';
      x.fillRect(i*64, 264, 64, 44);
    }
    x.save();
    x.translate(320, 388);
    x.rotate(Math.sin(f/40)*0.12);
    x.fillStyle = '#e9ecef';
    x.font = '700 40px ui-monospace,Menlo,monospace';
    x.textAlign = 'center';
    x.fillText('CIRCUIT BENDER', 0, 14);
    x.restore();
    x.strokeStyle = '#d8232a'; x.lineWidth = 6;
    x.beginPath();
    x.arc(320 + Math.cos(f/26)*210, 132 + Math.sin(f/17)*88, 40, 0, 6.2832);
    x.stroke();
    x.fillStyle = '#9aa2aa';
    x.font = '600 20px ui-monospace,Menlo,monospace';
    x.textAlign = 'left';
    x.fillText('NO SENSOR · BENCH PATTERN · ' + String(f).padStart(5,'0'), 16, 468);
  };
  c.tick();
  return c;
})();

let opening = false;
async function openCamera(facing){
  if(opening) return;                       /* a second tap mid-open killed the stream */
  opening = true;
  const old = stream;
  ready = false;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    source = bench; ready = true; opening = false;
    sizeTo(bench.width, bench.height);
    const s = $('#start');
    if(s){
      const b = s.querySelector('b'); if(b) b.textContent = 'NO SENSOR API — TAP TO RETRY';
    }
    crt('NO SENSOR API — BENCH PATTERN'); return;
  }
  crt('OPENING ' + (facing === 'user' ? 'FRONT' : 'REAR') + ' SENSOR');
  const sPlate = $('#start');
  if(sPlate){
    const b = sPlate.querySelector('b');
    if(b) b.textContent = 'OPENING SENSOR…';
  }
  /* a prompt the user never answers must not leave a dead black rectangle —
     race the request and fall through to the bench pattern */
  const withTimeout = pr => Promise.race([pr,
    new Promise((_,rej) => setTimeout(() => rej(new Error('SensorTimeout')), 9000))]);
  try {
    stream = await withTimeout(navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{ facingMode:{ ideal:facing }, width:{ ideal:1280 }, height:{ ideal:720 } }
    }));
  } catch(e){
    try { stream = await withTimeout(navigator.mediaDevices.getUserMedia({ audio:false, video:true })); }
    catch(e2){
      source = bench; ready = true; opening = false;
      sizeTo(bench.width, bench.height);
      const s = $('#start');
      if(s){
        const b = s.querySelector('b');
        if(b) b.textContent = 'SENSOR REFUSED — TAP TO RETRY';
        const em = s.querySelector('em');
        if(em) em.textContent = e2.name ? ('camera error: ' + e2.name) : 'camera access is required';
      }
      crt('NO SENSOR — BENCH PATTERN (' + e2.name + ')');
      return;
    }
  }
  if(old) old.getTracks().forEach(t => t.stop());   /* only now is it safe */
  video.srcObject = stream;
  await video.play().catch(()=>{});
  /* the fallback branch may have handed back the other camera entirely, and
     mirroring the preview off the REQUESTED facing would then be wrong */
  const st = stream.getVideoTracks()[0] && stream.getVideoTracks()[0].getSettings
           ? stream.getVideoTracks()[0].getSettings() : {};
  state.facing = st.facingMode || facing;
  await new Promise(r => {
    if(video.videoWidth) return r();
    video.onloadedmetadata = r;
  });
  sizeTo(video.videoWidth, video.videoHeight);
  source = video; ready = true; dropStart();
  crt('SIGNAL LOCK  ' + video.videoWidth + '×' + video.videoHeight);
  opening = false;
}

let quality = 1;                                  /* 0 lo · 1 mid · 2 hi */
const QUAL = [[448,336],[640,480],[800,600]];
function sizeTo(vw, vh){
  const [maxW, maxH] = QUAL[quality];
  const a = (vw||4) / (vh||3);
  let w = maxW, h = Math.round(maxW / a);
  if(h > maxH){ h = maxH; w = Math.round(maxH * a); }
  engine.resize(w & ~1, h & ~1);
}

/* ── selecting a bend writes V directly. The deep layer then shows exactly
      which knobs that short moved, so the front door teaches the chip. ── */
function applyBend(i, silent){
  state.pick = ((i % BENDS.length) + BENDS.length) % BENDS.length;
  const b = BENDS[state.pick];
  Object.assign(V, NEUTRAL, b.p);
  for(const s in STAGE) ON[s] = true;
  WIRES.length = 0;
  WIRES.push({ a: PINS.findIndex(p => p.name === b.a),
               b: PINS.findIndex(p => p.name === b.b) });
  for(const k in V){ const w = widgets[k]; if(w) w.set(V[k], false); }
  for(const st in STAGE){
    const r = widgets['@'+st]; if(r) r.set(true, false);
    const el = document.querySelector('[data-mod="'+st+'"]');
    if(el) el.classList.remove('off');
  }
  if(buildChip.repaint) buildChip.repaint();
  paintFront();
  if(!silent) crt('SHORT ' + b.a + '\u2013' + b.b);
}

function paintFront(){
  const b = BENDS[state.pick];
  const n = $('#bend-name'); if(n) n.textContent = b.a + '\u2013' + b.b;
  const d = $('#bend-dots');
  if(d) [...d.children].forEach((el,i) => el.classList.toggle('on', i === state.pick));
}

/* ── effective params, after stage gating and modulation ──── */
const P = {};
function build(t){
  for(const k in V) P[k] = V[k];
  for(const s in STAGE) if(!ON[s]) STAGE[s].forEach(k => P[k] = 0);

  for(const k in PATCH){
    const pt = PATCH[k];
    const src = SOURCES[pt.src];
    if(!src) continue;
    P[k] = clamp(P[k] + src.fn(t) * pt.depth * 0.5, 0, 1);
  }

  /* ── BRIDGES — applied after gating, because shorting two pins is exactly
        the act of bypassing the switch that was meant to isolate them ── */
  for(let i=0;i<WIRES.length;i++){
    const A = PINS[WIRES[i].a], B = PINS[WIRES[i].b];
    /* rate and phase come from the pin pair, so every bridge has its own
       feel — this is what makes 28 combinations worth discovering */
    const rate = 0.26 + ((A.id*7 + B.id*13) % 9) * 0.21;
    const ph   = A.id * 2.31 + B.id * 1.77;
    const cur  = 0.5 + 0.5 * Math.sin(t * rate + ph);
    const vA = P[A.p], vB = P[B.p];
    P[A.p] = clamp(Math.max(vA, cur * A.k) + vB * 0.28, 0, 1);
    P[B.p] = clamp(Math.max(vB, cur * B.k) + vA * 0.28, 0, 1);
  }

  /* ── front-door INTENSITY scales only what THIS bend does, never the
        instrument's own voice, so turning it down leaves a picture rather
        than a clean camera feed ── */
  const bp = BENDS[state.pick].p;
  const gainK = 0.35 + state.intensity * 1.45;
  for(const k in bp){
    if(k === 'slitMode' || k === 'axis') continue;
    P[k] = clamp(P[k] * gainK, 0, 1);
  }
  /* COLOUR moves where the routing lands — the difference between your
     teal frame and your magenta one */
  P.axis = (P.axis + (state.colour - 0.5) * 0.5 + 1) % 1;

  /* ── SURGE — BEND throws extra shorts on top of the ones already there,
        exactly as a probe wire does, and they fall away when released ── */
  for(let i=0;i<state.surge.length;i++){
    const sg = state.surge[i];
    const A = PINS[sg.a], B = PINS[sg.b];
    const cur = state.bend * (0.55 + 0.45 * Math.sin(t * sg.rate + sg.ph));
    P[A.p] = clamp(Math.max(P[A.p], cur * A.k), 0, 1);
    P[B.p] = clamp(Math.max(P[B.p], cur * B.k), 0, 1);
  }


  P.time = t;
  P.bend = state.bend;
  P.frame = state.frame;
  P.ntscPhase = state.ntscPhase;
  P.bitMask = state.bitMask;
  return P;
}

/* ── one frame ────────────────────────────────────────────── */
/* everything that advances state lives here, so a hand-driven frame is the
   same frame the loop draws — a verification path that skips the easing is a
   verification path that lies */
function frame(t, dt){
  state.frame++;

  /* BEND snaps in and releases slowly — the asymmetry is the whole feel */
  state.bend += (state.bendTarget - state.bend) * (state.bendTarget > state.bend ? 0.30 : 0.055);

  /* bitplane dropout lives in BURSTS — a chip with a bent pin, not a
     continuous mask, which would only ever read as posterisation */
  if(V.bitAmt > 0.002 || state.bend > 0.02){
    if(state.burst > 0){ state.burst--; }
    else if(Math.random() < 0.06 + state.bend*0.25){
      state.burst = 2 + Math.floor(Math.random()*7);
      const bit = 1 << (3 + Math.floor(Math.random()*5));
      const rot = Math.floor(Math.random()*8);
      const rol = x => ((x << rot) | (x >> (8-rot))) & 255;
      state.bitMask = [rol(bit), rol((bit<<1) & 255), rol(bit>>1)];
    } else state.bitMask = [0,0,0];
  } else state.bitMask = [0,0,0];

  state.ntscPhase = (state.ntscPhase + 1) % 4;

  if(ready && !state.hold && source){
    if(source === bench) source.tick();
    if(source !== video || video.readyState >= 2){
      engine.upload(source);
      engine.ingest(source === video && state.facing === 'user');
    }
  }
  engine.render(build(t), dt);
}

/* ── the loop ─────────────────────────────────────────────── */
let last = performance.now(), fpsT = last, fpsN = 0, fps = 0;
function loop(now){
  requestAnimationFrame(loop);
  const dt = now - last; last = now;
  frame(now / 1000, dt);
  fpsN++;
  if(now - fpsT > 500){
    fps = Math.round(fpsN * 1000 / (now - fpsT));
    fpsN = 0; fpsT = now;
    tick();
  }
}

/* ══ panel ═════════════════════════════════════════════════ */
const K = (id, label, o) => Object.assign({ kind:'knob', id, label }, o);
const S = (id, label, positions, o) => Object.assign({ kind:'slide', id, label, positions }, o);
const F = (id, label, o) => Object.assign({ kind:'fader', id, label }, o);

const RACK = [
  { id:'src', name:'SOURCE', fixed:true, ctl:[
    K('gain','GAIN',   { def:0.5, detent:[0.5] }),
    K('bias','TINT',   { def:0.5, detent:[0.5] }),
    K('duo','DUOTONE',{ def:0 }),
    K('axis','AXIS',   { def:0.34 }),
    K('route','ROUTE', { def:0 }),
    K('sat','COLOUR',  { def:0 }),
    K('con','CONTRAST',{ def:0 }),
    F('mix','DRY / WET',{ def:1,  detent:[0,1] })
  ]},
  { id:'time', name:'TIME BASE', note:'per-pixel delay', ctl:[
    K('slit','SPREAD', { def:0 }),
    S('slitMode','FIELD', ['X','Y','RAD','LUMA','GRID']),
    K('ctime','CH TIME',{ def:0 }),
    K('echo','ECHO',   { def:0 })
  ]},
  { id:'space', name:'DEFLECT', ctl:[
    K('tear','TEAR',   { def:0 }),
    K('tearRate','RATE',{ def:0.5 }),
    K('warp','WARP',   { def:0 }),
    K('kal','FOLD',    { def:0 })
  ]},
  { id:'raster', name:'RASTER', note:'rutt / etra', ctl:[
    K('rutt','DEFLECT',{ def:0 }),
    K('ruttLines','LINES',{ def:0.5 })
  ]},
  { id:'mosh', name:'MOSH', note:'p-frames, no key', ctl:[
    K('mosh','CARRY',  { def:0 }),
    K('delayMix','Δ FRAME',{ def:0 }),
    K('delay','TAP',   { def:0.35 })
  ]},
  { id:'regen', name:'REGEN', note:'feedback', ctl:[
    K('feed','AMOUNT', { def:0 }),
    K('orbit','ORBIT', { def:0.5, detent:[0.5] }),
    K('droste','DROSTE',{ def:0 })
  ]},
  { id:'tape', name:'TRANSPORT', note:'vhs', ctl:[
    K('headsw','HEAD SW',{ def:0 }),
    K('wave','EDGE WAVE',{ def:0 }),
    K('chromaLoss','CH LOSS',{ def:0 })
  ]},
  { id:'comp', name:'COMPOSITE', note:'ntsc encode → decode', ctl:[
    K('ntsc','ENCODE', { def:0 }),
    K('ntscSat','BURST',{ def:0.5 }),
    K('ghost','GHOST', { def:0 })
  ]},
  { id:'sensor', name:'SENSOR', ctl:[
    K('smear','SMEAR', { def:0 }),
    K('bitAmt','BITS', { def:0 })
  ]},
  /* the only stages here that corrupt the MACHINE rather than simulate a
     machine working normally on damaged media */
  { id:'bend', name:'BENDS', note:'real shorts', wide:true, ctl:[
    K('bitSwap','BIT SWAP',{ def:0 }),
    K('bus','BUS SHORT', { def:0 }),
    K('addr','ADDRESS',  { def:0 }),
    K('clock','CLOCK',   { def:0 }),
    K('starve','STARVE', { def:0 })
  ]},
  { id:'geom', name:'GEOMETRY', note:'space rearranged', wide:true, ctl:[
    K('tile',       'TILE',    { def:0 }),
    K('tileSpeed',  'T SPEED', { def:0.5 }),
    K('tileAngle',  'T ANGLE', { def:0 }),
    K('split',      'SPLIT',   { def:0 }),
    K('splitCount', 'STRIPS',  { def:0.4 }),
    K('splitAngle', 'S ANGLE', { def:0 }),
    K('stretch',    'STRETCH', { def:0 }),
    K('stretchWave','WAVE',    { def:0 }),
    K('stretchJag', 'JAG',     { def:0 }),
    K('w3d',        'WARP 3D', { def:0 }),
    K('w3dPitch',   'PITCH',   { def:0.5, detent:[0.5] }),
    K('w3dYaw',     'YAW',     { def:0.5, detent:[0.5] }),
    K('w3dRoll',    'ROLL',    { def:0.5, detent:[0.5] })
  ]},
  { id:'beam', name:'BEAM', note:'resynthesis', wide:true, ctl:[
    K('water',      'WATERCOLOR', { def:0 }),
    K('waterBleed', 'BLEED',      { def:0.5 }),
    K('scope',      'SCOPE',      { def:0 }),
    K('scopeLines', 'LINES',      { def:0.5 }),
    K('scopeGlow',  'GLOW',       { def:0.5 })
  ]},
  { id:'sort', name:'SORT', note:'span, not threshold', wide:true, ctl:[
    F('sort','PASSES',  { def:0 }),
    K('gateLo','GATE ↓',{ def:0.25 }),
    K('gateHi','GATE ↑',{ def:0.85 }),
    S('sortKey','KEY',  ['LUMA','DARK','RGB','VALUE']),
    S('sortAxis','AXIS',['HORIZ','VERT']),
    S('sortOrder','DIR',['UP','DOWN']),
    S('sortSpan','SPAN',['1:1','WIDE'], { value:1 })
  ]},
  { id:'redraw', name:'REDRAW', note:'another medium', wide:true, ctl:[
    K('cga',       'CGA',      { def:0 }),
    S('cgaPal',    'CGA PAL',  ['MAGENTA','RED/GRN','AMBER']),
    K('ascii',     'ASCII',    { def:0 }),
    K('asciiTint', 'PHOSPHOR', { def:0 }),
    K('key',       'CHROMA',   { def:0 }),
    K('keyHue',    'KEY HUE',  { def:0.33, detent:[0.33] }),
    K('keyTol',    'KEY TOL',  { def:0.3 }),
    K('mask',      'MASK',     { def:0 }),
    K('maskSize',  'M SIZE',   { def:0.5 }),
    K('maskSpeed', 'M SPEED',  { def:0.5 })
  ]},
  { id:'film', name:'FILM', note:'optics and stock', wide:true, ctl:[
    K('s8',         'SUPER 8',    { def:0 }),
    K('s8Dust',     'DUST',       { def:0.5 }),
    K('s8Burn',     'BURN',       { def:0.5 }),
    K('streak',     'STREAK',     { def:0 }),
    K('streakAngle','S ANGLE',    { def:0 }),
    K('over',       'OVERLAY',    { def:0 }),
    S('overMode',   'BLEND',      ['SCREEN','MULT','DIFF','ADD'])
  ]},
  { id:'out', name:'OUTPUT', wide:true, ctl:[
    K('post','QUANT',  { def:0 }),
    K('dither','DITHER',{ def:0 }),
    K('half','HALFTONE',{ def:0 }),
    K('scan','RASTER', { def:0.18 }),
    K('noise','HISS',  { def:0.05 }),
    S('inv','POLARITY',['NORM','NEG','SOLAR'])
  ]}
];

const widgets = {};
/* ══ FRONT DOOR ════════════════════════════════════════════
   Twelve shorts already soldered down, two knobs, and the shutter. No
   descriptions: you find out what BITS-COLOR does by pointing it at your
   own face. Everything else is behind the swipe. */
function buildFront(){
  const dots = $('#bend-dots');
  if(dots) BENDS.forEach(() => dots.append(UI.el('i', 'dot')));

  const wrap = $('#front-knobs');
  if(!wrap) return;
  const mk = (id, label, get, set) => {
    const w = UI.knob({ label, value:get(), lo:0, hi:1, def:0.5, detent:[0.5],
                        scale:100, dp:0, onchange:set });
    w.el.classList.add('ctl--big');
    wrap.append(w.el);
    return w;
  };
  widgets['@int'] = mk('int', 'INTENSITY', () => state.intensity, v => { state.intensity = v; });
  widgets['@col'] = mk('col', 'COLOUR',    () => state.colour,    v => { state.colour = v; });
}

/* ══ REWIRE — the chip, the wires, and the dragging ═════════ */
const pinEl = [];
function buildChip(){
  const chip  = $('#chip');
  const svg   = $('#chip-wires');
  const colL  = $('#pins-l');
  const colR  = $('#pins-r');
  if(!chip) return;

  PINS.forEach(pin => {
    const b = UI.el('button', 'pin');
    b.type = 'button';
    b.dataset.pin = pin.id;
    b.title = pin.name + ' — ' + pin.long + ' · ' + pin.was;
    b.innerHTML = '<span class="pin__name">' + pin.name + '</span>' +
                  '<span class="pin__lead"></span>' +
                  '<span class="pin__pad"></span>';
    pinEl[pin.id] = b;
    (pin.side === 'l' ? colL : colR).append(b);
  });

  /* pad centres are measured from the chip box, so the wires stay attached
     through every reflow — a resize or an orientation change would otherwise
     leave them hanging in the old positions */
  function padAt(id){
    const r = pinEl[id].querySelector('.pin__pad').getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    return { x: r.left - c.left + r.width/2, y: r.top - c.top + r.height/2 };
  }
  function arc(A, B){
    const mx = (A.x + B.x)/2;
    const my = (A.y + B.y)/2 + Math.abs(A.y - B.y)*0.10 + 16;
    return 'M' + A.x + ',' + A.y + ' Q' + mx + ',' + my + ' ' + B.x + ',' + B.y;
  }

  let dragFrom = null, dragPath = null;

  function paint(){
    svg.innerHTML = '';
    WIRES.forEach((w, i) => {
      const d = arc(padAt(w.a), padAt(w.b));
      const cut = ev => {
        ev.stopPropagation();
        WIRES.splice(i, 1);
        paint();
        crt('CUT ' + PINS[w.a].name + '–' + PINS[w.b].name);
      };
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('class', 'hit');
      hit.setAttribute('d', d);
      hit.addEventListener('click', cut);
      svg.append(hit);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.addEventListener('click', cut);
      svg.append(path);
    });
    if(dragPath) svg.append(dragPath);

    const live = new Set();
    WIRES.forEach(w => { live.add(w.a); live.add(w.b); });
    pinEl.forEach((el, i) => {
      el.classList.toggle('is-live', live.has(i));
      el.classList.toggle('is-arm', dragFrom === i);
    });
    $('#wire-led').classList.toggle('on', WIRES.length > 0);
    $('#wire-read').innerHTML = WIRES.length
      ? WIRES.map(w => '<b>' + PINS[w.a].name + '–' + PINS[w.b].name + '</b>').join(' &nbsp;·&nbsp; ')
      : 'CHIP INTACT — NO BRIDGES';
  }

  function pinUnder(x, y){
    const el = document.elementFromPoint(x, y);
    const btn = el && el.closest && el.closest('.pin');
    return btn ? +btn.dataset.pin : null;
  }

  chip.addEventListener('pointerdown', e => {
    const id = pinUnder(e.clientX, e.clientY);
    if(id == null) return;
    e.preventDefault();
    dragFrom = id;
    chip.classList.add('is-wiring');
    dragPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    dragPath.setAttribute('class', 'is-drag');
    chip.setPointerCapture(e.pointerId);
    paint();
  });

  chip.addEventListener('pointermove', e => {
    if(dragFrom == null) return;
    const c = chip.getBoundingClientRect();
    dragPath.setAttribute('d', arc(padAt(dragFrom),
      { x: e.clientX - c.left, y: e.clientY - c.top }));
    paint();
  });

  function endDrag(e){
    if(dragFrom == null) return;
    const to = pinUnder(e.clientX, e.clientY);
    const from = dragFrom;
    dragFrom = null; dragPath = null;
    chip.classList.remove('is-wiring');
    if(to != null && to !== from){
      const dupe = WIRES.some(w => (w.a === from && w.b === to) || (w.a === to && w.b === from));
      if(dupe) crt('ALREADY BRIDGED');
      else {
        WIRES.push({ a: from, b: to });
        crt('SHORT ' + PINS[from].name + '–' + PINS[to].name +
            '  (' + PINS[from].was + ' × ' + PINS[to].was + ')');
      }
    }
    paint();
  }
  chip.addEventListener('pointerup', endDrag);
  chip.addEventListener('pointercancel', endDrag);

  if(window.ResizeObserver) new ResizeObserver(() => paint()).observe(chip);
  addEventListener('resize', paint);

  buildChip.repaint = paint;
  paint();
}

function buildRack(){
  const rack = $('#rack');
  RACK.forEach((mod, mi) => {
    const box = UI.el('div', 'mod' + (mod.wide ? ' mod--wide' : ''));
    box.dataset.mod = mod.id;

    const head = UI.el('div', 'mod__head');
    if(!mod.fixed){
      const r = UI.rocker({ label:'', value:true, onchange: v => {
        ON[mod.id] = v;
        box.classList.toggle('off', !v);
        crt(mod.name + (v ? ' IN CIRCUIT' : ' BYPASSED'));
      }});
      r.el.classList.add('rock--mod');
      head.append(r.el);
      widgets['@'+mod.id] = r;
    }
    const nm = UI.el('div', 'mod__name');
    nm.innerHTML = '<b>' + mod.name + '</b>' + (mod.note ? '<em>' + mod.note + '</em>' : '');
    head.append(nm);
    const sg = UI.el('div', 'mod__sigil');
    Sigil.paint(sg, { seed: SEED + mi*97, arms:2, depth:1, cells:1, scale:0.62, w:26, h:26 });
    head.append(sg);
    box.append(head);

    const body = UI.el('div', 'mod__body');
    mod.ctl.forEach(spec => {
      const common = {
        label: spec.label,
        value: V[spec.id],
        def: spec.def,
        detent: spec.detent,
        scale: 100, dp: 0,
        onchange: v => { V[spec.id] = v; }
      };
      let w;
      if(spec.kind === 'knob')  w = UI.knob(Object.assign({}, common, { lo:0, hi:1 }));
      else if(spec.kind === 'fader') w = UI.fader(common);
      else {
        w = UI.slide({ label:spec.label, positions:spec.positions, value:V[spec.id],
                       onchange: v => { V[spec.id] = v; } });
      }
      w.el.dataset.p = spec.id;
      if(spec.kind !== 'slide') bindPatch(w, spec.id);
      widgets[spec.id] = w;
      body.append(w.el);
    });
    box.append(body);
    rack.append(box);
  });
}

/* ── patch bay: arm a source, then click any knob to bind it ── */
function bindPatch(w, id){
  w.node.addEventListener('pointerdown', e => {
    if(!armed) return;
    e.stopPropagation(); e.preventDefault();
    if(armed === 'CLR'){ delete PATCH[id]; }
    else PATCH[id] = { src: armed, depth: 0.55 };
    paintPatch();
    crt(armed === 'CLR' ? ('UNPATCHED ' + w.spec.label)
                        : (SOURCES[armed].label + ' → ' + w.spec.label));
  }, true);
}
/* One gesture for the whole machine: REWIRE drags pin→pin, this drags
   jack→knob. Arm-then-tap still works, but nobody discovers it. */
function dragJack(el, key){
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    const ghost = UI.el('div', 'jack__drag');
    ghost.style.setProperty('--c', key === 'CLR' ? '#8b939c' : SOURCES[key].color);
    ghost.textContent = key === 'CLR' ? 'PULL' : SOURCES[key].label;
    document.body.append(ghost);
    document.body.classList.add('is-patching');
    const move = ev => {
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top  = ev.clientY + 'px';
      const k = knobUnder(ev.clientX, ev.clientY);
      document.querySelectorAll('.ctl.is-target').forEach(n => n.classList.remove('is-target'));
      if(k) k.classList.add('is-target');
    };
    const up = ev => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      ghost.remove();
      document.body.classList.remove('is-patching');
      document.querySelectorAll('.ctl.is-target').forEach(n => n.classList.remove('is-target'));
      const target = knobUnder(ev.clientX, ev.clientY);
      if(!target) return;
      const id = target.dataset.p;
      if(!id || !widgets[id] || widgets[id].spec.positions) return;
      if(key === 'CLR'){ delete PATCH[id]; crt('PULLED ' + widgets[id].spec.label); }
      else { PATCH[id] = { src:key, depth:0.55 };
             crt(SOURCES[key].label + ' NOW MOVES ' + widgets[id].spec.label); }
      armed = null;
      paintPatch();
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    move(e);
  });
}
function knobUnder(x, y){
  const el = document.elementFromPoint(x, y);
  return el && el.closest ? el.closest('.ctl[data-p]') : null;
}

function paintPatch(){
  for(const id in widgets){
    const w = widgets[id];
    if(!w.el || !w.el.classList) continue;
    const pt = PATCH[id];
    w.el.classList.toggle('is-patched', !!pt);
    w.el.style.setProperty('--patch', pt ? SOURCES[pt.src].color : 'transparent');
  }
}
function buildPatchBay(){
  const bay = $('#patchbay');
  Object.keys(SOURCES).forEach(k => {
    const b = UI.el('button', 'jack');
    b.type = 'button';
    b.innerHTML = '<span class="jack__hole"></span><span class="jack__cap">' +
                  SOURCES[k].label + '</span>';
    b.style.setProperty('--c', SOURCES[k].color);
    b.addEventListener('click', () => {
      armed = (armed === k) ? null : k;
      paintBay();
      crt(armed ? (SOURCES[k].label + ' ARMED — NOW TOUCH A KNOB') : 'IDLE');
    });
    dragJack(b, k);
    bay.append(b);
    SOURCES[k].btn = b;
  });
  const clr = UI.el('button', 'jack jack--clr');
  clr.type = 'button';
  clr.innerHTML = '<span class="jack__hole"></span><span class="jack__cap">PULL</span>';
  clr.addEventListener('click', () => {
    armed = (armed === 'CLR') ? null : 'CLR';
    paintBay();
    crt(armed ? 'PULL ARMED — NOW TOUCH A KNOB' : 'IDLE');
  });
  dragJack(clr, 'CLR');
  bay.append(clr);
  SOURCES.CLR = { btn: clr };
  function paintBay(){
    for(const k in SOURCES) if(SOURCES[k].btn) SOURCES[k].btn.classList.toggle('armed', armed === k);
    document.body.classList.toggle('is-patching', !!armed);
  }
  buildPatchBay.repaint = paintBay;
  paintBay();
}

/* ── readouts ─────────────────────────────────────────────── */
let crtMsg = '', crtUntil = 0;
function dropStart(){ const s=document.getElementById('start'); if(s) s.remove(); }
function crt(m){ crtMsg = m; crtUntil = performance.now() + 2600; }
const mLevel = UI.meter(14), mSort = UI.meter(10, 'meter--amber'), mBend = UI.meter(8, 'meter--red');

function tick(){
  const st = engine.stats();
  const active = Object.keys(STAGE).filter(s => ON[s] &&
                 STAGE[s].some(k => P[k] > 0.004)).length;
  const now = performance.now();
  $('#crt').textContent = (now < crtUntil && crtMsg) ? crtMsg
    : (engine.width + '×' + engine.height + '  ' + fps + 'FPS  ' +
       'STG ' + active + '/' + Object.keys(STAGE).length + '  SRT ' + st.sortBudget +
       (state.hold ? '  ▪ HOLD' : ''));
  mLevel.set((P.gain*0.4 + P.feed*0.3 + P.tear*0.3) * (0.75 + Math.random()*0.25));
  mSort.set(P.sort);
  mBend.set(state.bend);
  $('#fps').textContent = String(fps).padStart(2,'0');
}

function openDeep(on){
  document.body.classList.toggle('panel-open', on);
  crt(on ? 'PANEL OPEN' : 'PANEL CLOSED');
}

/* ══ transport ═════════════════════════════════════════════ */
function scramble(hard){
  const skip = { mix:1, gain:1, bias:1 };
  for(const k in V){
    if(skip[k]) continue;
    const w = widgets[k];
    if(!w) continue;
    if(w.spec.positions){
      w.set(Math.floor(Math.random() * w.spec.positions.length), true);
    } else {
      /* most controls land near zero — a rack where everything is at 0.5 is
         mush. the character comes from a FEW stages being hard on */
      const r = Math.random();
      const v = r < (hard ? 0.35 : 0.55) ? 0
              : r < 0.85 ? Math.random()*0.45
              : 0.5 + Math.random()*0.5;
      w.set(v, true);
    }
  }
  for(const s in STAGE){
    const on = Math.random() > (hard ? 0.15 : 0.3);
    ON[s] = on;
    const r = widgets['@'+s];
    if(r) r.set(on, true);
    document.querySelector('[data-mod="'+s+'"]').classList.toggle('off', !on);
  }
  /* SCRAMBLE rewires the chip too — the button says scramble CIRCUIT, and
     leaving the bridges untouched would make that a lie */
  WIRES.length = 0;
  const nWires = Math.floor(Math.random() * (hard ? 4 : 3));
  for(let i=0;i<nWires;i++){
    const a = Math.floor(Math.random()*PINS.length);
    let b = Math.floor(Math.random()*PINS.length);
    if(b === a) b = (b + 1 + Math.floor(Math.random()*(PINS.length-1))) % PINS.length;
    if(!WIRES.some(w => (w.a===a&&w.b===b)||(w.a===b&&w.b===a))) WIRES.push({a,b});
  }
  if(buildChip.repaint) buildChip.repaint();

  if(hard && Math.random() < 0.6){
    const keys = Object.keys(SOURCES).filter(k => k !== 'CLR');
    const dests = Object.keys(V).filter(k => widgets[k] && !widgets[k].spec.positions);
    for(let i=0;i<2;i++){
      PATCH[dests[Math.floor(Math.random()*dests.length)]] =
        { src: keys[Math.floor(Math.random()*keys.length)], depth: 0.4 + Math.random()*0.5 };
    }
    paintPatch();
  }
  crt(hard ? 'CIRCUIT SCRAMBLED' : 'CIRCUIT NUDGED');
}

function resetAll(){
  Object.assign(V, DEF);
  for(const k in V){ const w = widgets[k]; if(w) w.set(V[k], false); }
  for(const s in STAGE){
    ON[s] = true;
    const r = widgets['@'+s]; if(r) r.set(true, false);
    document.querySelector('[data-mod="'+s+'"]').classList.remove('off');
  }
  state.intensity = 0.5;
  state.colour = 0.5;
  if(widgets['@int']) widgets['@int'].set(0.5, false);
  if(widgets['@col']) widgets['@col'].set(0.5, false);
  for(const k in PATCH) delete PATCH[k];
  WIRES.length = 0;
  if(buildChip.repaint) buildChip.repaint();
  armed = null;
  if(buildPatchBay.repaint) buildPatchBay.repaint();
  paintPatch();
  state.hold = false; $('#b-hold').classList.remove('on');
  engine.flush();
  crt('SIGNAL PATH CLEAR');
}

/* ══ capture ═══════════════════════════════════════════════ */
function stamp(){
  const d = new Date();
  const p = n => String(n).padStart(2,'0');
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
}
function save(blob, ext){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'circuit-bender-' + stamp() + '.' + ext;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 20000);
}
function shot(){
  canvas.toBlob(b => { if(b){ save(b,'png'); crt('FRAME WRITTEN'); flash(); } }, 'image/png');
}
function flash(){
  const f = $('#flash');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}
let rec = null, recT = 0, recTimer = 0, recCap = 0;
/* chunks live in RAM until you stop. A forgotten recording fills a phone and
   the tab is killed by the OS with nothing saved, so cap it and say so. */
const REC_MAX_S = 20;
function toggleRec(){
  const btn = $('#b-rec');
  if(rec){ rec.stop(); return; }
  if(!window.MediaRecorder || !canvas.captureStream){ crt('NO RECORDER ON THIS BROWSER'); return; }
  let mime = ['video/mp4;codecs=avc1','video/webm;codecs=vp9','video/webm']
    .find(m => { try { return MediaRecorder.isTypeSupported(m); } catch(e){ return false; } });
  if(!mime){ crt('NO RECORDER'); return; }
  const chunks = [];
  try {
    rec = new MediaRecorder(canvas.captureStream(30), { mimeType:mime, videoBitsPerSecond: 9e6 });
  } catch(e){
    /* isTypeSupported can pass and construction still fail under memory
       pressure on iOS — take whatever the browser will give us */
    try { rec = new MediaRecorder(canvas.captureStream(30)); mime = rec.mimeType || 'video/webm'; }
    catch(e2){ rec = null; crt('RECORDER REFUSED — ' + e2.name); return; }
  }
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onerror = () => { crt('RECORDER FAULT'); try { rec.stop(); } catch(e){} };
  rec.onstop = () => {
    clearInterval(recTimer); clearTimeout(recCap);
    save(new Blob(chunks, { type:mime }), mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm');
    chunks.length = 0;
    rec = null; btn.classList.remove('on'); btn.querySelector('b').textContent = 'REC';
    crt('TAPE WRITTEN');
  };
  rec.start(120);
  recT = performance.now();
  btn.classList.add('on');
  recCap = setTimeout(() => { if(rec && rec.state === 'recording'){ crt('TAPE FULL'); rec.stop(); } },
                      REC_MAX_S * 1000);
  recTimer = setInterval(() => {
    const s = (performance.now()-recT)/1000;
    btn.querySelector('b').textContent = String(Math.floor(s/60)).padStart(2,'0') + ':' +
                                         String(Math.floor(s%60)).padStart(2,'0');
  }, 200);
  crt('TAPE RUNNING — MAX ' + REC_MAX_S + 's');
}

/* ══ wiring ════════════════════════════════════════════════ */
function wire(){
  const bend = $('#b-bend');
  const down = () => {
    state.bendTarget = 1; bend.classList.add('on');
    /* pick fresh pin pairs each press, so a surge is never the same twice —
       this is the probe wire, not a preset */
    state.surge = [];
    const n = 2 + Math.floor(Math.random()*2);
    for(let i=0;i<n;i++){
      const a = Math.floor(Math.random()*PINS.length);
      let b = Math.floor(Math.random()*PINS.length);
      if(b === a) b = (b + 1 + Math.floor(Math.random()*(PINS.length-1))) % PINS.length;
      state.surge.push({ a, b, rate: 0.8 + Math.random()*7, ph: Math.random()*6.28 });
    }
    crt('SURGE  ' + state.surge.map(g => PINS[g.a].name + '\u2013' + PINS[g.b].name).join('  '));
  };
  const up = () => {
    state.bendTarget = 0; bend.classList.remove('on');
    setTimeout(() => { if(state.bendTarget === 0) state.surge = []; }, 900);
  };
  bend.addEventListener('pointerdown', e => { e.preventDefault(); down(); });
  ['pointerup','pointercancel','pointerleave'].forEach(ev => bend.addEventListener(ev, up));

  const step = d => applyBend(state.pick + d);
  const prev = $('#bend-prev'), next = $('#bend-next');
  if(prev) prev.addEventListener('click', () => step(-1));
  if(next) next.addEventListener('click', () => step(1));

  /* swipe sideways across the picture to change bend, up to open the panel */
  const front = $('#front');
  if(front){
    let sx=0, sy=0, moved=false;
    front.addEventListener('pointerdown', e => {
      if(e.target.closest('.ctl, .fbtn, .big')) return;
      sx = e.clientX; sy = e.clientY; moved = false;
    });
    front.addEventListener('pointerup', e => {
      if(!sx && !sy) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if(Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      else if(dy < -60 && Math.abs(dy) > Math.abs(dx)) openDeep(true);
      sx = sy = 0;
    });
  }
  const handle = $('#deep-handle');
  if(handle) handle.addEventListener('click', () => openDeep(!document.body.classList.contains('panel-open')));
  const closeBtn = $('#deep-close');
  if(closeBtn) closeBtn.addEventListener('click', () => openDeep(false));

  $('#b-scram').addEventListener('click', e => scramble(true));
  $('#b-kill').addEventListener('click', resetAll);
  $('#b-shot').addEventListener('click', shot);
  $('#b-rec').addEventListener('click', toggleRec);
  $('#b-hold').addEventListener('click', e => {
    state.hold = !state.hold;
    e.currentTarget.classList.toggle('on', state.hold);
    crt(state.hold ? 'FRAME HELD — KEEP BENDING' : 'SIGNAL LIVE');
  });
  $('#b-cam').addEventListener('click', () => {
    openCamera(state.facing === 'user' ? 'environment' : 'user');
  });
  $('#b-qual').addEventListener('click', e => {
    quality = (quality + 1) % QUAL.length;
    e.currentTarget.querySelector('b').textContent = ['LO','MID','HI'][quality];
    if(video.videoWidth) sizeTo(video.videoWidth, video.videoHeight);
    crt('RESOLUTION ' + QUAL[quality][0] + '×' + QUAL[quality][1]);
  });

  addEventListener('keydown', e => {
    if(e.target.tagName === 'INPUT' || e.repeat) return;
    const k = e.key.toLowerCase();
    if(k === ' '){ e.preventDefault(); down(); }
    else if(k === 'r') scramble(true);
    else if(k === 'x') resetAll();
    else if(k === 'f'){ state.hold = !state.hold; $('#b-hold').classList.toggle('on', state.hold); }
    else if(k === 'c') shot();
    else if(k === 'v') toggleRec();
  });
  addEventListener('keyup', e => { if(e.key === ' ') up(); });

  /* holding still on a phone should not sleep the screen mid-take */
  if('wakeLock' in navigator){
    const grab = () => navigator.wakeLock.request('screen').catch(()=>{});
    grab();
    document.addEventListener('visibilitychange', () => document.hidden || grab());
  }
}

/* ══ boot ══════════════════════════════════════════════════ */
function boot(){
  $('#serial').textContent = SERIAL;
  Sigil.paint($('#brandmark'), { seed:SEED, arms:4, depth:2, cells:2, w:52, h:52 });
  $('#rule-a').innerHTML = Sigil.rule(SEED+11, 300);
  $('#rule-b').innerHTML = Sigil.rule(SEED+23, 300);
  /* the fascia silkscreen — one big mark under the whole rack, and a smaller
     one struck into the BEND cap */
  const wash = UI.el('div', 'rack__wash');
  wash.innerHTML = Sigil.svg({ seed:SEED+5, arms:5, depth:3, cells:3, w:760, h:760 });
  $('#rack').append(wash);
  const bs = UI.el('span', 'big__sig');
  bs.innerHTML = Sigil.svg({ seed:SEED+31, arms:3, depth:2, cells:1, w:80, h:80 });
  $('#b-bend').append(bs);
  buildRack();
  buildChip();
  buildFront();
  applyBend(0, true);
  buildPatchBay();
  $('#meters').append(mLevel, mSort, mBend);
  wire();
  source = bench; ready = true;
  sizeTo(bench.width, bench.height);
  requestAnimationFrame(loop);

  const s = $('#start');
  if(s) s.addEventListener('click', () => { openCamera(state.facing); });
}

/* ── SERVICE MODE — press T. runs the whole chain flat out with every stage
      in circuit and reports real cost per frame. an instrument that claims to
      be playable has to be able to prove it on the device it is played on ── */
function selftest(passes){
  passes = passes || 90;
  const keep = JSON.parse(JSON.stringify(V));
  const keepOn = Object.assign({}, ON);
  for(const k in STAGE) ON[k] = true;
  const skipModes = { slitMode:1, sortKey:1, sortAxis:1, sortOrder:1, sortSpan:1, inv:1, cgaPal:1, overMode:1 };
  const midParams = { axis:0.5, keyHue:0.33, gateLo:0.25, gateHi:0.85 };
  for(const k in V){
    if(skipModes[k]) continue;
    if(midParams[k] !== undefined){
      V[k] = midParams[k];
    } else if(/Angle$|Hue$/i.test(k)){
      V[k] = 0.5;
    } else {
      V[k] = 0.6;
    }
  }
  const gl = engine.gl;
  /* gl.finish() does not reliably drain the pipe on macOS/ANGLE — a 1px
     readPixels does, so the number below is real GPU work, not queue depth */
  const px = new Uint8Array(4);
  const drain = () => gl.readPixels(0,0,1,1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  engine.render(build(0), 16); drain();
  const t0 = performance.now();
  for(let i=0;i<passes;i++){ engine.render(build(i*0.016), 16); }
  drain();
  const ms = (performance.now() - t0) / passes;
  Object.assign(V, keep); Object.assign(ON, keepOn);
  for(const k in V){ const w = widgets[k]; if(w) w.set(V[k], false); }
  const r = { msPerFrame: +ms.toFixed(2), fps: Math.round(1000/ms),
              res: engine.width + 'x' + engine.height, sortBudget: engine.stats().sortBudget };
  crt('SELF TEST  ' + r.msPerFrame + 'ms  ' + r.fps + 'FPS  ALL STAGES  ' + r.res);
  return r;
}
addEventListener('keydown', e => { if(e.key === 't' || e.key === 'T') console.log(selftest()); });

/* service surface — also what the panel's own controls are driven through */
/* drive n frames by hand — verification must not depend on rAF, which a
   backgrounded tab throttles to nothing */
function step(n){
  n = n || 1;
  for(let i=0;i<n;i++) frame(state.frame * 0.0166, 16);
  tick();
  return { frame: state.frame, res: engine.width + 'x' + engine.height,
           bend: +state.bend.toFixed(3) };
}

window.CB = { selftest, step, V, DEF, ON, PATCH, STAGE, PINS, WIRES, BENDS, VOICE, applyBend,
              widgets, scramble, resetAll, state,
                   get engine(){ return engine; }, get params(){ return P; },
                   get source(){ return source; }, get ready(){ return ready; } };

if(document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
})();
