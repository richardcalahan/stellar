import { describe, expect, it } from 'vitest';
import {
  AU,
  DT,
  G,
  NUCLEAR_AGE_SECONDS,
  NUCLEAR_WAR_CHANCE,
  SOLAR,
  STAGE_THRESHOLDS,
} from '../constants';
import { habitableZone, hazardPerSecond, stageFor } from '../habitability';
import { createRandom } from '../random';
import { World } from '../world';

describe('habitable zone', () => {
  it('sits at 240 to 480 px for the Sun and scales with the square root of luminosity', () => {
    const sun = habitableZone(1);
    expect(sun.inner).toBeCloseTo(240, 6);
    expect(sun.outer).toBeCloseTo(480, 6);
    const dwarf = habitableZone(0.1 ** 1.5);
    expect(dwarf.inner).toBeCloseTo(42.7, 0);
    expect(dwarf.outer).toBeCloseTo(85.3, 0);
    const blue = habitableZone(3 ** 1.5);
    expect(blue.inner).toBeCloseTo(547, 0);
    expect(blue.outer).toBeCloseTo(1094, 0);
  });

  it('maps habitable time onto stages', () => {
    expect(stageFor(0)).toBe('none');
    expect(stageFor(STAGE_THRESHOLDS.simple)).toBe('simple');
    expect(stageFor(STAGE_THRESHOLDS.nuclear + 1)).toBe('nuclear');
    expect(stageFor(1000)).toBe('spaceAge');
  });

  it('turns a total chance over a window into a per-second hazard', () => {
    const p = hazardPerSecond(NUCLEAR_WAR_CHANCE, NUCLEAR_AGE_SECONDS);
    expect((1 - p) ** NUCLEAR_AGE_SECONDS).toBeCloseTo(1 - NUCLEAR_WAR_CHANCE, 9);
  });
});

describe('life on a planet', () => {
  it('reaches the Space Age on schedule around a locked Sun when the dice are kind', () => {
    // A random source that never rolls under the hazard: no war, no climate collapse.
    const world = new World(() => 0.999999);
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    world.setLocked(sun, true);
    const planet = world.spawn({ mass: 1, x: AU, y: 0, vx: 0, vy: Math.sqrt((G * SOLAR) / AU) });

    let spaceAgeAt = -1;
    for (let t = 0; t < 150 && spaceAgeAt < 0; t += DT) {
      for (const event of world.step(DT)) {
        if (event.kind === 'stageChange' && event.stage === 'spaceAge') spaceAgeAt = world.time;
      }
    }
    expect(planet.status).toBe('habitable');
    expect(spaceAgeAt).toBeCloseTo(STAGE_THRESHOLDS.spaceAge, 0);
    expect(planet.civId).not.toBeNull();
  });

  it('is lava hot close in and frigid far out', () => {
    const world = new World();
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    world.setLocked(sun, true);
    const hot = world.spawn({ mass: 1, x: 100, y: 0 });
    world.setLocked(hot, true);
    const cold = world.spawn({ mass: 1, x: 900, y: 0 });
    world.setLocked(cold, true);
    world.step(DT);
    expect(hot.status).toBe('lavaHot');
    expect(cold.status).toBe('frigidIce');
  });

  it('a war world flashes and then dies', () => {
    const world = new World(() => 0);
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    world.setLocked(sun, true);
    const planet = world.spawn({ mass: 1, x: AU, y: 0 });
    world.setLocked(planet, true);
    planet.habitableTime = STAGE_THRESHOLDS.nuclear + 0.5;
    const events = world.step(DT);
    expect(planet.status).toBe('nuclearWar');
    expect(events.some((e) => e.kind === 'war' && e.cause === 'nuclear')).toBe(true);
    for (let t = 0; t < 6; t += DT) world.step(DT);
    expect(planet.status).toBe('deadWorld');
  });

  it('launches ships that colonize, and encounters follow the seeded dice', () => {
    const world = new World(createRandom(9));
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0 });
    world.setLocked(sun, true);
    const home = world.spawn({ mass: 1, x: AU, y: 0 });
    world.setLocked(home, true);
    const target = world.spawn({ mass: 1, x: AU + 200, y: 0 });
    world.setLocked(target, true);
    home.habitableTime = STAGE_THRESHOLDS.spaceAge + 1;

    let colonized = false;
    for (let t = 0; t < 40 && !colonized; t += DT) {
      for (const event of world.step(DT)) {
        if (event.kind === 'colonize' && event.outcome === 'colonized') colonized = true;
      }
    }
    expect(home.civId).not.toBeNull();
    expect(target.civId).toBe(home.civId);
    expect(target.status).toBe('colonized');
  });
});
