import { describe, expect, it } from 'vitest';
import { mergedAgeFraction } from '../collisions';
import { AU, BLACK_HOLE_FRACTION, BLAST_KICK, DT, G, NEUTRON_STAR_MASS, SOLAR } from '../constants';
import { becomeRemnant, blastRadiusFor, whiteDwarfMassFor } from '../death';
import { createRandom } from '../random';
import type { DeathEvent, SimEvent } from '../types';
import { World } from '../world';

function killStar(world: World, suns: number): { events: SimEvent[]; id: number } {
  const star = world.spawn({ mass: suns * SOLAR, x: 0, y: 0 });
  star.age = star.lifetime - DT / 2;
  return { events: world.step(DT), id: star.id };
}

function deathOf(events: SimEvent[]): DeathEvent {
  const death = events.find((e): e is DeathEvent => e.kind === 'death');
  if (!death) throw new Error('no death event');
  return death;
}

describe('remnants', () => {
  it('a Sun leaves a 0.6 solar mass white dwarf and a nebula', () => {
    const world = new World();
    const { events, id } = killStar(world, 1);
    const death = deathOf(events);
    const remnant = world.find(id);
    expect(death.remnant).toBe('whiteDwarf');
    expect(death.blastRadius).toBe(0);
    expect(remnant?.mass).toBeCloseTo(whiteDwarfMassFor(SOLAR), 6);
    expect(remnant?.mass).toBeCloseTo(0.6 * SOLAR, 6);
    expect(death.ejectedMass).toBeCloseTo(0.4 * SOLAR, 6);
  });

  it('a ten solar mass star leaves a neutron star, a black hole above twenty', () => {
    const world = new World(createRandom(5));
    const first = killStar(world, 10);
    expect(['pulsar', 'magnetar']).toContain(deathOf(first.events).remnant);
    expect(world.find(first.id)?.mass).toBeCloseTo(NEUTRON_STAR_MASS * SOLAR, 6);
    expect(deathOf(first.events).blastRadius).toBe(blastRadiusFor(10 * SOLAR));

    const second = new World();
    const { events, id } = killStar(second, 25);
    expect(deathOf(events).remnant).toBe('blackHole');
    expect(second.find(id)?.mass).toBeCloseTo(BLACK_HOLE_FRACTION * 25 * SOLAR, 6);
  });

  it('fires exactly one death event and never dies again', () => {
    const world = new World();
    const { events } = killStar(world, 1);
    expect(events.filter((e) => e.kind === 'death')).toHaveLength(1);
    let later = 0;
    for (let i = 0; i < 500; i++) later += world.step(DT).filter((e) => e.kind === 'death').length;
    expect(later).toBe(0);
  });

  it('keeps a planet bound when its Sun becomes a white dwarf', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    const speed = Math.sqrt((G * SOLAR) / AU);
    const planet = world.spawn({ mass: 1, x: AU, y: 0, vx: 0, vy: speed });
    sun.age = sun.lifetime - DT / 2;
    world.step(DT);
    expect(sun.remnant).toBe('whiteDwarf');
    const r = Math.hypot(planet.x - sun.x, planet.y - sun.y);
    const v2 = (planet.vx - sun.vx) ** 2 + (planet.vy - sun.vy) ** 2;
    const specificEnergy = v2 / 2 - (G * sun.mass) / r;
    expect(specificEnergy).toBeLessThan(0);
  });
});

describe('supernova blast', () => {
  it('destroys a planet inside the blast radius and kicks a star', () => {
    const world = new World();
    const star = world.spawn({ mass: 10 * SOLAR, x: 0, y: 0 });
    const planet = world.spawn({ mass: 1, x: 200, y: 0 });
    const neighbour = world.spawn({ mass: SOLAR, x: 0, y: 300 });
    const far = world.spawn({ mass: 1, x: 900, y: 0 });
    star.age = star.lifetime - DT / 2;
    world.step(DT);
    expect(world.find(planet.id)).toBeUndefined();
    expect(world.find(far.id)).toBeDefined();
    expect(neighbour.vy).toBeGreaterThan(BLAST_KICK * 0.9);
  });

  it('detonates a white dwarf pushed past 1.4 solar masses', () => {
    const world = new World();
    const dwarf = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    becomeRemnant(dwarf, 'whiteDwarf', 1.0 * SOLAR);
    world.spawn({ mass: 0.6 * SOLAR, x: 3, y: 0 });
    const events = world.step(DT);
    const death = deathOf(events);
    expect(death.remnant).toBeNull();
    expect(death.name).toBe('Type Ia Supernova');
    expect(world.bodies).toHaveLength(0);
  });
});

describe('compact mergers', () => {
  it('carries burned lifetime across a merge by mass', () => {
    const world = new World();
    const old = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    const young = world.spawn({ mass: SOLAR, x: 1000, y: 0 });
    old.age = old.lifetime * 0.5;
    expect(mergedAgeFraction(old, young)).toBeCloseTo(0.25, 9);
  });

  it('a black hole swallows what it touches, conserving momentum, and a pulsar makes a burst', () => {
    const world = new World();
    const hole = world.spawn({ mass: 10 * SOLAR, x: 0, y: 0, vx: 5, vy: 0 });
    becomeRemnant(hole, 'blackHole', 10 * SOLAR);
    const pulsar = world.spawn({ mass: SOLAR, x: 4, y: 0, vx: -40, vy: 20 });
    becomeRemnant(pulsar, 'pulsar', NEUTRON_STAR_MASS * SOLAR);
    const before = world.momentum();
    const events = world.step(DT);
    const after = world.momentum();
    expect(world.bodies).toHaveLength(1);
    expect(hole.remnant).toBe('blackHole');
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(events.filter((e) => e.kind === 'swallow')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'grb')).toHaveLength(1);
  });
});
