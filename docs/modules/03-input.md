# Module 3: Pointer input, mouse and touch

## What was built

Grab, drag, and fling any body with fingers or the mouse. A held body shows a dashed yellow ring, follows the pointer, and keeps pulling on everything else while gravity leaves it alone. Letting go hands it the pointer's recent velocity, scaled and capped. Throw a planet sideways past the Sun and its path bends into loops.

- `src/input/pointer.ts`: `PointerTracker`, one code path for mouse, touch, and pen through Pointer Events. Down is captured on the WebGL canvas; move, up, and cancel are on the window so a drag finishes wherever the finger lifts. Each pointer keeps a ring of the last sixteen plane-space samples with event timestamps; coalesced move events are unpacked so fast flicks are sampled fully. Right and middle mouse buttons are ignored; context menu, pinch gestures, and touch scrolling are suppressed. `estimateVelocity` is a pure function over the samples inside a time window before the release.
- `src/input/drag.ts`: `DragController` maps pointer ids to held bodies: hit test on down, pin on move, release with the fling velocity on up, release with zero velocity on cancel. `scaleFling` applies `FLING_SCALE` and caps at `FLING_MAX`.
- `src/sim/world.ts`: `bodyAt` (nearest unheld body whose hit radius covers the point), `grab`, `moveHeld`, `release`. `src/sim/gravity.ts` skips integration for held bodies. `Body.held` is the flag.
- `src/render/rings.ts`: the dashed yellow ring on held bodies, drawn on the HUD at the projected position.
- Tests: held bodies do not move but still pull; grab, move, and release do what they say; `bodyAt` picks the nearest and ignores held bodies; velocity estimation over a window, ignoring old samples and a stopped finger; fling scaling and capping.
- Also in this module: body sizes and the glow were recalibrated against the client's demo frames (see `02-simulation.md`), and the approved plan was copied into `docs/plan.md`.

## Formulas

**Release velocity.** Over the samples with `now - t <= FLING_WINDOW_MS` (90 ms), `v = (last - first) / (t_last - t_first)`. A window rather than the last two events averages out touch jitter, and a finger that paused before lifting gets zero because its samples are too old. Then `v = v * FLING_SCALE` (0.4) and the speed is capped at `FLING_MAX` (800 px/s). A natural flick is 500 to 1500 px/s, so a flick becomes 200 to 600 px/s: enough to escape the Sun from 300 px (267 px/s) but not to leave the table in a second.

**Hit test.** A body is under the pointer when the distance to its centre is at most `hitRadius = max(radius, MIN_HIT_RADIUS)`. Nearest wins. Held bodies are skipped so a second finger cannot steal one.

## Knobs worth turning

- `FLING_SCALE` and `FLING_MAX` in `src/sim/constants.ts`: 1.0 and 3000 turn every flick into a launch.
- `FLING_WINDOW_MS`: 20 makes throws twitchy, 300 makes them sluggish.
- `MIN_HIT_RADIUS`: how forgiving grabbing a 4 px planet is.
- Spawn a ring of planets in `seedDemoSystem` and throw the Sun through it.

## Talking points for Julian

- **Every finger is its own pointer.** The browser numbers them, so two fingers can hold two things at once and the code never confuses them.
- **The computer only hears where the finger is now.** Speed is worked out from where it was a moment ago. Look back too little and it is jumpy, too much and it is slow to notice a flick.
- **A held thing still pulls.** Hold the Sun and drag it; the planets chase it.
- **Falling and missing, with your own hand.** Last time we asked which way to throw the Earth so it goes round instead of in. Now he can try.

## Checkpoint

    npm run typecheck && npm run lint && npm test
    npm run dev:lan

On the Mac: drag the Earth away and let go, drag and flick, grab the Sun and pull it across the table. On the touch device (open the LAN URL): two fingers dragging two bodies at once; rotate the device mid-drag and nothing stays stuck.
