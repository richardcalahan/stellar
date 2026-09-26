import { describe, expect, it } from 'vitest';
import { AU, DT, G, SOFTENING, SOLAR, T_REF } from '../constants';
import { createRandom } from '../random';
import { World } from '../world';

describe('units', () => {
  it('derives G from Kepler so an Earth at one AU circles a Sun in T_REF seconds', () => {
    expect(G).toBeCloseTo((4 * Math.PI ** 2 * AU ** 3) / (T_REF ** 2 * SOLAR), 9);
    const circular = Math.sqrt((G * SOLAR) / AU);
    expect(circular).toBeCloseTo((2 * Math.PI * AU) / T_REF, 6);
    expect((2 * Math.PI * AU) / circular).toBeCloseTo(T_REF, 6);
  });
});

describe('gravity', () => {
  it('accelerates two equal masses toward each other symmetrically', () => {
    const world = new World();
    const a = world.spawn({ mass: SOLAR, x: -100, y: 0 });
    const b = world.spawn({ mass: SOLAR, x: 100, y: 0 });
    world.step(DT);

    expect(a.vx).toBeGreaterThan(0);
    expect(b.vx).toBeCloseTo(-a.vx, 12);
    expect(a.vy).toBe(0);
    expect(b.vy).toBe(0);

    const r = 200;
    const expected = ((G * SOLAR * r) / (r * r + SOFTENING * SOFTENING) ** 1.5) * DT;
    expect(a.vx).toBeCloseTo(expected, 9);
  });

  it('conserves the momentum of an isolated system to 1e-9 over 1000 steps', () => {
    const random = createRandom(42);
    const world = new World(random);
    const masses = [SOLAR, 0.3 * SOLAR, 100, 5, 1, 1];
    for (const mass of masses) {
      world.spawn({
        mass,
        x: (random() * 2 - 1) * 600,
        y: (random() * 2 - 1) * 600,
        vx: (random() * 2 - 1) * 100,
        vy: (random() * 2 - 1) * 100,
      });
    }
    const before = world.momentum();
    let scale = 0;
    for (const body of world.bodies) scale += body.mass * Math.hypot(body.vx, body.vy);

    for (let i = 0; i < 1000; i++) world.step(DT);

    const after = world.momentum();
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1e-9 * scale);
  });

  it('keeps an Earth at one AU on a T_REF second orbit with under 1 percent energy drift over 10 laps', () => {
    const world = new World();
    const speed = Math.sqrt((G * SOLAR) / AU);
    // The Sun gets the opposite momentum so the pair does not drift as a whole.
    const sun = world.spawn({ mass: SOLAR, x: 0, y: 0, vx: 0, vy: -speed / SOLAR });
    // Ten laps outlast the Sun's 200 second life; this test is about the integrator, not death.
    sun.lifetime = Infinity;
    const earth = world.spawn({ mass: 1, x: AU, y: 0, vx: 0, vy: speed });
    const energyBefore = world.energy();

    let angle = 0;
    let previous = Math.atan2(earth.y - sun.y, earth.x - sun.x);
    const steps = Math.round((10 * T_REF) / DT);
    for (let i = 0; i < steps; i++) {
      world.step(DT);
      const current = Math.atan2(earth.y - sun.y, earth.x - sun.x);
      let delta = current - previous;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      angle += delta;
      previous = current;
    }

    const laps = angle / (2 * Math.PI);
    const period = (steps * DT) / laps;
    expect(Math.abs(period - T_REF) / T_REF).toBeLessThan(0.02);

    const distance = Math.hypot(earth.x - sun.x, earth.y - sun.y);
    expect(Math.abs(distance - AU) / AU).toBeLessThan(0.02);

    const drift = Math.abs((world.energy() - energyBefore) / energyBefore);
    expect(drift).toBeLessThan(0.01);
  });
});
