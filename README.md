# CIRCUIT BENDER

A browser instrument that takes your live camera and breaks it in real time.
Everything runs on one WebGL2 engine, on your device. Nothing is uploaded.

**Try it:** https://kealan-hue.github.io/circuit-bender/ — needs a camera and
HTTPS, so open it on a phone or a laptop with a webcam.

---

## The shell

The front page is a desktop. Panels carry a path label and collapse to a title
bar; the one you select expands, and the background you are looking at *is* the
engine, running whichever build is active.

Eight builds. Seven are small — one idea, three or four knobs — and the eighth
is the whole instrument.

| build | what it does |
|---|---|
| `/builds/datamosh` | blocks smear and drag, like a codec that lost its keyframe |
| `/builds/pixelsort` | pixel sorting inside a gate band, four sort keys |
| `/builds/composite` | real NTSC encode onto one wire, then decoded back badly |
| `/builds/rutt_etra` | brightness pushes scanlines into a relief map |
| `/builds/frame_ring` | pixels arrive from different moments in the last 32 frames |
| `/builds/two_pole` | chroma collapses onto 1, 2, 3 or 4 hue poles; luma untouched |
| `/builds/light_streak` | anamorphic streak and Super 8 stock |
| `/builds/circuit_bender` | the full instrument — opens `bender/` |

One WebGL context serves all of them. Eight live canvases would pass iOS
Safari's context cap and go black, so a build changes only the parameter object
handed to `render()`.

## The instrument — `bender/`

**Twelve bends**, cycled with the arrows or a sideways swipe across the picture.
Each is labelled by the two pins it shorts — `BITS–COLOR`, `CLOCK–TIME`,
`POWER–LOOP` — and nothing tells you what any of them does.

**Two knobs.** INTENSITY drives how hard the current bend is pushed. COLOUR
moves where the colour lands.

**Buttons.** PHOTO saves a still. REC records a clip, capped at 20 seconds
because unbounded recording fills a phone and the tab dies with nothing saved.
CAM flips front/rear.

**BEND**, held, throws two or three extra shorts across random pin pairs on top
of whatever is already wired, each drifting at its own rate. They fall away when
you let go, and the pairs are different every press.

**Swipe up** (or tap PANEL) for the rest.

### REWIRE

A fake sensor chip, CBX-01, with eight pins. Drag one onto another to short
them; tap a wire to cut it. Several bridges can run at once.

| Pin | Wire | What it breaks |
|---|---|---|
| `BITS` | data lines | bits land on the wrong colour channel |
| `BUS` | shared wire | two signals fight, combining logically |
| `ADDR` | address bus | the wrong pixel gets fetched entirely |
| `CLOCK` | row clock | rows repeat, skip, shear |
| `POWER` | supply rail | the chip half-fails |
| `COLOR` | chroma path | colour collapses onto its poles |
| `TIME` | frame store | pixels arrive from the past |
| `LOOP` | output feed | the image eats itself |

A short is not shorthand for turning two knobs up. It **overrides the switch** —
both stages go live even with their module rockers off. It **injects its own
wandering current**, at a rate set by which two pins you joined. And it
**cross-couples the pair**, so each drives the other. Eight pins is 28 bridges.

**AUTO MOVE** holds four wandering signals — LFO A, LFO B, DRIFT, SHOCK — plus
PULL to disconnect. Drag one onto any knob and that knob starts moving by
itself.

### The rack — 17 modules, 108 controls

97 knobs, 9 slide switches, 2 faders. Every module has an on/off rocker; every
knob is a continuous parameter, never a preset. They run in order and each feeds
the next, so two switched on together give you a third thing that is neither.

| Module | What it does |
|---|---|
| **SOURCE** | input stage — gain, tint, and a dry/wet fader back to the clean feed |
| **TIME BASE** | pulls parts of the picture from different moments in the last 32 frames |
| **DEFLECT** | scanline tear, luma-driven warp, kaleidoscope fold |
| **RASTER** | Rutt/Etra — brightness pushes scanlines into a relief map |
| **MOSH** | blocks smear and drag |
| **REGEN** | video feedback, with orbit and an infinite Droste tunnel |
| **TRANSPORT** | VHS — head-switch curl, edge wave, chroma dropout |
| **COMPOSITE** | real NTSC encode to one wire, then decoded back badly |
| **SENSOR** | CCD bloom smear, bursty bitplane dropout |
| **BENDS** | the five real shorts: bit swap, bus, address, clock, starve |
| **GEOMETRY** | tile, splitter, stretch, 3D plane, bulge, push, wave, transform |
| **BEAM** | watercolour bleed, and oscilloscope scanline resynthesis |
| **SORT** | pixel sorting — a gate band, four sort keys, strided compare |
| **REDRAW** | CGA, ASCII mosaic, chromakey, animated mask blocks |
| **FILM** | Super 8 stock, anamorphic light streak, overlay from the frame ring |
| **GRADE** | strobe, grain, sharpen, blur, bleach, lift/gamma/gain/temperature |
| **OUTPUT** | duotone with 1–4 poles, saturation, contrast, quantise, dither, halftone, CRT, hiss |

## Notes

- SCRAMBLE randomises the rack and rewires the chip, but leaves GAIN, TINT and
  DRY/WET alone — those are how you get back to something usable.
- KILL returns everything to neutral, front-panel knobs included.
- Every knob shows its number, takes a typed value, drags to change (shift for
  fine), and double-clicks back to default.
- With no camera available it falls back to an internal bench pattern, so the
  whole instrument is visible and testable without a webcam.
- Press `T` for service mode — runs every stage at once and reports real cost
  per frame. Currently **7.83 ms at 640×480, 128 fps**, with everything on
  simultaneously, a state nothing in normal use reaches.

## Under it

Plain HTML, CSS and JavaScript. No dependencies, no build step, no framework.
WebGL2 required.

The pipeline: camera → a 32-layer texture array holding the last 32 frames →
MANGLE (where a pixel is fetched *from*) → SIGNAL → SORT ×N → POST (what its
value *becomes*) → screen, with the finished frame written back so feedback and
mosh chew the output rather than the raw input.

Colour is BT.601 throughout — `0.299/0.587/0.114` forward, `1.140 / −0.395 /
−0.581 / 2.032` back. The composite stage runs a real fs/4 quadrature carrier
with a four-tap box notch at the colourburst wavelength, not an impression of
one.

Panel is Sony consumer kit c.1981–95 — ribbed switches, engraved scales, small
wide-tracked type. The silkscreen is cyber sigilism, grown procedurally from the
unit's serial number, so no two units carry the same marks.
