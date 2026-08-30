/* ══════════════════════════════════════════════════════════════
   SIGIL — procedural cyber sigilism

   The style is HAIRLINE. Everything is a ribbon whose width collapses
   as (1-t)^p along its own spine, so almost the whole length is a
   needle and only the root carries weight. Nothing is a filled blob:
   the enclosed almonds are OUTLINES made of two thin ribbons meeting
   at a shared tip, and the negative space inside them is the point.

   Marks are grown from a seed, so a unit's serial fixes its panel art.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

const TAU = Math.PI * 2;
const f = n => Math.round(n * 100) / 100;

function rng(seed){
  let s = (seed >>> 0) || 1;
  return function(){
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/* A spine is integrated, not interpolated — a constant turning rate is what
   gives the claw its curl instead of a symmetrical arc. */
function spine(x, y, ang, len, turn, N){
  N = N || 18;
  const step = len / N;
  const pts = [], dirs = [];
  let a = ang, px = x, py = y;
  for(let i=0;i<=N;i++){
    pts.push([px,py]); dirs.push(a);
    a += turn / N;
    px += Math.cos(a) * step;
    py += Math.sin(a) * step;
  }
  return { pts, dirs, tip:[px,py], endAng:a };
}

/* Ribbon: walk the spine laying down a LENS width profile —
      w(t) ∝ t^a · (1-t)^b
   thin at the root, swelling around t≈a/(a+b), needle at the tip. This is the
   entire vocabulary of the style: every stroke is thin-thick-thin. A profile
   that only decreases gives you a bare tree, which is what a monotonic taper
   produced and why it read wrong. */
function ribbon(sp, w0, pb, pa){
  pa = (pa == null) ? 0.55 : pa;
  pb = (pb == null) ? 1.45 : pb;
  const peak = pa / (pa + pb);
  const norm = Math.pow(peak, pa) * Math.pow(1 - peak, pb);
  const n = sp.pts.length - 1;
  const L = [], R = [];
  for(let i=0;i<=n;i++){
    const t = i / n;
    const w = w0 * Math.pow(t, pa) * Math.pow(1 - t, pb) / norm;
    const [px,py] = sp.pts[i];
    const a = sp.dirs[i];
    const nx = Math.cos(a + Math.PI/2) * w, ny = Math.sin(a + Math.PI/2) * w;
    L.push([f(px+nx), f(py+ny)]);
    R.push([f(px-nx), f(py-ny)]);
  }
  let d = 'M' + L[0][0] + ',' + L[0][1];
  for(let i=1;i<=n;i++) d += 'L' + L[i][0] + ',' + L[i][1];
  for(let i=n;i>=0;i--) d += 'L' + R[i][0] + ',' + R[i][1];
  return d + 'Z';
}

/* the barb: a very short, very sharp ribbon thrown off a junction */
function barb(R, x, y, ang, len, w){
  return ribbon(spine(x, y, ang, len, (R()-0.5)*1.5, 7), w, 1.9, 0.42);
}

/* an almond of negative space — two thin ribbons from one root to one tip,
   bowed apart. the hole is the shape; the ink is only its wall */
function cell(out, x, y, ang, len, open, w){
  /* the two walls bow apart then come back — the almond between them is the
     shape, and it has to be big enough to read as a hole */
  out.push(ribbon(spine(x, y, ang - open, len,  open*2.6, 16), w, 1.25, 0.85));
  out.push(ribbon(spine(x, y, ang + open, len, -open*2.6, 16), w, 1.25, 0.85));
}

/* a whip: long, near-hairline, leaves the mass and does not come back */
function whip(x, y, ang, len, turn, w){
  return ribbon(spine(x, y, ang, len, turn, 24), w, 2.6, 0.30);
}

/* a branch throws barbs off its flanks, then recurses on a couple of them */
function branch(out, R, x, y, ang, len, w, depth){
  const turn = (R() - 0.5) * 2.6;
  const sp = spine(x, y, ang, len, turn, 18);
  out.push(ribbon(sp, w, 1.55, 0.60));
  if(depth <= 0) return;
  const n = 2 + Math.floor(R() * 2);
  for(let i=1;i<=n;i++){
    const t = 0.18 + (i / (n + 1)) * 0.66;
    const k = Math.round(t * 18);
    const [bx, by] = sp.pts[k];
    const ba = sp.dirs[k];
    const side = (i % 2 ? 1 : -1);
    const spread = (0.5 + R() * 0.8) * side;
    const kid = len * (0.52 - t * 0.22) * (0.7 + R() * 0.6);
    if(R() < 0.45 && depth > 1){
      branch(out, R, bx, by, ba + spread, kid, w * 0.40, depth - 1);
    } else {
      out.push(barb(R, bx, by, ba + spread * 1.3, kid * 0.62, w * 0.36));
    }
  }
}

/**
 * grow(opts) → array of SVG path `d` strings inside a 100×100 box.
 *   seed · arms · depth · cells · symmetry 'bilateral'|'radial'|'free' · scale
 */
function grow(opts){
  const o = Object.assign({ seed:1, arms:3, depth:2, cells:2,
                            symmetry:'bilateral', spine:true, scale:1 }, opts);
  const R = rng(o.seed * 2654435761 + 12345);
  const S = o.scale;
  const cx = 50, cy = 60;
  const out = [];

  if(o.symmetry === 'radial'){
    const n = o.arms * 2;
    for(let i=0;i<n;i++){
      const a = (i/n) * TAU - Math.PI/2;
      branch(out, R, cx, cy, a, (20 + R()*14) * S, 1.5 * S, o.depth);
      if(i % 2 === 0) cell(out, cx, cy, a, (15 + R()*9)*S, 0.32 + R()*0.18, 1.0*S);
    }
    return out;
  }

  const half = [];
  /* arms leave the spine spread over its length, not stacked at one node —
     clustering at a single origin is what made this read as a blob */
  for(let i=0;i<o.arms;i++){
    const t = o.arms === 1 ? 0 : i / (o.arms - 1);
    const a = -Math.PI/2 - (0.22 + t * 1.34) - R()*0.20;
    const len = (32 - t*8 + R()*15) * S;
    branch(half, R, cx - 0.6*S, cy - (4 + t*26)*S, a, len, (1.55 - t*0.42) * S, o.depth);
  }
  for(let i=0;i<o.cells;i++){
    const a = -Math.PI/2 - (0.34 + R()*0.9);
    cell(half, cx - 0.6*S, cy - (3 + i*13)*S, a, (22 + R()*14)*S,
         0.34 + R()*0.24, (1.15 - i*0.18) * S);
  }
  /* two long whips carry the eye off the mark */
  half.push(whip(cx - 0.6*S, cy - 4*S, -Math.PI/2 - 1.34, (44 + R()*18)*S,
                 -1.05 - R()*0.7, 1.35*S));
  half.push(whip(cx - 0.6*S, cy - 13*S, -Math.PI/2 - 0.55, (34 + R()*16)*S,
                 0.85 + R()*0.6, 1.05*S));
  /* one stroke that crosses the mark instead of leaving it — the interlace */
  half.push(whip(cx + 9*S, cy - 26*S, Math.PI*0.86, (30 + R()*12)*S,
                 1.5 + R()*0.8, 0.9*S));

  out.push(...half);
  if(o.symmetry === 'bilateral') out.push(...half.map(mirror));

  if(o.spine){
    out.push(ribbon(spine(cx, cy + 2*S, -Math.PI/2, 56*S, 0, 20), 1.35*S, 2.2, 0.34));
    out.push(ribbon(spine(cx, cy + 2*S,  Math.PI/2, 36*S, 0, 16), 1.05*S, 2.4, 0.30));
    /* the two hooks that cross the spine low down — a signature of the style */
    out.push(ribbon(spine(cx, cy + 21*S, -0.20, 17*S,  2.1, 12), 1.05*S, 1.5, 0.6));
    out.push(ribbon(spine(cx, cy + 21*S, Math.PI+0.20, 17*S, -2.1, 12), 1.05*S, 1.5, 0.6));
  }
  return out;
}

/* reflect about x = 50 — paths carry only absolute L/M pairs, so this is safe */
function mirror(d){
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
    (m, x, y) => f(100 - parseFloat(x)) + ',' + y);
}

function svg(opts){
  const o = Object.assign({ w:100, h:100, fill:'currentColor', opacity:1 }, opts);
  const paths = grow(o).map(d => '<path d="' + d + '"/>').join('');
  return '<svg viewBox="0 0 100 100" width="' + o.w + '" height="' + o.h + '" ' +
         'fill="' + o.fill + '" opacity="' + o.opacity + '" ' +
         'aria-hidden="true" focusable="false">' + paths + '</svg>';
}

function paint(el, opts){ if(el) el.innerHTML = svg(opts); }

/* a barbed rule — asymmetric, so it reads as a drawn mark and not as trim */
function rule(seed, len){
  const R = rng(seed * 40503 + 7);
  const out = [];
  let x = 3;
  while(x < len - 8){
    const up = R() < 0.5 ? -1 : 1;
    const l = 4 + R()*13;
    out.push(ribbon(spine(x, 6, up > 0 ? -0.5 - R()*0.6 : 0.5 + R()*0.6,
                          l, (R()-0.5)*2.6, 12), 1.5, 1.6, 0.5));
    if(R() < 0.34) cell(out, x, 6, up > 0 ? -1.15 : 1.15, 6 + R()*6, 0.38, 1.0);
    x += 5 + R()*17;
  }
  out.push('M0,5.65H' + len + 'V6.35H0Z');
  return '<svg viewBox="0 0 ' + len + ' 14" preserveAspectRatio="none" ' +
         'fill="currentColor" aria-hidden="true">' +
         out.map(d => '<path d="' + d + '"/>').join('') + '</svg>';
}

global.Sigil = { grow, svg, paint, rule, rng, ribbon, spine };
})(window);
