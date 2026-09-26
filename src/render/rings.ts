import { nearestMostMassive } from '../sim/orbits';
import type { World } from '../sim/world';
import type { PlaneCamera } from './camera';
import type { Hud, RingStyle } from './hud';

/** Gap between a body's edge and its held ring, in CSS pixels. */
export const HELD_RING_GAP = 6;
/** A held ring is never smaller than this, so a tiny planet still shows a clear ring. */
export const HELD_RING_MIN = 14;

const HELD_STYLE: RingStyle = { color: '#ffd84d', lineWidth: 2, dash: [6, 4], dashOffset: 0 };
const PREVIEW_STYLE: RingStyle = {
  color: 'rgba(80, 230, 120, 0.9)',
  lineWidth: 1.5,
  dash: [8, 6],
  dashOffset: 0,
};

/**
 * Rings on the HUD: a dashed yellow ring around every held body and a
 * dashed green preview of the orbit a held body will take if Orbit is on.
 * Nothing is drawn for bodies already in orbit; their trails show the path.
 */
export class Rings {
  private readonly point = { x: 0, y: 0 };
  private readonly centre = { x: 0, y: 0 };

  constructor(
    private readonly hud: Hud,
    private readonly camera: PlaneCamera,
  ) {}

  draw(world: World, now: number): void {
    HELD_STYLE.dashOffset = -now * 24;
    PREVIEW_STYLE.dashOffset = now * 18;
    for (const body of world.bodies) {
      if (body.held) {
        const p = this.camera.project(body.x, body.y, 0, this.point);
        this.hud.drawRing(
          p.x,
          p.y,
          Math.max(body.radius + HELD_RING_GAP, HELD_RING_MIN),
          HELD_STYLE,
        );
        if (body.orbiting) {
          const primary = nearestMostMassive(body, world);
          if (primary) this.orbitRing(body, primary, PREVIEW_STYLE);
        }
      }
      // Once released, an orbit draws no ring: the trail shows the path.
    }
  }

  private orbitRing(
    body: { x: number; y: number },
    primary: { x: number; y: number },
    style: RingStyle,
  ): void {
    const c = this.camera.project(primary.x, primary.y, 0, this.centre);
    const radius = Math.hypot(body.x - primary.x, body.y - primary.y);
    this.hud.drawRing(c.x, c.y, radius, style);
  }
}
