import type { Resizable, Viewport } from './viewport';

export interface TextStyle {
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Stroke colour drawn behind the glyphs, so text stays readable over a glowing star. */
  outline?: string;
  outlineWidth?: number;
}

export interface RingStyle {
  color: string;
  lineWidth?: number;
  dash?: readonly number[];
  /** Advance the dash pattern by this many pixels, to make a ring crawl. */
  dashOffset?: number;
}

export interface PillStyle {
  font: string;
  color: string;
  background: string;
  border: string;
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
    if (style.outline !== undefined) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = style.outlineWidth ?? 3;
      ctx.strokeStyle = style.outline;
      ctx.strokeText(text, x, y);
    }
    ctx.fillText(text, x, y);
  }

  drawRing(x: number, y: number, radius: number, style: RingStyle): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.setLineDash(style.dash ? [...style.dash] : []);
    ctx.lineDashOffset = style.dashOffset ?? 0;
    ctx.lineWidth = style.lineWidth ?? 1.5;
    ctx.strokeStyle = style.color;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  /** A rounded pill with centred text, for toasts. x, y is the pill's centre. */
  drawPill(text: string, x: number, y: number, style: PillStyle): void {
    const { ctx } = this;
    ctx.font = style.font;
    const width = ctx.measureText(text).width + 18;
    const height = 20;
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, height / 2);
    ctx.fillStyle = style.background;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = style.border;
    ctx.stroke();
    ctx.fillStyle = style.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  /** A small padlock glyph with its top-left at x, y. */
  drawPadlock(x: number, y: number, size: number, color: string): void {
    const { ctx } = this;
    const bodyTop = y + size * 0.45;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, bodyTop, size, size * 0.55, size * 0.12);
    ctx.fill();
    ctx.beginPath();
    ctx.lineWidth = Math.max(1, size * 0.16);
    ctx.strokeStyle = color;
    ctx.arc(x + size / 2, bodyTop, size * 0.3, Math.PI, 0);
    ctx.stroke();
  }
}
