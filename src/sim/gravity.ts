import { G, SOFTENING, USE_SEMI_IMPLICIT_EULER } from './constants';
import type { Body } from './types';

const EPS2 = SOFTENING * SOFTENING;

/**
 * Newton's law for every pair, then one integration step.
 *
 * For each pair the acceleration per unit of the other body's mass is
 * G / (r^2 + eps^2)^(3/2) along the line between them. That factor is
 * computed once per pair and applied to both bodies with opposite signs,
 * so momentum is conserved to rounding error.
 *
 * Semi-implicit Euler updates velocity first and then moves the body with
 * the new velocity. Plain Euler moves it with the old velocity. The
 * difference looks trivial and is not: plain Euler pumps energy into every
 * orbit, semi-implicit Euler keeps energy bounded forever.
 */
export function stepGravity(bodies: readonly Body[], dt: number): void {
  for (const body of bodies) {
    body.ax = 0;
    body.ay = 0;
  }

  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      if (b === undefined) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r2 = dx * dx + dy * dy + EPS2;
      const inv = G / (r2 * Math.sqrt(r2));
      const fx = dx * inv;
      const fy = dy * inv;
      a.ax += fx * b.mass;
      a.ay += fy * b.mass;
      b.ax -= fx * a.mass;
      b.ay -= fy * a.mass;
    }
  }

  if (USE_SEMI_IMPLICIT_EULER) {
    for (const body of bodies) {
      body.vx += body.ax * dt;
      body.vy += body.ay * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    }
  } else {
    for (const body of bodies) {
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.vx += body.ax * dt;
      body.vy += body.ay * dt;
    }
  }
}
