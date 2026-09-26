import { TOAST_SECONDS } from '../sim/constants';
import type { SimEvent } from '../sim/types';
import type { PlaneCamera } from './camera';
import type { Hud } from './hud';

interface Toast {
  text: string;
  x: number;
  y: number;
  bornAt: number;
}

const FONT = '600 12px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
/** Vertical offset above the event point, in CSS pixels. */
const RISE = 26;

/** Short pill-shaped messages that appear beside an event and fade out. */
export class Toasts {
  private readonly toasts: Toast[] = [];
  private readonly point = { x: 0, y: 0 };

  constructor(
    private readonly hud: Hud,
    private readonly camera: PlaneCamera,
  ) {}

  push(text: string, x: number, y: number, now: number): void {
    this.toasts.push({ text, x, y, bornAt: now });
  }

  /** Turn simulation events into messages, in the demo's wording where it had one. */
  consume(events: readonly SimEvent[], now: number): void {
    for (const event of events) {
      const text = textFor(event);
      if (text) this.push(text, event.x, event.y, now);
    }
  }

  draw(now: number): void {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const toast = this.toasts[i];
      if (toast === undefined) continue;
      const age = now - toast.bornAt;
      if (age > TOAST_SECONDS) {
        this.toasts.splice(i, 1);
        continue;
      }
      const alpha = age < TOAST_SECONDS - 0.5 ? 1 : (TOAST_SECONDS - age) / 0.5;
      const p = this.camera.project(toast.x, toast.y, 0, this.point);
      this.hud.drawPill(toast.text, p.x, p.y - RISE - age * 6, {
        font: FONT,
        color: `rgba(255, 255, 255, ${alpha})`,
        background: `rgba(30, 30, 40, ${0.8 * alpha})`,
        border: `rgba(255, 255, 255, ${0.35 * alpha})`,
      });
    }
  }
}

function textFor(event: SimEvent): string | null {
  switch (event.kind) {
    case 'merge':
      // The demo shows nothing for a merge: the bodies become one and the label changes.
      return null;
    case 'death':
      if (event.remnant === null) return 'Type Ia Supernova';
      if (event.remnant === 'blackHole') return 'Created BlackHole';
      return `${event.name} Created`;
    case 'ignite':
      return `${event.name} Ignited`;
    case 'collapse':
      return 'Protostar Forming';
    case 'swallow':
      return 'Swallowed';
    case 'grb':
      return 'Gamma Ray Burst';
    case 'stageChange':
      return event.label;
    case 'war':
      switch (event.cause) {
        case 'nuclear':
          return 'NUCLEAR WAR';
        case 'climate':
          return 'Climate Collapse';
        case 'attack':
          return 'Invaded';
        case 'sterilized':
          return 'Sterilized';
      }
      break;
    case 'colonize':
      switch (event.outcome) {
        case 'colonizing':
          return 'Colonizing';
        case 'colonized':
          return 'Colonized';
        case 'cooperate':
          return 'Cooperation';
        case 'attack':
          return 'Attack';
      }
      break;
    case 'shipLaunch':
      return null;
  }
  return null;
}
