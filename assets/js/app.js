/* ══════════════════════════════════════════════════════════════
   MANGLER — the instrument.

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
  let s = localStorage.getItem('mangler.serial');
  if(!s){
    s = 'MG' + Math.floor(Math.random()*9000+1000) + '-' +
        String.fromCharCode(65+Math.floor(Math.random()*26)) +
        Math.floor(Math.random()*90+10);
    localStorage.setItem('mangler.serial', s);
  }
  return s;
})();
const SEED = [...SERIAL].reduce((a,c) => (a*31 + c.charCodeAt(0)) >>> 0, 7);

/* ── the parameter set ─────────────────────────────────────── */
/* The unit boots already glitching, not clean-then-you-add-damage — a
   reference worth matching stays broken by default and you dial the
   character, you don't dial broken-ness into existence from nothing. TEAR +
   POST + NOISE are the baseline "always some current running through it." */
const V = {
  gain:0.5, bias:0.5, mix:1,
  slit:0, slitMode:0, ctime:0, echo:0, delay:0.35, delayMix:0,
  tear:0.38, tearRate:0.5, warp:0, kal:0, rutt:0, ruttLines:0.5,
  mosh:0, feed:0, orbit:0.5, droste:0,
  ntsc:0, ntscSat:0.5, headsw:0, wave:0, chromaLoss:0, ghost:0, smear:0, bitAmt:0,
  sort:0, gateLo:0.25, gateHi:0.85, sortAxis:0, sortOrder:0, sortKey:0, sortSpan:1,
  post:0.28, dither:0.3, half:0, scan:0.18, noise:0.14, inv:0
};
const DEF = Object.assign({}, V);

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
  sort:   ['sort'],
  out:    ['post','dither','half','scan','noise']
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
const PATCH = {};                      /* param → { src, depth } */
let armed = null;

const state = {
  bend:0, bendTarget:0, hold:false, facing:'user',
  ntscPhase:0, bitMask:[0,0,0], burst:0, frame:0
};

/* ══ engine boot ═══════════════════════════════════════════ */
const canvas = $('#glass');
let engine;
try { engine = new Engine(canvas); }
catch(err){ fail(err); return; }

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
    x.font = '700 54px ui-monospace,Menlo,monospace';
    x.textAlign = 'center';
    x.fillText('MANGLER', 0, 14);
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

async function openCamera(facing){
  if(stream) stream.getTracks().forEach(t => t.stop());
  ready = false;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    source = bench; ready = true; dropStart(); sizeTo(bench.width, bench.height);
    crt('NO SENSOR API — BENCH PATTERN'); return;
  }
  crt('OPENING ' + (facing === 'user' ? 'FRONT' : 'REAR') + ' SENSOR');
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
      source = bench; ready = true; dropStart();
      sizeTo(bench.width, bench.height);
      crt('NO SENSOR — BENCH PATTERN (' + e2.name + ')');
      return;
    }
  }
  video.srcObject = stream;
  await video.play().catch(()=>{});
  state.facing = facing;
  await new Promise(r => {
    if(video.videoWidth) return r();
    video.onloadedmetadata = r;
  });
  sizeTo(video.videoWidth, video.videoHeight);
  source = video; ready = true; dropStart();
  crt('SIGNAL LOCK  ' + video.videoWidth + '×' + video.videoHeight);
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

/* ── effective params, after stage gating and modulation ──── */
const P = {};
function build(t){
  for(const k in V) P[k] = V[k];
  for(const s in STAGE) if(!ON[s]) STAGE[s].forEach(k => P[k] = 0);

  for(const k in PATCH){
    const pt = PATCH[k];
    const src = SOURCES[pt.src];
    if(!src) continue;
    const base = DEF[k] === 0.5 ? P[k] : P[k];
    P[k] = clamp(base + src.fn(t) * pt.depth * 0.5, 0, 1);
  }

  /* BEND: shove the whole chain somewhere extreme for as long as it is held.
     it does not set values, it BIASES them — so it lands somewhere different
     depending on where the panel already was */
  const b = state.bend;
  if(b > 0.001){
    P.tear   = clamp(P.tear   + b*0.75, 0, 1);
    P.warp   = clamp(P.warp   + b*0.55, 0, 1);
    P.mosh   = clamp(P.mosh   + b*0.62, 0, 1);
    P.feed   = clamp(P.feed   + b*0.50, 0, 1);
    P.slit   = clamp(P.slit   + b*0.38, 0, 1);
    P.ctime  = clamp(P.ctime  + b*0.30, 0, 1);
    P.sort   = clamp(P.sort   + b*0.55, 0, 1);
    P.ntsc   = clamp(P.ntsc   + b*0.45, 0, 1);
    P.headsw = clamp(P.headsw + b*0.40, 0, 1);
    P.bitAmt = clamp(P.bitAmt + b*0.35, 0, 1);
    P.post   = clamp(P.post   + b*0.30, 0, 1);
    P.noise  = clamp(P.noise  + b*0.22, 0, 1);
    P.gateLo = clamp(P.gateLo - b*0.22, 0, 1);
    P.gain   = clamp(P.gain   + b*0.18, 0, 1);
  }

  P.time = t;
  P.bend = b;
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
  { id:'sort', name:'SORT', note:'span, not threshold', wide:true, ctl:[
    F('sort','PASSES',  { def:0 }),
    K('gateLo','GATE ↓',{ def:0.25 }),
    K('gateHi','GATE ↑',{ def:0.85 }),
    S('sortKey','KEY',  ['LUMA','DARK','RGB','VALUE']),
    S('sortAxis','AXIS',['HORIZ','VERT']),
    S('sortOrder','DIR',['UP','DOWN']),
    S('sortSpan','SPAN',['1:1','WIDE'], { value:1 })
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
      crt(armed ? ('PATCH ARMED — TOUCH A CONTROL') : 'PATCH IDLE');
    });
    bay.append(b);
    SOURCES[k].btn = b;
  });
  const clr = UI.el('button', 'jack jack--clr');
  clr.type = 'button';
  clr.innerHTML = '<span class="jack__hole"></span><span class="jack__cap">PULL</span>';
  clr.addEventListener('click', () => {
    armed = (armed === 'CLR') ? null : 'CLR';
    paintBay();
    crt(armed ? 'PULL ARMED — TOUCH A CONTROL' : 'PATCH IDLE');
  });
  bay.append(clr);
  SOURCES.CLR = { btn: clr };
  function paintBay(){
    for(const k in SOURCES) if(SOURCES[k].btn) SOURCES[k].btn.classList.toggle('armed', armed === k);
    document.body.classList.toggle('is-patching', !!armed);
  }
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
  for(const k in PATCH) delete PATCH[k];
  armed = null;
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
  a.download = 'mangler-' + stamp() + '.' + ext;
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
let rec = null, recT = 0, recTimer = 0;
function toggleRec(){
  const btn = $('#b-rec');
  if(rec){ rec.stop(); return; }
  let mime = ['video/mp4;codecs=avc1','video/webm;codecs=vp9','video/webm']
    .find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  if(!mime){ crt('NO RECORDER'); return; }
  const chunks = [];
  rec = new MediaRecorder(canvas.captureStream(30), { mimeType:mime, videoBitsPerSecond: 9e6 });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    clearInterval(recTimer);
    save(new Blob(chunks, { type:mime }), mime.startsWith('video/mp4') ? 'mp4' : 'webm');
    rec = null; btn.classList.remove('on'); btn.querySelector('b').textContent = 'REC';
    crt('TAPE WRITTEN');
  };
  rec.start(120);
  recT = performance.now();
  btn.classList.add('on');
  recTimer = setInterval(() => {
    const s = (performance.now()-recT)/1000;
    btn.querySelector('b').textContent = String(Math.floor(s/60)).padStart(2,'0') + ':' +
                                         String(Math.floor(s%60)).padStart(2,'0');
  }, 200);
  crt('TAPE RUNNING');
}

/* ══ wiring ════════════════════════════════════════════════ */
function wire(){
  const bend = $('#b-bend');
  const down = () => { state.bendTarget = 1; bend.classList.add('on'); };
  const up   = () => { state.bendTarget = 0; bend.classList.remove('on'); };
  bend.addEventListener('pointerdown', e => { e.preventDefault(); down(); });
  ['pointerup','pointercancel','pointerleave'].forEach(ev => bend.addEventListener(ev, up));

  $('#b-scram').addEventListener('click', e => scramble(!e.shiftKey));
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
  buildPatchBay();
  $('#meters').append(mLevel, mSort, mBend);
  wire();
  requestAnimationFrame(loop);
  openCamera('environment');

  const s = $('#start');
  if(s) s.addEventListener('click', () => { s.remove(); openCamera(state.facing); });
  /* iOS will not grant the sensor without a gesture, so the plate stays until
     a source is actually live — desktop drops it on its own a beat later */
}

/* ── SERVICE MODE — press T. runs the whole chain flat out with every stage
      in circuit and reports real cost per frame. an instrument that claims to
      be playable has to be able to prove it on the device it is played on ── */
function selftest(passes){
  passes = passes || 90;
  const keep = JSON.parse(JSON.stringify(V));
  const keepOn = Object.assign({}, ON);
  for(const k in STAGE) ON[k] = true;
  Object.assign(V, {
    slit:.7, ctime:.5, echo:.5, delayMix:.5, tear:.6, warp:.6, kal:.4,
    rutt:.5, mosh:.6, feed:.5, droste:.4, headsw:.5, wave:.5, chromaLoss:.4,
    ntsc:.8, ghost:.4, smear:.5, bitAmt:.5, sort:.7, post:.5, dither:.6,
    half:.4, scan:.4, noise:.3
  });
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

window.MANGLER = { selftest, step, V, DEF, ON, PATCH, STAGE, widgets, scramble, resetAll,
                   get engine(){ return engine; }, get params(){ return P; } };

if(document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
})();
