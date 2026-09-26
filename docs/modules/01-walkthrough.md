# Module 1 walkthrough: 30 minutes

Six stops, each with something to show, one thing to try, and one question to ask before you explain. Let Julian guess first every time; the guess is where the learning happens. Times are cumulative. If you run long, drop the experiment at stop 5 and keep the wrap.

## Before Julian sits down (5 minutes, not counted)

- Terminal 1: `npm run dev`. Terminal 2 free for `npm test`.
- Browser at `http://localhost:5173/?debug`, window not maximised so you can resize it.
- Editor tabs open in this order: `index.html`, `src/loop.ts`, `src/sim/constants.ts`, `src/render/camera.ts`, `src/render/renderer.ts`, `src/render/sun.ts`, `src/render/viewport.ts`.
- `git status` clean, so every knob you turn can be reverted at the end with `git checkout -- src`.
- Paper and a pen for the camera drawing at stop 3.

## 0:00 to 0:03. Look before code

**Show.** The page: one Sun, faint stars, the green readout top left. Resize the window a few times. Drag it to the other display if you have one.

**Ask.** "How many times a second do you think this picture is redrawn?" (Sixty on this Mac, one hundred twenty on an iPad Pro. Nothing on screen is kept; every frame is drawn from nothing.)

**Say.** Everything today is about that one fact. The rest of the project is what we draw and how things move between one drawing and the next.

## 0:03 to 0:07. What a build tool does

**Show.** `index.html`. Three elements and one script tag pointing at a `.ts` file.

**Ask.** "Can the browser run TypeScript?" (No. It only runs JavaScript.) "So how is this page working?"

**Say.** Vite sits between us and the browser. It translates each file as the browser asks for it, and when we save a file it reloads the page. For release, `npm run build` stitches everything into a few compressed files in `dist/`. We write in TypeScript because it catches mistakes before the page even loads.

**Try.** Change the `<title>` text, save, and watch the tab rename itself without a refresh.

## 0:07 to 0:12. The loop, and why the physics has its own clock

**Show.** `src/loop.ts`, the `tick` function. Point at `requestAnimationFrame`: the browser asking "what should I draw now?" and us answering. Then the `while` loop with the accumulator.

**Ask.** "If a slow frame takes twice as long, should the planets move twice as far?" (Yes, or the game runs slow. But if we move them by however long the frame took, every computer gets slightly different orbits.)

**Say.** So the simulation runs in fixed steps of `DT`, 240 a second, no matter what the screen does. Real time goes into a bucket, and we pay it out in whole steps. Leftover time waits for the next frame.

**Try.** In `src/sim/constants.ts` set `DT = 1 / 60`, save, and watch `substeps` in the readout drop to about 1. Then `DT = 1 / 1000`: `substeps` pins at 8, which is `MAX_SUBSTEPS`. Ask what happened to the other steps. (Dropped. On a slow machine the game goes into slow motion instead of freezing.) Put `DT` back to `1 / 240`.

## 0:12 to 0:18. The camera, or how 3D lines up with pixels

**Show.** `src/render/camera.ts`, the `heightFor` function. On paper draw a dot for the camera, a pyramid opening downward, and a flat line for the plane where the stars live. The plane has to be exactly as wide as the screen where the pyramid crosses it.

**Ask.** "If I make the window twice as tall, where does the camera have to go?" (Twice as high. The formula is half the height divided by tan of half the field of view.)

**Say.** Because the camera sits at exactly that height, one unit in the world is one pixel on screen on the plane. The physics can think in pixels while the renderer draws in 3D. Anything above the plane is closer to the camera and looks a bit bigger; that is our depth cue later for discs and jets.

**Try.** Set `CAMERA_FOV_DEG = 90`. The Sun stays the same size because the fit adapts, but it looks rounder and the stars shrink (the camera is now much closer to the plane, so the stars are far away by comparison). Set it to `10`: almost flat, like a map. Restore `30`. Then run `npm test` in terminal 2 and show the test that walks the corners of five screen sizes through screen to plane and back within a hundredth of a pixel. Tests are how we know the formula is right on screens we do not own.

## 0:18 to 0:23. Bloom, and why the Sun glows

**Show.** `src/render/renderer.ts`, the three passes and the three `BLOOM_` numbers. Then `src/render/sun.ts`, `SUN_COLOR` at 1.5, brighter than white.

**Ask.** "What does it mean for a colour to be brighter than 1.0 if the screen cannot show it?"

**Say.** After the frame is drawn, bloom takes every pixel above the threshold, blurs it, and adds the blur back on top. Only stars and coronas are allowed above 0.8, so only they glow. Brighter than 1.0 is how we tell bloom what glows and by how much. In `sun.ts` the `limb` line is why the edge of the disc is darker than the middle, which is also true of the real Sun.

**Try.** In `renderer.ts` set `BLOOM_STRENGTH = 0` and look at the raw picture: a flat disc and a soft corona quad, no glow. Restore `0.6`. Then `BLOOM_THRESHOLD = 0.3`: the stars glow too, because their brightness of 0.6 is now above the line. Ask why we keep them under. (Only suns should glow, and bloom costs pixels.) Restore `0.8`.

## 0:23 to 0:27. Three drawing layers

**Show.** Back to `index.html`: the WebGL canvas, the HUD canvas, the overlay div. Then `src/ui/styles.css`, the `pointer-events: none` lines. The readout you have been watching is drawn on the HUD canvas, not on the WebGL one.

**Ask.** "The GPU can draw a million triangles. Why not draw the text there too?" (It can, badly. GPUs have no idea what a letter is. A 2D canvas draws text for free and is hopeless at lighting. Buttons need real hit targets, so they stay HTML.)

**Say.** Each layer does the thing it is good at, and the top two let touches fall through to the world beneath, except on actual buttons.

**Try (skip if late).** In `src/render/viewport.ts` set `MAX_PIXEL_RATIO = 1`. On a Retina display the readout goes soft and the edge of the Sun goes jagged. That is device pixel ratio: two real pixels per CSS pixel, and we just threw one away. Restore `2`.

## 0:27 to 0:30. Wrap

- Revert the knobs: `git checkout -- src`, then `npm run typecheck && npm run lint && npm test` so he sees the three gates go green.
- Ask Julian to say back, in his own words, what the loop does, why the camera sits where it does, and what bloom is. Fix only what is wrong.
- Preview Module 2: next time the Sun gets company. Bodies placed in code will pull on each other with Newton's law and we will make a planet orbit.
- Question to carry until then: "If gravity were ten times stronger, would a planet at the same distance need to go faster or slower to stay in orbit?"
