# Module 10: Habitable worlds, civilizations, ships, and release

## What was built

- `src/sim/habitability.ts`: the habitable zone is `0.8 AU sqrt(L)` to `1.6 AU sqrt(L)` around the star whose light dominates: 240 to 480 px for the Sun. Inside is Lava Hot, outside is Frigid Ice, between is habitable. Habitable time accumulates in the zone and drains at half speed outside; stages are reached at 20, 45, 65, 80, 95, 110, 125, and 140 s: Simple Life through Space Age. The Nuclear Age carries a per-second hazard tuned so half of all worlds end in nuclear war (five seconds of surface flashes, then Dead World). Climate change claims 15 percent across the Industrial and Nuclear Ages. A red giant sterilizes.
- `src/sim/civilizations.ts`: a Space Age world founds a civilization with its own colour and launches a ship every 12 s at the nearest planet not already its own within 1500 px, up to 30 ships. A ship that lands on an unclaimed world starts colonizing (10 s, then Colonized, which launches at half rate). One that lands on a rival's world cooperates or attacks on a coin toss.
- Planet shader: lava cracks, ice, oceans and land that grow with life, city lights on the night side from the Industrial Age, nuclear flashes, a colonizing pulse, and ash for dead worlds. `src/render/ships.ts`: ships as small boxes in their colour, satellites circling spacefaring planets.
- `src/ui/info.ts`: the purple info buttons top and bottom (the top one rotated for the far player) open a panel with how to play, some science, and a hold-to-reset button. `src/ui/attract.ts`: three idle minutes reset the table.
- `src/render/adaptive.ts`: when frames go over budget for two seconds the pixel ratio drops a step, and climbs back when there is headroom.
- Labels show status and progress on the third and fourth lines.
- Tests: zone radii for the Sun, a red dwarf, and a 3 sun star; a planet at one AU reaches the Space Age on schedule when the dice are kind; lava and ice; a war world flashes then dies; ships colonize a neighbour.

## Checkpoint

    npm run typecheck && npm run lint && npm test
    npm run build && npm run preview

On the touch device: several Sun and planet systems, one goes nuclear, one reaches the Space Age and colonizes a lava-hot neighbour, and the table resets itself when left alone.

## Knobs

`STAGE_THRESHOLDS`, `NUCLEAR_WAR_CHANCE`, `CLIMATE_CHANCE`, `SHIP_INTERVAL`, `SHIP_SPEED`, `ATTRACT_IDLE_SECONDS`, `RESET_HOLD_MS` in `constants.ts`. `FRAME_BUDGET_MS` in `adaptive.ts`.
