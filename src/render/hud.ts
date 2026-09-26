import type { Resizable, Viewport } from './viewport';

export interface TextStyle {
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

export interface RingStyle {
  color: string;
  lineWidth?: number;
  dash?: readonly number[];
}

const DEFAULT_FONT = '13px system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

/**
 * The 2D canvas layer above the WebGL world. Labels, padlock glyphs, orbit
 * rings, and toasts are drawn here every frame at positions the camera
 * projects from world space. Two hundred text labels are cheap on a 2D
 * canvas and awkward in WebGL, which is why this layer exists.
 *
 * The canvas is sized to the viewport in CSS pixels times the device pixel
 * ratio, and the context is scaled to match, so callers draw in CSS pixels
 * and the text still comes out sharp on a Retina screen.
 */
export class Hud implements Resizable {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  resize({ width, height, pixelRatio }: Viewport): void {
    this.width = width;
    this.height = height;
    // Setting the backing store size resets all context state, so the transform comes after.
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  drawText(text: string, x: number, y: number, style: TextStyle = {}): void {
    const { ctx } = this;
    ctx.font = style.font ?? DEFAULT_FONT;
    ctx.fillStyle = style.color ?? '#ffffff';
    ctx.textAlign = style.align ?? 'left';
    ctx.textBaseline = style.baseline ?? 'top';
    ctx.fillText(text, x, y);
  }

  drawRing(x: number, y: number, radius: number, style: RingStyle): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.setLineDash(style.dash ? [...style.dash] : []);
    ctx.lineWidth = style.lineWidth ?? 1.5;
    ctx.strokeStyle = style.color;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
