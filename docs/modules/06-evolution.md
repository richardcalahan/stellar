# Module 6: Stellar classification and evolution

## What was built

- `src/sim/stars.ts`: `temperatureFor`, `lifetimeFor`, `refreshDerived` (radius, luminosity, temperature, colour from mass, phase, remnant, and age), `labelFor` (four lines for stars: name, mass, temperature, fuel burned; remnants and planets get what applies), and `formatTemperature` in the demo's style: 5.8k Kelvin, 26k Kelvin, 1,000k Kelvin.
- `src/sim/blackbody.ts`: temperature to linear RGB with a saturation lift, so classes read distinctly under bloom. Cool is red, the Sun is warm white, 30000 K is blue.
- `src/sim/evolution.ts`: stars age with time; in the last 15 percent of life they swell into red giants (radius times 2.5, 3500 K, luminosity times 4); at the end they die (Module 7). Protostars count up to ignition and white dwarfs cool.
- Merges carry burned lifetime across by mass (Module 8's rule, implemented here).
- Rendering: star colour and corona come from temperature, red giants get a wider halo, gas giants get cloud bands in the planet shader.
- Tests: temperature rises with mass; the Sun lives 200 s and red dwarfs forever; colour by temperature; label lines; red giant swelling; protostar ignition.

## Formulas

`T = 5800 M^0.3` below one solar mass, `5800 M^0.5` above, clamped at 50000 K. `L = M^1.5`. Lifetime `200 / sqrt(M)` seconds, infinite below 0.5 suns. Sun plus Sun is a White Star, three Suns a Blue Star, eleven a Blue Giant.

## Knobs

`TIME_SCALE`, `LIFETIME_SCALE`, `IMMORTAL_BELOW`, `RED_GIANT_FRACTION`, the class bounds, all in `constants.ts`. `SATURATION_LIFT` in `blackbody.ts`.
