# CIRCUIT BENDER

A browser app that takes your live camera and breaks it in real time. Point it
at yourself or the room, cycle through the bends, and keep the ones that look
wrong in an interesting way.

**Try it:** https://kealan-hue.github.io/circuit-bender/ — needs a camera and
HTTPS, so open it on a phone or a laptop with a webcam.

---

## The front door

What you get before touching anything. One screenful, shutter reachable with a
thumb.

**Twelve bends**, cycled with the arrows or a sideways swipe across the
picture. Each is labelled by the two pins it shorts — `BITS–COLOR`,
`CLOCK–TIME`, `POWER–LOOP` — and nothing tells you what any of them does. You
find out by pointing the camera at your own face.

**Two knobs.** INTENSITY drives how hard the current bend is pushed. COLOUR
moves where the colour lands.

**Buttons.** PHOTO saves a still. REC records a clip, capped at 20 seconds
because unbounded recording fills a phone and the tab dies with nothing saved.
CAM flips front/rear.

**BEND**, held, throws two or three extra shorts across random pin pairs on top
of whatever is already wired, each drifting at its own rate. They fall away when
you let go, and the pairs are different every press.

**Swipe up** (or tap PANEL) for everything else.

## Behind the swipe

**REWIRE** comes first — a fake sensor chip, CBX-01, with eight pins. Drag one
onto another to short them; tap a wire to cut it. Several bridges can run at
once.

| Pin | Wire | What it breaks |
|---|---|---|
| `BITS` | data lines | bits land on the wrong colour channel |
| `BUS` | shared wire | two signals fight, combining logically |
| `ADDR` | address bus | the wrong pixel gets fetched entirely |
| `CLOCK` | row clock | rows repeat, skip, shear |
| `POWER` | supply rail | the chip half-fails |
| `COLOR` | chroma path | colour collapses onto two hues |
| `TIME` | frame store | pixels arrive from the past |
| `LOOP` | output feed | the image eats itself |

A short is not shorthand for turning two knobs up. It **overrides the switch** —
both stages go live even with their module rockers off. It **injects its own
wandering current**, at a rate set by which two pins you joined. And it
**cross-couples the pair**, so each drives the other. Eight pins is 28 bridges.

**AUTO MOVE**, the strip below, holds four wandering signals — LFO A, LFO B,
DRIFT, SHOCK — plus PULL to disconnect. Drag one onto any knob and that knob
starts moving by itself. Where REWIRE shorts two effects together, this makes a
single knob move on its own.

## The rack — 16 modules, 87 controls

Under the chip. Every module has an on/off rocker; every knob is a continuous
parameter, never a preset. They run in the order listed, and each feeds the
next, so two switched on together give you a third thing that is neither.

| Module | What it does |
|---|---|
| **SOURCE** | input stage — gain, tint, and a dry/wet fader back to the clean feed |
| **TIME BASE** | pulls parts of the picture from different moments in the last 32 frames |
| **DEFLECT** | scanline tear, luma-driven warp, kaleidoscope fold |
| **RASTER** | Rutt/Etra — brightness pushes scanlines into a relief map |
| **MOSH** | blocks smear and drag, like a codec that lost its keyframe |
| **REGEN** | video feedback, with orbit and an infinite Droste tunnel |
| **TRANSPORT** | VHS — head-switch curl, edge wave, chroma dropout |
| **COMPOSITE** | real NTSC encode to one wire, then decoded back badly |
| **SENSOR** | CCD bloom smear, bursty bitplane dropout |
| **BENDS** | the five real shorts: bit swap, bus, address, clock, starve |
| **GEOMETRY** | tile, splitter, stretch, 3D perspective plane |
| **BEAM** | watercolour bleed, and oscilloscope scanline resynthesis |
| **SORT** | pixel sorting — a gate band, four sort keys, strided compare |
| **REDRAW** | CGA, ASCII mosaic, chromakey, animated mask blocks |
| **FILM** | Super 8 stock, anamorphic light streak, overlay from the frame ring |
| **OUTPUT** | duotone, saturation, contrast, quantise, dither, halftone, CRT, hiss |

## Notes

- SCRAMBLE randomises the rack and rewires the chip, but leaves GAIN, TINT and
  DRY/WET alone — those are how you get back to something usable.
- KILL returns everything to neutral. The resting look is applied once at boot
  and is not what KILL restores you to.
- Every knob shows its number, takes a typed value, drags to change (shift for
  fine), and double-clicks back to default.
- With no camera available it falls back to an internal bench pattern, so the
  whole instrument is visible and testable without a webcam.
- Press `T` for service mode — runs every stage at once and reports real cost
  per frame. Currently 8.85 ms at 640×480, which is 113 fps with everything on
  simultaneously, a state nothing in normal use reaches.

## Under it

Plain HTML, CSS and JavaScript. No dependencies, no build step, no framework.
WebGL2 required.

The pipeline: camera → a 32-layer texture array holding the last 32 frames →
MANGLE (where a pixel is fetched *from*) → SIGNAL → SORT ×N → POST (what its
value *becomes*) → screen, with the finished frame written back so feedback and
mosh chew the output rather than the raw input.

Panel is Sony consumer kit c.1981–95 — ribbed switches, engraved scales, small
wide-tracked type. The silkscreen is cyber sigilism, grown procedurally from
the unit's serial number, so no two units carry the same marks.
