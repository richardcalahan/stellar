import { describe, expect, it } from 'vitest';
import { AU, DT, G, SOLAR } from '../constants';
import { World } from '../world';

describe('merging', () => {
  it('conserves mass and momentum and reports a merge event', () => {
    const world = new World();
    const a = world.spawn({ mass: SOLAR, x: 0, y: 0, vx: 10, vy: 0 });
    world.spawn({ mass: SOLAR, x: 5, y: 0, vx: -30, vy: 4 });
    const before = world.momentum();

    const events = world.step(DT);

    expect(world.bodies).toHaveLength(1);
    expect(a.mass).toBe(2 * SOLAR);
    expect(a.starClass).toBe('white');
    const after = world.momentum();
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(events).toHaveLength(1);
    const first = events[0];
    expect(first?.kind).toBe('merge');
    if (first?.kind === 'merge') expect(first.name).toBe('White Star');
  });

  it('keeps a held survivor exactly where the finger is', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 100, y: 50 });
    world.grab(sun);
    world.spawn({ mass: 1, x: 104, y: 50, vx: 500, vy: 0 });
    world.step(DT);
    expect(sun.x).toBe(100);
    expect(sun.y).toBe(50);
    expect(sun.vx).toBe(0);
    expect(world.bodies).toHaveLength(1);
  });
});

describe('locked bodies', () => {
  it('do not move under gravity but still accelerate a neighbour', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    const planet = world.spawn({ mass: 1, x: 200, y: 0 });
    world.setLocked(sun, true);
    for (let i = 0; i < 50; i++) world.step(DT);
    expect(sun.x).toBe(0);
    expect(sun.y).toBe(0);
    expect(planet.vx).toBeLessThan(0);
  });

  it('locked plus orbiting bodies ignore everything but their primary', () => {
    const run = (withIntruder: boolean): number => {
      const world = new World();
      const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
      world.setLocked(sun, true);
      const planet = world.spawn({ mass: 1, x: AU, y: 0 });
      planet.orbiting = true;
      world.setLocked(planet, true);
      world.release(planet, 0, 0);
      if (withIntruder) world.spawn({ mass: 5 * SOLAR, x: AU + 60, y: 400, vx: 0, vy: -200 });
      for (let i = 0; i < 240; i++) world.step(DT);
      return Math.hypot(planet.x - sun.x, planet.y - sun.y);
    };
    expect(run(true)).toBeCloseTo(run(false), 6);
  });
});

describe('orbit release', () => {
  it('puts an orbiting body on a circular orbit around the strongest pull', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    const planet = world.spawn({ mass: 1, x: AU, y: 0 });
    world.grab(planet);
    planet.orbiting = true;
    world.release(planet, 999, 999);
    expect(planet.primaryId).toBe(sun.id);
    expect(planet.vx).toBeCloseTo(0, 9);
    expect(planet.vy).toBeCloseTo(Math.sqrt((G * SOLAR) / AU), 6);
  });
});
