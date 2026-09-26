import {
  AdditiveBlending,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Camera,
} from 'three';

/** On-screen radius of the placeholder Sun in CSS pixels (it sits on the plane, so 1 unit = 1 px). */
export const SUN_RADIUS = 35;
/** The corona quad is this many Sun radii across. */
export const CORONA_SIZE_FACTOR = 6;
/**
 * Sun surface colour in linear light. Above 1.0 on purpose so the bloom pass
 * picks it up, but not by much: the further above the threshold, the wider
 * the halo, and a halo that saturates past the sphere makes the Sun read
 * larger than its physical radius.
 */
export const SUN_COLOR: readonly [number, number, number] = [1.5, 1.3, 0.75];
/** Corona colour. Only its core crosses the bloom threshold. */
export const CORONA_COLOR: readonly [number, number, number] = [1.3, 0.85, 0.42];

const SPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const SPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    // Limb darkening: the edge of a star looks dimmer than its centre.
    float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    float limb = 0.45 + 0.55 * pow(mu, 0.6);
    float pulse = 1.0 + 0.04 * sin(uTime * 1.7);
    gl_FragColor = vec4(uColor * limb * pulse, 1.0);
  }
`;

const CORONA_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CORONA_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec2 vUv;

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
    // Additive blending: this adds uColor * intensity to whatever is behind.
    gl_FragColor = vec4(uColor, intensity);
  }
`;

/**
 * Module 1 stand-in for a star: a lit sphere with limb darkening and a
 * billboard corona. Module 2 replaces it with instanced bodies and Module 6
 * gives stars real colours from their temperature.
 */
export class PlaceholderSun {
  readonly group = new Group();
  private readonly corona: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly uTime = { value: 0 };

  constructor() {
    const sphere = new Mesh(
      new SphereGeometry(SUN_RADIUS, 64, 48),
      new ShaderMaterial({
        vertexShader: SPHERE_VERTEX,
        fragmentShader: SPHERE_FRAGMENT,
        uniforms: { uColor: { value: new Vector3(...SUN_COLOR) }, uTime: this.uTime },
      }),
    );

    const size = SUN_RADIUS * CORONA_SIZE_FACTOR;
    this.corona = new Mesh(
      new PlaneGeometry(size, size),
      new ShaderMaterial({
        vertexShader: CORONA_VERTEX,
        fragmentShader: CORONA_FRAGMENT,
        uniforms: { uColor: { value: new Vector3(...CORONA_COLOR) }, uTime: this.uTime },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    );
    // Transparent effects draw after the opaque sphere.
    this.corona.renderOrder = 1;

    this.group.add(sphere, this.corona);
  }

  update(timeSeconds: number, camera: Camera): void {
    this.uTime.value = timeSeconds;
    // Billboard: always face the camera, so the corona survives a future camera tilt.
    this.corona.quaternion.copy(camera.quaternion);
  }
}
