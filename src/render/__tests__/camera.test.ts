import { describe, expect, it } from 'vitest';
import { PlaneCamera } from '../camera';

const VIEWPORTS: readonly (readonly [number, number])[] = [
  [1920, 1080],
  [1024, 768],
  [3840, 2160],
  [390, 844],
  [2560, 1080],
];

function planeAt(camera: PlaneCamera, px: number, py: number): { x: number; y: number } {
  const point = camera.screenToPlane(px, py);
  if (!point) throw new Error(`No plane hit at ${px}, ${py}`);
  return point;
}

describe('PlaneCamera', () => {
  it('sits at the height where the plane exactly fills the viewport', () => {
    expect(PlaneCamera.heightFor(1080)).toBeCloseTo(2015.31, 1);

    for (const [width, height] of VIEWPORTS) {
      const camera = new PlaneCamera(width, height);
      const topLeft = planeAt(camera, 0, 0);
      const bottomRight = planeAt(camera, width, height);
      expect(topLeft.x).toBeCloseTo(-width / 2, 3);
      expect(topLeft.y).toBeCloseTo(height / 2, 3);
      expect(bottomRight.x).toBeCloseTo(width / 2, 3);
      expect(bottomRight.y).toBeCloseTo(-height / 2, 3);
    }
  });

  it('projects the world origin to the centre of the screen', () => {
    for (const [width, height] of VIEWPORTS) {
      const camera = new PlaneCamera(width, height);
      const centre = camera.project(0, 0, 0);
      expect(centre.x).toBeCloseTo(width / 2, 6);
      expect(centre.y).toBeCloseTo(height / 2, 6);
    }
  });

  it('round-trips screen to plane to screen within 0.01 px', () => {
    for (const [width, height] of VIEWPORTS) {
      const camera = new PlaneCamera(width, height);
      const samples: readonly (readonly [number, number])[] = [
        [0, 0],
        [width, 0],
        [0, height],
        [width, height],
        [width / 2, height / 2],
        [width * 0.13, height * 0.71],
        [width * 0.9, height * 0.05],
      ];
      for (const [sx, sy] of samples) {
        const onPlane = planeAt(camera, sx, sy);
        const back = camera.project(onPlane.x, onPlane.y, 0);
        expect(Math.hypot(back.x - sx, back.y - sy)).toBeLessThan(0.01);
      }
    }
  });

  it('keeps one world unit equal to one CSS pixel through a resize', () => {
    const camera = new PlaneCamera(1920, 1080);
    camera.resize(1024, 768);
    const a = camera.project(0, 0, 0);
    const b = camera.project(100, 0, 0);
    expect(b.x - a.x).toBeCloseTo(100, 3);
    expect(camera.scaleAt(0)).toBe(1);
  });

  it('magnifies points above the plane by a little', () => {
    const camera = new PlaneCamera(1920, 1080);
    expect(camera.scaleAt(40)).toBeCloseTo(1.0203, 3);
    const raised = camera.project(100, 0, 40);
    expect(raised.x - 960).toBeCloseTo(102.03, 1);
  });
});
