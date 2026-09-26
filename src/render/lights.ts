import type { Body } from '../sim/types';
import type { World } from '../sim/world';

/** How many stars can light a planet at once. A GPU uniform array has to have a fixed size. */
export const STAR_LIGHT_COUNT = 8;

/** Lighting strength is luminosity to this power, so a dim red dwarf still lights its planets. */
export const LIGHT_LUMINOSITY_EXP = 0.5;

/**
 * The pool of star lights the planet shader reads. Each frame the eight most
 * luminous stars are written into flat arrays that the shader sees as
 * uniform arrays. A planet near a dim ninth star is lit by the eight; that
 * is the budget.
 */
export class StarLights {
  private readonly positions = new Float32Array(STAR_LIGHT_COUNT * 3);
  private readonly colors = new Float32Array(STAR_LIGHT_COUNT * 3);
  private readonly strengths = new Float32Array(STAR_LIGHT_COUNT);
  private readonly count = { value: 0 };
  private readonly candidates: Body[] = [];

  /** Spread these into any material that wants to be lit by stars. The arrays update in place. */
  readonly uniforms = {
    uLightPos: { value: this.positions },
    uLightColor: { value: this.colors },
    uLightStrength: { value: this.strengths },
    uLightCount: this.count,
  };

  update(world: World): void {
    const candidates = this.candidates;
    candidates.length = 0;
    for (const body of world.bodies) {
      if (body.luminosity > 0) candidates.push(body);
    }
    candidates.sort((a, b) => b.luminosity - a.luminosity);

    const n = Math.min(candidates.length, STAR_LIGHT_COUNT);
    for (let i = 0; i < n; i++) {
      const star = candidates[i];
      if (star === undefined) break;
      this.positions[i * 3] = star.x;
      this.positions[i * 3 + 1] = star.y;
      this.positions[i * 3 + 2] = 0;
      this.colors[i * 3] = star.color[0];
      this.colors[i * 3 + 1] = star.color[1];
      this.colors[i * 3 + 2] = star.color[2];
      this.strengths[i] = star.luminosity ** LIGHT_LUMINOSITY_EXP;
    }
    this.count.value = n;
  }
}
