# Module 2 walkthrough: 30 minutes

Pitched at Julian: one picture per idea, he guesses first, no formulas. Every knob is a one-line edit; the page reloads on save. Times are cumulative. If you run long, skip the bumper at stop 3.

## Before Julian sits down (5 minutes, not counted)

- Terminal 1: `npm run dev`. Terminal 2 free for `npm test`.
- Browser at `http://localhost:5173/?debug`.
- Editor tabs: `src/main.ts` (scroll to `seedDemoSystem`), `src/sim/constants.ts`, `src/sim/gravity.ts`.
- `git status` clean, so every knob can be undone at the end with `git checkout -- src`.
- Something round and a flashlight for stop 5, if you have them handy.

## 0:00 to 0:03. Look

**Show.** Four things going round the Sun, each wearing a name tag. Let him watch a full lap of the Earth (ten seconds).

**Ask.** "Which one is us?" (The one called Planet with the 1.0 tag, at the same distance as the real Earth, scaled down.) "Why does it keep going round instead of flying off or falling in?"

Do not answer yet. That question is the whole session.

## 0:03 to 0:08. Everything pulls on everything

**Say.** Every body here is a magnet that never switches off. The Sun is a huge magnet. The Earth is a tiny one. Heavier pulls harder. Farther away pulls much less.

**Ask.** "If I stop the Earth dead and let go, where does it go?" Let him say it.

**Try.** In `seedDemoSystem`, change the Earth's `vy: circular(AU)` to `vy: 0`. Save. It falls straight into the Sun and out the other side, because nothing bumps into anything yet. (That is Module 5.)

**Ask.** "So how does the real Earth not fall in?" (It is moving sideways, fast.)

**Say.** Newton's cannon: fire a cannonball off a mountain and it curves down and lands. Fire it harder, it lands farther. Fire it hard enough and it curves down at exactly the rate the ground curves away, so it never lands. It is falling the whole time and always missing. That is an orbit.

**Try.** Put the Earth back to `vy: circular(AU)`. Then `vy: 0.7 * circular(AU)`: an egg shape, close and fast on one side, far and slow on the other. Then `vy: 1.42 * circular(AU)`: it never comes back. Ask which one is "too slow" and which is "too fast". Restore `circular(AU)`.

## 0:08 to 0:13. Stronger magnets

**Ask.** "If I make every magnet ten times stronger and change nothing else, do the planets go faster, slower, or fall in?" This is the question you sent him home with last time.

**Try.** In `constants.ts` add `* 10` to the end of the `G` line. Save. They all dive inward, because the sideways speed that used to be enough is now far too slow. Remove the `* 10`.

**Say.** In our world a year takes ten seconds and the Sun weighs 333,000 Earths. Show him `SOLAR` and `T_REF` in `constants.ts`. Those two numbers are the only "made up" ones; the strength of gravity is worked out from them so the Earth takes exactly ten seconds to go round.

**Skip if late. The bumper.** Set `SOFTENING = 0`, put the Earth's `vy` back to `0`, and watch it get flung out when it passes through the Sun's centre. The bumper (`SOFTENING = 8`) stops two things pulling infinitely hard when they touch. Restore both.

## 0:13 to 0:18. Turn, then step

**Show.** `gravity.ts`, the two little loops at the bottom. The computer moves everything in tiny steps, 240 a second. There are two ways to take a step: turn then step, or step then turn.

**Ask.** "If you walk a circle with your eyes closed, one step at a time, and you always step before you turn, do you stay on the circle?"

**Try.** In `constants.ts` change `USE_SEMI_IMPLICIT_EULER` from `true` to `false`. Save and wait. Over half a minute the orbits grow and grow; the Earth drifts outward every lap. Then run `npm test` in terminal 2 and show him the one test that goes red: the computer noticed the Earth gaining energy from nowhere. Set it back to `true` and run the tests again.

**Say.** Step-then-turn is the obvious way and it is wrong. Turn-then-step keeps every orbit where it belongs forever. This is the single most important line of code in the whole game.

## 0:18 to 0:23. One cookie cutter, and a flashlight

**Show.** Watch the Earth for a lap. Its bright side always faces the Sun.

**Ask.** "Which side of the Earth is night right now?" Let him point.

**Say.** Hold the ball in front of the flashlight if you have them. Every dot on the surface asks "am I facing the light?" and glows if it is. The computer does that for every dot on every planet, every frame.

**Say.** The other trick: there is only one ball shape in the whole game. The graphics card gets one cookie cutter and a list of two hundred places to stamp it and how big. That is how it can draw every body in one go.

**Try.** In `seedDemoSystem` change the Earth's `mass` from `PALETTE_MASSES.planet` to `PALETTE_MASSES.redDwarf`. Save. Its name tag changes, it glows red, it grows a corona, and the gas giant is now lit from two sides. Ask why it got bigger. (Heavier things are bigger.) Restore `PALETTE_MASSES.planet`.

## 0:23 to 0:27. His turn

Let Julian pick one number to change, anything in `seedDemoSystem` or the top of `constants.ts`, and predict out loud what will happen before he saves. Then run it. If the prediction was wrong, that is the good outcome; ask him why it went the other way.

## 0:27 to 0:30. Wrap

- Undo everything: `git checkout -- src`. Then `npm run typecheck && npm run lint && npm test` so he sees the gates go green.
- Ask him to explain, in his own words, why the Earth does not fall into the Sun, and what "turn, then step" means. Fix only what is wrong.
- Preview Module 3: next time he gets to grab any planet with a finger and throw it.
- Question to carry until then: "If you pick up the Earth and throw it, which way do you throw it so it goes round the Sun instead of into it?"
