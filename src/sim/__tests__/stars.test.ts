import { describe, expect, it } from 'vitest';
import { PALETTE_MASSES, SOLAR } from '../constants';
import { classify, formatMass, luminosityFor, radiusFor } from '../stars';
import { World } from '../world';

describe('classify', () => {
  it('names every class from the mass table', () => {
    expect(classify(1)).toBe('planet');
    expect(classify(9.9)).toBe('planet');
    expect(classify(10)).toBe('gasGiant');
    expect(classify(PALETTE_MASSES.gasGiant)).toBe('gasGiant');
    expect(classify(0.05 * SOLAR)).toBe('brownDwarf');
    expect(classify(PALETTE_MASSES.redDwarf)).toBe('redDwarf');
    expect(classify(PALETTE_MASSES.sun)).toBe('yellow');
    expect(classify(2 * SOLAR)).toBe('white');
    expect(classify(3 * SOLAR)).toBe('blue');
    expect(classify(11 * SOLAR)).toBe('blueGiant');
    expect(classify(21 * SOLAR)).toBe('superGiant');
    expect(classify(100 * SOLAR)).toBe('megaGiant');
  });
});

describe('radiusFor', () => {
  it('matches the size table in world units', () => {
    expect(radiusFor(1)).toBeCloseTo(5.7, 0);
    expect(radiusFor(100)).toBeCloseTo(6.5, 0);
    expect(radiusFor(0.1 * SOLAR)).toBeCloseTo(5.7, 0);
    expect(radiusFor(SOLAR)).toBe(7);
    expect(radiusFor(2 * SOLAR)).toBeCloseTo(7.7, 0);
    expect(radiusFor(20 * SOLAR)).toBeCloseTo(11.4, 0);
  });
});

describe('luminosityFor', () => {
  it('is one sun for the Sun and zero for anything that is not a star', () => {
    expect(luminosityFor(SOLAR, 'yellow')).toBe(1);
    expect(luminosityFor(PALETTE_MASSES.redDwarf, 'redDwarf')).toBeCloseTo(0.0316, 3);
    expect(luminosityFor(100, 'gasGiant')).toBe(0);
  });
});

describe('World.spawn', () => {
  it('derives class, radius, hit radius, luminosity and colour from mass', () => {
    const world = new World();
    const sun = world.spawn({ mass: PALETTE_MASSES.sun, x: 0, y: 0 });
    const planet = world.spawn({ mass: PALETTE_MASSES.planet, x: 300, y: 0 });

    expect(sun.starClass).toBe('yellow');
    expect(sun.radius).toBe(7);
    expect(sun.hitRadius).toBe(24);
    expect(planet.starClass).toBe('planet');
    expect(planet.hitRadius).toBe(24);
    expect(planet.luminosity).toBe(0);
    expect(sun.color).not.toEqual(planet.color);
  });

  it('formats mass with the Sun glyph for stars and the Earth glyph for the rest', () => {
    const world = new World();
    expect(formatMass(world.spawn({ mass: PALETTE_MASSES.sun, x: 0, y: 0 }))).toBe('1.0 ☉');
    expect(formatMass(world.spawn({ mass: 0.05 * SOLAR, x: 0, y: 0 }))).toBe('0.05 ☉');
    expect(formatMass(world.spawn({ mass: 1, x: 0, y: 0 }))).toBe('1.0 ⊕');
    expect(formatMass(world.spawn({ mass: 100, x: 0, y: 0 }))).toBe('100 ⊕');
  });

  it('bumps the version when bodies are added, removed, or change mass', () => {
    const world = new World();
    const v0 = world.version;
    const body = world.spawn({ mass: 1, x: 0, y: 0 });
    expect(world.version).toBe(v0 + 1);
    world.changeMass(body, 2 * SOLAR);
    expect(world.version).toBe(v0 + 2);
    expect(body.starClass).toBe('white');
    expect(world.remove(body.id)).toBe(true);
    expect(world.version).toBe(v0 + 3);
    expect(world.remove(body.id)).toBe(false);
  });
});
