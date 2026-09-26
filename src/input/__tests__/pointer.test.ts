import { describe, expect, it } from 'vitest';
import { FLING_MAX, FLING_SCALE } from '../../sim/constants';
import { scaleFling } from '../drag';
import { estimateVelocity, type PointerSample } from '../pointer';

function line(
  vx: number,
  vy: number,
  count: number,
  stepMs: number,
  startT = 1000,
): PointerSample[] {
  const samples: PointerSample[] = [];
  for (let i = 0; i < count; i++) {
    const t = startT + i * stepMs;
    samples.push({ x: (vx * (t - startT)) / 1000, y: (vy * (t - startT)) / 1000, t });
  }
  return samples;
}

describe('estimateVelocity', () => {
  it('recovers the velocity of a straight drag from the samples in the window', () => {
    const samples = line(300, -120, 12, 8);
    const now = samples[samples.length - 1]?.t ?? 0;
    const v = estimateVelocity(samples, now, 90);
    expect(v.vx).toBeCloseTo(300, 6);
    expect(v.vy).toBeCloseTo(-120, 6);
  });

  it('ignores samples older than the window', () => {
    const slow = line(20, 0, 10, 10, 0);
    const fast = line(500, 0, 5, 10, 500);
    const samples = [...slow, ...fast];
    const now = 540;
    expect(estimateVelocity(samples, now, 90).vx).toBeCloseTo(500, 6);
  });

  it('gives zero when the finger stopped before lifting, or there is only one sample', () => {
    const samples = line(400, 0, 6, 10, 0);
    expect(estimateVelocity(samples, 1000, 90)).toEqual({ vx: 0, vy: 0 });
    expect(estimateVelocity([{ x: 1, y: 2, t: 5 }], 5, 90)).toEqual({ vx: 0, vy: 0 });
  });
});

describe('scaleFling', () => {
  it('scales a flick and caps its speed without changing direction', () => {
    const [x, y] = scaleFling(300, 400);
    expect(x).toBeCloseTo(300 * FLING_SCALE, 9);
    expect(y).toBeCloseTo(400 * FLING_SCALE, 9);

    const [cx, cy] = scaleFling(30000, 40000);
    expect(Math.hypot(cx, cy)).toBeCloseTo(FLING_MAX, 9);
    expect(cx / cy).toBeCloseTo(0.75, 9);
  });
});
