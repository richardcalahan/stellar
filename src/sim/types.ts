export type StarClass =
  | 'planet'
  | 'gasGiant'
  | 'brownDwarf'
  | 'redDwarf'
  | 'yellow'
  | 'white'
  | 'blue'
  | 'blueGiant'
  | 'superGiant'
  | 'megaGiant';

/** Linear RGB, each channel 0 to 1 (or above 1 for things that glow). */
export type RGB = readonly [number, number, number];

/**
 * One thing on the table. Position and velocity are in world units on the
 * z = 0 plane (1 unit = 1 CSS pixel, 1 unit per second). Everything after
 * mass is derived from it by setMass in stars.ts and must not be edited by hand.
 */
export interface Body {
  readonly id: number;
  /** Earth masses. */
  mass: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Acceleration accumulated during the current step. Scratch, owned by gravity.ts. */
  ax: number;
  ay: number;
  starClass: StarClass;
  /** World units. */
  radius: number;
  /** Radius used for touch hit tests, never smaller than a fingertip. */
  hitRadius: number;
  /** Suns. Zero for planets and gas giants. */
  luminosity: number;
  color: RGB;
}

export interface BodyInit {
  mass: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

/**
 * Something that happened during a step, for the renderer to turn into an
 * effect or a toast. Module 5 adds the first member (merge).
 */
export type SimEvent = never;
