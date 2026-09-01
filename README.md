# MANGLER VS-1

A browser app that takes your live camera and lets you break it in real time —
tear it, delay it, feed it back on itself, sort its pixels, smear it like a
dying VHS tape. Point it at yourself or the room and turn knobs until it looks
wrong in an interesting way.

**Why "MANGLER"** — that's literally what it does to the video signal. Not a
filter (one fixed look you pick from a list) — a *mangler*: a chain of little
machines that each corrupt the picture a bit, that you can turn on/off and mix
together, so the same knob does something different depending what else is
switched on. "Circuit-bender cam" was the working name; MANGLER is the name on
the box.

**Try it:** https://kealan-hue.github.io/mangler/ (needs a camera + HTTPS,
so open it on your phone or a laptop with a webcam)

---

## The top-row buttons — these are the things you originally asked for

| Button | What it does |
|---|---|
| **BEND** (big red one) | Hold it down and everything gets pushed toward extreme — whatever's already turned up gets pushed further. Let go and it eases back. This is the "physical BEND button" you asked for. |
| **SCRAMBLE** | Randomizes every knob at once — "scramble the circuit." Most land low so the result isn't total mush; a couple always land high so something's obviously happening. |
| **HOLD** | Freezes the current frame. Everything else keeps running on that one frozen frame — so you can freeze a moment and keep bending it, per your spec. |
| **KILL** | Snaps every control back to its default / off. The reset switch. |
| **FRAME** | Saves what's on screen right now as a PNG. |
| **REC** | Starts/stops recording a video clip of the mangled output (WebM/MP4). |
| **SENSOR** | Flips between front and back camera. |
| **MID** | Toggles processing resolution (full vs. half) if it's chugging on your phone. |

## The knob modules — 11 stations, stack any combination

Each box on the panel is a self-contained effect with its own on/off switch
and 2–4 knobs. They run in a fixed order (listed below), and because each one
feeds the next, turning on two at once gives you a third thing that's neither
effect alone — that's the "unpredictable when combined" part.

1. **SOURCE** — not an effect, the input stage. GAIN = contrast/brightness
   punch. TINT = shifts the overall colour. DRY/WET fader at the bottom blends
   the mangled picture back with the clean camera feed, so you can pull any
   effect back to "barely there."

2. **TIME BASE** — the camera remembers its last ~32 frames, and this pulls
   different parts of the picture from different *moments* instead of all from
   right now. SPREAD = how far back. FIELD picks the pattern: X = smears
   sideways like a photo-finish, Y = smears top-to-bottom like a waterfall,
   RAD = warps outward from the centre, LUMA = bright parts stay current while
   dark parts lag behind, GRID = a checkered mix of all of it.

3. **DEFLECT** — TEAR = random horizontal glitch tears, like a bad cable.
   RATE = how often. WARP = the picture bends itself based on its own
   brightness (bright spots pull the image toward them). FOLD = kaleidoscope
   mirroring.

4. **RASTER** *(rutt/etra)* — an old 1970s video-synth trick: the picture's
   own brightness pushes its scanlines up and down like a 3D relief map, with
   comb-like scan lines laid over it. DEFLECT = how strong. LINES = how fine
   the comb is.

5. **MOSH** — the "video compression broke" look. CARRY = blocks of the image
   smear and drag when something moves, like a corrupted video codec that lost
   its keyframe. Δ FRAME = blends in a ghost of an older frame. TAP = how far
   back that ghost comes from.

6. **REGEN** *(feedback)* — like pointing a camera at its own monitor.
   AMOUNT = how much of the last output frame gets fed back into the new one.
   ORBIT = the feedback loop slowly zooms/spins as it repeats. DROSTE = turns
   that into an infinite tunnel-zoom.

7. **TRANSPORT** *(vhs)* — simulates a worn tape. HEAD SW = the torn/rolled
   band you see at the very bottom of a VHS frame. EDGE WAVE = the wobbly,
   breathing wave a stretched tape gets. CH LOSS = random scanlines randomly
   lose their colour and go black-and-white, like tape dropout.

8. **COMPOSITE** *(ntsc)* — simulates squeezing the picture down into an old
   analogue TV signal and decoding it back out badly. ENCODE = how strong.
   BURST = how much the colour bleeds/rainbows around edges. GHOST = a faint
   double-image, like a weak antenna signal.

9. **SENSOR** — damage at the camera-chip level. SMEAR = bright lights (like
   a window or a lamp) streak upward, the way a cheap old camcorder's sensor
   overloads. BITS = short random bursts of glitchy colour-block corruption —
   this one's true "circuit bending": it corrupts the actual numbers, not a
   simulated defect.

10. **SORT** *(pixel sorting)* — takes pixels within a chosen brightness range
    and sorts them into streaks. PASSES = how many sorting passes (more =
    longer streaks). GATE ↓ / GATE ↑ = which brightness range gets sorted.
    KEY = sort by brightness / darkness / raw colour value / strongest
    channel — four different-looking results. AXIS = sideways or vertical.
    DIR = sort direction. SPAN = short choppy streaks vs. long ones.

11. **OUTPUT** — the finishing/CRT stage. QUANT = crushes the colours down to
    fewer blocky steps (posterize). DITHER = adds a fine grain so that
    crushing doesn't look flat. HALFTONE = turns the image into
    newspaper-print dots. RASTER = scanlines + curved screen edge. HISS =
    static/noise/dead pixels. POLARITY = normal, inverted, or solarized
    (part-inverted, the weird one).

## Patch bay — the "combine for chaos" part

Four little wandering signals — **LFO A** (steady wobble), **LFO B**
(slower/uneven wobble), **DRIFT** (very slow random wander), **SHOCK**
(random sudden spikes). Tap one of these, then tap any knob, and that knob
starts moving on its own instead of sitting still. Route SHOCK onto a knob
that's already feeding another effect and you get the genuinely unpredictable
combinations you asked for — two things fighting over one control.

## Everything else

- Every knob shows its number, can be typed directly, drag up/down to change
  (hold shift for slow/fine), double-click resets it.
- Serves with **no camera** by falling back to an internal test-card pattern,
  so the whole rig is visible even without a webcam.
- No install, no build step — it's plain HTML/CSS/JS, opens straight in a
  browser. Needs a browser that supports WebGL2 (basically anything from the
  last ~6 years) and HTTPS (for camera permission).

## What's underneath, briefly

The panel look is old Sony consumer electronics (Walkman/Handycam-era):
brushed metal, ribbed slide switches, small precise labels. The scratchy
artwork silkscreened onto it is generated fresh per device from a serial
number — it's cyber-sigilism style (thin barbed thorn-like linework), not a
static logo.

---

If something above still doesn't match what you pictured — tell me which
effect or button feels off and what you expected instead, and I'll change it
rather than you having to reverse-engineer it from the panel.
