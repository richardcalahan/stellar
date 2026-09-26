# Module 8: Black holes and compact mergers

## What was built

- `src/sim/collisions.ts`: a black hole swallows whatever overlaps it (mass and momentum added, a `swallow` event). Any two of pulsar, magnetar, and black hole meeting fire a `grb` event as well. Merge age carry-over: `f = (m1 a1/L1 + m2 a2/L2) / (m1 + m2)`, new age `f` times the new lifetime.
- `src/render/lensing.ts`: a post-processing pass after bloom that pulls the picture toward each black hole with a 1/r law, for up to eight holes, fed with screen positions each frame and switched off when there are none.
- `src/render/effects.ts`: the gamma-ray burst as a blinding magenta beam along the jet axis for one second. `src/render/waves.ts`: three concentric magenta gravitational wave rings crossing the plane over three seconds, drawn on the HUD.
- Caps: `MAX_BODIES` at spawn; bodies more than `TABLE_RADIUS` (3000 px) from the centre are removed.
- Tests: carry-over maths; a swallow conserves momentum; a pulsar into a black hole emits exactly one burst.

## Knobs

`LENS_STRENGTH`, `LENS_REACH` in `lensing.ts`. `WAVE_SECONDS`, `WAVE_REACH` in `waves.ts`. `BLACK_HOLE_FRACTION`, `TABLE_RADIUS` in `constants.ts`.
