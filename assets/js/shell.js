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

/* ── THE EFFECT CATALOGUE ──────────────────────────────────────
   Mosh-Pro's taxonomy, Mosh-Pro's names, our engine underneath.
   An effect appears here only when every parameter it names exists
   in the engine — there are no placeholder tiles. ── */
const CATS = [
  ['REFRAME',  'reframing the picture'],
  ['TIME',     'built from several frames — needs motion'],
  ['DISPLACE', 'pushing pixels around'],
  ['REPEAT',   'reflecting and repeating'],
  ['TONE',     'how light and dark are distributed'],
  ['DOTS',     'rebuilt from a limited set of marks'],
  ['COLOR',    'grading, remapping, palettes'],
  ['OPTICS',   'lenses and light'],
  ['FILM',     'formats and displays'],
  ['LAYERS',   'brings its own picture'],
  ['MASK',     'cuts the effect to part of the frame'],
];

const K = (id, label, value, def, detent) =>
  ({ id, label, kind: 'knob', value, def: def == null ? 0 : def, detent });
const D = (id, label, positions, value) =>
  ({ id, label, kind: 'slide', positions, value: value || 0, def: value || 0 });

const EFFECTS = {
  /* ── REFRAME ── */
  transform:   { cat:'REFRAME', name:'TRANSFORM', tag:'CBX-TFM', note:'move, scale, rotate the frame',
                 params:[K('tx','POS X',0.5,0.5,[0.5]),K('ty','POS Y',0.5,0.5,[0.5]),K('tScale','SCALE',0.62,0.5,[0.5]),K('tRot','ANGLE',0.5,0.5,[0.5])] },
  transform3d: { cat:'REFRAME', name:'TRANSFORM 3D', tag:'CBX-3D', note:'rotate the plane in space',
                 params:[K('w3d','AMOUNT',0.55),K('w3dPitch','PITCH',0.62,0.5,[0.5]),K('w3dYaw','YAW',0.60,0.5,[0.5]),K('w3dRoll','ROLL',0.5,0.5,[0.5])] },

  /* ── TIME ── */
  decimate:    { cat:'TIME', name:'DECIMATE', tag:'CBX-DEC', note:'shooting on twos · motion arrives in steps',
                 params:[K('dec','AMOUNT',0.85),K('decSpeed','SPEED',0.20,0.5,[0.5]),K('decScale','SCALE',0.35),K('decTint','COLORIZE',0.25)] },
  opticalflow: { cat:'TIME', name:'OPTICAL FLOW', tag:'CBX-FLW', note:'dragged along its own motion vectors',
                 params:[K('flow','AMOUNT',0.75),K('flowDist','DISTORTION',0.60),K('flowSpeed','SPEED',0.50,0.5,[0.5])] },
  datamosh:    { cat:'TIME', name:'DATA MOSH', tag:'CBX-MOSH', note:'p-frame vector carry · recursive buffer',
                 params:[K('mosh','AMOUNT',0.55),K('feed','FLOW',0.35),K('orbit','DRIFT',0.52,0.5,[0.5])] },
  feedback:    { cat:'TIME', name:'FEEDBACK', tag:'CBX-FDBK', note:'the camera pointed at its own monitor',
                 params:[K('feed','AMOUNT',0.60),K('orbit','ROTATE',0.55,0.5,[0.5]),K('droste','TUNNEL',0.40)] },
  watercolor:  { cat:'TIME', name:'WATERCOLOR', tag:'CBX-WTR', note:'paint bleeding on wet paper',
                 params:[K('water','AMOUNT',0.62),K('waterBleed','FLOW',0.55,0.5,[0.5])] },
  slitscan:    { cat:'TIME', name:'SLIT SCAN', tag:'CBX-SLIT', note:'each part of the frame from a different moment',
                 params:[K('slit','AMOUNT',0.70),D('slitMode','FIELD',['X','Y','RAD','LUM','GRD'],0),K('ctime','SPREAD',0.60)] },

  /* ── DISPLACE ── */
  lumamesh:    { cat:'DISPLACE', name:'LUMA MESH', tag:'CBX-MESH', note:'brightness becomes height · rutt/etra lines',
                 params:[K('rutt','HEIGHT',0.58),K('ruttLines','LINES',0.45,0.5,[0.5]),K('scope','TRACE',0.35),K('scopeGlow','GLOW',0.60,0.5,[0.5])] },
  bulge:       { cat:'DISPLACE', name:'BULGE', tag:'CBX-BLG', note:'pushed outward like a fisheye',
                 params:[K('bulge','AMOUNT',0.70,0.5,[0.5]),K('bulgeRadius','RADIUS',0.55,0.5,[0.5])] },
  slices:      { cat:'DISPLACE', name:'SLICES', tag:'CBX-SLC', note:'the classic torn transmission',
                 params:[K('tear','AMOUNT',0.62),K('tearRate','SPEED',0.50,0.5,[0.5])] },
  stretch:     { cat:'DISPLACE', name:'STRETCH', tag:'CBX-STR', note:'pulls a region across the frame',
                 params:[K('stretch','AMOUNT',0.60),K('stretchWave','WAVE',0.35),K('stretchJag','JAGGIES',0.30)] },
  wave:        { cat:'DISPLACE', name:'WAVE', tag:'CBX-WAV', note:'one clean sine through the picture',
                 params:[K('wave2','AMOUNT',0.55),K('waveFreq','SIZE',0.45,0.5,[0.5]),K('waveAngle','ANGLE',0.0)] },
  badtv:       { cat:'DISPLACE', name:'BAD TV', tag:'CBX-BTV', note:'analog transport warble · tracking off',
                 params:[K('headsw','THICK',0.62),K('wave','FINE',0.40),K('chromaLoss','CH LOSS',0.35)] },
  hardglitch:  { cat:'DISPLACE', name:'HARD GLITCH', tag:'CBX-HGL', note:'chunky multi-scale displacement',
                 params:[K('addr','AMOUNT',0.55),K('clock','SCALE',0.45),K('bitAmt','SPLIT',0.40)] },
  smear:       { cat:'DISPLACE', name:'SMEAR', tag:'CBX-SMR', note:'long painted streaks behind motion',
                 params:[K('smear','AMOUNT',0.62)] },
  strobe:      { cat:'DISPLACE', name:'STROBE', tag:'CBX-STB', note:'cuts frames in and out on a beat',
                 params:[K('strobe','AMOUNT',0.70),K('strobeRate','SPEED',0.45,0.5,[0.5])] },
  streak:      { cat:'DISPLACE', name:'LIGHT STREAK', tag:'CBX-STK', note:'highlights stretched anamorphic',
                 params:[K('streak','AMOUNT',0.65),K('streakAngle','ANGLE',0.15)] },
  pixelsort:   { cat:'DISPLACE', name:'PIXEL SORT', tag:'CBX-SORT', note:'odd-even transposition · luma gate',
                 params:[K('sort','AMOUNT',0.45),K('gateLo','GATE ↓',0.20),K('gateHi','GATE ↑',0.75),D('sortKey','KEY',['LUMA','DARK','RGB','VAL'],0)] },

  jitter:      { cat:'DISPLACE', name:'JITTER', tag:'CBX-JIT', note:'never quite settles · an unstable signal',
                 params:[K('jit','AMOUNT',0.80),K('jitSpeed','SPEED',0.60,0.5,[0.5]),K('jitAngle','ANGLE',0.30)] },
  melt:        { cat:'DISPLACE', name:'MELT', tag:'CBX-MLT', note:'sliding off the screen in irregular runs',
                 params:[K('melt','AMOUNT',0.75),K('meltScale','SCALE',0.55,0.5,[0.5]),K('meltSpeed','SPEED',0.50,0.5,[0.5])] },
  wobble:      { cat:'DISPLACE', name:'WOBBLE', tag:'CBX-WOB', note:'a lens made of water rather than glass',
                 params:[K('wob','AMOUNT',0.70),K('wobSize','SIZE',0.55,0.5,[0.5]),K('wobSpeed','SPEED',0.50,0.5,[0.5])] },
  shake:       { cat:'DISPLACE', name:'SHAKE', tag:'CBX-SHK', note:'the camera being knocked',
                 params:[K('shake','AMOUNT',0.60),K('shakeSpeed','SPEED',0.55,0.5,[0.5])] },
  softglitch:  { cat:'DISPLACE', name:'SOFT GLITCH', tag:'CBX-SGL', note:'colour pulls apart in soft bands',
                 params:[K('soft','AMOUNT',0.75),K('softSpeed','SPEED',0.55,0.5,[0.5])] },

  /* ── REPEAT ── */
  mirror:      { cat:'REPEAT', name:'MIRROR', tag:'CBX-MIR', note:'one half reflected onto the other',
                 params:[K('mirror','AMOUNT',0.90),K('mirrorPos','POSITION',0.5,0.5,[0.5]),D('mirrorSide','SIDE',['L','R','T','B'],0)] },
  tile:        { cat:'REPEAT', name:'TILE', tag:'CBX-TIL', note:'sliding mirrored tiling',
                 params:[K('tile','AMOUNT',0.55),K('tileSpeed','SPEED',0.45,0.5,[0.5]),K('tileAngle','ANGLE',0.0)] },
  kaleido:     { cat:'REPEAT', name:'KALEIDO', tag:'CBX-KAL', note:'mirrored into wedges',
                 params:[K('kal','AMOUNT',0.60)] },
  splitter:    { cat:'REPEAT', name:'SPLITTER', tag:'CBX-SPL', note:'strips offset but still ordered',
                 params:[K('split','SHIFT',0.55),K('splitCount','COUNT',0.40),K('splitAngle','ANGLE',0.0)] },

  /* ── TONE ── */
  posterize:   { cat:'TONE', name:'POSTERIZE', tag:'CBX-PST', note:'gradients become flat bands · screen print',
                 params:[K('poster','AMOUNT',0.85),K('posterLevels','LEVELS',0.30)] },
  edges:       { cat:'TONE', name:'EDGES', tag:'CBX-EDG', note:'only where brightness changes sharply',
                 params:[K('edge','AMOUNT',0.80),K('edgeThick','THICKNESS',0.45),K('edgePass','PASSTHRU',0.25)] },
  solarize:    { cat:'TONE', name:'SOLARIZE', tag:'CBX-SOL', note:'the darkroom accident',
                 params:[D('inv','POLARITY',['NORM','NEG','SOLAR'],2)] },
  bleach:      { cat:'TONE', name:'BLEACH', tag:'CBX-BLC', note:'contrast crushed toward white',
                 params:[K('bleach','AMOUNT',0.55)] },
  sharpen:     { cat:'TONE', name:'SHARPEN', tag:'CBX-SHP', note:'local contrast at the edges',
                 params:[K('sharpen','AMOUNT',0.60)] },

  /* ── DOTS ── */
  pixelate:    { cat:'DOTS', name:'PIXELATE', tag:'CBX-PIX', note:'averaged into rectangular blocks',
                 params:[K('pix','AMOUNT',0.90),K('pixX','H PIXELS',0.18),K('pixY','V PIXELS',0.18)] },
  dotmatrix:   { cat:'DOTS', name:'DOT MATRIX', tag:'CBX-DOT', note:'dots sized by brightness · a stadium display',
                 params:[K('dot','AMOUNT',0.85),K('dotCount','COUNT',0.40),K('dotSize','SIZE',0.60),K('dotBlur','BLUR',0.30)] },
  linocut:     { cat:'DOTS', name:'LINOCUT', tag:'CBX-LIN', note:'carved marks with a directional cut',
                 params:[K('lino','AMOUNT',0.85),K('linoScale','SCALE',0.40),K('linoAngle','ANGLE',0.30)] },
  polar:       { cat:'DOTS', name:'POLAR', tag:'CBX-POL', note:'wrapped around a centre · lines become arcs',
                 params:[K('polar','AMOUNT',0.85),K('polarRadius','RADIUS',0.30),K('polarSeg','SEGMENTS',0.25)] },
  eightbit:    { cat:'DOTS', name:'8-BIT', tag:'CBX-CGA', note:'period palette, pixelated to match',
                 params:[K('cga','AMOUNT',0.70),D('cgaPal','PALETTE',['MAGENTA','RED/GRN','AMBER'],0)] },
  halftone:    { cat:'DOTS', name:'HALF TONE', tag:'CBX-HTN', note:'tone as dots on an angled screen',
                 params:[K('half','AMOUNT',0.60)] },
  dither:      { cat:'DOTS', name:'DITHER', tag:'CBX-DTH', note:'bayer 8×8 · extra tones from noise',
                 params:[K('dither','AMOUNT',0.65)] },
  ascii:       { cat:'DOTS', name:'ASCII', tag:'CBX-ASC', note:'characters chosen by brightness',
                 params:[K('ascii','AMOUNT',0.70),K('asciiTint','COLORIZE',0.50)] },

  /* ── COLOR ── */
  colorcorr:   { cat:'COLOR', name:'COLOR CORRECTION', tag:'CBX-CC', note:'the plate everything else starts from',
                 params:[K('ccLift','LIFT',0.5,0.5,[0.5]),K('ccGamma','GAMMA',0.5,0.5,[0.5]),K('ccGain','GAIN',0.5,0.5,[0.5]),K('ccTemp','TEMP',0.5,0.5,[0.5])] },
  huecycle:    { cat:'COLOR', name:'HUE CYCLE', tag:'CBX-HUE', note:'every colour rotated · relationships kept',
                 params:[K('hue','HUE',0.55),K('hueSpeed','SPEED',0.30)] },
  rainbow:     { cat:'COLOR', name:'RAINBOW', tag:'CBX-RBW', note:'tone becomes hue · thermal camera territory',
                 params:[K('rain','AMOUNT',0.85),D('rainPal','PALETTE',['THERMAL','SPECTRUM','ICE','TOXIC'],0),K('rainOffset','OFFSET',0.30),K('rainSpeed','SPEED',0.25)] },
  instacolor:  { cat:'COLOR', name:'INSTACOLOR', tag:'CBX-INS', note:'preset grades · set a mood without building one',
                 params:[K('insta','AMOUNT',0.85),D('instaStyle','STYLE',['VINTAGE','CINEMA','NOIR','SUMMER'],0)] },
  duotone:     { cat:'COLOR', name:'DUOTONE', tag:'CBX-DUO', note:'chroma collapsed onto poles · luma untouched',
                 params:[K('duo','AMOUNT',0.75),D('poles','POLES',['MONO','DUO','TRI','QUAD'],1),K('axis','AXIS',0.34,0.34,[0.34]),K('sat','COLOUR',0.60)] },

  /* ── OPTICS ── */
  rgbshift:    { cat:'OPTICS', name:'RGB SHIFT', tag:'CBX-RGB', note:'channels separated · chroma misregistration',
                 params:[K('rgbs','AMOUNT',0.70),K('rgbsAngle','ANGLE',0.25),D('rgbsMode','MODE',['LINEAR','RADIAL','BARREL'],0)] },
  vignette:    { cat:'OPTICS', name:'VIGNETTE', tag:'CBX-VIG', note:'quiet work · the corners darken',
                 params:[K('vig','AMOUNT',0.70),K('vigFeather','FEATHER',0.50,0.5,[0.5]),K('vigRound','ROUNDNESS',0.30)] },
  tiltshift:   { cat:'OPTICS', name:'TILT SHIFT', tag:'CBX-TLT', note:'one band sharp · reads as miniature',
                 params:[K('tilt','AMOUNT',0.75),K('tiltPos','POSITION',0.50,0.5,[0.5])] },
  barrelblur:  { cat:'OPTICS', name:'BARREL BLUR', tag:'CBX-BAR', note:'cheap glass · softening and fringing at the edge',
                 params:[K('barrel','AMOUNT',0.75),K('barrelInv','INVERT',0)] },
  glow:        { cat:'OPTICS', name:'GLOW', tag:'CBX-GLW', note:'light spills past its edges',
                 params:[K('glow','AMOUNT',0.70),K('glowCut','CUT OFF',0.35)] },
  blur:        { cat:'OPTICS', name:'BLUR', tag:'CBX-BLR', note:'straight gaussian',
                 params:[K('blur','AMOUNT',0.45)] },
  pushdraw:    { cat:'OPTICS', name:'PUSH DRAW', tag:'CBX-PSH', note:'displaced along a direction you choose',
                 params:[K('push','AMOUNT',0.55),K('pushAngle','ANGLE',0.25)] },

  /* ── FILM ── */
  super8:      { cat:'FILM', name:'SUPER 8', tag:'CBX-S8', note:'burn, dust, gate weave',
                 params:[K('s8','AMOUNT',0.60),K('s8Dust','DUST',0.45),K('s8Burn','BURN',0.40)] },
  vhs:         { cat:'FILM', name:'VHS', tag:'CBX-VHS', note:'dropout bars · chroma noise · head switch',
                 params:[K('headsw','HEAD SW',0.55),K('chromaLoss','STATIC',0.45),K('smear','BARS',0.40),K('ghost','GHOST',0.30)] },
  crt:         { cat:'FILM', name:'CRT', tag:'CBX-CRT', note:'phosphor triads, curvature, vignette',
                 params:[K('post','AMOUNT',0.65)] },
  scanlines:   { cat:'FILM', name:'SCANLINES', tag:'CBX-SCN', note:'the raster of an old monitor',
                 params:[K('scan','AMOUNT',0.55)] },
  grain:       { cat:'FILM', name:'GRAIN', tag:'CBX-GRN', note:'sits on the print, not inside the image',
                 params:[K('grain','AMOUNT',0.45),K('grainSize','SIZE',0.40,0.5,[0.5]),K('noise','HISS',0.25)] },

  /* ── LAYERS ── */
  media:       { cat:'LAYERS', name:'OVERLAY', tag:'CBX-OVL', note:'a second layer from the frame ring',
                 params:[K('over','OPACITY',0.55),D('overMode','BLEND',['SCREEN','MULT','DIFF','ADD'],0)] },

  /* ── MASK ── */
  maskblocks:  { cat:'MASK', name:'MASK BLOCKS', tag:'CBX-MSK', note:'a generated block pattern that shifts',
                 params:[K('mask','AMOUNT',0.60),K('maskSize','SCALE',0.45,0.5,[0.5]),K('maskSpeed','SPEED',0.50,0.5,[0.5])] },
  chromakey:   { cat:'MASK', name:'CHROMAKEY', tag:'CBX-KEY', note:'keys out a colour you pick',
                 params:[K('key','AMOUNT',0.70),K('keyHue','CHROMA',0.33),K('keyTol','THRESHOLD',0.30)] },
};

/* ── open-effect state ─────────────────────────────────────────
   Several effects are open at once and they all apply — that is the
   whole point of a rack, and it is what "stack and re-order effects"
   means in the reference. activeParams is their union, not a winner. ── */
const openOrder = [];                 /* effect ids, in the order added */
const values = {};                    /* per-effect current knob values  */
const widgetMap = {};
for (const id in EFFECTS) {
  values[id] = {};
  EFFECTS[id].params.forEach(p => { values[id][p.id] = p.value; });
}

/* every parameter any effect touches — used to clear only what we own */
const OWNED = (() => {
  const s = new Set();
  for (const id in EFFECTS) EFFECTS[id].params.forEach(p => s.add(p.id));
  return [...s];
})();

function recomputeParams() {
  /* start from neutral for everything an effect could have touched */
  OWNED.forEach(k => { activeParams[k] = (k in NEUTRAL) ? NEUTRAL[k] : 0; });
  /* then lay each open effect over the top, in the order it was added */
  openOrder.forEach(id => {
    const v = values[id];
    for (const k in v) activeParams[k] = v[k];
  });
  /* pixel sort needs its stride schedule or it caps at the pass count */
  if (openOrder.includes('pixelsort')) activeParams.sortSpan = 1;
  paintChain();
}

function paintChain() {
  const label = $('#shell-active-label');
  const txt = openOrder.length
    ? openOrder.map(id => EFFECTS[id].name).join(' → ')
    : 'no effects — pick one from /effects';
  if (label) label.textContent = txt;
  const sysBuild = $('#sys-build');
  if (sysBuild) sysBuild.textContent = openOrder.length + ' in chain';
  $$('.cat-row').forEach(r => r.classList.toggle('on', openOrder.includes(r.dataset.fx)));
}

function openEffect(id) {
  if (!EFFECTS[id] || openOrder.includes(id)) return;
  openOrder.push(id);
  desk.appendChild(makePanel(id));
  recomputeParams();
  layoutDesktopPanels();
}

function closeEffect(id) {
  const i = openOrder.indexOf(id);
  if (i < 0) return;
  openOrder.splice(i, 1);
  const p = $('#panel-' + id);
  if (p) p.remove();
  EFFECTS[id].params.forEach(pr => { values[id][pr.id] = pr.value; });
  recomputeParams();
  layoutDesktopPanels();
}

function updateParam(id, paramId, val) {
  values[id][paramId] = val;
  if (openOrder.includes(id)) activeParams[paramId] = val;
}

function resetActiveParams() {
  [...openOrder].forEach(closeEffect);
}

/* ── a panel, built from the effect's own definition ───────── */
function makePanel(id) {
  const fx = EFFECTS[id];
  const el = document.createElement('article');
  el.className = 'shell-panel is-expanded is-active';
  el.dataset.build = id;
  el.id = 'panel-' + id;

  const head = document.createElement('div');
  head.className = 'shell-panel__header';
  head.innerHTML =
    '<i class="shell-panel__screw"></i>' +
    '<span class="shell-panel__led on"></span>' +
    '<span class="shell-panel__path">/fx/' + id + '</span>' +
    '<button class="shell-panel__act-btn on" type="button">REMOVE</button>' +
    '<i class="shell-panel__screw shell-panel__screw--r"></i>';
  head.querySelector('button').addEventListener('click', e => {
    e.stopPropagation(); closeEffect(id);
  });

  const body = document.createElement('div');
  body.className = 'shell-panel__body';
  body.id = 'body-' + id;

  const foot = document.createElement('div');
  foot.className = 'shell-panel__footer';
  foot.innerHTML = '<span class="shell-panel__tag">' + fx.tag + '</span>' +
                   '<span class="shell-panel__note">' + fx.note + '</span>';

  el.append(head, body, foot);
  fx.params.forEach(ctl => {
    let w;
    if (ctl.kind === 'knob') {
      w = UI.knob({ label: ctl.label, value: values[id][ctl.id], def: ctl.def,
                    detent: ctl.detent, lo: 0, hi: 1, scale: 100, dp: 0,
                    onchange: v => updateParam(id, ctl.id, v) });
    } else {
      w = UI.slide({ label: ctl.label, positions: ctl.positions,
                     value: values[id][ctl.id], def: ctl.def,
                     onchange: v => updateParam(id, ctl.id, v) });
    }
    if (w && w.el) { widgetMap[id + '_' + ctl.id] = w; body.appendChild(w.el); }
  });

  initDraggable(el, head);
  head.addEventListener('click', e => {
    if (e.target.closest('button, a, input, select')) return;
    if (window.innerWidth <= 900) el.classList.toggle('is-expanded');
    else bringToFront(el);
  });
  return el;
}

/* ── the catalogue — every effect, in the reference's own order ── */
function buildCatalogue() {
  const box = $('#cat-list');
  if (!box) return;
  box.innerHTML = '';
  CATS.forEach(([cat, blurb]) => {
    const ids = Object.keys(EFFECTS).filter(k => EFFECTS[k].cat === cat);
    if (!ids.length) return;
    const h = document.createElement('div');
    h.className = 'cat-head';
    h.innerHTML = '<b>' + cat + '</b><em>' + blurb + '</em>';
    box.appendChild(h);
    ids.forEach(id => {
      const r = document.createElement('button');
      r.type = 'button';
      r.className = 'cat-row';
      r.dataset.fx = id;
      r.innerHTML = '<span class="cat-row__dot"></span><span class="cat-row__name">' +
                    EFFECTS[id].name + '</span><span class="cat-row__add">ADD</span>';
      r.addEventListener('click', () => {
        openOrder.includes(id) ? closeEffect(id) : openEffect(id);
      });
      box.appendChild(r);
    });
  });
}

/* ── WebGL2 Engine boot — exactly one canvas in DOM ────────── */
const desk  = $('#desktop');
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

/* ── desktop dragging & bring-to-front ────────────────────── */
let topZ = 20;

function bringToFront(panel) {
  topZ++;
  panel.style.zIndex = topZ;
}

function initDraggable(panel, handle) {
  let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false, didMove = false;

  handle.addEventListener('pointerdown', e => {
    if (window.innerWidth <= 900) return; /* Mobile: drag disabled */
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest('button, a, input, select')) return;

    bringToFront(panel);
    dragging = true;
    didMove = false;
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
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didMove = true;

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
    panel._dragged = true;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-dragging');
    try { handle.releasePointerCapture(e.pointerId); } catch (_) {}

    if (!didMove && panel.dataset.aux) {
      panel.classList.toggle('is-expanded');
      layoutDesktopPanels();
    }
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
      p.style.left = ''; p.style.top = '';
      p.style.right = ''; p.style.bottom = ''; p.style.zIndex = '';
    });
    return;
  }

  /* Columns, not one running stack — with a catalogue open and several
     effects stacked, a single column walks straight off the bottom. Panels
     the user has dragged keep their own position and are skipped. */
  const panels = [...$$('.shell-desktop .shell-panel')].filter(p => !p._dragged);
  const top = 14, gap = 6, colGap = 10;
  const limit = window.innerHeight - 20;
  let x = 18, y = top, colW = 0, z = 10;

  panels.forEach(p => {
    const h = p.offsetHeight || 30;
    const w = p.offsetWidth || 240;
    if (y + h > limit && y > top) { x += colW + colGap; y = top; colW = 0; }
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.right = 'auto';
    p.style.bottom = 'auto';
    p.style.zIndex = ++z;
    y += h + gap;
    if (w > colW) colW = w;
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

  /* The catalogue lists every effect; panels are created when one is added */
  buildCatalogue();

  /* Static panels — catalogue, bender launcher, status, about */
  $$('.shell-panel[data-aux]').forEach(panel => {
    const btn = panel.querySelector('.shell-panel__act-btn');
    if (btn) {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        panel.classList.toggle('is-expanded');
        btn.classList.toggle('on', panel.classList.contains('is-expanded'));
        layoutDesktopPanels();
      });
    }
    const header = panel.querySelector('.shell-panel__header');
    if (header) initDraggable(panel, header);
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

  /* Boot with a short chain so the instrument is doing something on arrival */
  ['duotone', 'slices'].forEach(openEffect);

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
