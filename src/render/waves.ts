import type { PlaneCamera } from './camera';
import type { Hud } from './hud';

/** Seconds the gravitational wave rings take to cross the table. */
export const WAVE_SECONDS = 5;
/** Radius the outermost ring reaches, in world units. */
export const WAVE_REACH = 900;

interface Wave {
  x: number;
  y: number;
  bornAt: number;
}

interface Pulse {
  x: number;
  y: number;
  bornAt: number;
  seconds: number;
  reach: number;
  /** "r, g, b" so the alpha can be appended each frame. */
  rgb: string;
}

/**
 * Rings drawn on the HUD: gravitational waves from a compact merger as
 * three concentric magenta rings expanding across the plane, and single
 * pulses for merges and swallows, which bloom cannot wash out.
 */
export class Waves {
  private readonly waves: Wave[] = [];
  private readonly pulses: Pulse[] = [];
  private readonly point = { x: 0, y: 0 };

  constructor(
    private readonly hud: Hud,
    private readonly camera: PlaneCamera,
  ) {}

  push(x: number, y: number, now: number): void {
    this.waves.push({ x, y, bornAt: now });
  }

  /** One ring that expands to reach world units over seconds and fades out. */
  pulse(
    x: number,
    y: number,
    now: number,
    color: readonly [number, number, number],
    reach: number,
    seconds: number,
  ): void {
    const rgb = color.map((c) => Math.round(Math.min(c, 1) * 255)).join(', ');
    this.pulses.push({ x, y, bornAt: now, seconds, reach, rgb });
  }

  draw(now: number): void {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i];
      if (wave === undefined) continue;
      const t = (now - wave.bornAt) / WAVE_SECONDS;
      if (t > 1) {
        this.waves.splice(i, 1);
        continue;
      }
      const p = this.camera.project(wave.x, wave.y, 0, this.point);
      for (const lag of [0, 0.12, 0.24]) {
        const u = t - lag;
        if (u <= 0) continue;
        const alpha = (1 - u) * 0.9;
        this.hud.drawRing(p.x, p.y, u * WAVE_REACH, {
          color: `rgba(255, 80, 230, ${alpha})`,
          lineWidth: 2,
        });
      }
    }

    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i];
      if (pulse === undefined) continue;
      const t = (now - pulse.bornAt) / pulse.seconds;
      if (t > 1) {
        this.pulses.splice(i, 1);
        continue;
      }
      const p = this.camera.project(pulse.x, pulse.y, 0, this.point);
      // Ease out: fast at first, slowing as it fades.
      const eased = 1 - (1 - t) * (1 - t);
      this.hud.drawRing(p.x, p.y, 4 + eased * pulse.reach, {
        color: `rgba(${pulse.rgb}, ${(1 - t) * 0.95})`,
        lineWidth: 3.5 - 2.5 * t,
      });
    }
  }
}
