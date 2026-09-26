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
    float omega = uSpeed / pow(0.18 + t, 1.5);
    float a = angle - uTime * omega;
    float bands = 0.55 + 0.45 * sin(a * 5.0 + t * 20.0) * sin(a * 11.0 - t * 7.0);
    float streaks = 0.5 + 0.5 * sin(a * 23.0 + t * 40.0 + uTime * 2.0);
    vec3 hot = vec3(1.6, 1.35, 1.0);
    vec3 mid = vec3(1.3, 0.55, 0.15);
    vec3 cold = vec3(0.5, 0.08, 0.02);
    vec3 col = t < 0.4 ? mix(hot, mid, t / 0.4) : mix(mid, cold, (t - 0.4) / 0.6);
    float beam = 0.7 + 0.5 * sin(angle + 1.2);
    float edge = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.7, 1.0, t));
    float flicker = 0.9 + 0.1 * sin(uTime * 9.0 + t * 30.0) * sin(uTime * 5.3 + angle * 2.0);
    float intensity = edge * (0.6 + 0.5 * bands + 0.3 * streaks) * beam * flicker;
    gl_FragColor = vec4(col * intensity, edge * 0.95);
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

/** Relativistic jets: pulses of light racing out along the axis and fading toward the tip. */
const JET_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const JET_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    float along = vUv.y;
    float pulses = 0.55 + 0.45 * sin(along * 28.0 - uTime * 14.0);
    float fine = 0.7 + 0.3 * sin(along * 90.0 - uTime * 30.0);
    float fade = pow(1.0 - along, 1.4);
    float core = 0.6 + 0.4 * sin(uTime * 11.0);
    float intensity = fade * (0.35 + 0.65 * pulses * fine) * core;
    gl_FragColor = vec4(uColor * intensity, intensity * 0.9);
  }
`;

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
      if (effect.spinner) effect.spinner.rotation.z = time * 2.2;
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
        const disc = this.accretionDisc(6, 22, uTime);
        disc.rotation.x = DISC_TILT;
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
        for (const sign of [1, -1]) {
          const jet = new Mesh(
            new ConeGeometry(2.6, 80, 10, 1, true),
            new ShaderMaterial({
              vertexShader: JET_VERTEX,
              fragmentShader: JET_FRAGMENT,
              uniforms: { uTime, uColor: { value: new Vector3(0.7, 0.9, 1.4) } },
              transparent: true,
              depthWrite: false,
              blending: AdditiveBlending,
              side: DoubleSide,
            }),
          );
          jet.position.copy(axis).multiplyScalar(sign * 42);
          jet.quaternion.setFromUnitVectors(
            new Vector3(0, 1, 0),
            axis.clone().multiplyScalar(sign),
          );
          jet.rotation.z += Math.PI;
          root.add(jet);
        }
        return { root, remnant: body.remnant, spinner: null, uTime };
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
          uSpeed: { value: 1.6 },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );
  }
}
