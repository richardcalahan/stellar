import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';

/** Vertical field of view in degrees. Narrow, so the top-down view has only a little perspective. */
export const CAMERA_FOV_DEG = 30;

/** How far below the plane the camera can still see. The starfield lives down there. */
export const CAMERA_FAR_BELOW_PLANE = 4000;

/** A point on the screen in CSS pixels: origin top-left, y grows downward. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** A point on the simulation plane (z = 0): 1 unit = 1 CSS pixel, origin at screen centre, y grows upward. */
export interface PlanePoint {
  x: number;
  y: number;
}

/**
 * A perspective camera on the z axis looking straight down at the z = 0 plane,
 * placed at exactly the height where that plane fills the viewport. Because of
 * that fit, one world unit on the plane is one CSS pixel on screen, which is
 * what lets the simulation think in pixels while the renderer draws in 3D.
 *
 * Objects above the plane (z > 0) are closer to the camera and appear slightly
 * larger. That is the depth cue for discs, jets, and satellites later on.
 *
 * All input goes through screenToPlane and all HUD drawing through project, so
 * the camera can tilt or move later without touching the input or HUD code.
 */
export class PlaneCamera {
  /** The three.js camera the renderer draws with. */
  readonly three: PerspectiveCamera;

  private width = 1;
  private height = 1;
  private readonly plane = new Plane(new Vector3(0, 0, 1), 0);
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly scratch = new Vector3();

  constructor(width: number, height: number) {
    this.three = new PerspectiveCamera(CAMERA_FOV_DEG, 1, 1, 1);
    this.three.up.set(0, 1, 0);
    this.resize(width, height);
  }

  /**
   * The height above the plane at which the plane exactly fills a viewport of
   * the given height: half the viewport divided by tan of half the field of view.
   * At 30 degrees this is about 1.87 times the viewport height.
   */
  static heightFor(viewportHeight: number): number {
    const halfFov = (CAMERA_FOV_DEG / 2) * (Math.PI / 180);
    return viewportHeight / 2 / Math.tan(halfFov);
  }

  /** Height of the camera above the plane for the current viewport. */
  get heightAbovePlane(): number {
    return this.three.position.z;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const h = PlaneCamera.heightFor(height);
    this.three.aspect = width / height;
    this.three.near = 10;
    this.three.far = h + CAMERA_FAR_BELOW_PLANE;
    this.three.position.set(0, 0, h);
    this.three.lookAt(0, 0, 0);
    this.three.updateProjectionMatrix();
    this.three.updateMatrixWorld();
  }

  /** World point to CSS pixels on screen. */
  project(x: number, y: number, z = 0, out: ScreenPoint = { x: 0, y: 0 }): ScreenPoint {
    this.scratch.set(x, y, z).project(this.three);
    out.x = (this.scratch.x + 1) * 0.5 * this.width;
    out.y = (1 - this.scratch.y) * 0.5 * this.height;
    return out;
  }

  /** CSS pixel on screen to the point on the z = 0 plane under it, by casting a ray. */
  screenToPlane(px: number, py: number, out: PlanePoint = { x: 0, y: 0 }): PlanePoint | null {
    this.ndc.set((px / this.width) * 2 - 1, 1 - (py / this.height) * 2);
    this.raycaster.setFromCamera(this.ndc, this.three);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.scratch);
    if (!hit) return null;
    out.x = hit.x;
    out.y = hit.y;
    return out;
  }

  /** Screen pixels per world unit for something at height z. Exactly 1 on the plane. */
  scaleAt(z: number): number {
    const h = this.three.position.z;
    return h / (h - z);
  }
}
