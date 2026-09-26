import { describe, expect, it } from 'vitest';
import { COLLAPSE_INTERVAL, COLLAPSE_MASS, DT, DUST_DRAG, DUST_EVERY, SOLAR } from '../constants';
import { DustField } from '../dust';
import { createRandom } from '../random';
import { World } from '../world';

describe('dust', () => {
  it('is pushed outward by a bright star and drawn in by a dark one', () => {
    const sunny = new World();
    sunny.spawn({ mass: SOLAR, x: 0, y: 0 });
    sunny.dust.emit(150, 0, 0, 1, 1, 0, createRandom(1));
    sunny.dust.step(sunny, DT * DUST_EVERY, []);
    expect(sunny.dust.vx[0]).toBeGreaterThan(0);

    const dark = new World();
    const hole = dark.spawn({ mass: SOLAR, x: 0, y: 0 });
    hole.remnant = 'blackHole';
    hole.luminosity = 0;
    dark.dust.emit(150, 0, 0, 1, 1, 0, createRandom(1));
    dark.dust.step(dark, DT * DUST_EVERY, []);
    expect(dark.dust.vx[0]).toBeLessThan(0);
  });

  it('slows by the drag factor with nothing around', () => {
    const world = new World();
    const field = new DustField();
    field.emit(0, 0, 0, 1, 1, 100, createRandom(2));
    const speed = Math.hypot(field.vx[0] ?? 0, field.vy[0] ?? 0);
    const dt = 0.1;
    field.step(world, dt, []);
    const after = Math.hypot(field.vx[0] ?? 0, field.vy[0] ?? 0);
    expect(after / speed).toBeCloseTo(1 - DUST_DRAG * dt, 6);
  });

  it('collapses a dense, slow cell into exactly one protostar of the same mass', () => {
    const world = new World();
    const mass = COLLAPSE_MASS * SOLAR * 1.5;
    world.dust.emit(500, 500, 2, mass, 200, 0, createRandom(3));
    const events: ReturnType<World['step']> = [];
    for (let t = 0; t < COLLAPSE_INTERVAL + 0.01; t += DT * DUST_EVERY) {
      world.dust.step(world, DT * DUST_EVERY, events);
    }
    const collapses = events.filter((e) => e.kind === 'collapse');
    expect(collapses).toHaveLength(1);
    expect(world.bodies).toHaveLength(1);
    expect(world.bodies[0]?.remnant).toBe('protostar');
    expect(world.bodies[0]?.mass).toBeCloseTo(mass, 3);
    expect(world.dust.count).toBe(0);
  });

  it('a dying Sun seeds the field with its lost mass', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    sun.age = sun.lifetime - DT / 2;
    world.step(DT);
    let total = 0;
    for (let i = 0; i < world.dust.count; i++) total += world.dust.mass[i] ?? 0;
    expect(world.dust.count).toBeGreaterThan(0);
    expect(total).toBeCloseTo(0.4 * SOLAR, 0);
  });
});
