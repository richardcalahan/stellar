import { describe, expect, it } from 'vitest';
import { DT, MIN_HIT_RADIUS, SOLAR } from '../constants';
import { World } from '../world';

describe('held bodies', () => {
  it('do not move under gravity but still pull on their neighbours', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    const planet = world.spawn({ mass: 1, x: 200, y: 0 });
    world.grab(sun);
    for (let i = 0; i < 100; i++) world.step(DT);

    expect(sun.x).toBe(0);
    expect(sun.y).toBe(0);
    expect(sun.vx).toBe(0);
    expect(planet.x).toBeLessThan(200);
    expect(planet.vx).toBeLessThan(0);
  });

  it('go where the pointer goes and take off with the release velocity', () => {
    const world = new World();
    const planet = world.spawn({ mass: 1, x: 0, y: 0, vx: 50, vy: 0 });
    world.grab(planet);
    expect(planet.vx).toBe(0);
    world.moveHeld(planet, 120, -40);
    world.step(DT);
    expect(planet.x).toBe(120);
    expect(planet.y).toBe(-40);

    world.release(planet, 30, 10);
    expect(planet.held).toBe(false);
    world.step(DT);
    expect(planet.x).toBeCloseTo(120 + 30 * DT, 9);
    expect(planet.y).toBeCloseTo(-40 + 10 * DT, 9);
  });
});

describe('World.bodyAt', () => {
  it('picks the nearest body whose hit radius covers the point and ignores held ones', () => {
    const world = new World();
    const a = world.spawn({ mass: 1, x: 0, y: 0 });
    const b = world.spawn({ mass: 1, x: 30, y: 0 });

    expect(world.bodyAt(8, 0)).toBe(a);
    expect(world.bodyAt(20, 0)).toBe(b);
    expect(world.bodyAt(0, MIN_HIT_RADIUS + 1)).toBeNull();

    world.grab(a);
    expect(world.bodyAt(8, 0)).toBe(b);
  });
});
