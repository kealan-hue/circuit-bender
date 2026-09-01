# CIRCUIT BENDER

A browser app that takes your live camera and lets you break it in real time —
tear it, delay it, feed it back on itself, sort its pixels, smear it like a
dying VHS tape. Point it at yourself or the room and turn knobs until it looks
wrong in an interesting way.

**Try it:** https://kealan-hue.github.io/circuit-bender/ (needs a camera + HTTPS,
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

## REWIRE — the manual circuit bend

The panel on the right is a fake sensor chip, **CBX-01**, with eight pins.
Every pin is a real parameter of the signal path:

| Pin | Function | What it does to the picture |
|---|---|---|
| **SUB** | substrate bias | exposure damage — lifted blacks, warm cast |
| **RG** | reset gate | saturation and colour banding |
| **OD** | output drain | R/G/B channel separation |
| **HCK** | horizontal clock | line timing — torn/rolled rows |
| **TG** | transfer gate | hue and phase |
| **AB** | anti-bloom drain | bloom streaks and colour kill |
| **VCK** | vertical clock | frame timing — time smear |
| **VRF** | voltage reference | feedback |

**Drag one pin onto another to short them together.** Tap a wire to cut it.
You can run several bridges at once.

A short is not a shortcut for turning two knobs up. It does three things a
knob cannot:

1. **It overrides the switch.** Both stages go live even if their module
   rockers are off. Shorting two pins bypasses the thing meant to keep them
   apart — that is what bending actually is.
2. **It injects its own current.** The bridge carries a wandering signal whose
   rate and phase come from *which two pins* you joined, so every pair has its
   own character. Eight pins is 28 possible bridges.
3. **It cross-couples the pair.** Each parameter drives the other, so they
   feed back into one another instead of just sitting at their values.

That is the part worth exploring — not the knobs.

## Patch bay — the "combine for chaos" part

The slim strip under the chip. Four wandering signals — **LFO A** (steady
wobble), **LFO B** (slower, uneven), **DRIFT** (very slow random wander),
**SHOCK** (sudden random spikes) — plus **PULL** to disconnect.

Tap a jack to arm it, then tap any knob. That knob now **moves on its own**,
driven by that signal, instead of sitting where you left it. It is hands-free
automation, not routing.

Where REWIRE shorts two *effects* together, the patch bay makes a single
*knob* move by itself. Arm SHOCK onto a knob that a bridge is already driving
and the two fight over it.

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
