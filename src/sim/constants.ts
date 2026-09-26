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
export const T_REF = 25;

/**
 * The gravitational constant in world units, from Kepler's third law
 * T^2 = 4 pi^2 a^3 / (G M) with a = AU, M = SOLAR, T = T_REF. About 5.1 at T_REF 25.
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

/**
 * Radius in world units is RADIUS_BASE + RADIUS_SCALE * M^exp with M in solar masses.
 * Calibrated against the client's demo at 1080p, where a one solar mass star reads about
 * 7 px in radius and a planet about 4 px: Earth 4.1, gas giant 4.4, red dwarf 5.7, Sun 7,
 * blue giant 10.2, super giant 11.5. Touch targets are handled separately by
 * MIN_HIT_RADIUS, so small bodies stay easy to grab.
 */
export const RADIUS_BASE = 4;
export const RADIUS_SCALE = 3;
/**
 * Planets and gas giants use their own gentler law so they stay visible next to a
 * 7 px Sun: PLANET_RADIUS_BASE + PLANET_RADIUS_LOG_SCALE * log10(mass + 1) with mass
 * in Earth masses. Earth 5.7, gas giant 6.5.
 */
export const PLANET_RADIUS_BASE = 5.5;
export const PLANET_RADIUS_LOG_SCALE = 0.5;
/** Exponent below one solar mass. */
export const RADIUS_EXP_SMALL = 0.25;
/** Exponent at one solar mass and above. */
export const RADIUS_EXP_LARGE = 0.3;

/** Luminosity in suns is M^LUMINOSITY_EXP, a squashed mass-luminosity relation. */
export const LUMINOSITY_EXP = 1.5;

// Stellar evolution (Module 6)

/** Seconds of stellar age per simulated second. 1 means the Sun lives 200 seconds on the table. */
export const TIME_SCALE = 1;

/** Surface temperature of a one solar mass star, in Kelvin. */
export const SUN_TEMPERATURE = 5800;
/** Temperature scales as M^exp: this exponent below one solar mass, the next at and above. */
export const TEMPERATURE_EXP_SMALL = 0.3;
export const TEMPERATURE_EXP_LARGE = 0.5;
export const TEMPERATURE_MAX = 50000;

/** Lifetime in seconds is LIFETIME_SCALE / sqrt(M): fuel over burn rate, exponents squashed for play. */
export const LIFETIME_SCALE = 200;
/** Stars below this many solar masses never die. */
export const IMMORTAL_BELOW = 0.5;

/** The last fraction of a star's life is spent swollen and red. */
export const RED_GIANT_FRACTION = 0.15;
export const RED_GIANT_RADIUS = 2.5;
export const RED_GIANT_TEMPERATURE = 3500;
export const RED_GIANT_LUMINOSITY = 4;

// Stellar death (Module 7)

/** Below this many solar masses a star dies as a planetary nebula plus a white dwarf. */
export const NEBULA_BELOW = 8;
/** At and above this many solar masses a supernova leaves a black hole; between, a neutron star. */
export const BLACK_HOLE_FROM = 20;
/** White dwarf mass in suns is min(WHITE_DWARF_MAX, WHITE_DWARF_FACTOR * sqrt(M)). Above the max it detonates. */
export const WHITE_DWARF_MAX = 1.4;
export const WHITE_DWARF_FACTOR = 0.6;
/** A fresh white dwarf starts this hot and cools to the end temperature over the cooling time. */
export const WHITE_DWARF_TEMPERATURE_START = 100000;
export const WHITE_DWARF_TEMPERATURE_END = 10000;
export const WHITE_DWARF_COOL_SECONDS = 60;
export const NEUTRON_STAR_MASS = 1.5;
export const MAGNETAR_CHANCE = 0.1;
export const NEUTRON_STAR_TEMPERATURE = 1000000;
/** A black hole keeps this fraction of the star's mass. */
export const BLACK_HOLE_FRACTION = 0.4;
/** Supernova blast radius in world units: base plus this much per solar mass of the star. */
export const BLAST_RADIUS_BASE = 250;
export const BLAST_RADIUS_PER_SUN = 10;
/** Radial speed kick given to stars caught in a blast, in world units per second. */
export const BLAST_KICK = 60;

/** Protostars take this long to ignite. */
export const PROTOSTAR_TIME = 20;
export const PROTOSTAR_TEMPERATURE_START = 1000;
export const PROTOSTAR_TEMPERATURE_END = 3000;
/** Planets a protostar forms as it ignites: count range, mass range in Earths, orbit range in world units. */
export const IGNITION_PLANETS_MIN = 1;
export const IGNITION_PLANETS_MAX = 3;
export const IGNITION_PLANET_MASS_MIN = 1;
export const IGNITION_PLANET_MASS_MAX = 10;
export const IGNITION_ORBIT_MIN = 120;
export const IGNITION_ORBIT_MAX = 300;

// Dust and star formation (Module 9)

/** Most dust particles alive at once. */
export const DUST_MAX = 12000;
/** Dust advances once every this many simulation steps, with a correspondingly larger dt. */
export const DUST_EVERY = 4;
/** Dust feels gravity and wind from only the most massive bodies, this many of them. */
export const DUST_SOURCES = 8;
/** Softening for dust gravity, larger than for bodies so a star does not slingshot grains. */
export const DUST_SOFTENING = 40;
/**
 * Solar wind pushes dust away from a star with an acceleration of
 * WIND_TO_GRAVITY times what a one solar mass star's gravity would pull,
 * scaled by luminosity. Above 1 the Sun clears dust; red dwarfs, dim for
 * their mass, gather it; black holes, dark, swallow it.
 */
export const WIND_TO_GRAVITY = 1.3;
/** Fraction of dust speed lost per second, so nebulae slow down and can clump. */
export const DUST_DRAG = 0.12;
/** Dust inside this many black hole radii is swallowed. */
export const BLACK_HOLE_DUST_REACH = 4;
/** Clump detection: grid cell size, minimum cell mass in solar masses, maximum velocity spread. */
export const COLLAPSE_CELL = 64;
export const COLLAPSE_MASS = 0.02;
export const COLLAPSE_SPEED = 30;
export const COLLAPSE_INTERVAL = 0.5;
/** Ejected mass becomes this many particles per solar mass, within a floor and a ceiling. */
export const DUST_PER_SUN = 5000;
export const DUST_EMIT_MIN = 600;
export const DUST_EMIT_MAX = 5000;
/** Outward speed of a planetary nebula and of supernova ejecta, in world units per second. */
export const NEBULA_DUST_SPEED = 35;
export const SUPERNOVA_DUST_SPEED = 200;

// Habitable worlds and civilizations (Module 10)

/** Habitable zone edges in AU for a one sun star; scale with sqrt of luminosity. */
export const HABITABLE_INNER_AU = 0.8;
export const HABITABLE_OUTER_AU = 1.6;
/** Habitable time drains at this fraction of real time while a planet is out of the zone. */
export const HABITABLE_DRAIN = 0.5;
/** Seconds of habitable time at which each life stage is reached. */
export const STAGE_THRESHOLDS = {
  simple: 20,
  complex: 45,
  intelligent: 65,
  earlyCiv: 80,
  farming: 95,
  industrial: 110,
  nuclear: 125,
  spaceAge: 140,
} as const;
/** The Nuclear Age lasts this long, and this fraction of worlds destroy themselves during it. */
export const NUCLEAR_AGE_SECONDS = 15;
export const NUCLEAR_WAR_CHANCE = 0.5;
/** Climate change claims this fraction of worlds across the Industrial and Nuclear Ages. */
export const CLIMATE_CHANCE = 0.15;
export const CLIMATE_WINDOW_SECONDS = 30;
/** Flashes on the surface before a nuclear war world goes dark. */
export const WAR_FLASH_SECONDS = 5;
export const COLONIZE_SECONDS = 10;
export const SHIP_INTERVAL = 12;
export const SHIP_SPEED = 200;
export const SHIP_RANGE = 1500;
export const SHIP_CAP = 30;
export const COOPERATE_CHANCE = 0.5;
/** Seconds of idleness before the table resets itself and plays a demo. */
export const ATTRACT_IDLE_SECONDS = 180;
/** Milliseconds the reset button must be held, so a public table cannot be wiped by a brush. */
export const RESET_HOLD_MS = 800;

// Black holes (Module 8)

/** Bodies farther than this from the centre of the table are removed. */
export const TABLE_RADIUS = 3000;

// Collisions (Module 5)

/** Two bodies merge when their centres are closer than this fraction of their combined radii. */
export const MERGE_OVERLAP = 0.85;

/** Seconds an event toast stays on screen. */
export const TOAST_SECONDS = 2;

// Touch and fling (Module 3)

/** A flick is scaled by this before it becomes the body's velocity. A natural flick is 500 to 1500 px/s. */
export const FLING_SCALE = 0.16;

/** Fastest release speed in px/s, whatever the finger did. */
export const FLING_MAX = 320;

/** Release velocity comes from the pointer samples inside this many milliseconds before the release. */
export const FLING_WINDOW_MS = 90;

/**
 * Below this release speed (px/s, before scaling) the finger did not flick, so
 * a body put down keeps the motion it had when it was picked up. A tap on an
 * orbiting planet then leaves its orbit alone.
 */
export const FLING_MIN = 60;

/** Bodies dragged in from a palette start with Orbit switched on. */
export const ORBIT_BY_DEFAULT = false as boolean;
