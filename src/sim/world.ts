import { CIV_COLORS, stepCivilizations } from './civilizations';
import { resolveCollisions } from './collisions';
import { DUST_EVERY, G, MAX_BODIES, SOFTENING, TABLE_RADIUS } from './constants';
import { DustField } from './dust';
import { stepEvolution } from './evolution';
import { stepGravity } from './gravity';
import { stepHabitability } from './habitability';
import { circularVelocity, nearestMostMassive } from './orbits';
import { createRandom, type Random } from './random';
import { setMass } from './stars';
import type { Body, BodyInit, Civilization, Ship, SimEvent } from './types';

/**
 * Everything that exists and the rules that move it. Pure TypeScript: no
 * DOM, no three.js, so it runs in Node for tests and could move to a Worker.
 */
export class World {
  readonly bodies: Body[] = [];
  readonly dust = new DustField();
  readonly civilizations: Civilization[] = [];
  readonly ships: Ship[] = [];
  /** When each spacefaring planet next launches a ship, in world time. */
  readonly launchTimers = new Map<number, number>();
  /** Simulated seconds since the world was created. */
  time = 0;
  /**
   * Bumped whenever a body is added or removed or changes mass, so views
   * know when to re-upload colours and sizes instead of doing it every frame.
   */
  version = 0;
  nextShipId = 1;
  private nextId = 1;
  private nextCivId = 1;
  private stepsSinceDust = 0;

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
      age: 0,
      lifetime: Infinity,
      phase: 'main',
      remnant: null,
      starClass: 'planet',
      radius: 0,
      hitRadius: 0,
      luminosity: 0,
      temperature: 0,
      color: [0, 0, 0],
      habitableTime: 0,
      lifeStage: 'none',
      status: 'none',
      statusAge: 0,
      civId: null,
      held: false,
      locked: false,
      orbiting: false,
      primaryId: null,
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
    for (const body of this.bodies) {
      if (body.primaryId === id) body.primaryId = null;
    }
    this.launchTimers.delete(id);
    this.version++;
    return true;
  }

  find(id: number): Body | undefined {
    return this.bodies.find((body) => body.id === id);
  }

  /** Wipe the table: bodies, dust, ships, and civilizations. */
  reset(): void {
    this.bodies.length = 0;
    this.dust.clear();
    this.ships.length = 0;
    this.civilizations.length = 0;
    this.launchTimers.clear();
    this.version++;
  }

  foundCivilization(home: Body): Civilization {
    const id = this.nextCivId++;
    const color = CIV_COLORS[(id - 1) % CIV_COLORS.length] ?? [1, 1, 1];
    const civilization: Civilization = { id, color, homeId: home.id };
    this.civilizations.push(civilization);
    return civilization;
  }

  civilization(id: number | null): Civilization | undefined {
    if (id === null) return undefined;
    return this.civilizations.find((civ) => civ.id === id);
  }

  /** The nearest body whose hit radius covers the point, ignoring bodies already held. */
  bodyAt(x: number, y: number): Body | null {
    let best: Body | null = null;
    let bestDistance = Infinity;
    for (const body of this.bodies) {
      if (body.held) continue;
      const distance = Math.hypot(body.x - x, body.y - y);
      if (distance <= body.hitRadius && distance < bestDistance) {
        best = body;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Pin a body to a pointer. It stops moving on its own but keeps pulling on the others. */
  grab(body: Body): void {
    body.held = true;
    body.vx = 0;
    body.vy = 0;
  }

  moveHeld(body: Body, x: number, y: number): void {
    body.x = x;
    body.y = y;
  }

  /**
   * Let go. An orbiting body is put on a circular orbit around the body
   * that pulls on it hardest, whatever the finger was doing; a locked body
   * that is not orbiting stays put; anything else takes the given velocity.
   */
  release(body: Body, vx: number, vy: number): void {
    body.held = false;
    if (body.orbiting) {
      const primary = nearestMostMassive(body, this);
      if (primary) {
        body.primaryId = primary.id;
        const v = circularVelocity(body, primary);
        body.vx = v.vx;
        body.vy = v.vy;
        return;
      }
      body.primaryId = null;
    }
    if (body.locked) {
      body.vx = 0;
      body.vy = 0;
      return;
    }
    body.vx = vx;
    body.vy = vy;
  }

  /** Locking a body that is not orbiting freezes it where it is. */
  setLocked(body: Body, locked: boolean): void {
    body.locked = locked;
    if (locked && !body.orbiting) {
      body.vx = 0;
      body.vy = 0;
    }
  }

  /** Turning orbit on for a free body puts it on a circular orbit right away. */
  setOrbiting(body: Body, orbiting: boolean): void {
    body.orbiting = orbiting;
    if (!orbiting) {
      body.primaryId = null;
      return;
    }
    if (!body.held) this.release(body, body.vx, body.vy);
  }

  /** Advance by exactly dt seconds and report what happened. */
  step(dt: number): SimEvent[] {
    const events: SimEvent[] = [];
    stepGravity(this.bodies, dt);
    resolveCollisions(this, events);
    stepEvolution(this, dt, events);
    stepHabitability(this, dt, events);
    stepCivilizations(this, dt, events);
    if (++this.stepsSinceDust >= DUST_EVERY) {
      this.stepsSinceDust = 0;
      this.dust.step(this, dt * DUST_EVERY, events);
    }
    this.pruneFar();
    this.time += dt;
    return events;
  }

  /** Bodies flung far off the table are gone for good. */
  private pruneFar(): void {
    for (const body of [...this.bodies]) {
      if (!body.held && Math.hypot(body.x, body.y) > TABLE_RADIUS) this.remove(body.id);
    }
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
