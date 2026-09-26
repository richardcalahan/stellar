import { MERGE_OVERLAP, SOLAR, WHITE_DWARF_MAX } from './constants';
import { die } from './death';
import { isCompact, nameOf } from './stars';
import type { Body, SimEvent } from './types';
import type { World } from './world';

/**
 * Bodies that overlap by more than MERGE_OVERLAP of their combined radii
 * become one body. Mass adds. Velocity is the momentum-weighted average and
 * the new position is the centre of mass, so nothing is created or lost by
 * a collision. The heavier body survives and keeps its identity; if it is
 * being held or is locked it stays exactly where it is.
 *
 * A black hole swallows whatever it touches. Two compact objects (pulsar,
 * magnetar, black hole) meeting fire a gamma-ray burst. A white dwarf that
 * grows past the Chandrasekhar limit detonates.
 */
export function resolveCollisions(world: World, events: SimEvent[]): void {
  let merged = true;
  while (merged) {
    merged = false;
    const bodies = world.bodies;
    const n = bodies.length;
    search: for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (a === undefined) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (b === undefined) continue;
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        if (distance < MERGE_OVERLAP * (a.radius + b.radius)) {
          mergePair(world, a, b, events);
          merged = true;
          break search;
        }
      }
    }
  }
}

/**
 * Fraction of life already burned after a merge: each star contributes its
 * own burned fraction weighted by mass, so merging a fresh star into an old
 * one resets only part of the clock.
 */
export function mergedAgeFraction(a: Body, b: Body): number {
  const fraction = (body: Body): number =>
    Number.isFinite(body.lifetime) && body.remnant === null ? body.age / body.lifetime : 0;
  return (a.mass * fraction(a) + b.mass * fraction(b)) / (a.mass + b.mass);
}

function mergePair(world: World, a: Body, b: Body, events: SimEvent[]): void {
  let survivor: Body;
  let absorbed: Body;
  const aHole = a.remnant === 'blackHole';
  const bHole = b.remnant === 'blackHole';
  if (aHole !== bHole) {
    [survivor, absorbed] = aHole ? [a, b] : [b, a];
  } else {
    [survivor, absorbed] = a.mass >= b.mass ? [a, b] : [b, a];
  }
  const total = survivor.mass + absorbed.mass;
  const burned = mergedAgeFraction(survivor, absorbed);
  const compactPair = isCompact(a) && isCompact(b);

  if (!survivor.held && !survivor.locked) {
    survivor.x = (survivor.x * survivor.mass + absorbed.x * absorbed.mass) / total;
    survivor.y = (survivor.y * survivor.mass + absorbed.y * absorbed.mass) / total;
    survivor.vx = (survivor.vx * survivor.mass + absorbed.vx * absorbed.mass) / total;
    survivor.vy = (survivor.vy * survivor.mass + absorbed.vy * absorbed.mass) / total;
  }

  world.remove(absorbed.id);
  world.changeMass(survivor, total);
  if (survivor.remnant === null && Number.isFinite(survivor.lifetime)) {
    survivor.age = burned * survivor.lifetime;
  }

  const x = survivor.x;
  const y = survivor.y;
  if (survivor.remnant === 'blackHole') {
    events.push({ kind: 'swallow', x, y, blackHoleId: survivor.id, absorbedId: absorbed.id });
  } else {
    events.push({
      kind: 'merge',
      x,
      y,
      survivorId: survivor.id,
      absorbedId: absorbed.id,
      name: nameOf(survivor),
    });
  }
  if (compactPair) events.push({ kind: 'grb', x, y, bodyId: survivor.id });

  if (survivor.remnant === 'whiteDwarf' && survivor.mass > WHITE_DWARF_MAX * SOLAR) {
    die(world, survivor, events);
  }
}
