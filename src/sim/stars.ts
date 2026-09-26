import { blackbodyRGB } from './blackbody';
import {
  CLASS_BOUNDS,
  IMMORTAL_BELOW,
  LIFETIME_SCALE,
  LUMINOSITY_EXP,
  MIN_HIT_RADIUS,
  NEUTRON_STAR_TEMPERATURE,
  PLANET_RADIUS_BASE,
  PLANET_RADIUS_LOG_SCALE,
  PROTOSTAR_TEMPERATURE_END,
  PROTOSTAR_TEMPERATURE_START,
  PROTOSTAR_TIME,
  RADIUS_BASE,
  RADIUS_EXP_LARGE,
  RADIUS_EXP_SMALL,
  RADIUS_SCALE,
  RED_GIANT_LUMINOSITY,
  RED_GIANT_RADIUS,
  RED_GIANT_TEMPERATURE,
  SOLAR,
  SUN_TEMPERATURE,
  TEMPERATURE_EXP_LARGE,
  TEMPERATURE_EXP_SMALL,
  TEMPERATURE_MAX,
  WHITE_DWARF_COOL_SECONDS,
  WHITE_DWARF_TEMPERATURE_END,
  WHITE_DWARF_TEMPERATURE_START,
} from './constants';
import type { Body, LifeStage, PlanetStatus, RGB, Remnant, StarClass } from './types';

/** Mass alone decides what a body is. Bounds are in solar masses. */
export function classify(massEarth: number): StarClass {
  const m = massEarth / SOLAR;
  if (m >= CLASS_BOUNDS.megaGiant) return 'megaGiant';
  if (m >= CLASS_BOUNDS.superGiant) return 'superGiant';
  if (m >= CLASS_BOUNDS.blueGiant) return 'blueGiant';
  if (m >= CLASS_BOUNDS.blue) return 'blue';
  if (m >= CLASS_BOUNDS.white) return 'white';
  if (m >= CLASS_BOUNDS.yellow) return 'yellow';
  if (m >= CLASS_BOUNDS.redDwarf) return 'redDwarf';
  if (m >= CLASS_BOUNDS.brownDwarf) return 'brownDwarf';
  if (m >= CLASS_BOUNDS.gasGiant) return 'gasGiant';
  return 'planet';
}

export const CLASS_NAMES: Record<StarClass, string> = {
  planet: 'Planet',
  gasGiant: 'Gas Giant',
  brownDwarf: 'Brown Dwarf',
  redDwarf: 'Red Dwarf',
  yellow: 'Yellow Star',
  white: 'White Star',
  blue: 'Blue Star',
  blueGiant: 'Blue Giant',
  superGiant: 'Super Giant',
  megaGiant: 'Mega Giant',
};

export const REMNANT_NAMES: Record<Remnant, string> = {
  protostar: 'Protostar',
  whiteDwarf: 'White Dwarf',
  pulsar: 'Pulsar',
  magnetar: 'Magnetar',
  blackHole: 'Blackhole',
};

export const STAGE_NAMES: Record<LifeStage, string> = {
  none: '',
  simple: 'Simple Life',
  complex: 'Complex Life',
  intelligent: 'Intelligent Life',
  earlyCiv: 'Early Civilizations',
  farming: 'Farming Age',
  industrial: 'Industrial Age',
  nuclear: 'Nuclear Age',
  spaceAge: 'Space Age',
};

export const STATUS_NAMES: Record<PlanetStatus, string> = {
  none: '',
  lavaHot: 'Lava Hot',
  frigidIce: 'Frigid Ice',
  habitable: '',
  nuclearWar: 'NUCLEAR WAR',
  deadWorld: 'Dead World',
  colonizing: 'Colonizing',
  colonized: 'Colonized',
};

/** Hand-picked colours for the bodies that are not black bodies. */
export const FIXED_COLORS: Record<
  'planet' | 'gasGiant' | 'blackHole' | 'pulsar' | 'magnetar',
  RGB
> = {
  planet: [0.72, 0.74, 0.78],
  gasGiant: [0.45, 0.6, 0.95],
  blackHole: [0, 0, 0],
  pulsar: [0.3, 1.0, 0.95],
  magnetar: [0.75, 0.4, 1.0],
};

/** What a body is called on its label. */
export function nameOf(body: Body): string {
  return body.remnant ? REMNANT_NAMES[body.remnant] : CLASS_NAMES[body.starClass];
}

/** Stars shine and get coronas. Planets and gas giants are lit by them. */
export function isStar(starClass: StarClass): boolean {
  return starClass !== 'planet' && starClass !== 'gasGiant';
}

/** Anything that emits light: a star, or a remnant other than a black hole. */
export function shines(body: Body): boolean {
  if (body.remnant) return body.remnant !== 'blackHole';
  return isStar(body.starClass);
}

/** Planets and gas giants, the things that get lit and can host life. */
export function isWorld(body: Body): boolean {
  return body.remnant === null && !isStar(body.starClass);
}

export function isCompact(body: Body): boolean {
  return body.remnant === 'pulsar' || body.remnant === 'magnetar' || body.remnant === 'blackHole';
}

/** World units. Grows slowly with mass so a blue giant is big but still fits on the table. */
export function radiusFor(massEarth: number): number {
  if (!isStar(classify(massEarth))) {
    return PLANET_RADIUS_BASE + PLANET_RADIUS_LOG_SCALE * Math.log10(massEarth + 1);
  }
  const m = massEarth / SOLAR;
  const exponent = m < 1 ? RADIUS_EXP_SMALL : RADIUS_EXP_LARGE;
  return RADIUS_BASE + RADIUS_SCALE * m ** exponent;
}

/** Suns. Squashed mass-luminosity relation; zero for anything that is not a star. */
export function luminosityFor(massEarth: number, starClass: StarClass): number {
  return isStar(starClass) ? (massEarth / SOLAR) ** LUMINOSITY_EXP : 0;
}

/** Kelvin for a main sequence star of the given mass. */
export function temperatureFor(massEarth: number): number {
  const m = massEarth / SOLAR;
  const exponent = m < 1 ? TEMPERATURE_EXP_SMALL : TEMPERATURE_EXP_LARGE;
  return Math.min(SUN_TEMPERATURE * m ** exponent, TEMPERATURE_MAX);
}

/** Seconds a star of the given mass burns for. Live fast, die young. */
export function lifetimeFor(massEarth: number): number {
  const m = massEarth / SOLAR;
  if (m < IMMORTAL_BELOW) return Infinity;
  return LIFETIME_SCALE / Math.sqrt(m);
}

/**
 * Recompute everything that follows from mass, phase, remnant, and age.
 * Called on spawn, on every mass change, on phase change, and every step
 * for things that cool or warm.
 */
export function refreshDerived(body: Body): void {
  const massEarth = body.mass;
  body.starClass = classify(massEarth);
  body.hitRadius = 0;

  switch (body.remnant) {
    case 'protostar': {
      const progress = Math.min(body.age / PROTOSTAR_TIME, 1);
      body.radius = radiusFor(Math.max(massEarth, CLASS_BOUNDS.brownDwarf * SOLAR)) * 0.9;
      body.luminosity = 0.15 * (massEarth / SOLAR) ** LUMINOSITY_EXP + 0.02;
      body.temperature =
        PROTOSTAR_TEMPERATURE_START +
        (PROTOSTAR_TEMPERATURE_END - PROTOSTAR_TEMPERATURE_START) * progress;
      body.color = blackbodyRGB(body.temperature);
      break;
    }
    case 'whiteDwarf': {
      const cooled = Math.min(body.age / WHITE_DWARF_COOL_SECONDS, 1);
      body.radius = 4;
      body.luminosity = 0.05;
      body.temperature =
        WHITE_DWARF_TEMPERATURE_START +
        (WHITE_DWARF_TEMPERATURE_END - WHITE_DWARF_TEMPERATURE_START) * cooled;
      body.color = blackbodyRGB(body.temperature);
      break;
    }
    case 'pulsar':
    case 'magnetar': {
      body.radius = 3.5;
      body.luminosity = 0.08;
      body.temperature = NEUTRON_STAR_TEMPERATURE;
      body.color = FIXED_COLORS[body.remnant];
      break;
    }
    case 'blackHole': {
      body.radius = 4 + 2 * Math.log10(1 + massEarth / SOLAR);
      body.luminosity = 0;
      body.temperature = 0;
      body.color = FIXED_COLORS.blackHole;
      break;
    }
    case null: {
      body.radius = radiusFor(massEarth);
      body.luminosity = luminosityFor(massEarth, body.starClass);
      if (isStar(body.starClass)) {
        body.temperature = temperatureFor(massEarth);
        if (body.phase === 'redGiant') {
          body.radius *= RED_GIANT_RADIUS;
          body.temperature = RED_GIANT_TEMPERATURE;
          body.luminosity *= RED_GIANT_LUMINOSITY;
        }
        body.color = blackbodyRGB(body.temperature);
      } else {
        body.temperature = 0;
        body.color = FIXED_COLORS[body.starClass === 'gasGiant' ? 'gasGiant' : 'planet'];
      }
      break;
    }
  }
  body.hitRadius = Math.max(body.radius, MIN_HIT_RADIUS);
}

/** Set a body's mass and recompute everything that follows from it. */
export function setMass(body: Body, massEarth: number): void {
  body.mass = massEarth;
  if (body.remnant === null)
    body.lifetime = isStar(classify(massEarth)) ? lifetimeFor(massEarth) : Infinity;
  refreshDerived(body);
}

/** Label text for a body's mass: solar masses with the Sun glyph for stars, Earth masses otherwise. */
export function formatMass(body: Body): string {
  if (body.remnant !== null || isStar(body.starClass)) {
    const suns = body.mass / SOLAR;
    return `${suns < 0.1 ? suns.toFixed(2) : suns.toFixed(1)} ☉`;
  }
  return `${body.mass < 10 ? body.mass.toFixed(1) : body.mass.toFixed(0)} ⊕`;
}

/** "5.8k Kelvin", "19k Kelvin", "1,000k Kelvin", "0 Kelvin". */
export function formatTemperature(kelvin: number): string {
  if (kelvin <= 0) return '0 Kelvin';
  const k = kelvin / 1000;
  if (k < 10) return `${k.toFixed(1)}k Kelvin`;
  if (k < 1000) return `${k.toFixed(0)}k Kelvin`;
  return `${Math.round(k).toLocaleString('en-US')}k Kelvin`;
}

/**
 * The lines of a body's label. Stars: name, mass, temperature, fuel burned.
 * Protostars: progress to ignition instead of fuel. Remnants: no percentage.
 * Planets: name, mass, then status and progress once they have any.
 */
export function labelFor(body: Body, stageProgress = 0): string[] {
  const lines = [nameOf(body), formatMass(body)];
  if (body.remnant === 'protostar') {
    lines.push(formatTemperature(body.temperature));
    lines.push(`${(Math.min(body.age / PROTOSTAR_TIME, 1) * 100).toFixed(1)}%`);
    return lines;
  }
  if (body.remnant !== null) {
    lines.push(formatTemperature(body.temperature));
    return lines;
  }
  if (isStar(body.starClass)) {
    lines.push(formatTemperature(body.temperature));
    if (Number.isFinite(body.lifetime)) {
      lines.push(`${(Math.min(body.age / body.lifetime, 1) * 100).toFixed(1)}%`);
    }
    return lines;
  }
  const status =
    body.lifeStage !== 'none' && body.status === 'habitable'
      ? STAGE_NAMES[body.lifeStage]
      : STATUS_NAMES[body.status];
  if (status) {
    lines.push(status);
    if (body.status === 'habitable' || body.status === 'colonizing') {
      lines.push(`${(stageProgress * 100).toFixed(0)}%`);
    }
  }
  return lines;
}
