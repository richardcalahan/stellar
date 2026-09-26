import {
  BLACK_HOLE_DUST_REACH,
  COLLAPSE_CELL,
  COLLAPSE_INTERVAL,
  COLLAPSE_MASS,
  COLLAPSE_SPEED,
  DUST_DRAG,
  DUST_MAX,
  DUST_SOFTENING,
  DUST_SOURCES,
  G,
  SOLAR,
  WIND_TO_GRAVITY,
} from './constants';
import { becomeRemnant } from './death';
import { shines } from './stars';
import type { Body, SimEvent } from './types';
import type { World } from './world';

interface Cell {
  mass: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  indices: number[];
}

/**
 * Nebula dust: many light particles that feel the gravity and the solar
 * wind of the heaviest bodies, slow down, and collapse into protostars
 * where they pile up. Stored as flat arrays so twelve thousand of them cost
 * a fraction of a millisecond per step.
 */
export class DustField {
  readonly x = new Float32Array(DUST_MAX);
  readonly y = new Float32Array(DUST_MAX);
  readonly vx = new Float32Array(DUST_MAX);
  readonly vy = new Float32Array(DUST_MAX);
  readonly mass = new Float32Array(DUST_MAX);
  /** 0 cold and thin, 1 dense enough to collapse. Set by the clump pass, read by the renderer. */
  readonly heat = new Float32Array(DUST_MAX);
  count = 0;
  private sinceClumpPass = 0;

  clear(): void {
    this.count = 0;
  }

  /** Throw totalMass of dust outward from a ring, as count particles. */
  emit(
    cx: number,
    cy: number,
    radius: number,
    totalMass: number,
    count: number,
    speed: number,
    random: () => number,
  ): void {
    const each = totalMass / count;
    for (let i = 0; i < count && this.count < DUST_MAX; i++) {
      const angle = random() * Math.PI * 2;
      const v = speed * (0.5 + random());
      const tangent = (random() - 0.5) * speed * 0.4;
      const n = this.count++;
      this.x[n] = cx + Math.cos(angle) * radius;
      this.y[n] = cy + Math.sin(angle) * radius;
      this.vx[n] = Math.cos(angle) * v - Math.sin(angle) * tangent;
      this.vy[n] = Math.sin(angle) * v + Math.cos(angle) * tangent;
      this.mass[n] = each;
      this.heat[n] = 0;
    }
  }

  step(world: World, dt: number, events: SimEvent[]): void {
    const sources = [...world.bodies].sort((a, b) => b.mass - a.mass).slice(0, DUST_SOURCES);
    const eps2 = DUST_SOFTENING * DUST_SOFTENING;
    const keep = Math.max(0, 1 - DUST_DRAG * dt);
    const swallowed = new Map<Body, number>();

    let i = 0;
    while (i < this.count) {
      let ax = 0;
      let ay = 0;
      let eaten = false;
      const px = this.x[i] ?? 0;
      const py = this.y[i] ?? 0;
      for (const body of sources) {
        const dx = body.x - px;
        const dy = body.y - py;
        const r2 = dx * dx + dy * dy + eps2;
        const inv = 1 / (r2 * Math.sqrt(r2));
        let pull = G * body.mass * inv;
        if (shines(body)) {
          pull -= WIND_TO_GRAVITY * G * SOLAR * body.luminosity * inv;
        } else if (
          body.remnant === 'blackHole' &&
          r2 < (body.radius * BLACK_HOLE_DUST_REACH) ** 2 + eps2
        ) {
          swallowed.set(body, (swallowed.get(body) ?? 0) + (this.mass[i] ?? 0));
          eaten = true;
          break;
        }
        ax += dx * pull;
        ay += dy * pull;
      }
      if (eaten) {
        this.remove(i);
        continue;
      }
      const vx = ((this.vx[i] ?? 0) + ax * dt) * keep;
      const vy = ((this.vy[i] ?? 0) + ay * dt) * keep;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.x[i] = px + vx * dt;
      this.y[i] = py + vy * dt;
      i++;
    }

    for (const [hole, mass] of swallowed) world.changeMass(hole, hole.mass + mass);

    this.sinceClumpPass += dt;
    if (this.sinceClumpPass >= COLLAPSE_INTERVAL) {
      this.sinceClumpPass = 0;
      this.clumpPass(world, events);
    }
  }

  /**
   * Bin the dust on a grid. A cell holding enough slow-moving mass collapses
   * into a protostar of that mass at the cell's centre of mass, with its
   * mean velocity. Every particle learns how crowded its cell is, for colour.
   */
  private clumpPass(world: World, events: SimEvent[]): void {
    const cells = new Map<number, Cell>();
    for (let i = 0; i < this.count; i++) {
      const cx = Math.floor((this.x[i] ?? 0) / COLLAPSE_CELL);
      const cy = Math.floor((this.y[i] ?? 0) / COLLAPSE_CELL);
      const key = cx * 100003 + cy;
      let cell = cells.get(key);
      if (!cell) {
        cell = { mass: 0, x: 0, y: 0, vx: 0, vy: 0, indices: [] };
        cells.set(key, cell);
      }
      const m = this.mass[i] ?? 0;
      cell.mass += m;
      cell.x += (this.x[i] ?? 0) * m;
      cell.y += (this.y[i] ?? 0) * m;
      cell.vx += (this.vx[i] ?? 0) * m;
      cell.vy += (this.vy[i] ?? 0) * m;
      cell.indices.push(i);
    }

    const threshold = COLLAPSE_MASS * SOLAR;
    const doomed = new Set<number>();
    for (const cell of cells.values()) {
      const crowd = Math.min(cell.mass / threshold, 1);
      for (const index of cell.indices) this.heat[index] = crowd;
      if (cell.mass < threshold || world.isFull) continue;

      const mvx = cell.vx / cell.mass;
      const mvy = cell.vy / cell.mass;
      let spread = 0;
      for (const index of cell.indices) {
        const dvx = (this.vx[index] ?? 0) - mvx;
        const dvy = (this.vy[index] ?? 0) - mvy;
        spread += ((this.mass[index] ?? 0) * (dvx * dvx + dvy * dvy)) / cell.mass;
      }
      if (Math.sqrt(spread) > COLLAPSE_SPEED) continue;

      const body = world.spawn({
        mass: cell.mass,
        x: cell.x / cell.mass,
        y: cell.y / cell.mass,
        vx: mvx,
        vy: mvy,
      });
      becomeRemnant(body, 'protostar', cell.mass);
      world.version++;
      for (const index of cell.indices) doomed.add(index);
      events.push({
        kind: 'collapse',
        x: body.x,
        y: body.y,
        bodyId: body.id,
        massEarth: cell.mass,
      });
    }

    if (doomed.size > 0) {
      let write = 0;
      for (let read = 0; read < this.count; read++) {
        if (doomed.has(read)) continue;
        if (write !== read) this.copy(read, write);
        write++;
      }
      this.count = write;
    }
  }

  private remove(i: number): void {
    const last = --this.count;
    if (i !== last) this.copy(last, i);
  }

  private copy(from: number, to: number): void {
    this.x[to] = this.x[from] ?? 0;
    this.y[to] = this.y[from] ?? 0;
    this.vx[to] = this.vx[from] ?? 0;
    this.vy[to] = this.vy[from] ?? 0;
    this.mass[to] = this.mass[from] ?? 0;
    this.heat[to] = this.heat[from] ?? 0;
  }
}
