/** The CSS-pixel size of the view and the device pixel ratio the GPU renders at. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

/** Anything whose GPU buffers or canvas backing store depend on the viewport. */
export interface Resizable {
  resize(viewport: Viewport): void;
}

/**
 * Bloom cost scales with real pixels, so a 3x phone display renders at 2x.
 * Module 10 lowers this adaptively when a device misses the frame budget.
 */
export const MAX_PIXEL_RATIO = 2;

export function readViewport(): Viewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
  };
}

/**
 * Calls onChange when the device pixel ratio changes (the window is dragged to
 * another display, or the browser zooms). A media query only fires for the
 * ratio it was created with, so the listener re-arms itself after each change.
 */
export function watchPixelRatio(onChange: () => void): void {
  const arm = (): void => {
    const query = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener(
      'change',
      () => {
        onChange();
        arm();
      },
      { once: true },
    );
  };
  arm();
}
