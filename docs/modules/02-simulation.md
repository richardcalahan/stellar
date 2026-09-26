# Module 2: Simulation core, instanced bodies, labels

## What was built

Bodies placed in code pull on each other and carry labels. Planets are lit spheres with a day side facing the nearest star. Bodies pass through each other for now; collisions arrive in Module 5.

- `src/sim/constants.ts`: the unit system (Earth masses, pixels, seconds), `G` derived from Kepler, `SOFTENING`, the integrator switch, `MAX_BODIES`, the palette masses, the class table bounds, and the radius and luminosity relations.
- `src/sim/types.ts`: `Body`, `StarClass`, `RGB`, `BodyInit`, and `SimEvent` (no members yet).
- `src/sim/stars.ts`: `classify`, the class names and colours, `radiusFor`, `luminosityFor`, `setMass` (recomputes everything derived from mass), and `formatMass` for labels.
- `src/sim/gravity.ts`: the pair loop with softening and the semi-implicit Euler step. Plain Euler is one flag away for comparison.
- `src/sim/world.ts`: `World` with `spawn`, `changeMass`, `remove`, `find`, `step`, `momentum`, `energy`, a version counter for views, and a seeded random source for later modules.
- `src/render/lights.ts`: picks the eight most luminous stars each frame and writes them into uniform arrays the planet shader reads.
- `src/render/bodies.ts`: two instanced meshes sharing one sphere. Planets and gas giants use a lit shader (Lambert with a soft terminator, inverse-square falloff in AU). Stars use the emissive limb-darkened shader from Module 1. Colours upload only when the world version changes; positions and sizes every frame.
- `src/render/coronas.ts`: one instanced billboard quad per star, additive, facing the camera.
- `src/render/labels.ts`: name and mass up and to the right of every body on the HUD canvas. The third line is reserved.
- `src/main.ts`: seeds a Sun, an Earth at one AU, a gas giant at 1.7 AU, and a small planet on an eccentric orbit. `src/render/sun.ts` is gone; the instanced views replace it.
- Tests: ten new. Units derive the right G, two equal masses accelerate symmetrically, momentum of a six-body system holds to one part in a billion over 1000 steps, an Earth at one AU orbits in 10 seconds within 2 percent with under 1 percent energy drift over ten laps, and the class, radius, luminosity, label, and version rules hold.

## Formulas

**Newton with softening.** For each pair, the acceleration on body i from body j is

    a_i = G m_j (r_j - r_i) / (|r_j - r_i|^2 + eps^2)^(3/2)

with `eps = SOFTENING` (8 px). Without eps the pull goes to infinity when two bodies overlap and the integrator throws them across the table. With it, the pull peaks at a large finite value and falls off again inside eps.

**Semi-implicit Euler.** Each step: `v = v + a dt`, then `x = x + v dt` using the new v. Plain Euler moves first and then updates v. The two differ by one term of order dt, but plain Euler adds a little energy every step, so orbits spiral outward without limit. Semi-implicit Euler is symplectic: its energy error oscillates but never grows, which is why a 10 second orbit stays a 10 second orbit for as long as you watch.

**Units.** Mass in Earth masses (`SOLAR = 333000`), distance in pixels on the plane (`AU = 300`), time in seconds. Kepler's third law for a circular orbit, `T^2 = 4 pi^2 a^3 / (G M)`, solved for G with `a = AU`, `M = SOLAR`, `T = T_REF`. The plan chose `T_REF = 10`; play showed that far too fast, so it is 25:

    G = 4 pi^2 AU^3 / (T_REF^2 SOLAR) = 5.12

**Speeds.** Circular speed `v = sqrt(G M / r)`, 75 px/s for Earth at one AU. Escape speed is `sqrt(2)` times that, 107 px/s. Period scales as `r^1.5`: 150 px takes 8.8 s, 500 px takes 54 s.

**Size and light.** Star radius in pixels is `4 + 3 M^0.25` below one solar mass and `4 + 3 M^0.3` above, M in solar masses: red dwarf 5.7, Sun 7, blue giant 10.2, super giant 11.5. Planets use a gentler law, `5.5 + 0.5 log10(m + 1)` with m in Earth masses: Earth 5.7, gas giant 6.5, so they stay visible beside a 7 px Sun. The plan's original table (Sun 35 px) was measured against the client's demo frames during this module and found five times too big; in the demo a one solar mass star reads about 7 px in radius with its glow gone by 25 px, and a planet about 4 px, so the Sun is roughly twice a planet. Touch targets are a separate number (`MIN_HIT_RADIUS`, 24 px). Luminosity is `M^1.5` suns. The planet shader uses lighting strength `L^0.5` (so red dwarfs still light their planets), falloff `AU^2 / (d^2 + AU^2 / 4)` (0.8 at one AU), and caps any one star at 2.

**Energy.** `sum(m v^2 / 2) - sum over pairs of G m_i m_j / sqrt(r^2 + eps^2)`, the same softened potential the force comes from. The orbit test watches it.

## Knobs worth turning

All in `src/sim/constants.ts` unless noted.

- `USE_SEMI_IMPLICIT_EULER = false`: the orbits spiral outward over about half a minute, and `npm test` fails the energy drift test on purpose.
- Multiply `G` by 10 (append `* 10` to its line): every orbit is suddenly too slow for its distance and the planets plunge inward. Or set `T_REF = 20` and watch everything slow down together.
- `SOFTENING = 0` versus `200`: with zero, close passes fling bodies away; with 200, gravity goes mushy inside 200 px and tight orbits stop being circular.
- In `seedDemoSystem` in `src/main.ts`: set the Earth's `vy` to `0` (it falls straight in), `0.7 * circular(AU)` (an ellipse), or `1.42 * circular(AU)` (it escapes). Change its `mass` to `PALETTE_MASSES.redDwarf` and it becomes a small star with a corona and a red label.
- `LIGHT_LUMINOSITY_EXP` and `PLANET_AMBIENT` in `src/render/lights.ts` and `src/render/bodies.ts` change how dim stars light planets and how dark the night side gets. `STAR_EMISSIVE` and `CORONA_SIZE_FACTOR` change the glow.

## Talking points for Julian

The walkthrough in `02-walkthrough.md` has the timed version pitched at him. The ideas underneath, for you:

- **Everything pulls on everything.** Gravity is a magnet that never switches off. Heavier things pull harder, and the pull fades fast with distance.
- **An orbit is falling and missing.** Newton's cannon on a mountain: throw the ball harder and harder and eventually it falls all the way around the Earth. The planet is always falling toward the Sun and always moving sideways too fast to hit it.
- **Turn, then step.** Walking a circle, if you turn first and then step you stay on the circle. If you step first and then turn, you drift outward a little every step. That is the difference between semi-implicit and plain Euler.
- **One cookie cutter, two hundred cookies.** The GPU is handed one sphere shape and a list of where to stamp it and how big. That is instancing.
- **A flashlight on a ball.** The lit side of a planet is the side facing the star. The shader asks, for every dot on the surface, "is this dot facing the light?"

## Checkpoint

    npm run typecheck && npm run lint && npm test
    npm run dev

Four bodies orbit the Sun with labels. The Earth laps once every 10 seconds and its bright side always faces the Sun. The small inner planet swings close and far on its ellipse. The gas giant, blue and slow, laps every 22 seconds.
