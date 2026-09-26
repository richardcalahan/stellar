import {
  AdditiveBlending,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type Camera,
  type InstancedBufferAttribute,
} from 'three';
import { MAX_BODIES } from '../sim/constants';
import { isStar } from '../sim/stars';
import type { World } from '../sim/world';
import { prepareInstances } from './bodies';

/** The corona quad is this many star radii across. */
export const CORONA_SIZE_FACTOR = 6;
/** Multiplier on the star colour for the corona. Only its core crosses the bloom threshold. */
export const CORONA_EMISSIVE = 1.3;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uEmissive;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    // Soft halo that fades to nothing at the edge of the quad.
    float glow = pow(max(0.0, 1.0 - d), 2.4);
    // A faint four-point flare: thin across, long along each axis.
    float streakX = pow(max(0.0, 1.0 - abs(p.y) * 8.0), 2.0) * pow(max(0.0, 1.0 - abs(p.x)), 1.5);
    float streakY = pow(max(0.0, 1.0 - abs(p.x) * 8.0), 2.0) * pow(max(0.0, 1.0 - abs(p.y)), 1.5);
    float shimmer = 0.94 + 0.06 * sin(uTime * 2.3 + d * 9.0);
    float intensity = (glow * 0.9 + (streakX + streakY) * 0.25) * shimmer;
    // Additive blending: this adds colour * intensity to whatever is behind.
    gl_FragColor = vec4(vColor * uEmissive, intensity);
  }
`;

/**
 * One billboard quad per star, drawn additively over the spheres. The quads
 * copy the camera's rotation each frame, so they keep facing it if the
 * camera ever tilts.
 */
export class CoronasView {
  readonly mesh: InstancedMesh;
  private readonly colors: InstancedBufferAttribute;
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly uTime = { value: 0 };
  private syncedVersion = -1;

  constructor() {
    this.mesh = new InstancedMesh(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uEmissive: { value: CORONA_EMISSIVE }, uTime: this.uTime },
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
      if (!isStar(body.starClass)) continue;
      const size = body.radius * CORONA_SIZE_FACTOR;
      this.position.set(body.x, body.y, 0);
      this.scale.set(size, size, 1);
      this.matrix.compose(this.position, camera.quaternion, this.scale);
      this.mesh.setMatrixAt(count, this.matrix);
      if (colorsDirty) this.colors.setXYZ(count, body.color[0], body.color[1], body.color[2]);
      count++;
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colorsDirty) {
      this.colors.needsUpdate = true;
      this.syncedVersion = world.version;
    }
  }
}
