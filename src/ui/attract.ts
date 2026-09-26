import { ATTRACT_IDLE_SECONDS } from '../sim/constants';

/**
 * Attract mode: after a few idle minutes the table clears itself and plays
 * a demo, so a public installation never sits showing yesterday's chaos.
 * Any touch or key press counts as activity.
 */
export class Attract {
  private lastActivity = performance.now();

  constructor(private readonly onIdle: () => void) {
    const touched = (): void => {
      this.lastActivity = performance.now();
    };
    window.addEventListener('pointerdown', touched, { passive: true });
    window.addEventListener('keydown', touched);
  }

  update(): void {
    const idle = (performance.now() - this.lastActivity) / 1000;
    if (idle < ATTRACT_IDLE_SECONDS) return;
    this.lastActivity = performance.now();
    this.onIdle();
  }
}
