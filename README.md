# MANGLER VS-1

A hand-bent video signal processor that runs in a browser. Live camera in,
corrupted signal out, in real time.

It is not a filter app. There are no named looks and nothing to choose from a
list. There is a signal path with twenty-odd stages in it, each one switchable
in or out of circuit, each with continuous controls — and the interesting
behaviour is what the stages do to *each other*.

## The signal path

```
INGEST → ring[32]                 32-layer TEXTURE_2D_ARRAY, one texture unit
  ↓
MANGLE   per-pixel time displacement · channel time · hue-precessing echo
         · scanline tear · luma warp · kaleidoscope fold · Rutt/Etra raster
         deflection · Δ frame · block motion mosh · feedback (+ droste)
  ↓
SIGNAL   NTSC composite encode → decode at fs/4 · head switching · edge wave
         · chroma loss · multipath ghost · CCD charge smear · bitplane dropout
  ↓
SORT ×N  odd–even transposition with a stride schedule, four sort keys
  ↓
POST     quantise + Bayer dither · halftone · polarity · raster · hiss · CRT
  ↓      (written back into the feedback buffer, so REGEN and MOSH chew the
glass    finished frame rather than the raw one)
```

Some notes on what is actually happening, because most of these are not the
cheap version of themselves:

- **Time base.** The ring is a 32-layer texture array, so any pixel can read
  any of the last 32 frames. The delay *field* is the instrument: `x` gives a
  photo-finish smear, `y` a waterfall, radial a time warp, and `LUMA` makes
  bright things live in the present while dark things lag behind.
- **Composite.** NTSC is really encoded to a single wire — luma plus a QAM'd
  chroma subcarrier — and then separated back out with a box filter that is
  deliberately not good enough. Dot crawl is not drawn on; it *is* the
  imperfect separation.
- **Sort.** The gate is a band, not a threshold, so spans start and stop at
  real edges. The compare distance is strided, because plain odd–even
  transposition moves a pixel exactly one cell per pass and caps span length at
  the pass count.
- **Bits.** Bitplane dropout is the only stage here that is literally circuit
  bending — it corrupts the number rather than modelling an analogue defect —
  and it fires in bursts, because a continuous mask only ever reads as
  posterisation.

## Controls

- **BEND** — hold. Biases the whole chain toward the extreme rather than
  setting it, so it lands somewhere different depending on where the panel
  already was.
- **SCRAMBLE** — rewires the circuit. Most controls land near zero: a rack
  where everything sits at half is mush, and the character comes from a few
  stages being hard on.
- **HOLD** — freezes the sensor and keeps bending the held frame.
- **KILL** — clears the signal path.
- **PATCH BAY** — arm LFO A / LFO B / DRIFT / SHOCK, then touch any knob to
  route it there. This is the only place two controls can fight each other.
- **FRAME / REC** — PNG still, or MP4/WebM straight off the canvas.

Every continuous control is accurate by construction: the value is always on
screen, shift-drag is fine and alt-drag finer, double-click returns to the
detent default, the number can be typed, and one calibrated sweep length
(260px) means every control moves at the same rate under your thumb.

Press **T** for service mode — it runs the whole chain flat out with every
stage in circuit and reports real cost per frame.

## Panel

The enclosure follows Sony consumer kit c.1981–95: graphite and brushed
silver, ribbed slide switches, engraved scales with numerals, small
wide-tracked type, restraint. The silkscreen is cyber sigilism — hairline
tapering thorns, barbed junctions, a bilateral spine — grown procedurally from
the unit's serial number, so no two units carry the same marks.

## Running it

Static files, no build step, no dependencies. Serve the directory over HTTPS
(the camera API requires it) and open `index.html`. With no camera available it
falls back to an internal bench pattern so you can still see the signal path
working.

WebGL2 required.

## Credit

Techniques were re-implemented from published descriptions, not copied.
Cathode-Retro (BSL-1.0) for the composite encode/decode structure, ntsc-rs
(MIT/ISC/Apache-2.0) for the fs/4 integer carrier and the VHS transport
artifacts, keijiro's SlitScanCam and KinoDatamosh (Unlicense) for the ring-slot
addressing and the DCT-basis mosh fill, gyng/ditherer (MIT) for CCD smear and
bitplane dropout. Pixel-sort span behaviour follows Asendorf's four key modes.
