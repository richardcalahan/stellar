import { describe, expect, it } from 'vitest';
import { blackbodyRGB } from '../blackbody';
import { AU, DT, LIFETIME_SCALE, PROTOSTAR_TIME, RED_GIANT_FRACTION, SOLAR } from '../constants';
import { becomeRemnant } from '../death';
import { formatTemperature, labelFor, lifetimeFor, temperatureFor } from '../stars';
import { World } from '../world';

describe('temperature and lifetime', () => {
  it('rise with mass, and the Sun reads 5.8k Kelvin', () => {
    let previous = 0;
    for (const suns of [0.1, 0.5, 1, 2, 5, 8, 20, 60]) {
      const t = temperatureFor(suns * SOLAR);
      expect(t).toBeGreaterThan(previous);
      previous = t;
    }
    expect(formatTemperature(temperatureFor(SOLAR))).toBe('5.8k Kelvin');
    expect(formatTemperature(25900)).toBe('26k Kelvin');
    expect(formatTemperature(1000000)).toBe('1,000k Kelvin');
    expect(formatTemperature(0)).toBe('0 Kelvin');
  });

  it('gives the Sun 200 seconds and red dwarfs forever', () => {
    expect(lifetimeFor(SOLAR)).toBe(LIFETIME_SCALE);
    expect(lifetimeFor(4 * SOLAR)).toBe(LIFETIME_SCALE / 2);
    expect(lifetimeFor(0.1 * SOLAR)).toBe(Infinity);
  });

  it('turns temperature into colour: cool is red, hot is blue', () => {
    const cool = blackbodyRGB(3000);
    const hot = blackbodyRGB(30000);
    expect(cool[0]).toBeGreaterThan(cool[2]);
    expect(hot[2]).toBeGreaterThan(hot[0]);
  });
});

describe('labels', () => {
  it('give stars four lines and planets two', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    const planet = world.spawn({ mass: 1, x: AU, y: 0 });
    expect(labelFor(sun)).toEqual(['Yellow Star', '1.0 ☉', '5.8k Kelvin', '0.0%']);
    expect(labelFor(planet)).toEqual(['Planet', '1.0 ⊕']);
    const dwarf = world.spawn({ mass: 0.1 * SOLAR, x: 0, y: AU });
    expect(labelFor(dwarf)).toHaveLength(3);
  });

  it('name remnants and show a protostar its progress', () => {
    const world = new World();
    const body = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    becomeRemnant(body, 'protostar', 0.5 * SOLAR);
    body.age = PROTOSTAR_TIME / 2;
    expect(labelFor(body)[0]).toBe('Protostar');
    expect(labelFor(body)[3]).toBe('50.0%');
    becomeRemnant(body, 'blackHole', 8 * SOLAR);
    expect(labelFor(body)).toEqual(['Blackhole', '8.0 ☉', '0 Kelvin']);
  });
});

describe('aging', () => {
  it('swells a star into a red giant near the end and burns fuel on the label', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    const radius = sun.radius;
    sun.age = sun.lifetime * (1 - RED_GIANT_FRACTION) - DT / 2;
    world.step(DT);
    expect(sun.phase).toBe('redGiant');
    expect(sun.radius).toBeGreaterThan(radius * 2);
    expect(sun.temperature).toBe(3500);
    expect(labelFor(sun)[3]).toBe('85.0%');
  });

  it('ignites a protostar into a star with a few planets', () => {
    const world = new World();
    const body = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    becomeRemnant(body, 'protostar', SOLAR);
    body.age = PROTOSTAR_TIME - DT / 2;
    const events = world.step(DT);
    expect(body.remnant).toBeNull();
    expect(body.starClass).toBe('yellow');
    expect(events.some((e) => e.kind === 'ignite')).toBe(true);
    expect(world.bodies.length).toBeGreaterThanOrEqual(2);
    expect(world.bodies.length).toBeLessThanOrEqual(4);
  });
});
