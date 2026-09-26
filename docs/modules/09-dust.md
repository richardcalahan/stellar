# Module 9: Dust and star formation

## What was built

- `src/sim/dust.ts`: a field of up to 12000 grains in flat arrays. Each grain feels gravity from the eight heaviest bodies, solar wind from every shining one, drag, and is swallowed by black holes it comes near. Every half second the field is binned on a 64 px grid; a cell holding at least 0.02 suns of dust with a velocity spread under 30 px/s collapses into a protostar of that mass at its centre of mass, with its mean velocity. Grains learn how crowded their cell is, for colour.
- Dust steps at a quarter of the simulation rate (`DUST_EVERY`), which keeps twelve thousand grains under a millisecond a frame.
- `src/sim/death.ts` now throws the lost mass of every death into the field: slow for a nebula, fast for a supernova.
- `src/sim/evolution.ts`: protostars ignite after 20 s as a star of their mass (a brown dwarf if under 0.08 suns) and form one to three planets on circular orbits at 120 to 300 px.
- `src/render/dust.ts`: a Points view, purple when thin, green as it gathers, cyan where it is about to collapse, with a little height jitter for volume. Protostars get the swirling disc from `effects.ts`.
- Tests: a bright star pushes dust away and a black hole pulls it in; drag slows by the documented factor; a dense slow cell collapses exactly once with the right mass; a dying Sun seeds the field with 0.4 suns.

## Formulas

Wind acceleration is `WIND_TO_GRAVITY` (1.3) times the pull of a one sun star, scaled by luminosity, so the Sun clears dust while a red dwarf (dim for its mass) gathers it and a black hole swallows it.

## Knobs

`WIND_TO_GRAVITY`, `DUST_DRAG`, `COLLAPSE_MASS`, `COLLAPSE_SPEED`, `COLLAPSE_CELL`, `PROTOSTAR_TIME` in `constants.ts`.
