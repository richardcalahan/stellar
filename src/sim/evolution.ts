import {
  CLASS_BOUNDS,
  IGNITION_ORBIT_MAX,
  IGNITION_ORBIT_MIN,
  IGNITION_PLANET_MASS_MAX,
  IGNITION_PLANET_MASS_MIN,
  IGNITION_PLANETS_MAX,
  IGNITION_PLANETS_MIN,
  PROTOSTAR_TIME,
  RED_GIANT_FRACTION,
  SOLAR,
  TIME_SCALE,
  WHITE_DWARF_COOL_SECONDS,
} from './constants';
import { die } from './death';
import { circularVelocity } from './orbits';
import { isStar, nameOf, refreshDerived } from './stars';
import type { Body, SimEvent } from './types';
import type { World } from './world';

/**
 * Ages every star, swells the old ones into red giants, and hands the dead
 * ones to death.ts. Protostars count up to ignition; white dwarfs cool.
 */
export function stepEvolution(world: World, dt: number, events: SimEvent[]): void {
  const elapsed = dt * TIME_SCALE;
  for (const body of [...world.bodies]) {
    if (body.remnant === 'protostar') {
      body.age += elapsed;
      refreshDerived(body);
      if (body.age >= PROTOSTAR_TIME) ignite(world, body, events);
      continue;
    }
    if (body.remnant === 'whiteDwarf') {
      if (body.age < WHITE_DWARF_COOL_SECONDS) {
        body.age += elapsed;
        refreshDerived(body);
      }
      continue;
    }
    if (body.remnant !== null || !isStar(body.starClass)) continue;

    body.age += elapsed;
    if (!Number.isFinite(body.lifetime)) continue;

    const phase = body.age >= body.lifetime * (1 - RED_GIANT_FRACTION) ? 'redGiant' : 'main';
    if (phase !== body.phase) {
      body.phase = phase;
      refreshDerived(body);
      world.version++;
    }
    if (body.age >= body.lifetime) die(world, body, events);
  }
}

/**
 * A protostar has finished collapsing: it becomes a main sequence star of
 * its mass (or a brown dwarf if it is too light to burn) and forms a few
 * planets on circular orbits as it does.
 */
export function ignite(world: World, body: Body, events: SimEvent[]): void {
  body.remnant = null;
  body.age = 0;
  body.phase = 'main';
  world.changeMass(body, Math.max(body.mass, CLASS_BOUNDS.brownDwarf * SOLAR));

  const count =
    IGNITION_PLANETS_MIN +
    Math.floor(world.random() * (IGNITION_PLANETS_MAX - IGNITION_PLANETS_MIN + 1));
  for (let i = 0; i < count && !world.isFull; i++) {
    const distance =
      IGNITION_ORBIT_MIN + world.random() * (IGNITION_ORBIT_MAX - IGNITION_ORBIT_MIN);
    const angle = world.random() * Math.PI * 2;
    const mass =
      IGNITION_PLANET_MASS_MIN +
      world.random() * (IGNITION_PLANET_MASS_MAX - IGNITION_PLANET_MASS_MIN);
    const planet = world.spawn({
      mass,
      x: body.x + Math.cos(angle) * distance,
      y: body.y + Math.sin(angle) * distance,
    });
    const v = circularVelocity(planet, body);
    planet.vx = v.vx;
    planet.vy = v.vy;
  }

  events.push({ kind: 'ignite', x: body.x, y: body.y, bodyId: body.id, name: nameOf(body) });
}
