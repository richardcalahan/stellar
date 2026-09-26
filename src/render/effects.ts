import {
  AdditiveBlending,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Body, RGB } from '../sim/types';
import type { World } from '../sim/world';

/** Accretion and protostar discs are tilted this far out of the plane, in radians. */
export const DISC_TILT = 1.05;
/** Seconds a gamma-ray burst beam stays visible. */
export const GRB_SECONDS = 2.2;

const DISC_VERTEX = /* glsl */ `
  varying vec2 vLocal;
  varying vec2 vUv;
  void main() {
    vLocal = position.xy;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Protostar disc: a soft swirl in one colour. */
const DISC_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uInner;
  uniform float uOuter;
  uniform float uTime;
  uniform float uSpeed;
  varying vec2 vLocal;

  void main() {
    float r = length(vLocal);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float angle = atan(vLocal.y, vLocal.x);
    float swirl = 0.55 + 0.45 * sin(angle * 3.0 + t * 14.0 - uTime * uSpeed);
    float fade = (1.0 - t) * smoothstep(0.0, 0.15, t);
    float glow = pow(1.0 - t, 1.6);
    gl_FragColor = vec4(uColor * (swirl * fade + glow * 0.6), fade);
  }
`;

/**
 * Accretion disc: gas spiralling into a black hole. The inner edge orbits
 * fastest (Keplerian), glows white-hot and cools to deep red outward, the
 * side swinging toward the viewer is brighter (Doppler beaming), and it is
 * streaked, banded, and flickering all the way round.
 */
const ACCRETION_FRAGMENT = /* glsl */ `
  uniform float uInner;
  uniform float uOuter;
  uniform float uTime;
  uniform float uSpeed;
  varying vec2 vLocal;

  void main() {
    float r = length(vLocal);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float angle = atan(vLocal.y, vLocal.x);
    // Keplerian: the inner edge orbits fastest.
    float omega = uSpeed / pow(0.25 + t, 1.5);
    float a = angle - uTime * omega;
    // Two smooth spiral arms and a gentle finer texture; no sharp streaks.
    float arms = 0.65 + 0.35 * sin(a * 2.0 + t * 9.0);
    float fine = 0.88 + 0.12 * sin(a * 7.0 - t * 5.0 + uTime * 0.4);
    vec3 hot = vec3(1.7, 1.4, 1.05);
    vec3 mid = vec3(1.2, 0.5, 0.12);
    vec3 cold = vec3(0.4, 0.06, 0.02);
    vec3 col = t < 0.35 ? mix(hot, mid, t / 0.35) : mix(mid, cold, (t - 0.35) / 0.65);
    // Doppler beaming: the side swinging toward the viewer is brighter.
    float beam = 0.65 + 0.55 * sin(angle + 1.2);
    float edge = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.6, 1.0, t));
    float flicker = 0.94 + 0.06 * sin(uTime * 2.6 + angle);
    float intensity = edge * arms * fine * beam * flicker;
    gl_FragColor = vec4(col * intensity, edge);
  }
`;

/** The void: a soft black disc that swallows the light behind the hole, so it reads as a hole. */
const VOID_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float breathe = 1.0 + 0.05 * sin(uTime * 0.6);
    float dark = smoothstep(1.0, 0.3, d * breathe);
    gl_FragColor = vec4(0.0, 0.0, 0.0, dark * 0.9);
  }
`;

/** A photon ring: light bent all the way round the shadow, a thin hot ring that shivers. */
const HALO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float angle = atan(p.y, p.x);
    float wobble = 0.03 * sin(angle * 4.0 + uTime * 3.0);
    float ring = exp(-pow((d - 0.42 - wobble) / 0.05, 2.0));
    float glow = pow(max(0.0, 1.0 - d), 2.5) * smoothstep(0.3, 0.5, d) * 0.6;
    float shimmer = 0.85 + 0.15 * sin(uTime * 7.0 + angle * 6.0);
    float shadow = smoothstep(0.34, 0.4, d);
    float intensity = (ring * 1.6 + glow) * shimmer * shadow;
    vec3 col = mix(vec3(1.0, 0.6, 0.25), vec3(1.0, 0.95, 0.85), ring);
    gl_FragColor = vec4(col * intensity, intensity);
  }
`;

/**
 * Relativistic jets as glowing ribbons: a white-blue core inside a soft blue
 * sheath, widening toward the tip, with bright knots racing outward and a
 * sway that grows along the length like a plasma stream in a wind.
 * u runs across the ribbon, v from the hole (0) to the tip (1).
 */
const JET_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const JET_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float v = vUv.y;
    float u = vUv.x * 2.0 - 1.0;
    float t = uTime;
    float sway = 0.18 * v * sin(v * 7.0 - t * 1.6) + 0.06 * v * sin(v * 19.0 + t * 2.7);
    float x = u - sway;
    float width = mix(0.28, 1.0, v);
    float core = exp(-pow(x / (0.14 * width), 2.0));
    float sheath = exp(-pow(x / (0.55 * width), 2.0)) * 0.4;
    float knots = 0.55 + 0.45 * sin(v * 22.0 - t * 5.0) * sin(v * 6.0 - t * 1.7);
    float fade = pow(1.0 - v, 1.1) * smoothstep(0.0, 0.04, v);
    float flicker = 0.92 + 0.08 * sin(t * 9.0 + v * 25.0);
    vec3 sheathColor = vec3(0.45, 0.75, 1.5);
    vec3 coreColor = vec3(1.3, 1.5, 1.9);
    vec3 light = coreColor * core * (0.6 + 0.6 * knots) + sheathColor * sheath;
    gl_FragColor = vec4(light * fade * flicker, 1.0);
  }
`;

/** Jet ribbon size in world units, before the per-hole scale. */
const JET_LENGTH = 60;
const JET_WIDTH = 10;

interface BodyEffect {
  root: Group;
  remnant: Body['remnant'];
  spinner: Object3D | null;
  uTime: { value: number } | null;
}

interface Burst {
  root: Group;
  bornAt: number;
  material: MeshBasicMaterial;
}

/**
 * Three-dimensional dressing for remnants: rotating beams for pulsars and
 * magnetars, a living accretion disc with a photon ring and pulsing jets
 * for black holes, and a swirling disc for protostars. Everything rises out
 * of the plane, which is why this is a 3D scene and not a sprite sheet.
 */
export class EffectsView {
  readonly group = new Group();
  private readonly effects = new Map<number, BodyEffect>();
  private readonly bursts: Burst[] = [];

  sync(world: World, time: number): void {
    const seen = new Set<number>();
    for (const body of world.bodies) {
      if (body.remnant === null) continue;
      seen.add(body.id);
      let effect = this.effects.get(body.id);
      if (effect && effect.remnant !== body.remnant) {
        this.group.remove(effect.root);
        this.effects.delete(body.id);
        effect = undefined;
      }
      if (!effect) {
        effect = this.build(body);
        this.effects.set(body.id, effect);
        this.group.add(effect.root);
      }
      effect.root.position.set(body.x, body.y, 0);
      const scale = Math.max(body.radius / 4, 0.8);
      effect.root.scale.setScalar(scale);
      if (effect.spinner) {
        // Pulsars spin their beams; a black hole's jets slowly precess instead.
        effect.spinner.rotation.z =
          effect.remnant === 'blackHole' ? 0.14 * Math.sin(time * 0.35) : time * 2.2;
      }
      if (effect.uTime) effect.uTime.value = time;
    }
    for (const [id, effect] of this.effects) {
      if (seen.has(id)) continue;
      this.group.remove(effect.root);
      this.effects.delete(id);
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      if (burst === undefined) continue;
      const age = time - burst.bornAt;
      if (age > GRB_SECONDS) {
        this.group.remove(burst.root);
        this.bursts.splice(i, 1);
        continue;
      }
      burst.material.opacity = 1 - age / GRB_SECONDS;
      burst.root.scale.set(1, 1 + age * 1.4, 1);
    }
  }

  /** A gamma-ray burst: a blinding beam along the jet axis for a second. */
  burst(x: number, y: number, time: number): void {
    const material = new MeshBasicMaterial({
      color: 0xff66ff,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const beam = new Mesh(new CylinderGeometry(3, 3, 900, 8, 1, true), material);
    beam.rotation.x = DISC_TILT;
    const root = new Group();
    root.add(beam);
    root.position.set(x, y, 0);
    this.group.add(root);
    this.bursts.push({ root, bornAt: time, material });
  }

  private build(body: Body): BodyEffect {
    const root = new Group();
    switch (body.remnant) {
      case 'pulsar':
      case 'magnetar': {
        const spinner = new Group();
        const color = body.remnant === 'pulsar' ? 0x3dfff0 : 0xc06bff;
        for (const sign of [1, -1]) {
          const cone = new Mesh(
            new ConeGeometry(7, 90, 10, 1, true),
            new MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.5,
              blending: AdditiveBlending,
              depthWrite: false,
              side: DoubleSide,
            }),
          );
          cone.position.set(0, sign * 45, 0);
          cone.rotation.z = sign > 0 ? Math.PI : 0;
          spinner.add(cone);
        }
        spinner.rotation.x = DISC_TILT * 0.6;
        root.add(spinner);
        return { root, remnant: body.remnant, spinner, uTime: null };
      }
      case 'blackHole': {
        const uTime = { value: 0 };
        const dark = new Mesh(
          new PlaneGeometry(64, 64),
          new ShaderMaterial({
            vertexShader: HALO_VERTEX,
            fragmentShader: VOID_FRAGMENT,
            uniforms: { uTime },
            transparent: true,
            depthWrite: false,
            depthTest: false,
          }),
        );
        dark.renderOrder = -1;
        root.add(dark);

        const disc = this.accretionDisc(5, 16, uTime);
        disc.rotation.x = DISC_TILT;
        disc.renderOrder = 1;
        root.add(disc);

        const halo = new Mesh(
          new PlaneGeometry(26, 26),
          new ShaderMaterial({
            vertexShader: HALO_VERTEX,
            fragmentShader: HALO_FRAGMENT,
            uniforms: { uTime },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: AdditiveBlending,
          }),
        );
        halo.renderOrder = 3;
        root.add(halo);

        const axis = new Vector3(0, -Math.sin(DISC_TILT), Math.cos(DISC_TILT));
        const jets = new Group();
        for (const sign of [1, -1]) {
          const jet = new Mesh(
            new PlaneGeometry(JET_WIDTH, JET_LENGTH, 1, 24),
            new ShaderMaterial({
              vertexShader: JET_VERTEX,
              fragmentShader: JET_FRAGMENT,
              uniforms: { uTime },
              transparent: true,
              depthWrite: false,
              depthTest: false,
              blending: AdditiveBlending,
              side: DoubleSide,
            }),
          );
          // The ribbon's own y axis points out along the jet; v = 0 sits at the hole.
          const direction = axis.clone().multiplyScalar(sign);
          jet.position.copy(direction).multiplyScalar(JET_LENGTH / 2 + 3);
          jet.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
          jet.renderOrder = 2;
          jets.add(jet);
        }
        root.add(jets);
        return { root, remnant: body.remnant, spinner: jets, uTime };
      }
      case 'protostar': {
        const uTime = { value: 0 };
        const disc = this.disc([1.0, 0.45, 0.15], 5, 22, uTime, 1.5);
        disc.rotation.x = DISC_TILT * 0.7;
        root.add(disc);
        return { root, remnant: body.remnant, spinner: null, uTime };
      }
      case 'whiteDwarf':
      case null:
        return { root, remnant: body.remnant, spinner: null, uTime: null };
    }
  }

  private disc(
    color: RGB,
    inner: number,
    outer: number,
    uTime: { value: number },
    speed: number,
  ): Mesh {
    return new Mesh(
      new RingGeometry(inner, outer, 48, 1),
      new ShaderMaterial({
        vertexShader: DISC_VERTEX,
        fragmentShader: DISC_FRAGMENT,
        uniforms: {
          uColor: { value: new Vector3(...color) },
          uInner: { value: inner },
          uOuter: { value: outer },
          uTime,
          uSpeed: { value: speed },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );
  }

  private accretionDisc(inner: number, outer: number, uTime: { value: number }): Mesh {
    return new Mesh(
      new RingGeometry(inner, outer, 96, 4),
      new ShaderMaterial({
        vertexShader: DISC_VERTEX,
        fragmentShader: ACCRETION_FRAGMENT,
        uniforms: {
          uInner: { value: inner },
          uOuter: { value: outer },
          uTime,
          uSpeed: { value: 0.9 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );
  }
}
