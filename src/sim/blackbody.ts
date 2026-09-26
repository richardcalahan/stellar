import type { RGB } from './types';

/** How far colours are pushed away from grey, so classes read distinctly under bloom. */
export const SATURATION_LIFT = 1.35;

/**
 * Linear RGB for a black body at the given temperature, from a fit to the
 * Planckian locus (the usual Helland approximation), with a saturation lift.
 * 1000 K is deep red, 5800 K is warm white, 30000 K is blue.
 */
export function blackbodyRGB(kelvin: number): RGB {
  const t = Math.min(Math.max(kelvin, 1000), 50000) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const luma = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  return [
    Math.max(0, luma + (lr - luma) * SATURATION_LIFT),
    Math.max(0, luma + (lg - luma) * SATURATION_LIFT),
    Math.max(0, luma + (lb - luma) * SATURATION_LIFT),
  ];
}

function toLinear(channel255: number): number {
  const c = Math.min(Math.max(channel255, 0), 255) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
