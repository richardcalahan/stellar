/** Palette card size in CSS pixels, matching the client's cards at 1080p. */
export const CARD_WIDTH = 230;
export const CARD_HEIGHT = 72;
/** Corner cards sit this far in from the side edge, and this far from the top or bottom. */
export const CARD_INSET_X = 260;
export const CARD_INSET_Y = 8;
/** Screens at least this wide get the eight-card table layout. */
export const WIDE_LAYOUT_MIN_WIDTH = 2560;
/**
 * One card at the bottom centre, for a screen with one player in front of it.
 * Set to false for the client's table layout: four corners, or eight on 4K.
 */
export const SINGLE_PALETTE = true as boolean;

export interface PaletteSlot {
  /** Centre of the card in CSS pixels. */
  x: number;
  y: number;
  /** Degrees, so cards on the far side of a table read the right way up for that player. */
  rotation: 0 | 90 | 180 | 270;
}

/**
 * Where the palette cards go. With SINGLE_PALETTE, one card at the bottom
 * centre. Otherwise, below 2560 px wide: one per corner, the top pair upside
 * down for the player across the table. Wider: three top, three bottom, one
 * on each side, as on the client's 4K table.
 */
export function layoutPalettes(
  width: number,
  height: number,
  single: boolean = SINGLE_PALETTE,
): PaletteSlot[] {
  const top = CARD_INSET_Y + CARD_HEIGHT / 2;
  const bottom = height - CARD_INSET_Y - CARD_HEIGHT / 2;

  if (single) return [{ x: width / 2, y: bottom, rotation: 0 }];

  if (width < WIDE_LAYOUT_MIN_WIDTH) {
    const left = CARD_INSET_X + CARD_WIDTH / 2;
    const right = width - CARD_INSET_X - CARD_WIDTH / 2;
    return [
      { x: left, y: top, rotation: 180 },
      { x: right, y: top, rotation: 180 },
      { x: left, y: bottom, rotation: 0 },
      { x: right, y: bottom, rotation: 0 },
    ];
  }

  const slots: PaletteSlot[] = [];
  for (const fraction of [0.25, 0.5, 0.75]) {
    slots.push({ x: width * fraction, y: top, rotation: 180 });
  }
  for (const fraction of [0.25, 0.5, 0.75]) {
    slots.push({ x: width * fraction, y: bottom, rotation: 0 });
  }
  slots.push({ x: CARD_INSET_Y + CARD_HEIGHT / 2, y: height / 2, rotation: 90 });
  slots.push({ x: width - CARD_INSET_Y - CARD_HEIGHT / 2, y: height / 2, rotation: 270 });
  return slots;
}
