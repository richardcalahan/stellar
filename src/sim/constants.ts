/**
 * Every number that shapes play lives in this file, so exploring the physics
 * is a one-line edit. Sections are added module by module.
 */

// Clock (Module 1)

/** Fixed simulation step in seconds. 240 steps per second keeps fast orbits stable. */
export const DT = 1 / 240;

/** The most simulation steps one frame may run before we drop time instead of catching up. */
export const MAX_SUBSTEPS = 8;

/**
 * The longest real-time gap a single frame is allowed to account for, in seconds.
 * A tab coming back from the background gets this much, not a minute of catch-up.
 */
export const MAX_FRAME_SECONDS = 0.25;

// Units and gravity (Module 2)

/** Mass is measured in Earth masses everywhere. This is one solar mass in those units. */
export const SOLAR = 333000;

/** One astronomical unit on the table, in world units (CSS pixels on the plane). */
export const AU = 300;

/**
 * Seconds for an Earth-mass body to circle a one-solar-mass star at one AU.
 * Pick this, and Kepler's third law fixes G.
 */
export const T_REF = 10;

/**
 * The gravitational constant in world units, from Kepler's third law
 * T^2 = 4 pi^2 a^3 / (G M) with a = AU, M = SOLAR, T = T_REF. About 32.
 */
export const G = (4 * Math.PI ** 2 * AU ** 3) / (T_REF ** 2 * SOLAR);

/**
 * Softening length in world units. Gravity uses r^2 + SOFTENING^2 instead of
 * r^2, so two bodies that pass through each other feel a large but finite pull
 * instead of an infinite one.
 */
export const SOFTENING = 8;

/**
 * Update velocity first, then position with the new velocity (semi-implicit
 * Euler). Set to false for plain Euler (position first) and watch orbits
 * spiral outward: the energy test fails on purpose.
 */
export const USE_SEMI_IMPLICIT_EULER = true as boolean;

/** Body cap. The pair loop costs about 15 ns per pair, so 200 bodies is about 1.2 ms per frame. */
export const MAX_BODIES = 200;

/** A finger needs a target at least this big, in world units. */
export const MIN_HIT_RADIUS = 24;

/** Palette masses in Earth masses: the Sun, a red dwarf, a gas giant, a planet. */
export const PALETTE_MASSES = {
  sun: SOLAR,
  redDwarf: 0.1 * SOLAR,
  gasGiant: 100,
  planet: 1,
} as const;

// Stellar classes (Module 2 names and sizes; Module 6 adds temperature and lifetime)

/** Lower mass bound of each class in solar masses. Below the first bound is a planet. */
export const CLASS_BOUNDS = {
  gasGiant: 10 / SOLAR,
  brownDwarf: 0.012,
  redDwarf: 0.08,
  yellow: 0.5,
  white: 1.5,
  blue: 2.5,
  blueGiant: 8,
  superGiant: 20,
  megaGiant: 60,
} as const;

/** Radius in world units is RADIUS_BASE + RADIUS_SCALE * M^exp with M in solar masses. */
export const RADIUS_BASE = 6;
export const RADIUS_SCALE = 29;
/** Exponent below one solar mass. */
export const RADIUS_EXP_SMALL = 0.25;
/** Exponent at one solar mass and above. */
export const RADIUS_EXP_LARGE = 0.3;

/** Luminosity in suns is M^LUMINOSITY_EXP, a squashed mass-luminosity relation. */
export const LUMINOSITY_EXP = 1.5;
