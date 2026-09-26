import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from 'three';
import { createRandom } from '../sim/random';
import { CAMERA_FOV_DEG } from './camera';
import type { Resizable, Viewport } from './viewport';

export const STAR_COUNT = 2000;
/** The starfield floats in a slab this far below the simulation plane (world units). */
export const STARFIELD_NEAR_Z = -1200;
export const STARFIELD_FAR_Z = -3000;
/** Half-width of the slab. Wide enough that a 4K viewport never sees its edge. */
export const STARFIELD_HALF_SPREAD = 4200;
/** Star size range in world units. At these depths one unit is roughly one device pixel. */
export const STAR_SIZE_MIN = 1.4;
export const STAR_SIZE_MAX = 3.6;
/** Peak star brightness, in linear light. Kept under the bloom threshold so the sky never glows. */
export const STAR_BRIGHTNESS = 0.6;

/** Faint white, red, and blue, weighted toward white. */
const TINTS: readonly (readonly [number, number, number])[] = [
  [1.0, 1.0, 1.0],
  [1.0, 1.0, 1.0],
  [1.0, 1.0, 1.0],
  [1.0, 1.0, 1.0],
  [1.0, 0.72, 0.62],
  [0.66, 0.78, 1.0],
];

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float speed = 0.5 + aPhase * 1.5;
    vTwinkle = 0.7 + 0.3 * sin(uTime * speed + aPhase * 6.2831853);
    vColor = aColor;
    // Size attenuation: a length of aSize world units at this depth, in device pixels.
    gl_PointSize = max(1.0, aSize * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uBrightness;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float alpha = smoothstep(0.25, 0.0, r2);
    gl_FragColor = vec4(vColor * uBrightness * vTwinkle, alpha);
  }
`;

/**
 * A distant field of points far below the plane. Being far away, it barely
 * moves if the camera ever tilts, and its size attenuation is exact: a star of
 * aSize world units covers aSize * uScale / depth device pixels, where uScale
 * is the projection scale of the current viewport.
 */
export class Starfield implements Resizable {
  readonly points: Points;
  private readonly uTime = { value: 0 };
  private readonly uScale = { value: 1 };
  private readonly uBrightness = { value: STAR_BRIGHTNESS };

  constructor(seed = 7) {
    const random = createRandom(seed);
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (random() * 2 - 1) * STARFIELD_HALF_SPREAD;
      positions[i * 3 + 1] = (random() * 2 - 1) * STARFIELD_HALF_SPREAD;
      positions[i * 3 + 2] = STARFIELD_FAR_Z + random() * (STARFIELD_NEAR_Z - STARFIELD_FAR_Z);
      const tint = TINTS[Math.floor(random() * TINTS.length)] ?? TINTS[0];
      if (tint) {
        colors[i * 3] = tint[0];
        colors[i * 3 + 1] = tint[1];
        colors[i * 3 + 2] = tint[2];
      }
      // Squared so most stars are small and a few are bright.
      const t = random();
      sizes[i] = STAR_SIZE_MIN + (STAR_SIZE_MAX - STAR_SIZE_MIN) * t * t;
      phases[i] = random();
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new Float32BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new Float32BufferAttribute(phases, 1));

    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uTime: this.uTime, uScale: this.uScale, uBrightness: this.uBrightness },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
  }

  resize({ height, pixelRatio }: Viewport): void {
    const halfFov = (CAMERA_FOV_DEG / 2) * (Math.PI / 180);
    this.uScale.value = (height * pixelRatio) / (2 * Math.tan(halfFov));
  }

  update(timeSeconds: number): void {
    this.uTime.value = timeSeconds;
  }
}
