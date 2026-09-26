import {
  AdditiveBlending,
  BufferGeometry,
  DynamicDrawUsage,
  BufferAttribute,
  Points,
  ShaderMaterial,
} from 'three';
import { DUST_MAX } from '../sim/constants';
import type { DustField } from '../sim/dust';
import { createRandom } from '../sim/random';
import { CAMERA_FOV_DEG } from './camera';
import type { Resizable, Viewport } from './viewport';

/** Dust floats within this many units above and below the plane, for a little volume. */
export const DUST_THICKNESS = 20;
export const DUST_POINT_SIZE = 2.6;
export const DUST_ALPHA = 0.24;

const COLD: readonly [number, number, number] = [0.5, 0.2, 0.75];
const WARM: readonly [number, number, number] = [0.25, 0.85, 0.4];
const DENSE: readonly [number, number, number] = [0.35, 1.0, 1.0];

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  uniform float uScale;
  uniform float uSize;
  varying vec3 vColor;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vColor = aColor;
    gl_PointSize = clamp(uSize * uScale / -mv.z, 1.0, 24.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vColor;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float soft = smoothstep(0.25, 0.0, r2);
    gl_FragColor = vec4(vColor * soft * uAlpha, soft * uAlpha);
  }
`;

/**
 * A Points view over the simulation's dust field. Purple where thin and
 * cold, green as it gathers, cyan where it is about to collapse. Each grain
 * gets a fixed height jitter so a nebula has a little thickness.
 */
export class DustView implements Resizable {
  readonly points: Points;
  private readonly positions = new Float32Array(DUST_MAX * 3);
  private readonly colors = new Float32Array(DUST_MAX * 3);
  private readonly jitter = new Float32Array(DUST_MAX);
  private readonly positionAttr: BufferAttribute;
  private readonly colorAttr: BufferAttribute;
  private readonly uScale = { value: 1 };

  constructor() {
    const random = createRandom(11);
    for (let i = 0; i < DUST_MAX; i++) this.jitter[i] = (random() - 0.5) * 2 * DUST_THICKNESS;

    const geometry = new BufferGeometry();
    this.positionAttr = new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage);
    this.colorAttr = new BufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setDrawRange(0, 0);

    this.points = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uScale: this.uScale,
          uSize: { value: DUST_POINT_SIZE },
          uAlpha: { value: DUST_ALPHA },
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

  update(field: DustField): void {
    const n = field.count;
    for (let i = 0; i < n; i++) {
      this.positions[i * 3] = field.x[i] ?? 0;
      this.positions[i * 3 + 1] = field.y[i] ?? 0;
      this.positions[i * 3 + 2] = this.jitter[i] ?? 0;
      const heat = field.heat[i] ?? 0;
      const [a, b, t] = heat < 0.5 ? [COLD, WARM, heat * 2] : [WARM, DENSE, (heat - 0.5) * 2];
      this.colors[i * 3] = a[0] + (b[0] - a[0]) * t;
      this.colors[i * 3 + 1] = a[1] + (b[1] - a[1]) * t;
      this.colors[i * 3 + 2] = a[2] + (b[2] - a[2]) * t;
    }
    this.points.geometry.setDrawRange(0, n);
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
  }
}
