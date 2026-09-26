# Module 7: Particles and stellar death

## What was built

- `src/sim/death.ts`: below 8 suns a star puffs off a planetary nebula (its lost mass becomes dust) and leaves a white dwarf of `min(1.4, 0.6 sqrt(M))` suns that cools from 100k to 10k Kelvin over 60 s and never dies. From 8 to 20 suns a supernova leaves a 1.5 sun neutron star, a pulsar nine times in ten and a magnetar otherwise. At 20 and above the supernova leaves a black hole of 0.4 M. A white dwarf pushed past 1.4 suns by a merge detonates completely. A supernova blast destroys planets and lesser remnants within `250 + 10 M` px and kicks stars outward at 150 px/s.
- `src/render/particles.ts`: a pool of 20000 particles in one Points draw call, packed contiguously, with ring, burst, and shell emitters. Planetary nebula: an expanding blue-to-red ring with a purple afterglow. Supernova: white flash, pink shell, purple ring.
- `src/render/effects.ts`: rotating beam cones for pulsars (teal) and magnetars (violet), a tilted accretion disc with polar jets for black holes, and a swirling disc for protostars, all rising out of the plane.
- Tests: remnant masses for 1, 10, and 25 suns; death fires once; a planet stays bound when its Sun becomes a white dwarf; blast removes a planet and kicks a neighbour; a 1.6 sun white dwarf detonates.

## Knobs

`NEBULA_BELOW`, `BLACK_HOLE_FROM`, `WHITE_DWARF_MAX`, `MAGNETAR_CHANCE`, `BLAST_RADIUS_BASE`, `BLAST_KICK` in `constants.ts`. `DISC_TILT` in `effects.ts`. Particle counts and speeds in `playEvents` in `main.ts`.
