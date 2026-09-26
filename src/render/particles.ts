import {
  AdditiveBlending,
  BufferGeometry,
  DynamicDrawUsage,
  BufferAttribute,
  Points,
  ShaderMaterial,
} from 'three';
import type { RGB } from '../sim/types';
import { CAMERA_FOV_DEG } from './camera';
import type { Resizable, Viewport } from './viewport';

export const PARTICLE_CAPACITY = 20000;
/** Largest point size in device pixels, so mobile GPUs are not asked for huge sprites. */
export const PARTICLE_MAX_SIZE = 28;

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  uniform float uMaxSize;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vColor = aColor;
    vAlpha = aAlpha;
    gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, uMaxSize);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float soft = smoothstep(0.25, 0.0, r2);
    gl_FragColor = vec4(vColor * vAlpha * soft, soft * vAlpha);
  }
`;

export interface ParticleSpec {
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  vz?: number;
  life: number;
  size: number;
  color: RGB;
}

/**
 * A pool of one-shot particles in a single Points draw call. Live particles
 * are packed at the front of the buffers; a dead one is replaced by the last
 * live one, so the draw range is always contiguous. Positions advance on the
 * CPU each frame, which is cheap for twenty thousand points.
 */
export class ParticlesView implements Resizable {
  readonly points: Points;
  private readonly positions = new Float32Array(PARTICLE_CAPACITY * 3);
  private readonly velocities = new Float32Array(PARTICLE_CAPACITY * 3);
  private readonly colors = new Float32Array(PARTICLE_CAPACITY * 3);
  private readonly sizes = new Float32Array(PARTICLE_CAPACITY);
  private readonly alphas = new Float32Array(PARTICLE_CAPACITY);
  private readonly life = new Float32Array(PARTICLE_CAPACITY);
  private readonly maxLife = new Float32Array(PARTICLE_CAPACITY);
  private readonly positionAttr: BufferAttribute;
  private readonly colorAttr: BufferAttribute;
  private readonly sizeAttr: BufferAttribute;
  private readonly alphaAttr: BufferAttribute;
  private readonly uScale = { value: 1 };
  private count = 0;

  constructor() {
    const geometry = new BufferGeometry();
    this.positionAttr = new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage);
    this.colorAttr = new BufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage);
    this.sizeAttr = new BufferAttribute(this.sizes, 1).setUsage(DynamicDrawUsage);
    this.alphaAttr = new BufferAttribute(this.alphas, 1).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setAttribute('aSize', this.sizeAttr);
    geometry.setAttribute('aAlpha', this.alphaAttr);
    geometry.setDrawRange(0, 0);

    this.points = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uScale: this.uScale, uMaxSize: { value: PARTICLE_MAX_SIZE } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  get liveCount(): number {
    return this.count;
  }

  resize({ height, pixelRatio }: Viewport): void {
    const halfFov = (CAMERA_FOV_DEG / 2) * (Math.PI / 180);
    this.uScale.value = (height * pixelRatio) / (2 * Math.tan(halfFov));
  }

  emit(spec: ParticleSpec): void {
    if (this.count >= PARTICLE_CAPACITY) return;
    const i = this.count++;
    this.positions[i * 3] = spec.x;
    this.positions[i * 3 + 1] = spec.y;
    this.positions[i * 3 + 2] = spec.z ?? 0;
    this.velocities[i * 3] = spec.vx;
    this.velocities[i * 3 + 1] = spec.vy;
    this.velocities[i * 3 + 2] = spec.vz ?? 0;
    this.colors[i * 3] = spec.color[0];
    this.colors[i * 3 + 1] = spec.color[1];
    this.colors[i * 3 + 2] = spec.color[2];
    this.sizes[i] = spec.size;
    this.life[i] = spec.life;
    this.maxLife[i] = spec.life;
    this.alphas[i] = 1;
  }

  /** An expanding ring with a slight thickness above the plane: a planetary nebula. */
  ring(
    x: number,
    y: number,
    radius: number,
    count: number,
    speed: number,
    inner: RGB,
    rim: RGB,
    life: number,
    random: () => number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const t = random();
      const v = speed * (0.7 + 0.6 * t);
      const color: RGB = [
        inner[0] + (rim[0] - inner[0]) * t,
        inner[1] + (rim[1] - inner[1]) * t,
        inner[2] + (rim[2] - inner[2]) * t,
      ];
      this.emit({
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        z: (random() - 0.5) * 16,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        vz: (random() - 0.5) * 6,
        life: life * (0.7 + 0.6 * random()),
        size: 1.2 + random() * 1.8,
        color,
      });
    }
  }

  /** A burst in every direction with a spread of speeds: a flash. */
  burst(
    x: number,
    y: number,
    count: number,
    speed: number,
    color: RGB,
    life: number,
    size: number,
    random: () => number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const v = speed * random();
      this.emit({
        x,
        y,
        z: (random() - 0.5) * 8,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: life * (0.5 + random()),
        size: size * (0.5 + random()),
        color,
      });
    }
  }

  /** A thin expanding shell, every particle at the same speed: a supernova front. */
  shell(
    x: number,
    y: number,
    count: number,
    speed: number,
    color: RGB,
    life: number,
    random: () => number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      this.emit({
        x,
        y,
        z: (random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        size: 1.4 + random() * 1.8,
        color,
      });
    }
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const remaining = (this.life[i] ?? 0) - dt;
      if (remaining <= 0) {
        this.removeAt(i);
        continue;
      }
      this.life[i] = remaining;
      this.alphas[i] = remaining / (this.maxLife[i] ?? 1);
      for (let k = 0; k < 3; k++) {
        this.positions[i * 3 + k] =
          (this.positions[i * 3 + k] ?? 0) + (this.velocities[i * 3 + k] ?? 0) * dt;
      }
      i++;
    }
    this.points.geometry.setDrawRange(0, this.count);
    this.positionAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }

  private removeAt(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (let k = 0; k < 3; k++) {
      this.positions[i * 3 + k] = this.positions[last * 3 + k] ?? 0;
      this.velocities[i * 3 + k] = this.velocities[last * 3 + k] ?? 0;
      this.colors[i * 3 + k] = this.colors[last * 3 + k] ?? 0;
    }
    this.sizes[i] = this.sizes[last] ?? 0;
    this.alphas[i] = this.alphas[last] ?? 0;
    this.life[i] = this.life[last] ?? 0;
    this.maxLife[i] = this.maxLife[last] ?? 0;
  }
}
