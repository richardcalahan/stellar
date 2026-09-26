import type { FrameStats } from '../loop';
import type { Hud } from '../render/hud';
import type { Viewport } from '../render/viewport';

export interface DebugCounts {
  bodies: number;
  dust: number;
}

const FONT = '12px ui-monospace, Menlo, Consolas, monospace';
const COLOR = 'rgba(170, 255, 190, 0.9)';
const LINE_HEIGHT = 16;

/** Frame timing and entity counts, drawn on the HUD when the page is opened with ?debug. */
export class DebugOverlay {
  constructor(
    private readonly hud: Hud,
    readonly enabled: boolean,
  ) {}

  draw(stats: FrameStats, viewport: Viewport, counts: DebugCounts): void {
    if (!this.enabled) return;
    const lines = [
      `fps ${stats.fps.toFixed(0)}`,
      `frame ${stats.frameMs.toFixed(2)} ms`,
      `substeps ${stats.substeps}`,
      `bodies ${counts.bodies}`,
      `dust ${counts.dust}`,
      `view ${viewport.width}x${viewport.height} @${viewport.pixelRatio}x`,
    ];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line !== undefined) {
        this.hud.drawText(line, 12, 12 + i * LINE_HEIGHT, { font: FONT, color: COLOR });
      }
    }
  }
}
