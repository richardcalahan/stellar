import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Points,
  ShaderMaterial,
} from 'three';
import { MAX_BODIES } from '../sim/constants';
import type { World } from '../sim/world';
import { CAMERA_FOV_DEG } from './camera';
import type { Resizable, Viewport } from './viewport';

/** Samples kept per body. */
export const TRAIL_POINTS = 100;
/** Seconds between samples. With TRAIL_POINTS this is the length of a trail in time. */
export const TRAIL_INTERVAL = 0.025;
export const TRAIL_SECONDS = TRAIL_POINTS * TRAIL_INTERVAL;
/** Trails sit just under the plane so bodies draw over them. */
export const TRAIL_Z = -1;
/** Width of the soft ribbon in world units. */
export const TRAIL_SIZE = 3.4;
export const TRAIL_BRIGHTNESS = 0.32;

/** A time so old that a sample stamped with it is fully faded, used to blank unused samples. */
const NEVER = -1e9;

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aTime;
  uniform float uNow;
  uniform float uSeconds;
  uniform float uScale;
  uniform float uSize;
  varying vec4 vColor;

  void main() {
    float age = uNow - aTime;
    float fade = clamp(1.0 - age / uSeconds, 0.0, 1.0);
    vColor = vec4(aColor, fade * fade);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Fresh samples are a touch wider, so the ribbon tapers as it fades.
    gl_PointSize = clamp(uSize * (0.6 + 0.4 * fade) * uScale / -mv.z, 1.0, 14.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uBrightness;
  varying vec4 vColor;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float soft = smoothstep(0.25, 0.02, r2);
    gl_FragColor = vec4(vColor.rgb * uBrightness * soft * vColor.a, soft * vColor.a);
  }
`;

interface TrailState {
  slot: number;
  head: number;
  lastSample: number;
}

/**
 * Every body's recent path as a soft ribbon of round sprites in one Points
 * draw call. Each body owns a ring of TRAIL_POINTS samples in a shared
 * buffer. A sample is written every TRAIL_INTERVAL seconds; each carries the
 * time it was written and the shader fades and narrows it against the
 * current time, so nothing on the CPU has to touch old samples.
 */
export class TrailsView implements Resizable {
  readonly points: Points;
  private readonly positions = new Float32Array(MAX_BODIES * TRAIL_POINTS * 3);
  private readonly colors = new Float32Array(MAX_BODIES * TRAIL_POINTS * 3);
  private readonly times = new Float32Array(MAX_BODIES * TRAIL_POINTS).fill(NEVER);
  private readonly positionAttr: BufferAttribute;
  private readonly colorAttr: BufferAttribute;
  private readonly timeAttr: BufferAttribute;
  private readonly trails = new Map<number, TrailState>();
  private readonly freeSlots: number[] = [];
  private readonly uNow = { value: 0 };
  private readonly uScale = { value: 1 };

  constructor() {
    for (let slot = MAX_BODIES - 1; slot >= 0; slot--) this.freeSlots.push(slot);

    const geometry = new BufferGeometry();
    this.positionAttr = new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage);
    this.colorAttr = new BufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage);
    this.timeAttr = new BufferAttribute(this.times, 1).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setAttribute('aTime', this.timeAttr);

    this.points = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uNow: this.uNow,
          uSeconds: { value: TRAIL_SECONDS },
          uScale: this.uScale,
          uSize: { value: TRAIL_SIZE },
          uBrightness: { value: TRAIL_BRIGHTNESS },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
  }

  resize({ height, pixelRatio }: Viewport): void {
    const halfFov = (CAMERA_FOV_DEG / 2) * (Math.PI / 180);
    this.uScale.value = (height * pixelRatio) / (2 * Math.tan(halfFov));
  }

  update(world: World, time: number): void {
    this.uNow.value = time;
    let dirty = false;

    const seen = new Set<number>();
    for (const body of world.bodies) {
      seen.add(body.id);
      let trail = this.trails.get(body.id);
      if (!trail) {
        const slot = this.freeSlots.pop();
        if (slot === undefined) continue;
        trail = { slot, head: 0, lastSample: time };
        this.trails.set(body.id, trail);
      }
      if (body.held) {
        // No trail behind a finger; the trail restarts at the drop point.
        trail.lastSample = time;
        continue;
      }
      if (time - trail.lastSample < TRAIL_INTERVAL) continue;

      const i = trail.slot * TRAIL_POINTS + trail.head;
      this.positions[i * 3] = body.x;
      this.positions[i * 3 + 1] = body.y;
      this.positions[i * 3 + 2] = TRAIL_Z;
      this.colors[i * 3] = body.color[0];
      this.colors[i * 3 + 1] = body.color[1];
      this.colors[i * 3 + 2] = body.color[2];
      this.times[i] = time;
      trail.head = (trail.head + 1) % TRAIL_POINTS;
      trail.lastSample = time;
      dirty = true;
    }

    for (const [id, trail] of this.trails) {
      if (seen.has(id)) continue;
      // The body is gone: blank its samples and hand the slot back.
      const start = trail.slot * TRAIL_POINTS;
      this.times.fill(NEVER, start, start + TRAIL_POINTS);
      this.trails.delete(id);
      this.freeSlots.push(trail.slot);
      dirty = true;
    }

    if (dirty) {
      this.positionAttr.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
      this.timeAttr.needsUpdate = true;
    }
  }
}
