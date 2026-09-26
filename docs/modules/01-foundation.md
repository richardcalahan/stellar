# Module 1: Foundation and renderer

## What was built

A full-screen starfield with one glowing Sun that survives any resize or display change, a debug overlay, a fullscreen button, and a green toolchain. Nothing moves yet except the Sun's pulse and the twinkle of the stars, which is enough to prove the loop is alive.

- **Toolchain.** Vite for dev server and bundling, TypeScript in strict mode with `noUncheckedIndexedAccess`, ESLint with typescript-eslint's strict type-checked rules, Prettier, Vitest for tests, three.js for rendering. Scripts: `dev`, `dev:lan`, `build`, `preview`, `typecheck`, `lint`, `test`, `format`.
- **Three drawing layers** in `index.html`: a WebGL canvas for the world, a 2D canvas above it for text and thin geometry, a DOM overlay above that for real buttons. The upper two layers are `pointer-events: none` except on actual controls, so fingers reach the world.
- `src/render/camera.ts`: `PlaneCamera`, a perspective camera fitted so the z = 0 plane fills the viewport exactly, with `project` (world to screen) and `screenToPlane` (screen to world by raycast). Tested in Node.
- `src/render/renderer.ts`: `WorldRenderer` owns the WebGL renderer, the scene, the camera, and the post-processing chain (render, bloom, output). One `resize` refits everything, including registered `Resizable`s.
- `src/render/starfield.ts`: two thousand points in a slab far below the plane, custom shader with exact size attenuation and a per-star twinkle, brightness kept under the bloom threshold.
- `src/render/sun.ts`: the placeholder Sun. A sphere with limb darkening whose colour is above 1.0 so bloom picks it up, plus a billboard corona with a soft halo and a faint four-point flare, additively blended.
- `src/render/hud.ts`: the 2D canvas layer with device-pixel-ratio handling and `drawText` / `drawRing` helpers. Only the debug overlay draws on it so far.
- `src/loop.ts`: the frame loop with a fixed-step accumulator and smoothed timing.
- `src/ui/debug.ts`, `fullscreen.ts`, `wakelock.ts`: the `?debug` readout, the fullscreen button, and a screen wake lock. `public/manifest.webmanifest` and the iOS meta tags make Add to Home Screen work on an iPad.
- `src/sim/constants.ts` holds the clock (`DT`, `MAX_SUBSTEPS`, `MAX_FRAME_SECONDS`). `src/sim/random.ts` is a seeded random generator so tests and scenes are repeatable.

## Formulas

**Camera height.** With vertical field of view `fov` and a viewport `h` pixels tall, the camera sits at

    H = (h / 2) / tan(fov / 2)

above the plane. At 30 degrees that is about 1.87 h. At that height the plane spans exactly the viewport, so one world unit on the plane is one CSS pixel. Anything at height z above the plane is scaled by

    H / (H - z)

so an object 40 units up on a 1080-pixel viewport grows by about 2 percent. That is the depth cue we will use for discs, jets, and satellites.

**Fixed step.** Each frame the real elapsed time (clamped to `MAX_FRAME_SECONDS`) is added to an accumulator, and the simulation runs `DT` at a time while the accumulator has at least `DT` in it, up to `MAX_SUBSTEPS` times. The leftover carries into the next frame. If the frame is still behind after the cap, the backlog is dropped, so a slow frame costs a moment of slow motion instead of an ever-growing debt.

**Star size on screen.** A point of `aSize` world units at view depth `d` covers `aSize * S / d` device pixels, where `S = (h * pixelRatio) / (2 tan(fov / 2))` is the projection scale. This is the same relation as the camera height above, which is why one unit at roughly twice the camera height is about one pixel.

## Knobs worth turning

- `CAMERA_FOV_DEG` in `camera.ts`: 30 degrees gives a slight 3D feel. Try 10 for a near-orthographic view and 60 for a fish-eye. The tests still pass because the fit formula adapts.
- `BLOOM_THRESHOLD`, `BLOOM_STRENGTH`, `BLOOM_RADIUS` in `renderer.ts`: threshold below 0.6 makes the starfield glow too.
- `SUN_COLOR` in `sun.ts`: drop it below 1.0 and the bloom disappears, which shows what bloom is actually keyed on.
- `STAR_COUNT`, `STAR_BRIGHTNESS`, `STARFIELD_NEAR_Z` / `STARFIELD_FAR_Z` in `starfield.ts`.
- `DT` and `MAX_SUBSTEPS` in `constants.ts`: nothing to see until Module 2, but the debug overlay shows how many steps each frame runs.
- `MAX_PIXEL_RATIO` in `viewport.ts`: set it to 1 and look at the text on a Retina display.

## Talking points for Julian

- **What a build tool does.** The browser only understands JavaScript, CSS, and HTML. Vite turns our TypeScript into JavaScript on the fly while we work, reloads the page when a file changes, and for release stitches everything into a few compressed files.
- **The render loop.** The browser asks us to draw once per screen refresh through `requestAnimationFrame`. Our `Loop` answers that call, advances the physics, and draws.
- **Why simulation time is separate from frame time.** Screens refresh at 60, 90, or 120 times a second, and a busy frame can take longer. If physics moved by however long the frame took, orbits would drift differently on every machine. Fixed steps plus an accumulator make the physics identical everywhere; only the drawing rate varies.
- **How the camera is fitted.** A perspective camera sees a pyramid. Place it exactly high enough that the pyramid's cross-section at the plane matches the screen, and pixels and world units line up. Everything closer to the camera looks bigger, which is how we get depth without giving up the flat playfield.
- **What bloom is.** After the frame is drawn, the parts brighter than a threshold are blurred and added back on top. Only stars and coronas are allowed above the threshold, so only they glow.
- **Why three drawing layers.** The GPU is brilliant at millions of triangles and poor at text. A 2D canvas is brilliant at text and poor at lighting. Buttons need real hit targets, focus, and accessibility, which HTML gives for free. Each layer does the thing it is good at.

## Checkpoint

    npm run typecheck && npm run lint && npm test
    npm run dev

Open the URL, then add `?debug` for the readout. Resize the window, drag it to another display, and zoom the browser: the Sun stays round, centred, and about 35 px in radius, the corona glows, and the debug text stays sharp.
