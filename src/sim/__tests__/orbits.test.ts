import { describe, expect, it } from 'vitest';
import { AU, DT, SOLAR, T_REF } from '../constants';
import { circularVelocity, nearestMostMassive } from '../orbits';
import { World } from '../world';

describe('circularVelocity', () => {
  it('puts an Earth at one AU on the T_REF second orbit', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    const earth = world.spawn({ mass: 1, x: AU, y: 0 });
    const v = circularVelocity(earth, sun);
    earth.vx = v.vx;
    earth.vy = v.vy;
    expect(v.vx).toBeCloseTo(0, 9);
    expect(v.vy).toBeGreaterThan(0);

    const steps = Math.round(T_REF / DT);
    for (let i = 0; i < steps; i++) world.step(DT);
    expect(earth.x).toBeCloseTo(AU, -1);
    expect(Math.abs(earth.y)).toBeLessThan(AU * 0.02);
  });

  it('rides along with a moving primary', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0, vx: 40, vy: -10 });
    const earth = world.spawn({ mass: 1, x: 0, y: AU });
    const v = circularVelocity(earth, sun);
    expect(v.vy).toBeCloseTo(-10, 9);
    expect(v.vx).toBeLessThan(40);
  });
});

describe('nearestMostMassive', () => {
  it('prefers a Sun at 400 px over a red dwarf at 300 px', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 400, y: 0 });
    world.spawn({ mass: 0.1 * SOLAR, x: 0, y: 300 });
    const planet = world.spawn({ mass: 1, x: 0, y: 0 });
    expect(nearestMostMassive(planet, world)).toBe(sun);
  });

  it('never picks itself or something lighter', () => {
    const world = new World();
    const heavy = world.spawn({ mass: 100, x: 0, y: 0 });
    world.spawn({ mass: 1, x: 10, y: 0 });
    expect(nearestMostMassive(heavy, world)).toBeNull();
  });
});
