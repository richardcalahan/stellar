import { G, MAX_BODIES, SOFTENING } from './constants';
import { stepGravity } from './gravity';
import { createRandom, type Random } from './random';
import { setMass } from './stars';
import type { Body, BodyInit, SimEvent } from './types';

/**
 * Everything that exists and the rules that move it. Pure TypeScript: no
 * DOM, no three.js, so it runs in Node for tests and could move to a Worker.
 */
export class World {
  readonly bodies: Body[] = [];
  /** Simulated seconds since the world was created. */
  time = 0;
  /**
   * Bumped whenever a body is added or removed or changes mass, so views
   * know when to re-upload colours and sizes instead of doing it every frame.
   */
  version = 0;
  private nextId = 1;

  constructor(readonly random: Random = createRandom(1)) {}

  get isFull(): boolean {
    return this.bodies.length >= MAX_BODIES;
  }

  spawn(init: BodyInit): Body {
    if (this.isFull) throw new Error(`The table holds at most ${MAX_BODIES} bodies`);
    const body: Body = {
      id: this.nextId++,
      mass: 0,
      x: init.x,
      y: init.y,
      vx: init.vx ?? 0,
      vy: init.vy ?? 0,
      ax: 0,
      ay: 0,
      starClass: 'planet',
      radius: 0,
      hitRadius: 0,
      luminosity: 0,
      color: [0, 0, 0],
    };
    setMass(body, init.mass);
    this.bodies.push(body);
    this.version++;
    return body;
  }

  changeMass(body: Body, massEarth: number): void {
    setMass(body, massEarth);
    this.version++;
  }

  remove(id: number): boolean {
    const index = this.bodies.findIndex((body) => body.id === id);
    if (index < 0) return false;
    this.bodies.splice(index, 1);
    this.version++;
    return true;
  }

  find(id: number): Body | undefined {
    return this.bodies.find((body) => body.id === id);
  }

  /** Advance by exactly dt seconds and report what happened. */
  step(dt: number): SimEvent[] {
    stepGravity(this.bodies, dt);
    this.time += dt;
    return [];
  }

  /** Total momentum. Gravity between bodies cannot change it. */
  momentum(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const body of this.bodies) {
      x += body.mass * body.vx;
      y += body.mass * body.vy;
    }
    return { x, y };
  }

  /**
   * Kinetic plus potential energy, using the same softened potential the
   * force comes from. A good integrator keeps this nearly constant.
   */
  energy(): number {
    let total = 0;
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      const a = this.bodies[i];
      if (a === undefined) continue;
      total += 0.5 * a.mass * (a.vx * a.vx + a.vy * a.vy);
      for (let j = i + 1; j < n; j++) {
        const b = this.bodies[j];
        if (b === undefined) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        total -= (G * a.mass * b.mass) / Math.sqrt(dx * dx + dy * dy + SOFTENING * SOFTENING);
      }
    }
    return total;
  }
}
