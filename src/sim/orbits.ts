import { G, SOFTENING } from './constants';
import type { Body } from './types';
import type { World } from './world';

/**
 * Velocity for a circular, counter-clockwise orbit of body around primary,
 * on top of the primary's own motion: v = sqrt(G M / r), perpendicular to
 * the line between them.
 */
export function circularVelocity(body: Body, primary: Body): { vx: number; vy: number } {
  const dx = body.x - primary.x;
  const dy = body.y - primary.y;
  const r = Math.hypot(dx, dy);
  if (r === 0) return { vx: primary.vx, vy: primary.vy };
  const speed = Math.sqrt((G * primary.mass) / r);
  return { vx: primary.vx - (dy / r) * speed, vy: primary.vy + (dx / r) * speed };
}

/**
 * The body that pulls hardest on this one, among bodies heavier than it:
 * mass over distance squared, which is the transcript's "nearest most
 * massive" made precise. A Sun at 400 px beats a red dwarf at 300 px.
 */
export function nearestMostMassive(body: Body, world: World): Body | null {
  let best: Body | null = null;
  let bestScore = 0;
  for (const other of world.bodies) {
    if (other === body || other.mass <= body.mass) continue;
    const dx = other.x - body.x;
    const dy = other.y - body.y;
    const score = other.mass / (dx * dx + dy * dy + SOFTENING * SOFTENING);
    if (score > bestScore) {
      best = other;
      bestScore = score;
    }
  }
  return best;
}
