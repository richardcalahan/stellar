import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const MAX_LENSES = 8;
/** How hard a black hole bends the picture behind it. */
export const LENS_STRENGTH = 0.6;
/** Lens reach in multiples of the hole's drawn radius. */
export const LENS_REACH = 14;

const FRAGMENT = /* glsl */ `
  #define MAX_LENSES ${MAX_LENSES}
  uniform sampler2D tDiffuse;
  uniform int uCount;
  uniform vec2 uCentre[MAX_LENSES];
  uniform float uRadius[MAX_LENSES];
  uniform float uAspect;
  uniform float uStrength;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    for (int i = 0; i < MAX_LENSES; i++) {
      if (i >= uCount) break;
      vec2 d = (uv - uCentre[i]) * vec2(uAspect, 1.0);
      float r = max(length(d), 1e-4);
      float R = uRadius[i];
      // Light bends more the closer it passes: pull pixels toward the hole with a 1 / r law,
      // limited so nothing wraps through the centre.
      float pull = min(uStrength * R * R / r, r * 0.85);
      uv -= (d / r) * pull / vec2(uAspect, 1.0);
    }
    gl_FragColor = texture2D(tDiffuse, uv);
  }
`;

export interface Lens {
  /** Screen position in CSS pixels. */
  x: number;
  y: number;
  /** Drawn radius of the hole in CSS pixels. */
  radius: number;
}

/**
 * Screen-space gravitational lensing around black holes: a post pass that
 * warps the finished frame toward each hole. Positions arrive in CSS pixels
 * each frame and are converted to texture coordinates here.
 */
export class LensingPass extends ShaderPass {
  private readonly centres = new Float32Array(MAX_LENSES * 2);
  private readonly radii = new Float32Array(MAX_LENSES);

  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uCount: { value: 0 },
        uCentre: { value: new Float32Array(MAX_LENSES * 2) },
        uRadius: { value: new Float32Array(MAX_LENSES) },
        uAspect: { value: 1 },
        uStrength: { value: LENS_STRENGTH },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: FRAGMENT,
    });
    this.uniforms.uCentre = { value: this.centres };
    this.uniforms.uRadius = { value: this.radii };
  }

  /** Update the lenses for this frame. Pass an empty list to switch the effect off. */
  setLenses(lenses: readonly Lens[], width: number, height: number): void {
    const count = Math.min(lenses.length, MAX_LENSES);
    for (let i = 0; i < count; i++) {
      const lens = lenses[i];
      if (lens === undefined) break;
      this.centres[i * 2] = lens.x / width;
      this.centres[i * 2 + 1] = 1 - lens.y / height;
      this.radii[i] = (lens.radius * LENS_REACH) / height;
    }
    const countUniform = this.uniforms.uCount;
    if (countUniform) countUniform.value = count;
    const aspect = this.uniforms.uAspect;
    if (aspect) aspect.value = width / height;
    this.enabled = count > 0;
  }
}
