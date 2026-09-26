import type { PlanePoint } from '../render/camera';

/** One position report from a pointer, in plane coordinates, with the event time in ms. */
export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

/** Newest samples kept per pointer. Sixteen covers 130 ms at 120 Hz, more than the fling window. */
const SAMPLE_CAPACITY = 16;

/** A finger, pen, or mouse button that is currently down. */
export class ActivePointer {
  readonly samples: PointerSample[] = [];
  x = 0;
  y = 0;

  constructor(
    readonly id: number,
    readonly pointerType: string,
  ) {}

  push(x: number, y: number, t: number): void {
    this.x = x;
    this.y = y;
    this.samples.push({ x, y, t });
    if (this.samples.length > SAMPLE_CAPACITY) this.samples.shift();
  }
}

/**
 * Velocity over the samples inside the window before `now`, in plane units
 * per second. Using a window rather than the last two events smooths out
 * jittery touch reports, and a finger that stopped before lifting gives zero
 * because its old samples fall outside the window.
 */
export function estimateVelocity(
  samples: readonly PointerSample[],
  now: number,
  windowMs: number,
): { vx: number; vy: number } {
  let first: PointerSample | undefined;
  let last: PointerSample | undefined;
  for (const sample of samples) {
    if (now - sample.t > windowMs || sample.t > now) continue;
    first ??= sample;
    last = sample;
  }
  if (!first || !last || last === first) return { vx: 0, vy: 0 };
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

export interface PointerHandlers {
  down(pointer: ActivePointer): void;
  move(pointer: ActivePointer): void;
  up(pointer: ActivePointer, timeStamp: number): void;
  cancel(pointer: ActivePointer): void;
}

/**
 * One code path for mouse, touch, and pen through Pointer Events. Each finger
 * is a pointer with its own id; a mouse is one pointer. Down is listened for
 * on the canvas, but move, up, and cancel go on the window, so a drag that
 * starts on a palette card later still finishes wherever the finger lifts.
 */
export class PointerTracker {
  readonly pointers = new Map<number, ActivePointer>();

  constructor(
    private readonly target: HTMLElement,
    private readonly toPlane: (px: number, py: number) => PlanePoint | null,
    private readonly handlers: PointerHandlers,
  ) {}

  install(): void {
    this.target.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    // The browser must never turn a touch into a scroll, a zoom, or a menu.
    this.target.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    document.addEventListener('gesturestart', (event) => {
      event.preventDefault();
    });
    document.addEventListener(
      'touchmove',
      (event) => {
        event.preventDefault();
      },
      { passive: false },
    );
  }

  /**
   * Take over a pointer whose pointerdown happened on another element (a
   * palette icon). From here on it is tracked like one that started on the
   * canvas, so the same move and release handlers finish the gesture.
   */
  adopt(event: PointerEvent): ActivePointer | null {
    const point = this.toPlane(event.clientX, event.clientY);
    if (!point) return null;
    const pointer = new ActivePointer(event.pointerId, event.pointerType);
    pointer.push(point.x, point.y, event.timeStamp);
    this.pointers.set(event.pointerId, pointer);
    try {
      this.target.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners still catch the release.
    }
    return pointer;
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = this.toPlane(event.clientX, event.clientY);
    if (!point) return;
    const pointer = new ActivePointer(event.pointerId, event.pointerType);
    pointer.push(point.x, point.y, event.timeStamp);
    this.pointers.set(event.pointerId, pointer);
    try {
      this.target.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers refuse capture for synthetic pointers. Window listeners still catch the release.
    }
    event.preventDefault();
    this.handlers.down(pointer);
  };

  private readonly onMove = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    // Browsers batch high-rate touch reports; unpack them so the fling estimate sees every one.
    const events = 'getCoalescedEvents' in event ? event.getCoalescedEvents() : [event];
    for (const each of events.length > 0 ? events : [event]) {
      const point = this.toPlane(each.clientX, each.clientY);
      if (point) pointer.push(point.x, point.y, each.timeStamp);
    }
    this.handlers.move(pointer);
  };

  private readonly onUp = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    const point = this.toPlane(event.clientX, event.clientY);
    if (point) pointer.push(point.x, point.y, event.timeStamp);
    this.pointers.delete(event.pointerId);
    this.handlers.up(pointer, event.timeStamp);
  };

  private readonly onCancel = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    this.pointers.delete(event.pointerId);
    this.handlers.cancel(pointer);
  };
}
