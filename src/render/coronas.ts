import {
  AdditiveBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Camera,
} from 'three';
import { MAX_BODIES } from '../sim/constants';
import { shines } from '../sim/stars';
import type { Body } from '../sim/types';
import type { World } from '../sim/world';
import { prepareInstances } from './bodies';

/** The corona quad is this many star radii across. The demo's glow fades out by about 3 radii. */
export const CORONA_SIZE_FACTOR = 8;
/** The bright core occupies this fraction of the quad; the rest is the faint aurora. */
export const CORONA_CORE_FRACTION = 6 / 8;
/** Brightness of the aurora curtains relative to the core. */
export const CORONA_AURORA = 0.3;
/** Multiplier on the star colour for the corona. The corona, not bloom, carries the glow. */
export const CORONA_EMISSIVE = 1.6;
/** A red giant's halo is this much wider than a main sequence star's of the same radius. */
export const RED_GIANT_HALO = 1.2;
/** Luminous stars get a wider halo: size grows by this fraction per decade of luminosity. */
export const HALO_PER_DECADE = 0.2;
/** No corona wider than this, in world units, however bright the star. */
export const CORONA_MAX_SIZE = 220;
/** Ripples travel outward through the corona at this rate, in radians per second: 1.2 is one crest every 5 s. */
export const CORONA_RIPPLE_SPEED = 1.2;
/** How deep the ripples are, as a fraction of the glow. */
export const CORONA_RIPPLE_DEPTH = 0.18;
/** How fast the rays turn, in radians per second: 0.25 is one turn every 25 s. */
export const CORONA_RAY_SPEED = 0.25;
/** How fast the corona breathes, in radians per second. */
export const CORONA_BREATHE_SPEED = 0.5;

const VERTEX = /* glsl */ `
  attribute float aPhase;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;

  void main() {
    vUv = uv;
    vColor = instanceColor;
    // A fixed phase per star, so stars do not breathe in step. It must never depend on
    // position: a phase that moves with the star re-rolls the pattern every frame.
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uEmissive;
  uniform float uTime;
  uniform float uRippleSpeed;
  uniform float uRippleDepth;
  uniform float uRaySpeed;
  uniform float uCoreScale;
  uniform float uAurora;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float angle = atan(p.y, p.x);
    float t = uTime;

    // The bright core lives in the inner part of the quad; c is the distance in core units.
    float c = min(d * uCoreScale, 1.0);
    float glow = pow(1.0 - c, 2.4);
    vec2 q = p * uCoreScale;
    float streakX = pow(max(0.0, 1.0 - abs(q.y) * 8.0), 2.0) * pow(max(0.0, 1.0 - abs(q.x)), 1.5);
    float streakY = pow(max(0.0, 1.0 - abs(q.x) * 8.0), 2.0) * pow(max(0.0, 1.0 - abs(q.y)), 1.5);
    float rays = 0.5 + 0.5 * sin(angle * 6.0 + t * uRaySpeed + vPhase);
    float fine = 0.5 + 0.5 * sin(angle * 13.0 - t * uRaySpeed * 1.6 + vPhase * 2.0);
    float rayMask = smoothstep(0.2, 0.9, c) * pow(1.0 - c, 1.3);
    float flare = (0.45 * rays + 0.3 * fine) * rayMask;
    float ripple = 1.0 + uRippleDepth * sin(c * 9.0 - t * uRippleSpeed + vPhase);
    float core = (glow + flare * 0.7 + (streakX + streakY) * 0.25) * ripple;

    // Faint curtains of light drifting slowly around the star, outside the core, undulating
    // in and out like an aurora in a breeze, in the star's own colour.
    float wave1 = sin(angle * 3.0 + t * 0.35 + vPhase + 1.5 * sin(d * 6.0 - t * 0.45 + vPhase));
    float wave2 = sin(angle * 7.0 - t * 0.22 + vPhase * 2.0 + sin(d * 11.0 + t * 0.3));
    float auroraMask = smoothstep(0.1, 0.35, d) * pow(max(0.0, 1.0 - d), 2.2);
    float curtains = (max(0.0, wave1) + max(0.0, wave2) * 0.7) * auroraMask * uAurora;

    // Additive blending with alpha 1: what we output is what gets added.
    vec3 light = vColor * (core + curtains);
    gl_FragColor = vec4(light * uEmissive, 1.0);
  }
`;

/** How wide a body's corona should be, in world units. */
export function coronaSize(body: Body): number {
  let size = body.radius * CORONA_SIZE_FACTOR;
  if (body.phase === 'redGiant') size *= RED_GIANT_HALO;
  size *= 1 + HALO_PER_DECADE * Math.log10(1 + body.luminosity);
  return Math.min(size, CORONA_MAX_SIZE);
}

/**
 * One billboard quad per shining body, drawn additively over the spheres.
 * The quads copy the camera's rotation each frame, so they keep facing it
 * if the camera ever tilts. Black holes get no corona.
 */
export class CoronasView {
  readonly mesh: InstancedMesh;
  private readonly colors: InstancedBufferAttribute;
  private readonly phases: InstancedBufferAttribute;
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly uTime = { value: 0 };
  private syncedVersion = -1;

  constructor() {
    const geometry = new PlaneGeometry(1, 1);
    this.phases = new InstancedBufferAttribute(new Float32Array(MAX_BODIES), 1);
    this.phases.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aPhase', this.phases);
    this.mesh = new InstancedMesh(
      geometry,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uEmissive: { value: CORONA_EMISSIVE },
          uTime: this.uTime,
          uRippleSpeed: { value: CORONA_RIPPLE_SPEED },
          uRippleDepth: { value: CORONA_RIPPLE_DEPTH },
          uRaySpeed: { value: CORONA_RAY_SPEED },
          uCoreScale: { value: 1 / CORONA_CORE_FRACTION },
          uAurora: { value: CORONA_AURORA },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
      MAX_BODIES,
    );
    // Transparent effects draw after the opaque spheres.
    this.mesh.renderOrder = 1;
    this.colors = prepareInstances(this.mesh);
  }

  sync(world: World, camera: Camera, timeSeconds: number): void {
    this.uTime.value = timeSeconds;
    const colorsDirty = world.version !== this.syncedVersion;
    let count = 0;

    for (const body of world.bodies) {
      if (!shines(body)) continue;
      // Breathing: a slow four percent swell, out of step between stars.
      const size =
        coronaSize(body) *
        (1 + 0.03 * Math.sin(timeSeconds * CORONA_BREATHE_SPEED + body.id * 1.3));
      this.position.set(body.x, body.y, 0);
      this.scale.set(size, size, 1);
      this.matrix.compose(this.position, camera.quaternion, this.scale);
      this.mesh.setMatrixAt(count, this.matrix);
      if (colorsDirty) {
        this.colors.setXYZ(count, body.color[0], body.color[1], body.color[2]);
        this.phases.setX(count, ((body.id * 0.6180339) % 1) * Math.PI * 2);
      }
      count++;
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colorsDirty) {
      this.colors.needsUpdate = true;
      this.phases.needsUpdate = true;
      this.syncedVersion = world.version;
    }
  }
}
