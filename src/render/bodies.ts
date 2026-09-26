import {
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  SphereGeometry,
  type InstancedBufferAttribute,
} from 'three';
import { AU, MAX_BODIES } from '../sim/constants';
import { isStar } from '../sim/stars';
import type { World } from '../sim/world';
import { STAR_LIGHT_COUNT, type StarLights } from './lights';

/** Multiplier on a star's colour so it crosses the bloom threshold and glows. */
export const STAR_EMISSIVE = 1.5;
/** Light on the night side of a planet, so it never vanishes completely. */
export const PLANET_AMBIENT = 0.04;
/** The most light one star can put on a planet, however close it gets. */
export const PLANET_MAX_LIGHT = 2.0;

const PLANET_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vColor;

  void main() {
    mat4 model = modelMatrix * instanceMatrix;
    vec4 world = model * vec4(position, 1.0);
    vWorldPos = world.xyz;
    // Instances are uniformly scaled spheres, so the matrix itself is fine for normals.
    vWorldNormal = normalize(mat3(model) * normal);
    vColor = instanceColor;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const PLANET_FRAGMENT = /* glsl */ `
  #define MAX_LIGHTS ${STAR_LIGHT_COUNT}
  uniform vec3 uLightPos[MAX_LIGHTS];
  uniform vec3 uLightColor[MAX_LIGHTS];
  uniform float uLightStrength[MAX_LIGHTS];
  uniform int uLightCount;
  uniform float uAmbient;
  uniform float uMaxLight;
  uniform float uAu;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vColor;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 light = vec3(uAmbient);
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec3 toLight = uLightPos[i] - vWorldPos;
      float d2 = dot(toLight, toLight);
      vec3 l = toLight * inversesqrt(d2);
      // Lambert diffuse with a soft terminator, so day fades into night instead of snapping.
      float lambert = smoothstep(-0.12, 0.4, dot(n, l));
      // Inverse square falloff measured in AU, floored so a star on top of a planet does not blow out.
      float falloff = uAu * uAu / (d2 + 0.25 * uAu * uAu);
      light += uLightColor[i] * (lambert * min(uLightStrength[i] * falloff, uMaxLight));
    }
    gl_FragColor = vec4(vColor * light, 1.0);
  }
`;

const STAR_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vColor;

  void main() {
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vView = normalize(-mv.xyz);
    vColor = instanceColor;
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  uniform float uEmissive;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vColor;

  void main() {
    // Limb darkening: the edge of a star looks dimmer than its centre.
    float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    float limb = 0.45 + 0.55 * pow(mu, 0.6);
    float pulse = 1.0 + 0.03 * sin(uTime * 1.7);
    gl_FragColor = vec4(vColor * uEmissive * limb * pulse, 1.0);
  }
`;

/**
 * Every body on the table, drawn as two instanced meshes that share one
 * sphere: planets and gas giants lit by the star lights, and stars that
 * shine on their own. Two hundred spheres cost two draw calls.
 *
 * Positions and sizes are re-uploaded every frame (they change every frame).
 * Colours are re-uploaded only when the world's version changes.
 */
export class BodiesView {
  readonly group = new Group();
  private readonly planets: InstancedMesh;
  private readonly stars: InstancedMesh;
  private readonly planetColors: InstancedBufferAttribute;
  private readonly starColors: InstancedBufferAttribute;
  private readonly matrix = new Matrix4();
  private readonly uTime = { value: 0 };
  private syncedVersion = -1;

  constructor(lights: StarLights) {
    const geometry = new SphereGeometry(1, 48, 32);

    this.planets = new InstancedMesh(
      geometry,
      new ShaderMaterial({
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
        uniforms: {
          ...lights.uniforms,
          uAmbient: { value: PLANET_AMBIENT },
          uMaxLight: { value: PLANET_MAX_LIGHT },
          uAu: { value: AU },
        },
      }),
      MAX_BODIES,
    );

    this.stars = new InstancedMesh(
      geometry,
      new ShaderMaterial({
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        uniforms: { uEmissive: { value: STAR_EMISSIVE }, uTime: this.uTime },
      }),
      MAX_BODIES,
    );

    this.planetColors = prepareInstances(this.planets);
    this.starColors = prepareInstances(this.stars);
    this.group.add(this.planets, this.stars);
  }

  sync(world: World, timeSeconds: number): void {
    this.uTime.value = timeSeconds;
    const colorsDirty = world.version !== this.syncedVersion;
    let planetCount = 0;
    let starCount = 0;

    for (const body of world.bodies) {
      const star = isStar(body.starClass);
      const mesh = star ? this.stars : this.planets;
      const index = star ? starCount++ : planetCount++;
      this.matrix.makeScale(body.radius, body.radius, body.radius).setPosition(body.x, body.y, 0);
      mesh.setMatrixAt(index, this.matrix);
      if (colorsDirty) {
        const colors = star ? this.starColors : this.planetColors;
        colors.setXYZ(index, body.color[0], body.color[1], body.color[2]);
      }
    }

    this.planets.count = planetCount;
    this.stars.count = starCount;
    this.planets.instanceMatrix.needsUpdate = true;
    this.stars.instanceMatrix.needsUpdate = true;
    if (colorsDirty) {
      this.planetColors.needsUpdate = true;
      this.starColors.needsUpdate = true;
      this.syncedVersion = world.version;
    }
  }
}

/** Allocate the per-instance colour buffer and mark both buffers as changing every frame. */
export function prepareInstances(mesh: InstancedMesh): InstancedBufferAttribute {
  mesh.setColorAt(0, new Color(0, 0, 0));
  const colors = mesh.instanceColor;
  if (!colors) throw new Error('InstancedMesh did not allocate instance colours');
  colors.setUsage(DynamicDrawUsage);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  // The shared sphere's bounding volume says nothing about where instances are.
  mesh.frustumCulled = false;
  mesh.count = 0;
  return colors;
}
