# Module 4: Palettes, orbits, rings, trails

## What was built

- `src/ui/layout.ts`: card placement by screen size. Four corner cards below 2560 px wide, with the top pair rotated 180 degrees for the player across the table; three top, three bottom, one each side on a 4K table. Tested at 1920 and 3840.
- `src/ui/palettes.ts`: the "Touch and Drag" cards as DOM buttons. A pointerdown on an icon empties the slot, spawns the body under the finger, and hands the pointer to the drag controller, so touching an icon and dragging onto the table is one gesture. The slot fills back in on release. Cards grey out when the table is full.
- `src/input/pointer.ts` gained `adopt`, which takes over a pointer whose pointerdown happened on a card.
- `src/sim/orbits.ts`: `circularVelocity` (perpendicular to the radius, on top of the primary's own motion) and `nearestMostMassive` (mass over distance squared, so a Sun at 400 px beats a red dwarf at 300).
- `src/render/rings.ts`: the dashed green orbit preview while a held body has Orbit on, and thin green orbit paths under bodies circling a locked star.
- `src/render/trails.ts`: every body's path as one LineSegments draw call. Each body owns a ring of 120 segments in a shared buffer; every vertex carries the time it was written and the shader fades it against the current time, so old segments fade without the CPU touching them.

## Formulas

Circular speed `v = sqrt(G M / r)`. Kepler: 150 px takes 3.5 s, 500 px takes 21 s. Escape speed is `sqrt(2)` times circular.

## Knobs

`WIDE_LAYOUT_MIN_WIDTH`, `CARD_INSET_X` in `layout.ts`. `TRAIL_POINTS` and `TRAIL_INTERVAL` in `trails.ts` for trail length. In `orbits.ts`, multiply the speed by 0.7 for an ellipse or 1.42 for an escape, or flip the sign for retrograde.
