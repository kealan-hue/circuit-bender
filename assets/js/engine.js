/* ══════════════════════════════════════════════════════════════
   CIRCUIT BENDER — signal engine (WebGL2)

   INGEST → ring[head]        32-layer TEXTURE_2D_ARRAY, ONE texture unit
     ↓
   MANGLE   time displacement · channel time · echo · tear · warp · kaleido
            · rutt/etra · Δframe · mosh · regen (+droste)
     ↓
   SIGNAL   NTSC composite encode→decode (fs/4, no trig) · head switching
            · edge wave · chroma loss · ghost · CCD smear · bitplane dropout
     ↓
   SORT ×N  odd–even transposition with a STRIDE schedule, 4 key modes
     ↓
   POST     quantise+Bayer dither · halftone · polarity · raster · hiss · CRT
     ↓      (written to prev, so feedback and mosh chew the finished frame)
   glass

   Every branch below is on a UNIFORM, not on per-pixel data — the whole draw
   takes one side, so these are cheap, not the divergence trap they look like.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

const RING = 32;

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUv; out vec4 frag;
const float TAU = 6.28318530718;
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.317,289.113)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for(int i=0;i<4;i++){ s += a*vnoise(p); p *= 2.0; a *= 0.707; }
  return s;
}
vec3 hueRot(vec3 c, float a){
  const vec3 k = vec3(0.57735);
  float cs = cos(a), sn = sin(a);
  return c*cs + cross(k,c)*sn + k*dot(k,c)*(1.0-cs);
}
`;

/* ── INGEST ────────────────────────────────────────────────── */
const FS_INGEST = HEAD + `
uniform sampler2D uTex; uniform float uFlipX;
void main(){
  vec2 uv = vUv;
  if(uFlipX > 0.5) uv.x = 1.0 - uv.x;
  frag = vec4(texture(uTex, uv).rgb, 1.0);
}`;

const FS_COPY = HEAD + `
uniform sampler2D uTex;
void main(){ frag = vec4(texture(uTex, vUv).rgb, 1.0); }`;

const FS_LAYER = HEAD + `
uniform sampler2DArray uRing; uniform float uLayer;
void main(){ frag = vec4(texture(uRing, vec3(vUv, uLayer)).rgb, 1.0); }`;

/* ── MANGLE ────────────────────────────────────────────────── */
const FS_MANGLE = HEAD + `
uniform sampler2DArray uRing;
uniform sampler2D uPrev;
uniform vec2  uRes;
uniform float uHead, uRingN, uTime, uBend;
uniform float uGain, uBias;
uniform float uTear, uTearRate;
uniform float uWarp;
uniform float uSlit, uCTime, uEcho;
uniform int   uSlitMode;
uniform float uKal, uRutt, uRuttLines;
uniform float uDelay, uDelayMix;
uniform float uMosh;
uniform float uFeed, uOrbit, uDroste;
uniform float uAddr, uClock;

vec3 ringAt(vec2 uv, float back){
  float s = mod(uHead - back + uRingN*4.0, uRingN);
  return texture(uRing, vec3(uv, floor(s))).rgb;
}
/* texture() will not filter across layers, so cross-fade the two by hand —
   without this the whole time axis steps in 32 visible bands */
vec3 ringLerp(vec2 uv, float back){
  float fl = floor(back);
  return mix(ringAt(uv, fl), ringAt(uv, fl+1.0), fract(back));
}

void main(){
  vec2 uv = vUv;
  float t = uTime, B = uBend;

  /* ── KALEIDO — fold before anything samples ── */
  if(uKal > 0.002){
    vec2 p = uv - 0.5;
    float a = atan(p.y, p.x), r = length(p);
    float N = 2.0 + floor(uKal * 10.0);
    float seg = TAU / N;
    a = abs(mod(a, seg) - seg*0.5) + t*0.05*uKal;
    uv = 0.5 + vec2(cos(a), sin(a)) * r;
  }

  /* ── WARP — displacement driven by the picture's own luma gradient ── */
  vec2 wuv = uv;
  if(uWarp > 0.002){
    float l0 = luma(ringAt(uv, 0.0));
    float lx = luma(ringAt(uv + vec2(3.0/uRes.x, 0.0), 0.0));
    float ly = luma(ringAt(uv + vec2(0.0, 3.0/uRes.y), 0.0));
    vec2 grad = vec2(lx-l0, ly-l0);
    vec2 field = vec2(sin(uv.y*13.0 + t*0.71 + l0*6.0), cos(uv.x*11.0 - t*0.93 + l0*5.0));
    wuv += (grad*7.0 + field*0.30) * uWarp * 0.11 * (1.0 + B*3.5);
  }

  /* ── TEAR — a punchy, graphic line-tear: bands of rows get shifted, some
        bands blow out to pure black, some get a magenta wash, and every other
        row darkens (interlace flicker), plus a small overall magenta cast.
        This is a hard, immediate, poster-glitch look — not a subtle analogue
        artifact — matched deliberately against a reference the picture needs
        to read against at a glance, not on close inspection. ── */
  float tear = 0.0, roll = 0.0, bandBlack = 0.0, bandTint = 0.0, interlace = 1.0;
  if(uTear > 0.002){
    float e    = uTear * (1.0 + B*1.3);
    float seed = floor(t * (2.0 + uTearRate*14.0));
    float rows = uRes.y;
    float band = max(1.0, floor(2.0 + 16.0*(1.0-0.5*e) * (0.3+0.7*hash(vec2(floor(wuv.y*rows/9.0), seed+777.0)))));
    float ln   = floor(wuv.y * rows / band);
    float sh   = 0.05 * e;                                     /* shift as a fraction of width */
    tear = (hash(vec2(ln*1.73, seed*0.31)) - 0.5) * sh * 2.0;
    float pick = hash(vec2(ln + 50.0, seed + 200.0));
    bandBlack = step(pick, 0.04 * e);
    bandTint  = (1.0 - bandBlack) * step(pick, 0.04*e + 0.08*e);
    roll = (hash(vec2(seed*1.9, ln)) - 0.5) * 0.10 * e;
    interlace = (mod(floor(wuv.y * rows), 2.0) < 1.0) ? 1.0 : (1.0 - 0.2*uTear);
  }

  /* ── SPLIT — a clean, always-on chromatic split: red walks one way, blue
        the other, independently and jittered per row, green stays put. This
        is the single most recognisable "broken circuit" cue and it needs to
        read on its own, not only inside a gated burst. ── */
  vec2 splitR = vec2(0.0), splitB = vec2(0.0);
  if(uTear > 0.002){
    float px  = 1.0 / uRes.x;
    float base = (5.0 + 0.10 * uRes.x * uTear) * px;
    float rowJ = (hash(vec2(floor(wuv.y*uRes.y), 42.0)) - 0.5);
    float amt  = base * (1.0 + 0.8*rowJ) * (1.0 + B*1.6);
    splitR = vec2(-amt, 0.0);
    splitB = vec2( amt, 0.0);
  }

  /* ══ REAL BENDS ═══════════════════════════════════════════════════════
     Everything else in this file simulates a machine working normally on
     damaged media. These four corrupt the machine itself. ── */

  /* ── ADDRESS — the chip fetches each pixel from a memory address. Corrupt
        the address and it fetches the WRONG pixel: chunks appear elsewhere,
        tiles repeat. Not a smear — a wrong lookup. XOR on the integer
        coordinate is literally what a shorted address line does. ── */
  if(uAddr > 0.002){
    ivec2 ip = ivec2(wuv * uRes);
    int bit  = 1 << int(2.0 + floor(uAddr * 6.0));
    ip.x = ip.x ^ bit;
    ip.y = ip.y ^ (bit >> 2);
    wuv = mix(wuv, (vec2(ip) + 0.5) / uRes, step(0.35, uAddr) * 0.5 + 0.5);
  }

  /* ── CLOCK — the sensor reads out row by row on a clock tick. Disrupt it
        and rows are read at the wrong moment: repeated, skipped, sheared. ── */
  if(uClock > 0.002){
    float row  = floor(wuv.y * uRes.y);
    float grp  = 1.0 + floor(uClock * 22.0);
    float jam  = hash(vec2(floor(row / grp), floor(t * 14.0)));
    float rep  = floor(row / grp) * grp;                 /* row repeat */
    row = mix(row, rep, step(0.42, jam));
    float shear = (hash(vec2(floor(row/grp) * 3.1, floor(t*9.0))) - 0.5)
                * step(0.72, jam) * uClock * 0.35;
    wuv = vec2(wuv.x + shear, (row + 0.5) / uRes.y);
  }

  /* ── SLIT — per-pixel time displacement. the delay FIELD is the instrument:
        x = photo-finish smear, y = waterfall, radial = time warp, and LUMA
        makes bright things live in the present while dark things lag ── */
  float back = 0.0;
  if(uSlit > 0.002){
    float fld;
    if(uSlitMode == 0)      fld = wuv.x;
    else if(uSlitMode == 1) fld = 1.0 - wuv.y;
    else if(uSlitMode == 2) fld = clamp(length(wuv-0.5)*1.42, 0.0, 1.0);
    else if(uSlitMode == 3) fld = luma(ringAt(wuv, 0.0));
    else                    fld = fract(wuv.x*4.0 + wuv.y*2.5);
    back = fld * uSlit * (uRingN - 3.0);
  }

  /* ── CHANNEL TIME — R, G, B pulled from different moments.
        static scene looks normal; anything moving fringes into the past ── */
  float ct = uCTime * (uRingN - 3.0) / 2.6;

  vec2 uvR = wuv + vec2(tear, roll) + splitR;
  vec2 uvG = wuv + vec2(tear*-0.34,  0.0);
  vec2 uvB = wuv + vec2(tear* 0.73, -roll) + splitB;
  vec3 col = vec3(ringLerp(uvR, back).r,
                  ringLerp(uvG, back + ct).g,
                  ringLerp(uvB, back + ct*2.0).b);

  if(uTear > 0.002){
    col = mix(col, vec3(0.0), bandBlack);
    float grey = dot(col, vec3(0.333));
    col = mix(col, vec3(grey + 0.16*uTear, grey*(1.0-0.4*uTear), grey + 0.12*uTear), bandTint);
    col *= interlace;
    col = clamp(col + vec3(0.06, -0.024, 0.042) * uTear, 0.0, 1.0);   /* overall magenta cast */
  }

  /* ── ECHO — eight temporal taps, each tinted a different hue, summed.
        motion becomes a rainbow comet. no trig, no HSV round-trip ── */
  if(uEcho > 0.002){
    vec3 acc = vec3(0.0);
    for(int i=0;i<8;i++){
      float b = float(i) * uEcho * (uRingN-3.0) / 8.0;
      vec3 c = ringLerp(wuv, b + back);
      float h = float(i)/8.0*6.0 - 2.0;
      c *= clamp(vec3(abs(h-1.0)-1.0, 2.0-abs(h), 2.0-abs(h-2.0)), 0.0, 1.0);
      acc += c * 0.38;
    }
    col = mix(col, clamp(acc, 0.0, 1.0), min(1.0, uEcho*1.7));
  }

  /* ── RUTT / ETRA — raster deflection as a GATHER. march the column looking
        for the source row whose luma-displacement lands on this pixel; last
        hit wins, so occlusion falls out for free ── */
  if(uRutt > 0.002){
    float dy = 1.0/uRes.y;
    float hit = -1.0;
    for(int i=0;i<22;i++){
      float sy = uv.y + float(i)*dy*2.0;
      float d  = luma(ringAt(vec2(uv.x, sy), 0.0)) * uRutt * 0.42;
      if(abs(sy - d - uv.y) < dy*2.2) hit = sy;
    }
    if(hit >= 0.0){
      vec3 rc = ringAt(vec2(uv.x, hit), 0.0);
      float comb = step(fract(hit * uRuttLines), 0.55);
      col = mix(col, rc * comb, min(1.0, uRutt*1.6));
    } else {
      col = mix(col, vec3(0.0), min(1.0, uRutt*1.6));
    }
  }

  /* ── Δ FRAME — ghost trail, then hard replacement ── */
  if(uDelayMix > 0.002){
    float tap = 1.0 + uDelay * (uRingN - 4.0);
    vec3 d = ringLerp(wuv + vec2(tear*0.55, 0.0), tap);
    col = mix(col, max(col, d), clamp(uDelayMix*1.7, 0.0, 1.0));
    col = mix(col, d, smoothstep(0.55, 1.0, uDelayMix));
  }

  /* ── GAIN — the exposure circuit itself failing: crushed blacks LIFT off
        the floor, the gamma curve flattens (contrast drains rather than
        just scales), and the image pushes warm — red gained up, blue cut.
        Below detent this still behaves as a plain gain; above it, it damages. ── */
  {
    float g = clamp((uGain - 0.5) * 2.0, 0.0, 1.0);         /* 0 at detent, 1 at max */
    float under = clamp((0.5 - uGain) * 2.0, 0.0, 1.0);      /* plain darken below detent */
    col *= 1.0 - under * 0.55;
    float lift  = 0.42 * g;
    float gamma = mix(1.0, 0.35, g);
    col = lift + (1.0 - lift) * pow(max(col, 0.0), vec3(gamma));
    col.r = clamp(col.r * (1.0 + 0.20*g), 0.0, 1.0);
    col.b = clamp(col.b * (1.0 - 0.16*g), 0.0, 1.0);
  }
  /* ── BIAS — global hue rotate, full range ── */
  if(abs(uBias-0.5) > 0.004) col = hueRot(col, (uBias-0.5)*TAU);
  col = clamp(col, 0.0, 1.0);

  /* ── MOSH — block motion-vector carry, p-frames with no keyframe.
        vectors snap to whole pixels and the fill is a DCT basis, not hash
        noise — that is what makes it read as codec rather than as grain ── */
  if(uMosh > 0.002){
    float bs = mix(26.0, 4.0, uMosh);
    vec2  e  = bs / uRes;
    vec2  bq = (floor(uv*uRes/bs) + 0.5) * bs / uRes;
    float dp = luma(ringAt(bq, 1.0));
    float dn = luma(ringAt(bq, 0.0));
    float df = abs(dn - dp);
    float xp = abs(luma(ringAt(bq + vec2(e.x,0.0), 0.0)) - dp);
    float xm = abs(luma(ringAt(bq - vec2(e.x,0.0), 0.0)) - dp);
    float yp = abs(luma(ringAt(bq + vec2(0.0,e.y), 0.0)) - dp);
    float ym = abs(luma(ringAt(bq - vec2(0.0,e.y), 0.0)) - dp);
    vec2  mv = vec2(xm-xp, ym-yp) * e * (2.5 + uMosh*16.0 + B*34.0);
    mv = floor(mv*uRes + 0.5)/uRes;                       /* integer snap */
    float thr = mix(0.34, 0.008, uMosh);
    vec3 carried = texture(uPrev, uv + mv).rgb * 1.035 + 0.004;

    vec3 rnd = vec3(hash(bq*91.7), hash(bq*57.3+3.1), hash(bq*13.9+7.7));
    vec2 duv = uv * uRes * (rnd.x * 60.0 / (0.4 + uMosh));
    float dct = cos(mix(duv.x, duv.y, step(0.5, rnd.y)));
    /* high frequency ⇒ low amplitude is what reads as codec artifact */
    carried += dct * rnd.z * (1.0 - rnd.x) * uMosh * 0.16;

    col = mix(carried, col, max(0.10, smoothstep(thr*0.45, thr, df)));
  }

  /* ── REGEN — video feedback, orbit + hue precession, optional droste.
        droste is SPATIAL recursion against regen's TEMPORAL recursion, and
        the two periods beat against each other ── */
  if(uFeed > 0.002){
    vec2 c = uv - 0.5;
    float z = mix(1.075, 0.928, uOrbit);
    float a = (uOrbit - 0.5) * 0.17 * (1.0 + B*4.0);
    mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 fuv = R*c*z + 0.5;
    if(uDroste > 0.002){
      vec2 dc = fuv - 0.5;
      float r = max(length(dc), 1e-4), ang = atan(dc.y, dc.x);
      float k = log(1.0 + uDroste*1.6);
      float lr = fract(log(r)/k + t*0.05*uDroste) * k;
      fuv = 0.5 + exp(lr) * vec2(cos(ang), sin(ang)) * 0.5;
    }
    vec3 fb = texture(uPrev, fuv).rgb;
    fb = hueRot(fb, 0.055 + (uBias-0.5)*0.5 + B*0.55);
    float keep = 0.885 + uFeed*0.105;
    vec3 mixed = clamp(max(col*0.34 + fb*(1.03 - B*0.07), fb*keep), 0.0, 1.0);
    col = mix(col, mixed, clamp(uFeed*(0.9 + B*0.1), 0.0, 1.0));
  }

  frag = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* ── SIGNAL ────────────────────────────────────────────────── */
const FS_SIGNAL = HEAD + `
uniform sampler2D uTex;
uniform vec2  uRes;
uniform float uTime, uBend, uFrame;
uniform float uNtsc, uNtscSat, uNtscPhase;
uniform float uHeadSw, uWave, uChromaLoss;
uniform float uSmear, uGhost;
uniform float uBitAmt;
uniform vec3  uBitMask;
uniform float uBitSwap, uBus, uStarve;

/* composite sample at a horizontal offset, QAM'd at fs/4 so the carrier is
   [1,0,-1,0] / [0,1,0,-1] — four taps, integer indexing, no sin(), no cos() */
float compAt(vec2 uv, float dx, float phase){
  vec3 c = texture(uTex, uv + vec2(dx/uRes.x, 0.0)).rgb;
  float Y = dot(c, vec3(0.300, 0.590, 0.110));
  float I = dot(c, vec3(0.599,-0.2773,-0.3217));
  float Q = dot(c, vec3(0.213,-0.5251, 0.3121));
  int ph = int(mod(gl_FragCoord.x + dx + phase, 4.0));
  float im = (ph == 0) ? 1.0 : ((ph == 2) ? -1.0 : 0.0);
  float qm = (ph == 1) ? 1.0 : ((ph == 3) ? -1.0 : 0.0);
  return Y + (I*im + Q*qm) * uNtscSat;
}

void main(){
  vec2 uv = vUv;

  /* ── VHS transport: the torn band at the bottom of every tape. the 1.5
        power is what makes it curl instead of ramp ── */
  if(uHeadSw > 0.002){
    float rows = 4.0 + uHeadSw * 26.0;
    float fromBottom = (1.0 - uv.y) * uRes.y;
    if(fromBottom < rows){
      float k = fromBottom / rows;
      uv.x += uHeadSw * 0.16 * pow(1.0 - k, 1.5)
            + (hash(vec2(floor(fromBottom), uFrame)) - 0.5) * uHeadSw * 0.02;
    }
  }
  /* animating the second noise axis with the frame number makes the tape
     breathe instead of shimmer */
  if(uWave > 0.002){
    float w = fbm(vec2(uv.y * 26.0, uFrame * 0.035)) - 0.5;
    uv.x += w * uWave * 0.055;
  }

  vec3 col = texture(uTex, uv).rgb;

  /* ── NTSC: encode to one composite wire, then separate it back badly.
        dot crawl is not faked here — it IS the imperfect separation ── */
  if(uNtsc > 0.002){
    float line  = floor(gl_FragCoord.y);
    float phase = mod(uNtscPhase + line + floor(uFrame), 4.0);
    float cs[8];
    for(int k=0;k<8;k++) cs[k] = compAt(uv, float(k) - 4.0, phase);

    /* a box filter at exactly the colourburst wavelength kills that frequency
       perfectly; every fancier notch rings */
    float y = 0.0;
    for(int k=2;k<6;k++) y += cs[k];
    y *= 0.25;

    float I = 0.0, Q = 0.0;
    for(int k=2;k<6;k++){
      float ch = cs[k] - y;
      int ph = int(mod(gl_FragCoord.x + float(k) - 4.0 + phase, 4.0));
      I += ch * ((ph == 0) ? 1.0 : ((ph == 2) ? -1.0 : 0.0));
      Q += ch * ((ph == 1) ? 1.0 : ((ph == 3) ? -1.0 : 0.0));
    }
    I *= 0.5; Q *= 0.5;

    /* a random scanline loses chroma entirely and goes black and white while
       its neighbours do not */
    if(uChromaLoss > 0.002 &&
       hash(vec2(line*0.137, floor(uFrame*0.5))) < uChromaLoss*0.35){ I = 0.0; Q = 0.0; }

    vec3 dec = vec3(y + 0.956*I + 0.619*Q,
                    y - 0.272*I - 0.647*Q,
                    y - 1.106*I + 1.703*Q);
    col = mix(col, clamp(dec, 0.0, 1.0), min(1.0, uNtsc*1.25));
  }

  /* ── GHOST — multipath pre-echo. the reflection arrives BEFORE, because it
        took the shorter path, so sample ahead ── */
  if(uGhost > 0.002){
    vec2 g = vec2(uGhost * 0.09, 0.0);
    float px = 1.0/uRes.x;
    vec3 gc = texture(uTex, uv + g).rgb * 0.3230
            + texture(uTex, uv + g + vec2(1.174*px,0.0)).rgb * 0.2666
            + texture(uTex, uv + g - vec2(1.174*px,0.0)).rgb * 0.2666
            + texture(uTex, uv + g + vec2(2.339*px,0.0)).rgb * 0.0437
            + texture(uTex, uv + g - vec2(2.339*px,0.0)).rgb * 0.0437;
    col = (col + gc * uGhost) / (1.0 + uGhost*0.85);
  }

  /* ── CCD SMEAR — charge spilling up the column. carrying the spectral ratio
        keeps the streak the colour of whatever overloaded ── */
  if(uSmear > 0.002){
    float thr = 1.0 - uSmear*0.62;
    vec3 spill = vec3(0.0);
    for(int i=1;i<=22;i++){
      vec3 c = texture(uTex, uv + vec2(0.0, float(i)*2.0/uRes.y)).rgb;
      float ex = max(0.0, luma(c) - thr) / max(0.001, 1.0 - thr);
      vec3 sr = c / max(0.001, max(c.r, max(c.g, c.b)));
      spill += sr * ex * pow(0.87, float(i));
    }
    col += spill * uSmear * 0.42;
  }

  /* ── BIT SWAP — pixel values are numbers. Short two data lines and bits
        move BETWEEN channels: bit 6 of red lands in blue. The result is
        colours that are impossible, not merely oversaturated — no filter
        and no photograph can produce them, which is the signature. ── */
  if(uBitSwap > 0.002){
    ivec3 v = ivec3(clamp(col,0.0,1.0) * 255.0);
    int n = int(1.0 + floor(uBitSwap * 6.99));
    int m = 1 << n;
    int rb = v.r & m, bb = v.b & m;
    v.r = (v.r & ~m) | bb;
    v.b = (v.b & ~m) | rb;
    v.g = v.g ^ (m >> 1);
    col = mix(col, vec3(v) / 255.0, min(1.0, uBitSwap * 2.2));
  }

  /* ── BUS SHORT — two signals forced onto one wire do not blend like paint.
        They combine LOGICALLY: wired-AND, wired-OR, or contention. Hard and
        deterministic, nothing like a fade. ── */
  if(uBus > 0.002){
    ivec3 v = ivec3(clamp(col,0.0,1.0) * 255.0);
    ivec3 w = ivec3(v.r & v.g, v.g | v.b, v.b ^ v.r);
    col = mix(col, vec3(w) / 255.0, uBus);
  }

  /* ── STARVE — under-power the chip and it half-fails: timing drifts, the
        colour drains, the noise floor climbs. ── */
  if(uStarve > 0.002){
    float k = uStarve;
    col = pow(max(col, 0.0), vec3(1.0 - k*0.55));
    float g = dot(col, vec3(0.299,0.587,0.114));
    col = mix(col, vec3(g), k*0.45) * (1.0 - k*0.30) + k*0.05;
    col += (hash(uv*uRes + uTime*37.0) - 0.5) * k * 0.22;
  }

  /* ── BITPLANE DROPOUT — bursts of bits simply going missing ── */
  if(uBitAmt > 0.002){
    ivec3 v = ivec3(clamp(col,0.0,1.0) * 255.0);
    ivec3 m = ivec3(uBitMask);
    ivec3 w = v & (~m);
    col = mix(col, vec3(w) / 255.0, uBitAmt);
  }

  frag = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* ── SORT ──────────────────────────────────────────────────── */
const FS_SORT = HEAD + `
uniform sampler2D uTex;
uniform vec2  uRes;
uniform float uParity, uGateLo, uGateHi, uOrder, uStride;
uniform int   uAxis, uKey;

float sortKey(vec3 c){
  if(uKey == 0) return luma(c);
  if(uKey == 1) return 1.0 - luma(c);
  /* packed RGB integer — colour ordering leaks into a supposedly luminance
     sort, which is why Asendorf's "white" mode looks nothing like "bright" */
  if(uKey == 2) return dot(floor(c*255.0), vec3(65536.0,256.0,1.0)) / 16777215.0;
  return max(c.r, max(c.g, c.b));
}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 lim = ivec2(uRes) - 1;
  int st = int(uStride);
  int coord = (uAxis == 0) ? p.x : p.y;
  /* plain odd–even moves a pixel exactly ONE cell per pass, so span length is
     capped at N. striding the compare lifts transport range 8x for free */
  bool isLow = mod(floor(float(coord)/uStride) + uParity, 2.0) < 1.0;
  ivec2 off = (uAxis == 0) ? ivec2(st,0) : ivec2(0,st);
  ivec2 q = isLow ? p + off : p - off;

  vec4 self = texelFetch(uTex, p, 0);
  if(q.x < 0 || q.y < 0 || q.x > lim.x || q.y > lim.y){ frag = self; return; }
  vec4 other = texelFetch(uTex, q, 0);

  float ks = sortKey(self.rgb), ko = sortKey(other.rgb);
  /* a BAND, not one global threshold — spans then start and stop at real
     edges instead of smearing the whole frame */
  if(ks < uGateLo || ks > uGateHi || ko < uGateLo || ko > uGateHi){ frag = self; return; }

  float a = ks * uOrder, b = ko * uOrder;
  frag = (isLow ? (a > b) : (a < b)) ? other : self;
}`;

/* ── POST ──────────────────────────────────────────────────── */
const FS_POST = HEAD + `
uniform sampler2D uTex, uRaw;
uniform vec2  uRes;
uniform float uTime, uBend;
uniform float uScan, uPost, uDither, uHalf, uNoise, uMix, uBias;
uniform int   uInv;

/* Bayer 8x8 by bit interleave — no lookup table, no texture */
float bayer(ivec2 p){
  int x = p.x & 7, y = p.y & 7, v = 0;
  for(int i=0;i<3;i++){
    int bx = (x >> (2-i)) & 1;
    int by = (y >> (2-i)) & 1;
    v = (v << 2) | ((by << 1) | (bx ^ by));
  }
  return float(v) / 64.0;
}
void main(){
  vec2 c = vUv - 0.5;
  vec2 uv = vUv + c * dot(c,c) * (0.045 + uBend*0.09);
  vec2 cl = clamp(uv, 0.0, 1.0);
  float inside = step(0.0, uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);

  float bleed = (0.6 + uBend*3.0) / uRes.x;
  vec3 col = vec3(texture(uTex, cl + vec2(bleed,0.0)).r,
                  texture(uTex, cl).g,
                  texture(uTex, cl - vec2(bleed,0.0)).b);

  ivec2 fp = ivec2(gl_FragCoord.xy);
  float bd = bayer(fp) - 0.5;

  /* ── QUANT — punch the saturation up hard FIRST, then crush the levels.
        oversaturated colour blocked into hard bands is the loud, graphic
        "broken CCD" look; posterizing alone just looks like a filter. the
        Bayer offset turns the flat banding into structured dither, and the
        grid is fixed in SCREEN space while REGEN rotates the picture through
        it, so it slides on itself. ── */
  if(uPost > 0.002){
    float sat = 1.0 + 7.0 * uPost;
    float grey = dot(col, vec3(0.299,0.587,0.114));
    col = clamp(grey + (col - grey) * sat, 0.0, 1.0);
    float L = mix(22.0, 2.0, uPost);
    vec3 lv = vec3(L, max(2.0, L - uPost*2.0), max(2.0, L + uPost*1.5));
    col = floor(col*lv + 0.5 + bd*uDither*1.6) / lv;
  } else if(uDither > 0.002){
    col = floor(col*24.0 + 0.5 + bd*uDither*2.2) / 24.0;
  }

  /* ── HALFTONE — CMY screen angles in polar ── */
  if(uHalf > 0.002){
    float freq = mix(120.0, 26.0, uHalf);
    vec3 h;
    for(int i=0;i<3;i++){
      float ang = (i==0) ? 0.2618 : ((i==1) ? 1.3090 : 0.0);
      mat2 R = mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
      vec2 g = R * cl * freq;
      vec2 cell = fract(g) - 0.5;
      float v = (i==0) ? col.r : ((i==1) ? col.g : col.b);
      h[i] = step(length(cell), sqrt(max(v,0.0))*0.55);
    }
    col = mix(col, h, uHalf);
  }

  if(uInv == 1) col = 1.0 - col;
  else if(uInv == 2) col = abs(1.0 - 2.0*col);

  if(uScan > 0.002){
    float sl = 0.5 + 0.5*sin(cl.y*uRes.y*3.14159);
    col *= 1.0 - uScan*0.78*sl;
    float m = mod(floor(cl.x*uRes.x), 3.0);
    vec3 mask = vec3(m<1.0?1.12:0.94, (m>=1.0&&m<2.0)?1.12:0.94, m>=2.0?1.12:0.94);
    col *= mix(vec3(1.0), mask, uScan*0.55);
    float hum = smoothstep(0.0, 0.14, abs(fract(cl.y - uTime*0.09) - 0.5) - 0.36);
    col += hum * uScan * 0.09;
  }

  if(uNoise > 0.002){
    float n = hash(cl*uRes + uTime*77.0);
    col += (n - 0.5) * uNoise * 0.55;
    float drop = step(1.0 - uNoise*0.05*(1.0+uBend*1.2), hash(cl*uRes*1.7 - uTime*133.0));
    col = mix(col, vec3(step(0.5, n)), drop);

    /* ── rare bright horizontal dropout bars — tracking-error colour, not
          grey static. these read from across the room, which is the point ── */
    float frameId = floor(uTime * 30.0);
    float barRow   = floor(cl.y * uRes.y);
    float barSeed  = hash(vec2(floor(barRow/3.0), frameId));
    float barGate  = step(1.0 - uNoise*0.10, barSeed);
    if(barGate > 0.5){
      float pick = hash(vec2(frameId, barRow*0.7));
      vec3 barCol = pick < 0.55 ? vec3(1.0, 0.35, 0.72)
                  : pick < 0.85 ? vec3(1.0, 0.78, 0.90)
                                : vec3(0.95, 0.98, 1.0);
      float xs = hash(vec2(barRow, frameId+2.0));
      float xw = 0.10 + 0.5*hash(vec2(barRow+9.0, frameId+3.0));
      float inBar = step(xs, cl.x) * step(cl.x, min(1.0, xs+xw));
      col = mix(col, barCol, inBar * uNoise * 2.0);
    }
  }

  col = mix(texture(uRaw, cl).rgb, col, uMix);
  col *= 1.0 - dot(c,c)*0.55;
  col *= inside;
  frag = vec4(clamp(col,0.0,1.0), 1.0);
}`;

/* ══════════════════════════════════════════════════════════ */
function Engine(canvas){
  const gl = canvas.getContext('webgl2', {
    antialias:false, depth:false, stencil:false,
    preserveDrawingBuffer:true, powerPreference:'high-performance'
  });
  if(!gl) throw new Error('WEBGL2_UNAVAILABLE');

  function sh(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      const log = gl.getShaderInfoLog(s) || '';
      const n = +(log.match(/ERROR: \d+:(\d+)/) || [])[1];
      const lines = src.split('\n');
      const ctx = n ? lines.slice(Math.max(0,n-4), n+2)
                           .map((l,i)=>(Math.max(1,n-3)+i)+': '+l).join('\n') : '';
      throw new Error(log + '\n' + ctx);
    }
    return s;
  }
  function prog(fs){
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){
      const info = gl.getActiveUniform(p,i);
      u[info.name.replace(/\[0\]$/,'')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  const P = {
    ingest: prog(FS_INGEST), copy:  prog(FS_COPY),  layer: prog(FS_LAYER),
    mangle: prog(FS_MANGLE), signal:prog(FS_SIGNAL),
    sort:   prog(FS_SORT),   post:  prog(FS_POST)
  };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function makeRT(w,h,wrap){
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap||gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap||gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  let W=0, H=0, head=0, prime=true;
  let ringTex=null, ringFbo=null, work=null, alt=null, prev=null, raw=null;

  /* the ring is ONE texture with RING layers — 32 samplers would blow the
     16-unit guarantee, a 2D array costs one */
  function alloc(w,h){
    if(w === W && h === H) return;
    free();
    W = w; H = h;
    canvas.width = w; canvas.height = h;

    ringTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, ringTex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, w, h, RING);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    ringFbo = gl.createFramebuffer();

    work = makeRT(w,h,gl.REPEAT);
    alt  = makeRT(w,h,gl.REPEAT);
    prev = makeRT(w,h,gl.REPEAT);
    raw  = makeRT(w,h,gl.REPEAT);
    head = 0; prime = true;

    gl.clearColor(0,0,0,1);
    for(let i=0;i<RING;i++){
      gl.bindFramebuffer(gl.FRAMEBUFFER, ringFbo);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, ringTex, 0, i);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    [work,alt,prev,raw].forEach(rt => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function free(){
    if(ringTex){ gl.deleteTexture(ringTex); gl.deleteFramebuffer(ringFbo); ringTex=null; }
    [work,alt,prev,raw].forEach(rt => {
      if(!rt) return; gl.deleteTexture(rt.tex); gl.deleteFramebuffer(rt.fbo);
    });
    work = alt = prev = raw = null;
  }

  const srcTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  function useTex(prg, name, tex, unit, target){
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target || gl.TEXTURE_2D, tex);
    if(prg.u[name] != null) gl.uniform1i(prg.u[name], unit);
  }
  function draw(target){
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let sortBudget = 30, emaFrame = 16.7;
  const SORT_MIN = 6, SORT_MAX = 44;

  /* stride schedule: transport range jumps ~8x for the same pass count */
  const STRIDES = [8,4,2,1,4,2,1,2,1,1];

  return {
    gl, RING,
    get width(){ return W; }, get height(){ return H; },
    get head(){ return head; },
    resize: alloc,
    stats(){ return { sortBudget, frameMs: emaFrame }; },

    upload(source){
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    },

    /* write the live frame into the next ring layer and advance the head.
       the FIRST frame after an alloc is written to every layer — otherwise the
       whole time axis is 32 black frames deep and SLIT / ECHO / Δ FRAME show
       nothing but black for the first second of the instrument's life */
    ingest(flipX){
      if(!W) return;
      gl.viewport(0,0,W,H);
      gl.useProgram(P.ingest.p);
      useTex(P.ingest, 'uTex', srcTex, 0);
      gl.uniform1f(P.ingest.u.uFlipX, flipX ? 1 : 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, ringFbo);
      if(prime){
        for(let i=0;i<RING;i++){
          gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, ringTex, 0, i);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        prime = false;
        head = 1;
      } else {
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, ringTex, 0, head);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        head = (head + 1) % RING;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },

    render(p, dtMs){
      if(!W) return;
      if(dtMs > 0 && dtMs < 60){
        emaFrame = emaFrame*0.88 + dtMs*0.12;
        if(emaFrame > 26 && sortBudget > SORT_MIN) sortBudget -= 2;
        else if(emaFrame < 18 && sortBudget < SORT_MAX) sortBudget += 2;
      }
      const newest = (head - 1 + RING) % RING;

      /* clean tap for the DRY/WET fader */
      gl.useProgram(P.layer.p);
      useTex(P.layer, 'uRing', ringTex, 0, gl.TEXTURE_2D_ARRAY);
      gl.uniform1f(P.layer.u.uLayer, newest);
      draw(raw);

      /* ── MANGLE ── */
      gl.useProgram(P.mangle.p);
      useTex(P.mangle, 'uRing', ringTex, 0, gl.TEXTURE_2D_ARRAY);
      useTex(P.mangle, 'uPrev', prev.tex, 1);
      const m = P.mangle.u;
      gl.uniform2f(m.uRes, W, H);
      gl.uniform1f(m.uHead, newest);
      gl.uniform1f(m.uRingN, RING);
      gl.uniform1f(m.uTime, p.time);
      gl.uniform1f(m.uBend, p.bend);
      gl.uniform1f(m.uGain, p.gain);
      gl.uniform1f(m.uBias, p.bias);
      gl.uniform1f(m.uTear, p.tear);
      gl.uniform1f(m.uTearRate, p.tearRate);
      gl.uniform1f(m.uWarp, p.warp);
      gl.uniform1f(m.uSlit, p.slit);
      gl.uniform1i(m.uSlitMode, p.slitMode|0);
      gl.uniform1f(m.uCTime, p.ctime);
      gl.uniform1f(m.uEcho, p.echo);
      gl.uniform1f(m.uKal, p.kal);
      gl.uniform1f(m.uRutt, p.rutt);
      gl.uniform1f(m.uRuttLines, 40 + p.ruttLines * 190);
      gl.uniform1f(m.uDelay, p.delay);
      gl.uniform1f(m.uDelayMix, p.delayMix);
      gl.uniform1f(m.uMosh, p.mosh);
      gl.uniform1f(m.uFeed, p.feed);
      gl.uniform1f(m.uOrbit, p.orbit);
      gl.uniform1f(m.uDroste, p.droste);
      gl.uniform1f(m.uAddr, p.addr);
      gl.uniform1f(m.uClock, p.clock);
      draw(work);

      /* ── SIGNAL ── */
      gl.useProgram(P.signal.p);
      useTex(P.signal, 'uTex', work.tex, 0);
      const s = P.signal.u;
      gl.uniform2f(s.uRes, W, H);
      gl.uniform1f(s.uTime, p.time);
      gl.uniform1f(s.uBend, p.bend);
      gl.uniform1f(s.uFrame, p.frame);
      gl.uniform1f(s.uNtsc, p.ntsc);
      gl.uniform1f(s.uNtscSat, 0.4 + p.ntscSat*2.6);
      gl.uniform1f(s.uNtscPhase, p.ntscPhase);
      gl.uniform1f(s.uHeadSw, p.headsw);
      gl.uniform1f(s.uWave, p.wave);
      gl.uniform1f(s.uChromaLoss, p.chromaLoss);
      gl.uniform1f(s.uSmear, p.smear);
      gl.uniform1f(s.uGhost, p.ghost);
      gl.uniform1f(s.uBitAmt, p.bitAmt);
      gl.uniform3f(s.uBitMask, p.bitMask[0], p.bitMask[1], p.bitMask[2]);
      gl.uniform1f(s.uBitSwap, p.bitSwap);
      gl.uniform1f(s.uBus, p.bus);
      gl.uniform1f(s.uStarve, p.starve);
      draw(alt);

      /* ── SORT ── */
      let src = alt, dst = work;
      const want = Math.round(p.sort * 40 * (1 + p.bend*1.6));
      const n = Math.min(want, sortBudget);
      if(n > 0){
        gl.useProgram(P.sort.p);
        const su = P.sort.u;
        gl.uniform2f(su.uRes, W, H);
        gl.uniform1f(su.uGateLo, Math.min(p.gateLo, p.gateHi));
        gl.uniform1f(su.uGateHi, Math.max(p.gateLo, p.gateHi));
        gl.uniform1f(su.uOrder, p.sortOrder ? -1 : 1);
        gl.uniform1i(su.uAxis, p.sortAxis ? 1 : 0);
        gl.uniform1i(su.uKey, p.sortKey|0);
        for(let i=0;i<n;i++){
          useTex(P.sort, 'uTex', src.tex, 0);
          gl.uniform1f(su.uStride, p.sortSpan ? STRIDES[i % STRIDES.length] : 1);
          gl.uniform1f(su.uParity, i % 2);
          draw(dst);
          const t = src; src = dst; dst = t;
        }
      }

      /* ── POST → prev, then blit. writing POST into prev is what makes
            REGEN and MOSH chew the FINISHED frame, not the raw one ── */
      gl.useProgram(P.post.p);
      useTex(P.post, 'uTex', src.tex, 0);
      useTex(P.post, 'uRaw', raw.tex, 1);
      const q = P.post.u;
      gl.uniform2f(q.uRes, W, H);
      gl.uniform1f(q.uTime, p.time);
      gl.uniform1f(q.uBend, p.bend);
      gl.uniform1f(q.uScan, p.scan);
      gl.uniform1f(q.uPost, p.post);
      gl.uniform1f(q.uDither, p.dither);
      gl.uniform1f(q.uHalf, p.half);
      gl.uniform1f(q.uNoise, p.noise);
      gl.uniform1f(q.uMix, p.mix);
      gl.uniform1f(q.uBias, p.bias);
      gl.uniform1i(q.uInv, p.inv|0);
      draw(prev);

      gl.useProgram(P.copy.p);
      useTex(P.copy, 'uTex', prev.tex, 0);
      draw(null);
    },

    /* KILL wipes the trail buffers only — the ring is source history, and
       clearing it would make KILL-then-HOLD freeze on a black frame */
    flush(){
      gl.clearColor(0,0,0,1);
      [work,alt,prev,raw].forEach(rt => {
        if(!rt) return;
        gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  };
}

global.Engine = Engine;
global.ENGINE_RING = RING;
})(window);
