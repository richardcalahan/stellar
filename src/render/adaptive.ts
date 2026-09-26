import { getPixelRatioCap, MAX_PIXEL_RATIO, setPixelRatioCap } from './viewport';

/** Frames over this many milliseconds of work count as missed. */
export const FRAME_BUDGET_MS = 18;
/** Consecutive missed frames before the pixel ratio drops a step. */
export const MISSES_BEFORE_DROP = 120;
/** Consecutive comfortable frames (under half the budget) before it climbs back. */
export const HITS_BEFORE_RAISE = 2400;

/**
 * The performance pass: when a device cannot hold the frame budget, render
 * fewer pixels. Bloom and particles cost per pixel, so 1.5 on an iPad is
 * the difference between 45 and 60 frames a second.
 */
export class AdaptiveResolution {
  private misses = 0;
  private hits = 0;

  constructor(private readonly onChange: () => void) {}

  update(frameMs: number): void {
    if (frameMs > FRAME_BUDGET_MS) {
      this.misses++;
      this.hits = 0;
      if (this.misses >= MISSES_BEFORE_DROP && getPixelRatioCap() > 1) {
        setPixelRatioCap(getPixelRatioCap() - 0.5);
        this.misses = 0;
        this.onChange();
      }
      return;
    }
    this.misses = 0;
    if (frameMs < FRAME_BUDGET_MS / 2) {
      this.hits++;
      if (this.hits >= HITS_BEFORE_RAISE && getPixelRatioCap() < MAX_PIXEL_RATIO) {
        setPixelRatioCap(getPixelRatioCap() + 0.5);
        this.hits = 0;
        this.onChange();
      }
    }
  }
}
