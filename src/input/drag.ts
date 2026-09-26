import {
  FLING_MAX,
  FLING_MIN,
  FLING_SCALE,
  FLING_WINDOW_MS,
  ORBIT_BY_DEFAULT,
} from '../sim/constants';
import type { Body } from '../sim/types';
import type { World } from '../sim/world';
import { estimateVelocity, type ActivePointer, type PointerHandlers } from './pointer';

interface Hold {
  body: Body;
  pointerType: string;
  /** Motion the body had when it was picked up, restored if it is put down without a flick. */
  vx: number;
  vy: number;
}

/**
 * Turns pointers into grabs, drags, and throws. A pointer that lands on a
 * body holds it; the body follows the pointer; letting go hands the body
 * the pointer's recent velocity, scaled and capped so a flick is a throw
 * rather than a launch off the table. Put down without a flick, a body
 * keeps the motion it had before, so a tap does not stop a planet dead.
 */
export class DragController implements PointerHandlers {
  private readonly holds = new Map<number, Hold>();

  /** Called after every release or cancel with the pointer id, for the palettes. */
  onRelease: ((pointerId: number) => void) | null = null;

  constructor(private readonly world: World) {}

  /** The body a given pointer is holding, if any. */
  heldBy(pointerId: number): Body | undefined {
    return this.holds.get(pointerId)?.body;
  }

  /** The body held by the mouse, if the mouse is holding one. Keyboard shortcuts act on it. */
  mouseHeld(): Body | undefined {
    for (const hold of this.holds.values()) {
      if (hold.pointerType === 'mouse') return hold.body;
    }
    return undefined;
  }

  down(pointer: ActivePointer): void {
    const body = this.world.bodyAt(pointer.x, pointer.y);
    if (!body) return;
    const hold: Hold = { body, pointerType: pointer.pointerType, vx: body.vx, vy: body.vy };
    this.world.grab(body);
    this.world.moveHeld(body, pointer.x, pointer.y);
    this.holds.set(pointer.id, hold);
  }

  /** Spawn a new body under a pointer that came from a palette icon and hold it. */
  spawnAndHold(pointer: ActivePointer, massEarth: number): Body | null {
    if (this.world.isFull) return null;
    const body = this.world.spawn({ mass: massEarth, x: pointer.x, y: pointer.y });
    body.orbiting = ORBIT_BY_DEFAULT;
    this.world.grab(body);
    this.holds.set(pointer.id, { body, pointerType: pointer.pointerType, vx: 0, vy: 0 });
    return body;
  }

  move(pointer: ActivePointer): void {
    const hold = this.holds.get(pointer.id);
    if (hold) this.world.moveHeld(hold.body, pointer.x, pointer.y);
  }

  up(pointer: ActivePointer, timeStamp: number): void {
    const hold = this.holds.get(pointer.id);
    if (!hold) return;
    this.holds.delete(pointer.id);
    const { vx, vy } = estimateVelocity(pointer.samples, timeStamp, FLING_WINDOW_MS);
    if (Math.hypot(vx, vy) < FLING_MIN) {
      this.world.release(hold.body, hold.vx, hold.vy);
    } else {
      this.world.release(hold.body, ...scaleFling(vx, vy));
    }
    this.onRelease?.(pointer.id);
  }

  cancel(pointer: ActivePointer): void {
    const hold = this.holds.get(pointer.id);
    if (!hold) return;
    this.holds.delete(pointer.id);
    this.world.release(hold.body, hold.vx, hold.vy);
    this.onRelease?.(pointer.id);
  }

  /** Drop bodies that stopped existing (merged, blasted, or flung away) while held. */
  prune(): void {
    for (const [id, hold] of this.holds) {
      if (this.world.find(hold.body.id) !== hold.body) {
        this.holds.delete(id);
        this.onRelease?.(id);
      }
    }
  }
}

/** Apply FLING_SCALE, then cap the speed at FLING_MAX without changing the direction. */
export function scaleFling(vx: number, vy: number): [number, number] {
  let x = vx * FLING_SCALE;
  let y = vy * FLING_SCALE;
  const speed = Math.hypot(x, y);
  if (speed > FLING_MAX) {
    x *= FLING_MAX / speed;
    y *= FLING_MAX / speed;
  }
  return [x, y];
}
