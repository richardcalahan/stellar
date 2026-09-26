import {
  BLACK_HOLE_FRACTION,
  BLACK_HOLE_FROM,
  BLAST_KICK,
  BLAST_RADIUS_BASE,
  BLAST_RADIUS_PER_SUN,
  DUST_EMIT_MAX,
  DUST_EMIT_MIN,
  DUST_PER_SUN,
  MAGNETAR_CHANCE,
  NEBULA_BELOW,
  NEBULA_DUST_SPEED,
  NEUTRON_STAR_MASS,
  SOLAR,
  SUPERNOVA_DUST_SPEED,
  WHITE_DWARF_FACTOR,
  WHITE_DWARF_MAX,
} from './constants';
import { isCompact, isWorld, REMNANT_NAMES, refreshDerived } from './stars';
import type { Body, Remnant, SimEvent } from './types';
import type { World } from './world';

/** Mass of the white dwarf a star of the given mass leaves, in Earth masses. */
export function whiteDwarfMassFor(massEarth: number): number {
  const suns = massEarth / SOLAR;
  return Math.min(WHITE_DWARF_MAX, WHITE_DWARF_FACTOR * Math.sqrt(suns)) * SOLAR;
}

/** How far a supernova reaches, in world units. */
export function blastRadiusFor(massEarth: number): number {
  return BLAST_RADIUS_BASE + BLAST_RADIUS_PER_SUN * (massEarth / SOLAR);
}

/** Turn a body into a remnant in place, keeping its id, position, and motion. */
export function becomeRemnant(body: Body, remnant: Remnant, massEarth: number): void {
  body.remnant = remnant;
  body.mass = massEarth;
  body.age = 0;
  body.lifetime = Infinity;
  body.phase = 'main';
  refreshDerived(body);
}

/**
 * A star has used its fuel. Below NEBULA_BELOW solar masses it puffs off a
 * planetary nebula and leaves a white dwarf. Up to BLACK_HOLE_FROM it goes
 * supernova and leaves a neutron star, usually a pulsar and sometimes a
 * magnetar. Heavier still, the supernova leaves a black hole. A white dwarf
 * pushed past the Chandrasekhar limit detonates completely (Type Ia).
 */
export function die(world: World, body: Body, events: SimEvent[]): void {
  const suns = body.mass / SOLAR;
  const starRadius = body.radius;
  const massBefore = body.mass;

  if (body.remnant === 'whiteDwarf') {
    const radius = blastRadiusFor(massBefore);
    world.remove(body.id);
    blast(world, body.x, body.y, radius, body.id);
    eject(world, body.x, body.y, starRadius, massBefore, SUPERNOVA_DUST_SPEED);
    events.push({
      kind: 'death',
      x: body.x,
      y: body.y,
      bodyId: body.id,
      remnant: null,
      name: 'Type Ia Supernova',
      ejectedMass: massBefore,
      blastRadius: radius,
      starRadius,
    });
    return;
  }

  let remnant: Remnant;
  let remnantMass: number;
  let blastRadius = 0;
  if (suns < NEBULA_BELOW) {
    remnant = 'whiteDwarf';
    remnantMass = whiteDwarfMassFor(massBefore);
  } else if (suns < BLACK_HOLE_FROM) {
    remnant = world.random() < MAGNETAR_CHANCE ? 'magnetar' : 'pulsar';
    remnantMass = NEUTRON_STAR_MASS * SOLAR;
    blastRadius = blastRadiusFor(massBefore);
  } else {
    remnant = 'blackHole';
    remnantMass = BLACK_HOLE_FRACTION * massBefore;
    blastRadius = blastRadiusFor(massBefore);
  }

  becomeRemnant(body, remnant, remnantMass);
  world.version++;
  if (blastRadius > 0) blast(world, body.x, body.y, blastRadius, body.id);
  eject(
    world,
    body.x,
    body.y,
    starRadius,
    massBefore - remnantMass,
    blastRadius > 0 ? SUPERNOVA_DUST_SPEED : NEBULA_DUST_SPEED,
  );
  events.push({
    kind: 'death',
    x: body.x,
    y: body.y,
    bodyId: body.id,
    remnant,
    name: REMNANT_NAMES[remnant],
    ejectedMass: massBefore - remnantMass,
    blastRadius,
    starRadius,
  });
}

/** The mass a dying star throws off becomes dust that later stars can gather. */
function eject(
  world: World,
  x: number,
  y: number,
  radius: number,
  massEarth: number,
  speed: number,
): void {
  if (massEarth <= 0) return;
  const count = Math.round(
    Math.min(DUST_EMIT_MAX, Math.max(DUST_EMIT_MIN, (massEarth / SOLAR) * DUST_PER_SUN)),
  );
  world.dust.emit(x, y, radius, massEarth, count, speed, world.random);
}

/**
 * A supernova annihilates planets and lesser remnants within reach and
 * kicks stars outward.
 */
export function blast(world: World, x: number, y: number, radius: number, sourceId: number): void {
  for (const other of [...world.bodies]) {
    if (other.id === sourceId) continue;
    const dx = other.x - x;
    const dy = other.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) continue;
    if (isWorld(other) || (other.remnant !== null && !isCompact(other))) {
      world.remove(other.id);
      continue;
    }
    if (other.remnant === 'blackHole') continue;
    const inv = distance > 0 ? 1 / distance : 0;
    other.vx += dx * inv * BLAST_KICK;
    other.vy += dy * inv * BLAST_KICK;
  }
}
