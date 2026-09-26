import { DT, MAX_FRAME_SECONDS, MAX_SUBSTEPS } from './sim/constants';

export interface FrameStats {
  /** Smoothed frames per second, from the interval between animation frames. */
  fps: number;
  /** Smoothed milliseconds of JavaScript work per frame (simulation plus render). */
  frameMs: number;
  /** Simulation steps run during the latest frame. */
  substeps: number;
  /** Seconds of animation time since the loop started. Drives shader effects. */
  elapsed: number;
}

export interface LoopHooks {
  /** Advance the simulation by exactly dt seconds. Called zero or more times per frame. */
  step(dt: number): void;
  /**
   * Draw the current state. alpha is how far (0 to 1) the clock has moved
   * toward the next simulation step, for interpolation later.
   */
  render(alpha: number, stats: FrameStats): void;
}

/** Weight of the newest sample in the moving averages. */
const SMOOTHING = 0.1;

/**
 * The heartbeat. The browser calls us once per display refresh (60 or 120
 * times a second, whatever the screen does). The simulation, though, runs in
 * fixed steps of DT so the physics is identical on every screen. An
 * accumulator collects real time and pays it out in whole DT steps; leftover
 * time carries into the next frame. If a frame falls far behind, we run at
 * most MAX_SUBSTEPS and drop the rest, which trades a small slowdown for
 * never spiralling into longer and longer frames.
 */
export class Loop {
  private readonly stats: FrameStats = { fps: 0, frameMs: 0, substeps: 0, elapsed: 0 };
  private accumulator = 0;
  private lastFrame = -1;
  private intervalMs = 1000 / 60;
  private handle = 0;
  private running = false;

  constructor(private readonly hooks: LoopHooks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = -1;
    this.handle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    const workStart = performance.now();

    if (this.lastFrame < 0) this.lastFrame = now;
    const rawInterval = now - this.lastFrame;
    this.lastFrame = now;

    const frameSeconds = Math.min(rawInterval / 1000, MAX_FRAME_SECONDS);
    this.accumulator += frameSeconds;

    let substeps = 0;
    while (this.accumulator >= DT && substeps < MAX_SUBSTEPS) {
      this.hooks.step(DT);
      this.accumulator -= DT;
      substeps++;
    }
    if (substeps === MAX_SUBSTEPS && this.accumulator >= DT) {
      // Too far behind to catch up this frame: drop the backlog rather than snowball.
      this.accumulator = 0;
    }

    const stats = this.stats;
    stats.substeps = substeps;
    stats.elapsed += frameSeconds;
    this.hooks.render(this.accumulator / DT, stats);

    const work = performance.now() - workStart;
    stats.frameMs += (work - stats.frameMs) * SMOOTHING;
    if (rawInterval > 0) {
      this.intervalMs += (rawInterval - this.intervalMs) * SMOOTHING;
      stats.fps = 1000 / this.intervalMs;
    }

    this.handle = requestAnimationFrame(this.tick);
  };
}
