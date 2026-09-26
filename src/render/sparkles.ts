import { shines } from '../sim/stars';
import type { World } from '../sim/world';
import type { ParticlesView } from './particles';

/** Sparkles a star throws off per second. */
export const SPARKLE_RATE = 2;
/** Leave this much of the particle pool free for real events. */
export const SPARKLE_POOL_LIMIT = 14000;

/**
 * A steady drizzle of tiny sparks drifting off every star in its own
 * colour: the cheapest way to make a quiet table look alive.
 */
export class Sparkles {
  private accumulator = 0;

  constructor(
    private readonly particles: ParticlesView,
    private readonly random: () => number,
  ) {}

  update(world: World, dt: number): void {
    this.accumulator += dt * SPARKLE_RATE;
    if (this.accumulator < 1) return;
    const bursts = Math.floor(this.accumulator);
    this.accumulator -= bursts;
    if (this.particles.liveCount > SPARKLE_POOL_LIMIT) return;

    for (const body of world.bodies) {
      if (body.remnant === 'blackHole') {
        this.infall(body, bursts * INFALL_PER_SPARKLE);
        continue;
      }
      if (!shines(body)) continue;
      const boost = 1 + Math.log10(1 + body.luminosity);
      for (let i = 0; i < bursts; i++) {
        const angle = this.random() * Math.PI * 2;
        const speed = (4 + this.random() * 9) * boost;
        const start = body.radius * 1.1;
        this.particles.emit({
          x: body.x + Math.cos(angle) * start,
          y: body.y + Math.sin(angle) * start,
          z: (this.random() - 0.5) * 6,
          vx: body.vx + Math.cos(angle) * speed,
          vy: body.vy + Math.sin(angle) * speed,
          vz: (this.random() - 0.5) * 4,
          life: 2.5 + this.random() * 2,
          size: 1.2 + this.random() * 1.2,
          color: [body.color[0] * 1.3, body.color[1] * 1.3, body.color[2] * 1.3],
        });
      }
    }
  }

  /** Gas spiralling into a black hole: sparks launched sideways with an inward drift. */
  private infall(
    hole: { x: number; y: number; vx: number; vy: number; radius: number },
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const start = hole.radius * (3.5 + this.random() * 3);
      const tangential = 30 + this.random() * 30;
      const inward = 18 + this.random() * 14;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const heat = this.random();
      this.particles.emit({
        x: hole.x + cos * start,
        y: hole.y + sin * start,
        z: (this.random() - 0.5) * 5,
        vx: hole.vx - sin * tangential - cos * inward,
        vy: hole.vy + cos * tangential - sin * inward,
        life: 0.8 + this.random() * 0.7,
        size: 1.5 + this.random() * 1.5,
        color: [1.3, 0.55 + heat * 0.6, 0.15 + heat * 0.5],
      });
    }
  }
}

/** Infall sparks per sparkle tick for a black hole. */
const INFALL_PER_SPARKLE = 4;
