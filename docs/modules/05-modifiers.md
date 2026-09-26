# Module 5: Modifiers, collisions, merging, toasts

## What was built

- `src/ui/modifiers.ts`: Lock (red dashed ring, padlock) and Orbit (green dashed ring, orbit glyph) toggles floating to the right of every held body. They answer pointerdown so a second finger can press them mid drag. Mouse users press L and O.
- Flags on `Body`: `locked`, `orbiting`, `primaryId`. In `src/sim/gravity.ts`: a locked body that is not orbiting is frozen in place; a locked body that is orbiting feels only its primary, so a passing star cannot disturb it; both still pull on everything. `World.release` puts an orbiting body on a circular orbit around its strongest pull whatever the finger did.
- `src/sim/collisions.ts`: bodies overlapping by more than `MERGE_OVERLAP` (0.85) of their combined radii merge. Mass adds, velocity is the momentum-weighted average, the new position is the centre of mass. The heavier body survives; if it is held or locked it does not move.
- `src/render/toasts.ts`: pill messages beside an event that fade after 2 s. Merges show nothing, as in the demo; deaths, ignitions, bursts, life stages, wars, and colonizations do.
- Padlock glyph before the name of a locked body, drawn on the HUD.
- Tests: merge conserves mass and momentum; a held survivor stays put; locked bodies do not move but still pull; lock plus orbit ignores an intruder; orbit release picks the strongest pull.

## Knobs

`MERGE_OVERLAP`, `TOAST_SECONDS` in `constants.ts`. `MODIFIER_GAP` in `modifiers.ts`.
