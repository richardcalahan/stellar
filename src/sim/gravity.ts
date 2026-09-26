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
 *
 * Three flags bend the rules. A held body goes where the finger goes. A
 * locked body that is not orbiting is frozen in place. A locked body that
 * is orbiting feels only its primary, so a passing star cannot disturb it.
 * All of them still pull on everything else.
 */
export function stepGravity(bodies: readonly Body[], dt: number): void {
  for (const body of bodies) {
    body.ax = 0;
    body.ay = 0;
  }

  let exclusive: Map<number, number> | null = null;
  for (const body of bodies) {
    if (body.locked && body.orbiting && body.primaryId !== null) {
      exclusive ??= new Map();
      exclusive.set(body.id, body.primaryId);
    }
  }

  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    if (a === undefined) continue;
    const onlyA = exclusive?.get(a.id);
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      if (b === undefined) continue;
      const onlyB = exclusive?.get(b.id);
      const aFeels = onlyA === undefined || onlyA === b.id;
      const bFeels = onlyB === undefined || onlyB === a.id;
      if (!aFeels && !bFeels) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r2 = dx * dx + dy * dy + EPS2;
      const inv = G / (r2 * Math.sqrt(r2));
      const fx = dx * inv;
      const fy = dy * inv;
      if (aFeels) {
        a.ax += fx * b.mass;
        a.ay += fy * b.mass;
      }
      if (bFeels) {
        b.ax -= fx * a.mass;
        b.ay -= fy * a.mass;
      }
    }
  }

  if (USE_SEMI_IMPLICIT_EULER) {
    for (const body of bodies) {
      if (isPinned(body)) continue;
      body.vx += body.ax * dt;
      body.vy += body.ay * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    }
  } else {
    for (const body of bodies) {
      if (isPinned(body)) continue;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.vx += body.ax * dt;
      body.vy += body.ay * dt;
    }
  }
}

/** Held, or locked in place (locked and not orbiting): gravity does not move it. */
export function isPinned(body: Body): boolean {
  return body.held || (body.locked && !body.orbiting);
}
