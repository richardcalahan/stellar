import {
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { CIV_COLORS } from '../sim/civilizations';
import { AU, MAX_BODIES } from '../sim/constants';
import { stageIndex } from '../sim/habitability';
import { shines } from '../sim/stars';
import type { PlanetStatus } from '../sim/types';
import type { World } from '../sim/world';
import { STAR_LIGHT_COUNT, type StarLights } from './lights';

/** Multiplier on a star's colour so it crosses the bloom threshold and glows. */
export const STAR_EMISSIVE = 1.5;
/** Light on the night side of a planet, so it never vanishes completely. */
export const PLANET_AMBIENT = 0.08;
/** The most light one star can put on a planet, however close it gets. */
export const PLANET_MAX_LIGHT = 2.0;
/** Planets turn on their axis this fast, in radians per second, so bands and land drift. */
export const PLANET_SPIN = 0.5;

const PLANET_VERTEX = /* glsl */ `
  attribute vec4 aExtra;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vLocalNormal;
  varying vec3 vColor;
  varying vec4 vExtra;

  void main() {
    mat4 model = modelMatrix * instanceMatrix;
    vec4 world = model * vec4(position, 1.0);
    vWorldPos = world.xyz;
    // Instances are uniformly scaled spheres, so the matrix itself is fine for normals.
    vWorldNormal = normalize(mat3(model) * normal);
    vLocalNormal = normal;
    vColor = instanceColor;
    vExtra = aExtra;
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
  uniform float uTime;
  uniform vec3 uCivColors[8];
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vLocalNormal;
  varying vec3 vColor;
  varying vec4 vExtra;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 base = vColor;
    // aExtra: x = 1 for a gas giant, y = status code, z = civilization index + 1, w = life level.
    float status = vExtra.y;
    float life = vExtra.w;
    int civ = int(vExtra.z + 0.5) - 1;
    vec3 civColor = civ >= 0 && civ < 8 ? uCivColors[civ] : vec3(1.0, 0.85, 0.5);

    if (vExtra.x > 0.5) {
      // Gas giants get cloud bands across their latitude.
      float band = 0.82 + 0.18 * sin(vLocalNormal.y * 14.0 + sin(vLocalNormal.x * 5.0) * 1.5);
      base *= band;
    }
    vec3 emissive = vec3(0.0);
    if (status == 1.0) {
      // Lava hot: a cracked red glow.
      float cracks = smoothstep(0.55, 0.7, hash(floor(vLocalNormal.xy * 7.0)));
      base = mix(base, vec3(0.45, 0.12, 0.05), 0.7);
      emissive += vec3(1.0, 0.3, 0.05) * (0.25 + 0.5 * cracks);
    } else if (status == 2.0) {
      // Frigid ice: pale and blue-white.
      base = mix(base, vec3(0.85, 0.92, 1.0), 0.75);
    } else if (status == 5.0) {
      // Dead world: ash.
      base = vec3(0.26, 0.22, 0.2);
    } else if (life > 0.0) {
      // Living world: oceans and land grow with life.
      float land = step(0.5, hash(floor(vLocalNormal.xy * 5.0 + 3.0)));
      vec3 living = mix(vec3(0.15, 0.4, 0.9), vec3(0.2, 0.55, 0.2), land);
      base = mix(base, living, min(life * 1.6, 0.85));
    }
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
    float lit = max(light.r, max(light.g, light.b));
    float night = 1.0 - smoothstep(0.08, 0.35, lit);

    // City lights from the Industrial Age on, in the civilization's colour once it has one.
    if (life >= 0.7 || status == 7.0 || status == 6.0) {
      float towns = step(0.58, hash(floor(vLocalNormal.xy * 11.0 + 1.0)));
      emissive += civColor * towns * night * 0.9;
    }
    // Colonizing: a pulse of the settlers' colour.
    if (status == 6.0) {
      emissive += civColor * (0.3 + 0.3 * sin(uTime * 6.0));
    }
    // Nuclear war: white flashes across the surface.
    if (status == 4.0) {
      float cell = hash(floor(vLocalNormal.xy * 6.0) + floor(uTime * 9.0));
      emissive += vec3(1.0) * step(0.93, cell) * 2.0;
      base = mix(base, vec3(0.3, 0.25, 0.2), 0.5);
    }
    gl_FragColor = vec4(base * light + emissive, 1.0);
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
    float pulse = 1.0 + 0.03 * sin(uTime * 0.4);
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
  /** Per planet: x = 1 for a gas giant, y = status code, z = civilization hue, w = flash. */
  private readonly planetExtra: InstancedBufferAttribute;
  private readonly matrix = new Matrix4();
  private readonly spin = new Vector3();
  private readonly uTime = { value: 0 };
  private syncedVersion = -1;

  constructor(lights: StarLights) {
    const geometry = new SphereGeometry(1, 48, 32);
    const planetGeometry = geometry.clone();
    this.planetExtra = new InstancedBufferAttribute(new Float32Array(MAX_BODIES * 4), 4);
    this.planetExtra.setUsage(DynamicDrawUsage);
    planetGeometry.setAttribute('aExtra', this.planetExtra);

    this.planets = new InstancedMesh(
      planetGeometry,
      new ShaderMaterial({
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
        uniforms: {
          ...lights.uniforms,
          uAmbient: { value: PLANET_AMBIENT },
          uMaxLight: { value: PLANET_MAX_LIGHT },
          uAu: { value: AU },
          uTime: this.uTime,
          uCivColors: { value: civColorTable() },
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
      // Black holes go through the star shader too: black times anything is black.
      const star = shines(body) || body.remnant === 'blackHole';
      const mesh = star ? this.stars : this.planets;
      const index = star ? starCount++ : planetCount++;
      if (star) {
        this.matrix.makeScale(body.radius, body.radius, body.radius);
      } else {
        this.matrix.makeRotationZ(timeSeconds * PLANET_SPIN * (1 + (body.id % 5) * 0.15));
        this.spin.setScalar(body.radius);
        this.matrix.scale(this.spin);
      }
      this.matrix.setPosition(body.x, body.y, 0);
      mesh.setMatrixAt(index, this.matrix);
      if (colorsDirty) {
        const colors = star ? this.starColors : this.planetColors;
        colors.setXYZ(index, body.color[0], body.color[1], body.color[2]);
      }
      if (!star) {
        const civIndex =
          body.civId === null ? -1 : world.civilizations.findIndex((c) => c.id === body.civId);
        this.planetExtra.setXYZW(
          index,
          body.starClass === 'gasGiant' ? 1 : 0,
          STATUS_CODES[body.status],
          civIndex + 1,
          (stageIndex(body.lifeStage) + 1) / 8,
        );
      }
    }

    this.planets.count = planetCount;
    this.stars.count = starCount;
    this.planets.instanceMatrix.needsUpdate = true;
    this.stars.instanceMatrix.needsUpdate = true;
    this.planetExtra.needsUpdate = true;
    if (colorsDirty) {
      this.planetColors.needsUpdate = true;
      this.starColors.needsUpdate = true;
      this.syncedVersion = world.version;
    }
  }
}

/** Status codes the planet shader understands. */
const STATUS_CODES: Record<PlanetStatus, number> = {
  none: 0,
  lavaHot: 1,
  frigidIce: 2,
  habitable: 3,
  nuclearWar: 4,
  deadWorld: 5,
  colonizing: 6,
  colonized: 7,
};

function civColorTable(): Float32Array {
  const table = new Float32Array(8 * 3);
  CIV_COLORS.forEach((color, i) => {
    table[i * 3] = color[0];
    table[i * 3 + 1] = color[1];
    table[i * 3 + 2] = color[2];
  });
  return table;
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
