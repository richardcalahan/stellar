# Stellar Playground

A touch-driven n-body gravity sandbox. Drop stars and planets onto the table, watch them orbit, collide, merge, age, and die, seed nebulae that collapse into new stars, and grow civilizations that launch ships.

Built in ten modules, one per sitting. Each module's note in `docs/modules/` records what was built, the formulas, and the knobs worth turning.

## Run

    npm install
    npm run dev          # local
    npm run dev:lan      # also reachable from a touch device on the same network

Add `?debug` to the URL for frame timing and entity counts.

## Check

    npm run typecheck
    npm run lint
    npm test
    npm run build && npm run preview

## Layout

    src/sim       pure TypeScript physics, no DOM, no three.js; every tunable in constants.ts
    src/render    three.js world, fitted camera, effects, and the 2D HUD canvas
    src/input     pointer handling for mouse, touch, and pen
    src/ui        palettes, modifier toggles, info panel, debug overlay
    docs/modules  one note per module
