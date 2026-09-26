import { PALETTE_MASSES } from '../sim/constants';
import { CARD_HEIGHT, CARD_WIDTH, layoutPalettes } from './layout';

export type PaletteKind = keyof typeof PALETTE_MASSES;

const ICONS: readonly { kind: PaletteKind; caption: string }[] = [
  { kind: 'sun', caption: 'The Sun' },
  { kind: 'redDwarf', caption: 'Red Dwarf' },
  { kind: 'gasGiant', caption: 'Gas Giant' },
  { kind: 'planet', caption: 'Planet' },
];

/**
 * Called when a finger lands on a palette icon. The handler spawns the body
 * under the finger and takes over the pointer, so touching an icon and
 * dragging onto the table is one gesture. It returns a function to call when
 * the finger lifts, so the emptied slot can fill back in, or null if the
 * table is full.
 */
export type PickHandler = (kind: PaletteKind, event: PointerEvent) => (() => void) | null;

/**
 * The "Touch and Drag" cards around the edge of the table. Real DOM buttons,
 * because they need real hit targets and must work for a second finger while
 * the first is busy holding a body.
 */
export class Palettes {
  private readonly cards: HTMLElement[] = [];
  private enabled = true;

  constructor(
    private readonly root: HTMLElement,
    private readonly onPick: PickHandler,
  ) {}

  /** Lay the cards out for the viewport. Called on start and on every resize. */
  layout(width: number, height: number): void {
    for (const card of this.cards) card.remove();
    this.cards.length = 0;
    for (const slot of layoutPalettes(width, height)) {
      const card = this.buildCard();
      card.style.left = `${slot.x - CARD_WIDTH / 2}px`;
      card.style.top = `${slot.y - CARD_HEIGHT / 2}px`;
      card.style.transform = `rotate(${slot.rotation}deg)`;
      this.root.append(card);
      this.cards.push(card);
    }
    this.applyEnabled();
  }

  /** Grey the cards out while the table is full. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.applyEnabled();
  }

  private applyEnabled(): void {
    for (const card of this.cards) card.classList.toggle('palette-disabled', !this.enabled);
  }

  private buildCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'palette';

    const title = document.createElement('div');
    title.className = 'palette-title';
    title.textContent = 'Touch and Drag';
    card.append(title);

    const row = document.createElement('div');
    row.className = 'palette-icons';
    for (const { kind, caption } of ICONS) {
      const icon = document.createElement('button');
      icon.type = 'button';
      icon.className = `palette-icon palette-${kind}`;
      icon.setAttribute('aria-label', caption);
      const ring = document.createElement('span');
      ring.className = 'palette-ring';
      const dot = document.createElement('span');
      dot.className = 'palette-dot';
      ring.append(dot);
      const label = document.createElement('span');
      label.className = 'palette-caption';
      label.textContent = caption;
      icon.append(ring, label);

      icon.addEventListener('pointerdown', (event) => {
        if (!this.enabled) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        const refill = this.onPick(kind, event);
        if (!refill) return;
        icon.classList.add('palette-empty');
        const restore = (): void => {
          icon.classList.remove('palette-empty');
          refill();
        };
        this.pendingRefills.set(event.pointerId, restore);
      });
      row.append(icon);
    }
    card.append(row);
    return card;
  }

  private readonly pendingRefills = new Map<number, () => void>();

  /** The drag layer calls this when a pointer that started on an icon lifts. */
  released(pointerId: number): void {
    const restore = this.pendingRefills.get(pointerId);
    if (!restore) return;
    this.pendingRefills.delete(pointerId);
    restore();
  }
}
