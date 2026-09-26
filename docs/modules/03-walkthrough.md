# Module 3 walkthrough: 30 minutes

Pitched at Julian. This one is mostly hands on: he gets to grab things. Times are cumulative.

## Before Julian sits down (5 minutes, not counted)

- Terminal 1: `npm run dev:lan`. Terminal 2 free for `npm test`.
- Browser at `http://localhost:5173/`. If you have the touch device, open the LAN URL Vite printed.
- Editor tabs: `src/sim/constants.ts` (scroll to the fling section), `src/input/pointer.ts`.
- `git status` clean.

## 0:00 to 0:06. His hands on the Sun

**Ask.** "Which way do you throw the Earth so it goes round the Sun instead of into it?" (His question from last time. Let him answer, then let him try.)

**Try.** Grab the Earth with the mouse and drop it somewhere new. Drag and flick it. Try flicking straight at the Sun, then sideways. Sideways loops; straight in falls through.

**Say.** Nothing new in the physics. All we added is a way to put a planet somewhere with a speed. The Sun does the rest.

## 0:06 to 0:12. Every finger is a pointer

**Show.** If you have the touch device: two fingers, two bodies, at once. On the Mac, the mouse is one finger.

**Ask.** "How does the computer know which finger is which?"

**Say.** The browser gives every finger a number when it touches and keeps that number until it lifts. Show `pointers` in `pointer.ts`: a list keyed by that number. A mouse is just finger number one that never lifts.

**Try.** Grab the Sun and drag it around. The planets chase it. Ask why. (It still pulls while you hold it; it just does not get pulled back.)

## 0:12 to 0:18. How fast was that flick?

**Ask.** "The computer only ever hears where your finger is. How can it know how fast you moved?"

**Say.** It remembers where the finger was a moment ago and compares. Show `estimateVelocity` in `pointer.ts`: it looks at the last 90 milliseconds.

**Try.** In `constants.ts` set `FLING_WINDOW_MS = 20`: throws get twitchy, because it only looks at the last tiny wiggle. Set it to `400`: throws feel late and slow. Restore `90`. Then `FLING_SCALE = 1.0`: every flick is a cannon. Restore `0.4`.

## 0:18 to 0:24. Falling and missing, for real

**Try.** Have him put the Earth in a good orbit by hand: hold it out to the side, flick sideways, adjust. Then a fast one that escapes. Then an egg. Each time ask him to predict before letting go.

**Say.** This is exactly what a rocket does: it does not go up, it goes sideways very fast.

## 0:24 to 0:27. Run the tests

Run `npm test` in terminal 2. Point at the test named "do not move under gravity but still pull on their neighbours" and ask him what it checks. Then the one about the finger that stopped before lifting. Tests are the computer checking our promises.

## 0:27 to 0:30. Wrap

- Undo any knobs: `git checkout -- src`. Gates green.
- Ask him: why does a held Sun still pull the planets? What does the computer look at to know how fast a flick was?
- Preview Module 4: next time, the cards in the corners, so he can pull brand new suns and planets onto the table.
- Question to carry: "If you could drop a planet anywhere near the Sun and it started at just the right speed on its own, how would the computer know what speed that is?"
