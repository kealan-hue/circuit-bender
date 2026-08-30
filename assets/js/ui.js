/* ══════════════════════════════════════════════════════════════
   UI — the hardware. Sony control vocabulary: ribbed slide switches,
   engraved scales, precise small type. Every continuous control is
   ACCURATE by construction:

     · the value is always on screen, never only while dragging
     · shift = fine (x0.15), alt = ultra-fine (x0.03)
     · double-click = back to the detent default
     · click the number = type an exact one
     · focus + arrows = one step, shift+arrows = a tenth of a step
     · pointer capture, so the drag survives leaving the element
     · one calibrated sweep length for every control — 260px = full travel
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

const SWEEP = 260;                        /* px for a full 0→1 traverse */
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const fmt = (v, dp) => v.toFixed(dp == null ? 2 : dp);

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html != null) n.innerHTML = html;
  return n;
}

/* ── shared drag behaviour ────────────────────────────────── */
function draggable(node, opts){
  let startY = 0, startX = 0, startV = 0, active = false, moved = 0;

  function factor(e){ return e.altKey ? 0.03 : e.shiftKey ? 0.15 : 1; }

  node.addEventListener('pointerdown', e => {
    if(e.button != null && e.button !== 0) return;
    active = true; moved = 0;
    startY = e.clientY; startX = e.clientX; startV = opts.get();
    node.setPointerCapture(e.pointerId);
    node.classList.add('is-live');
    e.preventDefault();
  });
  node.addEventListener('pointermove', e => {
    if(!active) return;
    const dy = startY - e.clientY, dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dy) + Math.abs(dx));
    const d = (opts.horizontal ? dx : dy) / SWEEP * factor(e);
    opts.set(startV + d, true);
  });
  function end(e){
    if(!active) return;
    active = false;
    node.classList.remove('is-live');
    try { node.releasePointerCapture(e.pointerId); } catch(_){}
  }
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);

  node.addEventListener('dblclick', () => opts.reset());
  node.addEventListener('wheel', e => {
    e.preventDefault();
    opts.set(opts.get() - Math.sign(e.deltaY) * 0.02 * factor(e), true);
  }, { passive:false });

  node.tabIndex = 0;
  node.addEventListener('keydown', e => {
    const s = e.shiftKey ? 0.01 : 0.05;
    if(e.key === 'ArrowUp'   || e.key === 'ArrowRight'){ opts.set(opts.get()+s, true); e.preventDefault(); }
    else if(e.key === 'ArrowDown' || e.key === 'ArrowLeft'){ opts.set(opts.get()-s, true); e.preventDefault(); }
    else if(e.key === 'Home'){ opts.reset(); e.preventDefault(); }
  });
}

/* ── numeric readout you can type into ────────────────────── */
function readout(get, set, spec){
  const n = el('button', 'num');
  n.type = 'button';
  n.addEventListener('click', () => {
    const cur = spec.display ? spec.display(get()) : fmt(get() * (spec.scale||1), spec.dp);
    const v = prompt(spec.label + '  —  enter a value (' +
                     fmt((spec.lo||0)*(spec.scale||1), spec.dp) + ' … ' +
                     fmt((spec.hi==null?1:spec.hi)*(spec.scale||1), spec.dp) + ')', cur);
    if(v == null) return;
    const f = parseFloat(v);
    if(!isNaN(f)) set(f / (spec.scale||1), true);
  });
  return n;
}

/* ── KNOB ─────────────────────────────────────────────────── */
/* aspect-ratio is pinned and flex is frozen: a knob inside a flex column
   will otherwise be squashed into an ellipse the moment the row is tight */
function knob(spec){
  const root = el('div', 'ctl ctl--knob');
  const dial = el('div', 'knob');
  dial.innerHTML =
    '<div class="knob__ring"></div>' +
    '<div class="knob__body"><i class="knob__ptr"></i></div>' +
    '<svg class="knob__arc" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path class="knob__trk" d="M22,78 A38,38 0 1,1 78,78" />' +
      '<path class="knob__val" d="M22,78 A38,38 0 1,1 78,78" />' +
    '</svg>';
  const cap = el('div', 'ctl__cap', spec.label);
  const out = readout(get, set, spec);
  root.append(dial, out, cap);

  let v = spec.value != null ? spec.value : (spec.def != null ? spec.def : 0);
  const lo = spec.lo == null ? 0 : spec.lo;
  const hi = spec.hi == null ? 1 : spec.hi;
  const valPath = dial.querySelector('.knob__val');
  const LEN = 199;                       /* measured length of the arc path */

  function get(){ return v; }
  function paint(){
    const t = (v - lo) / (hi - lo);
    dial.style.setProperty('--t', t);
    dial.querySelector('.knob__ptr').style.transform =
      'translate(-50%,-100%) rotate(' + (-138 + t*276) + 'deg)';
    valPath.style.strokeDasharray = (t*LEN) + ' ' + LEN;
    out.textContent = spec.display ? spec.display(v) : fmt(v*(spec.scale||1), spec.dp);
    root.classList.toggle('is-zero', Math.abs(v - (spec.def||0)) < 1e-4);
  }
  function set(nv, fire){
    nv = clamp(nv, lo, hi);
    if(spec.detent){                    /* magnet, not a hard snap */
      for(const d of spec.detent) if(Math.abs(nv-d) < 0.018) nv = d;
    }
    if(nv === v){ paint(); return; }
    v = nv; paint();
    if(fire && spec.onchange) spec.onchange(v);
  }
  draggable(dial, { get, set, reset: () => set(spec.def != null ? spec.def : lo, true) });
  paint();
  return { el: root, get, set, node: dial, spec };
}

/* ── SLIDE SWITCH — the Sony control. ribbed thumb, N engraved detents ── */
function slide(spec){
  const n = spec.positions.length;
  const root = el('div', 'ctl ctl--slide');
  const body = el('div', 'slide');
  body.innerHTML =
    '<div class="slide__track"><div class="slide__thumb">' +
      '<i></i><i></i><i></i><i></i><i></i>' +
    '</div></div>';
  const marks = el('div', 'slide__marks');
  spec.positions.forEach((p,i) => {
    const m = el('span', 'slide__mark', p);
    m.addEventListener('click', () => set(i, true));
    marks.append(m);
  });
  const cap = el('div', 'ctl__cap', spec.label);
  root.append(body, marks, cap);
  root.style.setProperty('--n', n);

  let idx = spec.value || 0;
  const thumb = body.querySelector('.slide__thumb');

  function get(){ return idx; }
  function paint(){
    thumb.style.left = 'calc(' + (idx/(n-1)*100) + '% - ' + (idx/(n-1)) + ' * var(--tw) + 1px)';
    [...marks.children].forEach((m,i) => m.classList.toggle('on', i === idx));
    root.dataset.pos = spec.positions[idx];
    root.classList.toggle('is-zero', idx === (spec.def||0));
  }
  function set(i, fire){
    i = clamp(Math.round(i), 0, n-1);
    if(i === idx){ paint(); return; }
    idx = i; paint();
    if(fire && spec.onchange) spec.onchange(idx);
  }
  /* click steps forward; drag lands on the nearest detent */
  let dragged = false, sx = 0, si = 0;
  body.addEventListener('pointerdown', e => {
    dragged = false; sx = e.clientX; si = idx;
    body.setPointerCapture(e.pointerId);
    body.classList.add('is-live');
  });
  body.addEventListener('pointermove', e => {
    if(!body.hasPointerCapture || !body.hasPointerCapture(e.pointerId)) return;
    const w = body.getBoundingClientRect().width;
    const d = (e.clientX - sx) / (w / (n-1));
    if(Math.abs(e.clientX - sx) > 4) dragged = true;
    set(si + d, true);
  });
  body.addEventListener('pointerup', e => {
    body.classList.remove('is-live');
    try { body.releasePointerCapture(e.pointerId); } catch(_){}
    if(!dragged) set((idx+1) % n, true);
  });
  body.tabIndex = 0;
  body.addEventListener('keydown', e => {
    if(e.key === 'ArrowRight' || e.key === 'ArrowUp'){ set(idx+1, true); e.preventDefault(); }
    if(e.key === 'ArrowLeft'  || e.key === 'ArrowDown'){ set(idx-1, true); e.preventDefault(); }
  });
  paint();
  return { el: root, get, set, node: body, spec };
}

/* ── FADER — vertical, engraved 0–10 scale beside it (Sony volume) ── */
function fader(spec){
  const root = el('div', 'ctl ctl--fader');
  const body = el('div', 'fader');
  let scale = '';
  for(let i=0;i<=10;i++){
    scale += '<span class="fader__tick' + (i%5===0 ? ' maj' : '') + '"' +
             ' style="bottom:' + (i*10) + '%">' +
             (i%5===0 ? '<b>' + i + '</b>' : '') + '</span>';
  }
  body.innerHTML = '<div class="fader__scale">' + scale + '</div>' +
                   '<div class="fader__slot"><div class="fader__cap">' +
                   '<i></i><i></i><i></i></div></div>';
  const out = readout(get, set, spec);
  const cap = el('div', 'ctl__cap', spec.label);
  root.append(body, out, cap);

  let v = spec.value != null ? spec.value : (spec.def || 0);
  const capEl = body.querySelector('.fader__cap');

  function get(){ return v; }
  function paint(){
    capEl.style.bottom = 'calc(' + (v*100) + '% - ' + v + ' * var(--ch))';
    out.textContent = spec.display ? spec.display(v) : fmt(v*(spec.scale||1), spec.dp);
    root.classList.toggle('is-zero', Math.abs(v-(spec.def||0)) < 1e-4);
  }
  function set(nv, fire){
    nv = clamp(nv, 0, 1);
    if(spec.detent) for(const d of spec.detent) if(Math.abs(nv-d) < 0.018) nv = d;
    if(nv === v){ paint(); return; }
    v = nv; paint();
    if(fire && spec.onchange) spec.onchange(v);
  }
  draggable(body, { get, set, reset: () => set(spec.def||0, true) });
  paint();
  return { el: root, get, set, node: body, spec };
}

/* ── ROCKER — hard on/off with an LED ─────────────────────── */
function rocker(spec){
  const root = el('div', 'rock');
  root.innerHTML = '<button type="button" class="rock__sw"><i></i></button>' +
                   '<span class="rock__led"></span>' +
                   '<span class="rock__cap"></span>';
  root.querySelector('.rock__cap').textContent = spec.label;
  const sw = root.querySelector('.rock__sw');
  let on = !!spec.value;
  function get(){ return on; }
  function paint(){ root.classList.toggle('on', on); sw.setAttribute('aria-pressed', on); }
  function set(v, fire){
    v = !!v; if(v === on){ paint(); return; }
    on = v; paint(); if(fire && spec.onchange) spec.onchange(on);
  }
  sw.addEventListener('click', () => set(!on, true));
  paint();
  return { el: root, get, set, node: sw, spec };
}

/* ── LED strip meter ──────────────────────────────────────── */
function meter(n, cls){
  const m = el('div', 'meter ' + (cls||''));
  for(let i=0;i<n;i++) m.append(el('i'));
  m.set = v => {
    const k = Math.round(clamp(v,0,1) * n);
    [...m.children].forEach((c,i) => c.classList.toggle('on', i < k));
  };
  return m;
}

global.UI = { knob, slide, fader, rocker, meter, el, clamp, SWEEP };
})(window);
