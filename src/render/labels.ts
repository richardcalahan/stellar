import { CLASS_NAMES, formatMass, isStar } from '../sim/stars';
import type { World } from '../sim/world';
import type { PlaneCamera } from './camera';
import type { Hud, TextStyle } from './hud';
import type { Viewport } from './viewport';

export const LABEL_FONT = '12px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
export const LABEL_LINE_HEIGHT = 14;
/** Gap between the body's edge and the label, in CSS pixels. */
export const LABEL_GAP = 5;
/** Stars push their labels out by this many extra radii, past the bright core of the corona. */
export const STAR_LABEL_CLEARANCE = 0.5;

const LABEL_STYLE: TextStyle = {
  font: LABEL_FONT,
  color: 'rgba(255, 255, 255, 0.92)',
  outline: 'rgba(0, 0, 0, 0.6)',
};
/** Bodies this far outside the viewport still get no label. */
const MARGIN = 200;
const DIAGONAL = Math.SQRT1_2;

/**
 * A label per body on the HUD canvas, up and to the right of it: the class
 * name and the mass. A third line is reserved for temperature and status in
 * later modules. Positions come from the camera each frame, so labels stay
 * pinned to their bodies whatever the camera does.
 */
export class Labels {
  private readonly point = { x: 0, y: 0 };

  constructor(
    private readonly hud: Hud,
    private readonly camera: PlaneCamera,
  ) {}

  draw(world: World, viewport: Viewport): void {
    for (const body of world.bodies) {
      const p = this.camera.project(body.x, body.y, 0, this.point);
      if (
        p.x < -MARGIN ||
        p.y < -MARGIN ||
        p.x > viewport.width + MARGIN ||
        p.y > viewport.height + MARGIN
      ) {
        continue;
      }
      // Anchor at the 45 degree point on the body's edge, then step out by the gap.
      const clearance = isStar(body.starClass) ? body.radius * STAR_LABEL_CLEARANCE : 0;
      const edge = body.radius * DIAGONAL + clearance;
      const x = p.x + edge + LABEL_GAP;
      const y = p.y - edge - LABEL_GAP - LABEL_LINE_HEIGHT;
      this.hud.drawText(CLASS_NAMES[body.starClass], x, y, LABEL_STYLE);
      this.hud.drawText(formatMass(body), x, y + LABEL_LINE_HEIGHT, LABEL_STYLE);
    }
  }
}
