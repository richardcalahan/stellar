import {
  CLASS_BOUNDS,
  LUMINOSITY_EXP,
  MIN_HIT_RADIUS,
  RADIUS_BASE,
  RADIUS_EXP_LARGE,
  RADIUS_EXP_SMALL,
  RADIUS_SCALE,
  SOLAR,
} from './constants';
import type { Body, RGB, StarClass } from './types';

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

/**
 * Linear RGB per class. Module 6 replaces the star entries with colours
 * computed from temperature; until then these are hand-picked.
 */
export const CLASS_COLORS: Record<StarClass, RGB> = {
  planet: [0.55, 0.56, 0.6],
  gasGiant: [0.35, 0.5, 0.9],
  brownDwarf: [0.55, 0.15, 0.4],
  redDwarf: [1.0, 0.38, 0.14],
  yellow: [1.0, 0.85, 0.5],
  white: [1.0, 0.97, 0.9],
  blue: [0.7, 0.8, 1.0],
  blueGiant: [0.5, 0.65, 1.0],
  superGiant: [0.4, 0.5, 1.0],
  megaGiant: [0.75, 0.65, 1.0],
};

/** Stars shine and get coronas. Planets and gas giants are lit by them. */
export function isStar(starClass: StarClass): boolean {
  return starClass !== 'planet' && starClass !== 'gasGiant';
}

/** World units. Grows slowly with mass so a blue giant is big but still fits on the table. */
export function radiusFor(massEarth: number): number {
  const m = massEarth / SOLAR;
  const exponent = m < 1 ? RADIUS_EXP_SMALL : RADIUS_EXP_LARGE;
  return RADIUS_BASE + RADIUS_SCALE * m ** exponent;
}

/** Suns. Squashed mass-luminosity relation; zero for anything that is not a star. */
export function luminosityFor(massEarth: number, starClass: StarClass): number {
  return isStar(starClass) ? (massEarth / SOLAR) ** LUMINOSITY_EXP : 0;
}

/** Set a body's mass and recompute everything that follows from it. */
export function setMass(body: Body, massEarth: number): void {
  body.mass = massEarth;
  body.starClass = classify(massEarth);
  body.radius = radiusFor(massEarth);
  body.hitRadius = Math.max(body.radius, MIN_HIT_RADIUS);
  body.luminosity = luminosityFor(massEarth, body.starClass);
  body.color = CLASS_COLORS[body.starClass];
}

/** Label text for a body's mass: solar masses with the Sun glyph for stars, Earth masses otherwise. */
export function formatMass(body: Body): string {
  if (isStar(body.starClass)) {
    const suns = body.mass / SOLAR;
    return `${suns < 0.1 ? suns.toFixed(2) : suns.toFixed(1)} ☉`;
  }
  return `${body.mass < 10 ? body.mass.toFixed(1) : body.mass.toFixed(0)} ⊕`;
}
