import { COOPERATE_CHANCE, SHIP_CAP, SHIP_INTERVAL, SHIP_RANGE, SHIP_SPEED } from './constants';
import { isWorld } from './stars';
import type { Body, RGB, SimEvent } from './types';
import type { World } from './world';

/** Eight distinct civilization colours, assigned in order. */
export const CIV_COLORS: readonly RGB[] = [
  [0.35, 1.0, 0.55],
  [1.0, 0.45, 0.3],
  [0.4, 0.7, 1.0],
  [1.0, 0.9, 0.3],
  [1.0, 0.4, 0.9],
  [0.4, 1.0, 1.0],
  [1.0, 0.7, 0.2],
  [0.8, 0.5, 1.0],
];

/** A planet that has people who can build ships: a Space Age home world or a colony. */
export function isSpacefaring(body: Body): boolean {
  return (
    body.civId !== null &&
    ((body.status === 'habitable' && body.lifeStage === 'spaceAge') || body.status === 'colonized')
  );
}

/**
 * Space Age worlds found a civilization, then launch ships at the nearest
 * planet that is not already theirs. A ship that lands on an unclaimed
 * world colonizes it; one that lands on a rival's world either joins them
 * or wipes them out, on a coin toss. Colonies launch at half the rate.
 */
export function stepCivilizations(world: World, dt: number, events: SimEvent[]): void {
  for (const body of world.bodies) {
    if (body.remnant !== null || body.starClass !== 'planet') continue;
    if (body.status === 'habitable' && body.lifeStage === 'spaceAge' && body.civId === null) {
      body.civId = world.foundCivilization(body).id;
    }
    if (!isSpacefaring(body) || body.civId === null) continue;

    const due = world.launchTimers.get(body.id) ?? world.time + SHIP_INTERVAL;
    if (!world.launchTimers.has(body.id)) world.launchTimers.set(body.id, due);
    if (world.time < due) continue;
    const interval = body.status === 'colonized' ? SHIP_INTERVAL * 2 : SHIP_INTERVAL;
    world.launchTimers.set(body.id, world.time + interval);
    if (world.ships.length >= SHIP_CAP) continue;

    const target = nearestTarget(body, world);
    if (!target) continue;
    const dx = target.x - body.x;
    const dy = target.y - body.y;
    const distance = Math.hypot(dx, dy) || 1;
    world.ships.push({
      id: world.nextShipId++,
      civId: body.civId,
      x: body.x,
      y: body.y,
      vx: (dx / distance) * SHIP_SPEED,
      vy: (dy / distance) * SHIP_SPEED,
      targetId: target.id,
      age: 0,
    });
    events.push({ kind: 'shipLaunch', x: body.x, y: body.y, bodyId: body.id, civId: body.civId });
  }

  for (let i = world.ships.length - 1; i >= 0; i--) {
    const ship = world.ships[i];
    if (ship === undefined) continue;
    const target = world.find(ship.targetId);
    if (!target) {
      world.ships.splice(i, 1);
      continue;
    }
    // Ships steer straight at a moving target, so they can still miss a fast one.
    const dx = target.x - ship.x;
    const dy = target.y - ship.y;
    const distance = Math.hypot(dx, dy) || 1;
    ship.vx = (dx / distance) * SHIP_SPEED;
    ship.vy = (dy / distance) * SHIP_SPEED;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    ship.age += dt;
    if (distance > target.radius + 4 && ship.age < 60) continue;
    world.ships.splice(i, 1);
    if (distance > target.radius + 4) continue;
    arrive(world, ship.civId, target, events);
  }
}

function nearestTarget(from: Body, world: World): Body | null {
  let best: Body | null = null;
  let bestDistance = SHIP_RANGE;
  for (const other of world.bodies) {
    if (other === from || !isWorld(other) || other.civId === from.civId) continue;
    if (other.status === 'deadWorld' && other.civId === null && from.civId !== null) {
      // Dead worlds can be resettled.
    }
    const distance = Math.hypot(other.x - from.x, other.y - from.y);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

function arrive(world: World, civId: number, target: Body, events: SimEvent[]): void {
  const at = { x: target.x, y: target.y, bodyId: target.id, civId };
  if (target.civId === null || target.civId === civId) {
    target.civId = civId;
    target.status = 'colonizing';
    target.statusAge = 0;
    events.push({ kind: 'colonize', ...at, outcome: 'colonizing' });
    return;
  }
  if (world.random() < COOPERATE_CHANCE) {
    events.push({ kind: 'colonize', ...at, outcome: 'cooperate' });
    return;
  }
  target.status = 'deadWorld';
  target.statusAge = 0;
  target.lifeStage = 'none';
  target.habitableTime = 0;
  target.civId = null;
  events.push({ kind: 'colonize', ...at, outcome: 'attack' });
  events.push({ kind: 'war', x: target.x, y: target.y, bodyId: target.id, cause: 'attack' });
}
