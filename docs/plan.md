# Stellar Playground: a 10-module build plan

> The approved build plan, copied into the repo on 2026-09-26 so it lives with the code.
> Where a module note in `docs/modules/` disagrees with this file, the module note is current.
> Known drift so far: the radius table in Appendix A (Sun 35 px) was replaced in Module 2 by
> sizes measured from the client demo (Sun 7 px); see `docs/modules/02-simulation.md`. T_REF went
> from 10 to 25 seconds after play showed the orbits far too fast, so every speed quoted below is
> 2.5 times too high.

## Context

Richard and Julian are building Stellar Playground, a touch-driven n-body gravity sandbox from the client brief and the client's demo video: drag stars and planets in from perimeter palettes, watch them orbit, collide, merge, age, die, seed nebulae that collapse into new stars, and grow civilizations that launch ships. The build is split into ten sit-down sessions, each ending with something visible and testable, so the two of them can stop and talk through the physics and the engineering between sessions. This is a real application: strict TypeScript, tests for the simulation, GPU rendering that holds 60 fps, and a production build that runs on a touchscreen. Nothing is simplified for teaching; Richard explains the code to Julian as it lands.

Development happens in Chrome on the Mac. The near-term target is an ordinary touchscreen (touch laptop or iPad on the LAN). Mouse must work too. The client's real deployment is a 4K Ideum table with 80 touches, so the layout and input code are written to scale to that even though it is not tested here.

## What the reference video established

Reviewed from 512 extracted frames and the Whisper transcript of the 8.5-minute demo (the pointing-hand icon in the video is a recording overlay, not part of the product).

**Layout and chrome**

- Palettes are green-outlined rounded cards titled "Touch and Drag" with four dashed-ring icons: The Sun (yellow), Red Dwarf (orange), Gas Giant (blue), Planet (grey). Four cards at 1080p, one per corner, inset from the edge. On 4K the client uses eight: three top, three bottom, one left, one right. Cards on the far side of the table are rotated 180 degrees.
- One purple rounded-square info button at top centre (rotated for the far side) and one at bottom centre.
- The starfield is a sparse field of faint white, red, and blue points.

**Interaction**

- Touch a palette icon and the icon leaves the card (the slot goes empty) and follows the finger; release drops it. Release while moving tosses it.
- A held body shows a dashed yellow ring. Two toggles float to its right at the same height: "Lock" (red dashed ring, padlock glyph) and "Orbit" (green dashed ring, orbit glyph). With Orbit active, a dashed green circle is drawn around the nearest most massive star through the held body's position, previewing the orbit.
- Locked bodies show a small red padlock before their label. Bodies orbiting a locked star show their orbit path as a thin green circle.
- Every body carries a permanent label: name, mass (solar-mass glyph for stars, Earth-mass glyph for planets), temperature as "4.2k Kelvin", and a percentage. For stars the percentage is fuel burned; at 100 percent the star dies. For protostars it is progress to ignition. For planets the third line is a status ("Lava Hot", "Frigid Ice", "Simple Life") and the percentage is progress to the next stage.
- Events raise a short pill-shaped toast beside the body: "White Dwarf Created", "Created BlackHole".
- Trails are long, fading lines coloured by body class.

**Mechanics beyond the brief**

- Nebula dust is simulated: stars push it away with solar wind, masses pull it in, and clumps collapse into protostars. Dust that falls into a black hole is swallowed.
- Protostars age to 100 percent, then ignite as a star of their mass and generate planets while forming.
- White dwarfs explode if they gain too much mass (a Type Ia supernova).
- Supernovae annihilate nearby stars and planets. Stars below 20 solar masses leave a pulsar; 20 and above leave a black hole.
- A pulsar falling into a black hole fires a gamma-ray burst and emits gravitational waves, drawn as expanding magenta triple rings.
- Planets: too close is "Lava Hot", too far is "Frigid Ice", in the zone they progress Simple Life, Complex Life, Intelligent Life, Early Civilizations, Farming Age, Industrial Age, Nuclear Age, Space Age. The Nuclear Age has a roughly 50 percent chance of nuclear war (surface flashes, then "NUCLEAR WAR", then "Dead World"). Climate change is a second failure mode. Space Age planets show coloured city lights, spawn satellites, and launch ships that colonize any planet they hit ("Colonizing 46%", then "Colonized"). Each civilization has its own colour; when two colours meet they either cooperate or attack.

**Visual language in the demo**

- Stars: bright core, soft bloom, faint four-point flare. Blue giants have a large blue halo. The red giant phase is a swollen red glow.
- Protostars: orange core inside a swirling red-orange disc with sparkles.
- White dwarf: tiny, intensely white. Pulsar: teal point with a rotating beam. Magnetar: the same in violet. Black hole: small tilted accretion disc with polar jets.
- Planetary nebula: an expanding Helix-style ring, blue interior and red rim, that breaks into drifting purple and green clumps. Supernova: white flash, pink shell, then a purple ring. Condensing dust turns cyan before a protostar appears.

The demo draws flat sprites and its temperatures are not physical (its Sun reads 4.2k Kelvin). This build renders the same playfield as a 3D scene and uses real temperatures in the same label format, since the brief is educational.

## Working agreement

- One module per session. I build the module with you, explain each file as it lands, and stop at the checkpoint. I do not start the next module until asked. Module 10 is the largest and may take two sittings.
- First run: on approval, build Module 1 autonomously from scaffold to checkpoint (project creation, dependencies, config, renderer, starfield, loop, first commit), then stop and report. Modules 2 onward wait for a go.
- Every module ends green: `npm run typecheck`, `npm run lint`, and `npm test` pass, the checkpoint is confirmed in the browser, and the module is committed with a plain message (project rules: no quotes, no attribution trailers).
- Each module writes a short note in `docs/modules/NN-name.md`: what was built, the formulas used, and the knobs worth turning. These are the reference for the between-session conversations with Julian.
- Every number that shapes play (G, masses, thresholds, lifetimes, stage durations, blast radii, wind strength) lives in `src/sim/constants.ts`, so exploring the physics is a one-line edit.

## Decisions

**Stack.** Vite, TypeScript (strict), three.js (WebGLRenderer) for the world, an HTML canvas layer for text, a DOM overlay for palettes and buttons, Vitest for the simulation tests, ESLint and Prettier, npm.

**Planar physics, 3D rendering.** The simulation lives on the z = 0 plane because a finger on a table cannot express depth, and that is the client's product. The renderer treats that plane as a 3D scene: a PerspectiveCamera looks straight down from above, bodies are lit spheres, stars have shader coronas, black holes have tilted accretion discs and jets rising out of the plane, dust has a little thickness, and bloom and a lensing pass finish the frame. Touch maps to the plane by raycasting, so the camera can tilt later without touching input code. 1 world unit is 1 CSS pixel on the plane; the camera height is derived from the viewport and field of view so the plane fills the screen exactly.

**Why three.js rather than Pixi or raw WebGL.** Raw WebGL would spend sessions on buffer and shader plumbing before the first orbit. Pixi is a 2D scene graph and cannot do the lit 3D scene above. three.js gives InstancedMesh, ShaderMaterial, Points, the postprocessing stack (bloom, a custom lensing pass), and an API you already know.

**Three render layers.** WebGL for the world. An HTML canvas above it for text and thin geometry (labels, padlock glyphs, orbit rings, toasts), because 200 labels are cheap there and awkward in WebGL. DOM on top for palettes, the modifier toggles, the info button and panel, because those are real buttons that need real hit targets. Label and ring positions come from projecting world points through the camera each frame.

**Input.** Pointer Events. One code path for mouse, touch, and pen. Fingers are many pointers with distinct ids; a mouse is one. Mouse users toggle Lock and Orbit with the L and O keys while dragging, since a mouse cannot press a button while it is busy dragging.

**Simulation on the main thread.** 200 bodies with 4 substeps per frame costs about 1.2 ms in V8. Dust is a separate, cheaper field (gravity from the few most massive bodies only). The sim is pure TypeScript with no DOM or three.js imports, so moving it to a Worker later is a transport change, not a rewrite.

**Project location.** `/Users/richardcalahan/Developer/stellar`, a new git repo. Reference material stays in `/Users/richardcalahan/Developer/stellar-playground-ref` (video, transcript) and is not committed.

## Architecture

```
stellar/
  index.html                  webgl canvas, hud canvas, overlay root; touch-action none
  package.json                scripts: dev, build, preview, typecheck, lint, test
  tsconfig.json               strict, noUncheckedIndexedAccess, verbatimModuleSyntax
  vite.config.ts, vitest.config.ts, eslint.config.js, .prettierrc
  public/manifest.webmanifest
  src/
    main.ts                   composition root
    loop.ts                   rAF loop, fixed-step accumulator, frame timing
    sim/                      pure TS, no DOM, no three.js
      constants.ts            units, G, softening, steps, caps, every tunable table
      types.ts                Body, Dust, Ship, Civilization, SimEvent, StarClass, Remnant, LifeStage
      world.ts                World: entities, step(dt): SimEvent[]
      gravity.ts              pair loop with softening, semi-implicit Euler
      orbits.ts               circularVelocity, nearestMostMassive
      collisions.ts           overlap test, merge (mass, momentum, age carry-over), compact mergers
      stars.ts                classify, radiusFor, luminosity, temperature, lifetime, labels
      evolution.ts            aging, red giant phase, protostar ignition, death dispatch
      death.ts                remnant table, nebula ejection, supernova blast, Type Ia
      dust.ts                 dust field: gravity, solar wind, drag, clump detection, collapse
      habitability.ts         zone, life stage machine, nuclear war, climate change
      civilizations.ts        colours, ships, colonization, encounters
    render/
      renderer.ts             WebGLRenderer, PerspectiveCamera fit to the plane, DPR, resize, composer
      camera.ts               fitCameraToPlane, project(world) to screen, screenToPlane raycast
      starfield.ts            distant Points with a twinkle shader
      bodies.ts               instanced spheres: planet shader (star lighting, status, lights), star shader
      coronas.ts              instanced billboards: corona, flare, red giant halo
      lights.ts               star light pool: the 8 brightest stars feed the planet shader
      trails.ts               ring buffers rendered as one LineSegments geometry on the plane
      particles.ts            preallocated Points pool for one-shot effects
      dust.ts                 Points view over the sim dust field with z thickness
      effects.ts              accretion discs, jets, beams, protostar discs, GRB flash, GW rings, satellites, ships
      lensing.ts              ShaderPass: screen-space distortion around black holes
      color.ts                blackbody temperature to linear RGB
      hud.ts                  HTML canvas: labels, padlocks, orbit rings, toasts, projected each frame
    input/
      pointer.ts              PointerTracker: id map, capture, cancel, velocity samples
      drag.ts                 hit test on the plane, hold, fling, palette hand-off
    ui/
      layout.ts               palette placement and rotation by screen size
      palettes.ts             cards, icons, empty-slot state
      modifiers.ts            Lock / Orbit toggles near the held body, L/O keys
      info.ts                 info button and panel (instructions, science notes, reset)
      attract.ts              idle timer and demo system
      styles.css
    sim/__tests__/            Vitest specs
  docs/modules/               one note per module
```

Rule: `sim/` never imports from `render/`, `input/`, or `ui/`. Each frame the loop applies input to held bodies, calls `world.step(dt)` which returns a typed `SimEvent[]` (merge, death, ignite, collapse, swallow, grb, stageChange, war, shipLaunch, colonize), then the renderer syncs instance buffers from world state and consumes events for one-shot effects and toasts. This keeps the physics testable in Node and makes effects and audio pure consumers.

Key types (sketch):

```ts
type StarClass =
  | 'planet'
  | 'gasGiant'
  | 'brownDwarf'
  | 'redDwarf'
  | 'yellow'
  | 'white'
  | 'blue'
  | 'blueGiant'
  | 'superGiant'
  | 'megaGiant';
type Remnant = 'protostar' | 'whiteDwarf' | 'pulsar' | 'magnetar' | 'blackHole';
type LifeStage =
  | 'none'
  | 'simple'
  | 'complex'
  | 'intelligent'
  | 'earlyCiv'
  | 'farming'
  | 'industrial'
  | 'nuclear'
  | 'spaceAge';
type PlanetStatus =
  'lavaHot' | 'frigidIce' | 'habitable' | 'nuclearWar' | 'deadWorld' | 'colonizing' | 'colonized';

interface Body {
  id: number;
  mass: number; // Earth masses
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hitRadius: number;
  age: number;
  lifetime: number;
  phase: 'main' | 'redGiant';
  remnant?: Remnant; // overrides classify() when set
  locked: boolean;
  orbiting: boolean;
  primaryId?: number;
  held: boolean;
  habitableTime: number;
  lifeStage: LifeStage;
  status: PlanetStatus;
  civId?: number;
  luminosity: number;
  temperature: number;
  color: [number, number, number];
}
```

## Modules

### Module 1: Foundation and renderer

- **Result:** a full-screen starfield with one glowing Sun (a sphere with a corona) that resizes cleanly, a debug overlay showing frame time, a fullscreen button, and a green toolchain.
- **Explain to Julian:** what a build tool does; the render loop; why simulation time is separate from frame time (fixed step plus accumulator); how a perspective camera is fitted so one world unit is one pixel on the plane; what bloom is; why there are three drawing layers.
- **Build:**
  - `npm create vite@latest` (vanilla-ts), strict `tsconfig`, ESLint (typescript-eslint, strict-type-checked), Prettier, Vitest, `three` and `@types/three`, `git init`, scripts for dev/build/preview/typecheck/lint/test.
  - `render/camera.ts`: PerspectiveCamera at (0, 0, H) looking down the negative z axis with fov 30, H = (viewportHeight / 2) / tan(fov / 2) so the z = 0 plane fills the viewport; `project(x, y, z)` to CSS pixels; `screenToPlane(px, py)` via Raycaster against the z = 0 plane.
  - `render/renderer.ts`: WebGLRenderer (alpha false, antialias), `setPixelRatio(min(dpr, 2))`, resize that refits the camera, updates renderer size, composer size, and the HUD canvas backing store. EffectComposer with RenderPass, UnrealBloomPass (threshold 0.8), OutputPass, `NoToneMapping`.
  - `render/starfield.ts`: Points far below the plane with a small shader for size attenuation and twinkle, faint white, red, and blue tints.
  - `render/hud.ts`: the HTML canvas layer with DPR handling and `drawText`/`drawRing` helpers taking projected coordinates; nothing drawn yet but the sizing is proven.
  - `loop.ts`: rAF loop, fixed step 1/240 s with up to 8 substeps per frame, exponential moving average of frame time.
  - Debug overlay behind a `?debug` query flag (fps, frame ms, body and dust counts). Fullscreen button, `navigator.wakeLock`, web app manifest and iOS meta tags.
  - Placeholder Sun: a SphereGeometry mesh with an emissive colour above 1.0 so bloom picks it up, plus a billboard corona quad with a radial shader.
- **Checkpoint:** resize and DPR changes keep the Sun round, centred, and 35 px in radius on screen; the corona blooms; `npm run typecheck && npm run lint && npm test` pass (one placeholder spec).

### Module 2: Simulation core, instanced bodies, labels

- **Result:** bodies placed in code attract each other and carry labels ("Yellow Star", mass with the solar glyph). Planets are lit spheres with a day side facing the nearest star. Bodies pass through each other for now.
- **Explain to Julian:** Newton's law and softening; why semi-implicit Euler is stable for orbits and plain Euler is not; the unit system and how G is derived from Kepler's third law; how instancing draws 200 spheres in one call.
- **Build:**
  - `sim/constants.ts`: SOLAR = 333000, AU = 300, T_REF = 10, G = 4 pi^2 AU^3 / (T_REF^2 SOLAR) (about 32), SOFTENING = 8, DT = 1/240, MAX_SUBSTEPS = 8, MAX_BODIES = 200, palette masses (333000, 33300, 100, 1).
  - `sim/types.ts`, `sim/world.ts` (entity arrays, id allocation, `step(dt)` returning events), `sim/gravity.ts` (pair loop using `r^2 + eps^2`, velocity update then position update).
  - `render/bodies.ts`: two InstancedMesh objects sharing a SphereGeometry. Planet instances use a ShaderMaterial with per-instance colour, radius, and flags, lit by a uniform array of up to 8 star lights (position, colour, intensity) with Lambert diffuse and a soft terminator. Star instances use an emissive shader (colour above 1.0, limb darkening). `render/lights.ts` picks the 8 most luminous stars each frame. `render/coronas.ts`: an instanced billboard per star for corona and flare.
  - `render/hud.ts`: label per body at its projected position, offset to the upper right, three lines (name, mass, third line reserved), compact sans matching the video.
  - Tests: two equal masses accelerate symmetrically; momentum of an isolated system is conserved to 1e-9 over 1000 steps; an Earth-mass body at 300 px orbits a Sun with period 10 s within 2 percent and energy drift under 1 percent over 10 laps.
- **Knobs:** G times 10; one body 1000 times heavier; give a body a sideways velocity.
- **Checkpoint:** tests green; a planet's lit side tracks the Sun as it moves.

### Module 3: Pointer input, mouse and touch

- **Result:** grab, drag, and fling any body with fingers or mouse. A held body shows the dashed yellow ring. Throwing a planet sideways past the Sun bends its path into loops. Playable.
- **Explain to Julian:** events and pointer ids; raycasting a screen point onto the plane; why velocity is estimated over a time window instead of the last two events; inertia as the physics behind a toss.
- **Build:**
  - `input/pointer.ts`: `PointerTracker` class. pointerdown on the canvas with `setPointerCapture`; move, up, and cancel on window; a `Map<pointerId, Drag>` with a ring buffer of `{x, y, t}` plane samples from `event.timeStamp`; pointercancel releases with zero velocity; non-primary mouse buttons ignored; contextmenu, gesturestart, and passive-false touchmove suppressed.
  - `input/drag.ts`: hit test picks the nearest unheld body within `hitRadius` (max(radius, 24)) on the plane; held bodies are pinned to the pointer each frame, skip integration, and still exert gravity; on release, velocity from the last 80 to 100 ms of samples, scaled by FLING_SCALE (0.4) and capped at FLING_MAX (800 px/s).
  - `render/hud.ts`: dashed yellow ring on held bodies.
  - CSS: touch-action none, overscroll-behavior none, user-select none, touch-callout none on all layers.
- **Knobs:** FLING_SCALE; spawn a ring of planets in code.
- **Checkpoint:** mouse drag and fling on the Mac; two-finger simultaneous drags on the touch device over the LAN (`vite --host`); rotating the device mid-drag leaves nothing stuck.

### Module 4: Palettes, orbits, rings, trails

- **Result:** the "Touch and Drag" cards in the corners (eight on a 4K-wide screen), icons that leave the card and follow the finger, a dashed orbit-preview ring while a held body will orbit, green orbit-path rings for orbiting bodies, and fading trails on the plane.
- **Explain to Julian:** v = sqrt(GM / r) and where it comes from; Kepler's third law (150 px takes 3.5 s, 500 px takes 21 s); escape velocity is sqrt(2) times circular; how a layout rule turns one screen size into another.
- **Build:**
  - `ui/layout.ts`: four inset corner cards below 2560 px wide, otherwise three top, three bottom, one left, one right; far-side cards rotated 180 degrees, side cards rotated 90; positions recomputed on resize.
  - `ui/palettes.ts`: card markup matching the video (green outline, title, four dashed-ring icons with captions); pointerdown on an icon empties the slot, creates the body, and hands the pointer to the drag map so spawn-and-drag is one gesture; the slot refills on release; cards disable at MAX_BODIES.
  - `sim/orbits.ts`: `circularVelocity(body, primary)` (perpendicular to the radius, plus the primary's velocity), `nearestMostMassive(body, world)` (the transcript's rule: nearest, weighted by mass).
  - `render/hud.ts`: orbit preview (dashed green circle centred on the target star through the held body, projected) and orbit-path rings (thin green circle for bodies with `orbiting` set around a locked primary).
  - `render/trails.ts`: per-body ring buffer written into one LineSegments geometry on the plane with drawRange and per-vertex alpha fade, colour from body class.
  - Until Module 5 adds the toggle, palette drops apply the orbit velocity automatically.
  - Tests: `circularVelocity` reproduces the 10 s period; `nearestMostMassive` prefers a Sun at 400 px over a red dwarf at 300 px; layout returns 4 cards at 1920 and 8 at 3840.
- **Knobs:** orbit speed times 0.7 (ellipse) and 1.42 (escape); retrograde sign flip; the 2560 breakpoint.
- **Checkpoint:** a planet dropped at 300 px laps in 10 s and its trail closes on the orbit ring.

### Module 5: Modifiers, collisions, merging, toasts

- **Result:** Lock and Orbit toggles beside a held body, a padlock glyph on locked labels, locked stars that stay put while planets circle, overlapping bodies that merge and keep their combined momentum, and event toasts.
- **Explain to Julian:** conservation of mass and momentum; centre of mass; how a second finger (or a key) changes state while the first finger holds.
- **Build:**
  - `ui/modifiers.ts`: "Lock" (red dashed ring, padlock) and "Orbit" (green dashed ring, orbit glyph) positioned to the right of the held body at its projected height (overlay pointer-events none, buttons auto, pointerdown not click); L and O keys toggle the same flags for the active mouse drag; active state highlighted.
  - `sim/gravity.ts`: locked bodies skip integration but still pull; orbiting bodies get `circularVelocity` on release; locked plus orbiting bodies feel only their primary's gravity.
  - `sim/collisions.ts`: overlap test inside the gravity pair loop, merge when distance < 0.85 (r1 + r2): mass sum, momentum-weighted velocity, centre-of-mass position, a `merge` SimEvent.
  - `render/hud.ts`: padlock glyph before locked names; toast queue (pill label beside a body, 2 s fade) fed from events.
  - Tests: merge conserves mass and momentum; a locked body does not move under gravity but still accelerates a neighbour; lock plus orbit ignores a third body.
- **Knobs:** the 0.85 overlap factor; toast duration.
- **Checkpoint:** a Lock+Orbit planet circles a Sun while a second Sun flies past without disturbing it; the merge toast appears.

### Module 6: Stellar classification and evolution

- **Result:** mass sets class, luminosity, temperature, colour, radius, and lifetime. Labels fill in ("Yellow Star", "1.0" with the solar glyph, "5.8k Kelvin", "12.3%"). Sun plus Sun is a White Star; three Suns are a Blue Star; eleven are a Blue Giant with a wide halo. Near the end of life the star swells and reddens. Gas giants show procedural bands; planets show a day side lit in the colour of their star.
- **Explain to Julian:** the mass-luminosity relation and why the exponents are squashed for play; blackbody colour; live fast, die young; the red giant phase; why the demo's temperatures were wrong and ours are right.
- **Build:**
  - `sim/stars.ts`: `classify(mass)` from the table in Appendix A; `radiusFor(mass)`; L = M^1.5; T = 5800 M^0.3 below one solar mass and M^0.5 above, clamped at 50000 K; lifetime = 200 / sqrt(M) s, Infinity below 0.5 solar masses; red giant phase in the last 15 percent (radius times 2.5, T 3500 K, L times 4); `labelFor(body)` producing the three label lines.
  - `render/color.ts`: blackbody temperature to linear RGB from a CIE-based lookup (1000 to 50000 K), with a saturation lift so classes read distinctly under bloom.
  - `sim/evolution.ts`: age advances with sim time and a global time scale; phase transitions; derived fields recomputed on mass change.
  - `render/bodies.ts` and `render/coronas.ts`: star colour and intensity from temperature; corona and halo scale from luminosity and class; red giant halo; gas giant banding from noise in the planet shader via a kind flag; `render/lights.ts` feeds star colour and luminosity into the planet lighting.
  - Tests: classify boundaries; label formatting for each class; temperature monotonic in mass.
- **Knobs:** class thresholds; the Sun's lifetime; red giant swell.
- **Checkpoint:** 1, 2, 3, and 11 merged Suns read Yellow Star, White Star, Blue Star, and Blue Giant with rising temperatures, and a planet's day side shifts from yellow to blue as its star grows.

### Module 7: Particles and stellar death

- **Result:** a dying Sun swells, puffs out a Helix-style ring, and leaves a white dwarf with a "White Dwarf Created" toast; its planets drift into wider ellipses. A Blue Giant detonates in a white flash and pink shell that annihilates nearby planets and leaves a pulsar (a small sphere with a rotating beam cone) or, one time in ten, a magnetar. A white dwarf pushed past 1.4 solar masses explodes. Stars of 20 solar masses and up leave a black hole with a "Created BlackHole" toast.
- **Explain to Julian:** planetary nebula versus supernova; remnant masses; why losing more than half the star's mass unbinds its planets; the Chandrasekhar limit.
- **Build:**
  - `render/particles.ts`: preallocated pool of 20000 particles in a Points geometry (position, velocity, colour, life as Float32Arrays, DynamicDrawUsage, drawRange), custom shader with a radial sprite, additive blending, depthWrite off, point size scaled by camera distance and capped for mobile GPUs. Emitters: ring (blue interior, red rim, expanding, slight z thickness), flash, shell, streak.
  - `sim/death.ts`: on age reaching lifetime: below 8 solar masses, planetary nebula (ejected mass becomes dust, see Module 9) plus a white dwarf of min(1.4, 0.6 sqrt(M)) that never dies and cools over 60 s; 8 to 20, supernova plus a 1.5 solar mass neutron star, 90 percent pulsar, 10 percent magnetar; 20 and above, supernova plus a black hole of 0.4 M. White dwarf above 1.4 after a merge: Type Ia supernova, no remnant. Supernova blast: planets and remnants within BLAST_RADIUS are destroyed, stars get a radial velocity kick. `death` and `blast` events.
  - `render/effects.ts`: rotating beam cones for pulsars (teal) and magnetars (violet), tilted out of the plane; black hole as a black sphere with a tilted emissive accretion disc (ring geometry, swirl shader) and two jet cones along its axis.
  - Tests: remnant masses; death events fire once; a bound planet stays bound after a Sun to white dwarf transition; a planet inside the blast radius is removed; a 1.5 solar mass white dwarf explodes.
- **Knobs:** magnetar chance; white dwarf mass; blast radius.
- **Checkpoint:** the three death paths play out on screen with the correct remnants and toasts.

### Module 8: Black holes and compact mergers

- **Result:** black holes bend the starfield and everything behind them, swallow whatever they touch, and grow. Dropping a pulsar into a black hole fires a gamma-ray burst and sends magenta gravitational-wave rings across the plane. Merges carry over burned lifetime.
- **Explain to Julian:** event horizons and accretion; gravitational lensing; what LIGO detects; why merging a fresh star into an old one resets only part of the clock.
- **Build:**
  - `sim/collisions.ts`: black holes swallow overlapping bodies (mass and momentum added, `swallow` event); any two of pulsar, magnetar, black hole merging raise a `grb` event; merge age carry-over f = (m1 age1 / life1 + m2 age2 / life2) / (m1 + m2), age = f times the new lifetime.
  - `render/lensing.ts`: a ShaderPass after bloom applying a radial distortion around each black hole (uniform array of projected screen positions and radii, capped at 8).
  - `render/effects.ts`: gamma-ray burst (bright beam along the jet axis, 1 s) and gravitational waves (three concentric magenta rings on the plane expanding from the merge point over 3 s).
  - Caps: MAX_BODIES enforced at spawn; bodies more than 3000 px from centre are removed.
  - Tests: carry-over math; a swallow conserves momentum; a pulsar plus black hole merge emits exactly one grb event.
- **Knobs:** black hole mass fraction; lensing strength; ring speed.
- **Checkpoint:** the video's pulsar-into-black-hole moment reproduces, rings and all.

### Module 9: Dust and star formation

- **Result:** nebulae are living dust with a little thickness above the plane. Stars push it away with solar wind, masses pull it in, and where it piles up it turns cyan and collapses into a protostar wrapped in a swirling tilted disc. Protostars age to 100 percent, ignite as stars of their mass, and generate planets as they form. A Sun placed inside an old nebula shepherds the dust into a ring of new systems.
- **Explain to Julian:** radiation pressure and stellar wind; Jeans collapse in one sentence; why a supernova seeds the next generation of stars.
- **Build:**
  - `sim/dust.ts`: a preallocated dust field (up to 20000 particles with position, velocity, mass, temperature). Per step: gravity from the K most massive bodies (K = 8), solar wind acceleration k L / r^2 away from every star, mild drag, black holes swallow dust in range. Clump detection on a 64 px grid every 0.5 s: a cell whose dust mass exceeds COLLAPSE_MASS and whose velocity dispersion is below COLLAPSE_SPEED spawns a protostar of that mass and removes the dust. Planetary nebulae and supernovae from Module 7 now eject their mass into this field.
  - `sim/evolution.ts`: protostars age over PROTOSTAR_TIME (20 s), then ignite as a main-sequence star of their mass (or a brown dwarf below 0.08) and spawn one to three planets of 1 to 10 Earth masses on circular orbits at 120 to 300 px; `ignite` event.
  - `render/dust.ts`: Points view over the field, z jittered within plus or minus 20 units for volume, colour by temperature (purple cold, green, cyan when dense); `render/effects.ts`: protostar disc (tilted ring with a swirl shader and sparkle particles).
  - Tests: dust momentum under gravity alone is conserved; wind pushes a test particle outward; a dense, cold cell collapses exactly once and the protostar mass equals the removed dust mass; ignition yields the right class.
- **Knobs:** wind strength; collapse thresholds; protostar time.
- **Checkpoint:** a Sun dropped into a fresh planetary nebula produces two or three protostars within 30 s and they ignite into a working system.

### Module 10: Habitable worlds, civilizations, ships, and release

- **Result:** planets read "Lava Hot" near a star, "Frigid Ice" far from it, and progress through eight life stages in the zone. Their night sides show city lights from the Industrial Age on, nuclear flashes in the Nuclear Age, and civilization-coloured lights at Space Age; half of nuclear worlds die in nuclear war and climate change claims some industrial ones. Space Age planets spawn orbiting satellites and launch ships that colonize what they hit; rival civilizations cooperate or attack. The info panel, attract mode, performance pass, and production build finish the app on the touch device.
- **Explain to Julian:** the habitable zone scales with sqrt(L); the Fermi paradox and why the 50/50 nuclear war is in the transcript; timescales of life versus stars.
- **Build:**
  - `sim/habitability.ts`: inner = 0.8 AU sqrt(L), outer = 1.6 AU sqrt(L); status lavaHot inside, frigidIce outside, habitable within; `habitableTime` accumulates in zone and drains at half speed outside; stage thresholds from Appendix A; `stageChange` events. Nuclear Age: each second a hazard roll so that about 50 percent of worlds end in `nuclearWar` (5 s of flashes, then `deadWorld`). Industrial and Nuclear Ages: a smaller climate-change hazard with the same end. Red giant phase sterilizes.
  - `sim/civilizations.ts`: on Space Age a civilization with a colour is created; the planet spawns satellites (visual) and a ship every SHIP_INTERVAL (12 s), 200 px/s straight line, target the nearest planet not of this civilization within 1500 px, cap 30. On arrival: uncolonized planet becomes `colonizing` for 10 s then `colonized` in that colour; a planet of another civilization triggers a 50/50 cooperate (ship absorbed) or attack (target becomes deadWorld). Colonized planets launch ships at half rate.
  - `render/bodies.ts`: planet shader gains status tint (red lava glow, pale ice, blue-green living), night-side city lights masked by the terminator, nuclear flashes, civilization colour; `render/effects.ts`: satellites as tiny instanced spheres orbiting above the plane, ships as instanced elongated meshes in civilization colour.
  - `ui/info.ts`: the purple info buttons (top rotated, bottom upright) open a panel with instructions, the science notes, and a reset button (a long-press, so a public table cannot be wiped by accident).
  - `ui/attract.ts`: three idle minutes reset the field and spawn a demo system.
  - Performance pass: 200 bodies plus 20000 dust plus 20000 particles at 60 fps on the Mac and the touch device; adaptive pixel ratio (1.5 on iPad) if the frame budget is missed.
  - `vite build`, serve `dist/` on the LAN, test the full flow on the device.
  - Tests: zone radii for Sun, red dwarf, and a 3 solar mass star; a planet at 300 px around a Sun reaches Space Age at the expected time; hazard maths yields 50 percent over the Nuclear Age duration; encounter outcomes are drawn from the seeded RNG.
- **Knobs:** stage thresholds; war and climate hazards; ship speed and interval.
- **Checkpoint:** the transcript's final scene reproduces on the touch device: several Sun-and-planet systems, one goes nuclear, one reaches Space Age and colonizes a lava-hot neighbour, and the field resets itself when left alone.

## Verification

- Every module: `npm run typecheck && npm run lint && npm test`, then the browser checkpoint, then commit.
- Simulation tests live in `src/sim/__tests__/` and run in Node with no browser; the orbit period and energy drift test from Module 2 stays green through every later module. Randomness goes through a seeded RNG injected into World so tests are deterministic.
- Camera fit is tested numerically: `project(screenToPlane(p))` round-trips within 0.01 px at the corners and centre for several viewport sizes.
- Touch from Module 3 on is tested on the real device over the LAN, since Chrome DevTools cannot emulate true multitouch.
- Final acceptance is the Module 10 checkpoint on the touch device.

## Appendix A: the numbers

**Units.** Mass in Earth masses; convert to solar masses only inside `stars.ts`. 1 world unit = 1 CSS pixel on the z = 0 plane. AU = 300 px. G = 4 pi^2 AU^3 / (T_REF^2 SOLAR), about 32. Softening 8 px. Step 1/240 s, up to 8 substeps per frame. Pair loop cost is about 15 ns per pair, so 200 bodies costs about 1.2 ms per frame and 600 would blow the budget. Cap at 200.

**Camera.** Vertical fov 30 degrees, height H = (viewportHeight / 2) / tan(15 degrees), about 1.87 times the viewport height. Objects above the plane appear slightly larger (an object at z = 40 on a 1080 px viewport grows by about 2 percent), which is the depth cue for discs, jets, and satellites.

**Speeds at 300 px from a Sun.** Circular 188 px/s, escape 267 px/s, period 10 s. A natural flick is 500 to 1500 px/s, hence the 0.4 fling scale and 800 px/s cap. Tune in play.

**Radius from mass (px).** 6 + 29 M^0.25 below one solar mass, exponent 0.30 above. Hit radius at least 24 px.

| Body   | 1 Earth | 100 Earth | 0.1 Sun | 1   | 2   | 5   | 20  | 60  | 150 |
| ------ | ------- | --------- | ------- | --- | --- | --- | --- | --- | --- |
| radius | 7       | 9         | 22      | 35  | 42  | 53  | 77  | 105 | 136 |

**Classes (solar masses).** Names follow the brief; the video's "Blue Giant" and "Super Blue Giant" map to Blue Giant and Super Giant. Boundaries at 8 and 20 coincide with the death thresholds on purpose.

| Class       | Range                    | Colour                 | Note                  |
| ----------- | ------------------------ | ---------------------- | --------------------- |
| Planet      | below 10 Earth masses    | grey, tinted by status | can host life         |
| Gas Giant   | 10 Earth masses to 0.012 | blue, banded           |                       |
| Brown Dwarf | 0.012 to 0.08            | dark magenta           | never dies            |
| Red Dwarf   | 0.08 to 0.5              | orange-red             | never dies            |
| Yellow Star | 0.5 to 1.5               | yellow-white           | the Sun               |
| White Star  | 1.5 to 2.5               | white                  | Sun + Sun = 2         |
| Blue Star   | 2.5 to 8                 | blue-white             | Sun x 3 = 3           |
| Blue Giant  | 8 to 20                  | blue, large halo       | supernova, pulsar     |
| Super Giant | 20 to 60                 | deep blue              | supernova, black hole |
| Mega Giant  | above 60                 | violet-white           | hypernova, black hole |

**Luminosity, temperature, lifetime.** L = M^1.5 suns. Lifetime = 200 / sqrt(M) seconds (fuel over burn rate with squashed exponents). T = 5800 M^0.3 below one solar mass, M^0.5 above.

| M (suns) | 0.1   | 0.5  | 1    | 2    | 5     | 8     | 20    | 60    | 150   |
| -------- | ----- | ---- | ---- | ---- | ----- | ----- | ----- | ----- | ----- |
| L        | 0.03  | 0.35 | 1    | 2.8  | 11    | 23    | 89    | 465   | 1840  |
| T (K)    | 2900  | 4700 | 5800 | 8200 | 13000 | 16400 | 25900 | 44900 | 50000 |
| life (s) | never | 283  | 200  | 141  | 89    | 71    | 45    | 26    | 16    |

**Remnant labels.** White dwarf 100k Kelvin cooling to 10k over 60 s. Pulsar and magnetar 1,000k Kelvin. Black hole shows mass only. Protostar 1k to 3k Kelvin rising toward ignition.

**Deaths.** Below 0.5: never. 0.5 to 8: planetary nebula (ejected mass to dust) plus white dwarf of min(1.4, 0.6 sqrt(M)); the Sun drops to 0.6, so orbits go elliptical but stay bound. 8 to 20: supernova plus 1.5 solar mass neutron star, 90 percent pulsar, 10 percent magnetar. 20 and above: supernova plus black hole of 0.4 M. White dwarf above 1.4: Type Ia, no remnant. Blast radius 250 px plus 10 px per solar mass; planets and remnants inside are destroyed, stars get a 150 px/s radial kick.

**Dust.** Particle mass = ejected mass / particle count. Gravity from the 8 most massive bodies. Wind acceleration 4000 L / r^2 px/s^2 away from each star (about 0.04 px/s^2 at 300 px from a Sun, strong inside 100 px). Drag 0.05 per second. Collapse when a 64 px cell holds at least 0.05 solar masses of dust with velocity dispersion under 20 px/s; protostar time 20 s; ignition spawns 1 to 3 planets.

**Habitable zone and life.** Inner 0.8 AU sqrt(L), outer 1.6 AU sqrt(L): Sun 240 to 480 px, red dwarf 43 to 85 px, 3 solar mass blue star 578 to 1156 px. Stage thresholds in seconds of habitable time:

| Stage      | Simple Life | Complex Life | Intelligent Life | Early Civilizations | Farming Age | Industrial Age | Nuclear Age | Space Age |
| ---------- | ----------- | ------------ | ---------------- | ------------------- | ----------- | -------------- | ----------- | --------- |
| reached at | 20          | 45           | 65               | 80                  | 95          | 110            | 125         | 140       |

Nuclear Age lasts 15 s with a per-second hazard tuned so 50 percent of worlds reach nuclear war. Climate change hazard 15 percent across Industrial and Nuclear Ages. With a 200 s Sun, Space Age lands at 140 s, ships launch at 152, 164, and 176 s, and the red giant phase at 170 s sterilizes the home world, so colonies matter.

## Appendix B: pitfalls to design around

- **Multitouch:** touch-action none and friends must be present before the first touch, on every layer. Handle pointercancel like pointerup with zero velocity or bodies stay held forever. Move, up, and cancel listeners go on window so a drag that starts on a palette icon continues over the canvas. Fling from timestamps over the last 80 to 100 ms, not the last two events. Modifier buttons must be hittable by a second finger while the first holds the body. iPad edge swipes cannot be blocked in Safari; Add to Home Screen helps. iPad Pro runs at 120 Hz, so never assume a frame is 1/60 s.
- **Mouse:** one pointer at a time, so the L and O keys replace the second finger for modifiers. Ignore right and middle buttons and suppress contextmenu.
- **Perspective camera on a plane:** refit the camera on every resize or the plane no longer matches the viewport; verify with the round-trip test. All hit testing and physics use plane coordinates from the raycast, never screen pixels. Labels and rings are projected each frame, and a body's screen radius is its world radius scaled by the projection at its z. Keep the plane at z = 0 and the camera on the z axis until there is a reason to tilt.
- **Lighting:** eight star lights in a uniform array is the budget; pick by luminosity over distance to the planet being shaded is not possible per instance, so pick the eight brightest on screen and accept that a planet near a dim ninth star is lit by the eight. Stars themselves are emissive and unlit.
- **three.js and bloom:** on resize update the camera, renderer size, composer size, and both canvases' backing stores, or bloom goes blurry and labels drift. Cap pixel ratio at 2 (1.5 on iPad); bloom cost scales with real pixels. Keep planets, dust, and the starfield below the bloom threshold so only stars and coronas glow. Instance buffers are marked needsUpdate only when dirty. Particles and dust are single Points objects with preallocated buffers, DynamicDrawUsage, drawRange, additive blending, depthWrite off. Transparent effects (coronas, discs, beams, dust) render after opaque spheres and are sorted by distance.
- **HUD canvas:** clear and redraw every frame; batch text by font; skip labels for bodies off screen; keep the canvas `pointer-events: none` so touches reach the WebGL canvas beneath.
