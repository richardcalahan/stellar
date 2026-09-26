/**
 * A deterministic random number generator (mulberry32). The same seed gives
 * the same sequence in Node and in the browser, which is what makes the
 * simulation testable and lets a scene be replayed exactly.
 */
export type Random = () => number;

/** Returns a function that yields numbers in [0, 1), like Math.random, from the given seed. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
