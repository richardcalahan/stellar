import type { Body } from '../sim/types';
import type { World } from '../sim/world';
import type { PlaneCamera } from '../render/camera';

/** Distance from the held body's edge to the first toggle, in CSS pixels. */
export const MODIFIER_GAP = 22;

const LOCK_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
  '<rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/>' +
  '<path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
  '</svg>';

const ORBIT_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>' +
  '<circle cx="20" cy="12" r="2.2" fill="currentColor"/>' +
  '</svg>';

interface ModifierPair {
  root: HTMLElement;
  lock: HTMLButtonElement;
  orbit: HTMLButtonElement;
}

/**
 * The Lock and Orbit toggles that float to the right of every held body.
 * They are DOM buttons so a second finger can press them while the first
 * holds the body, and they answer pointerdown, not click, so they work mid
 * gesture. Mouse users, who have no second finger, press L and O instead.
 */
export class Modifiers {
  private readonly pairs = new Map<number, ModifierPair>();
  private readonly point = { x: 0, y: 0 };

  constructor(
    private readonly root: HTMLElement,
    private readonly world: World,
    private readonly camera: PlaneCamera,
    /** The body the mouse (as opposed to a finger) is holding, for the keyboard shortcuts. */
    private readonly mouseHeld: () => Body | undefined,
  ) {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      const body = this.mouseHeld();
      if (!body) return;
      const key = event.key.toLowerCase();
      if (key === 'l') this.world.setLocked(body, !body.locked);
      if (key === 'o') this.world.setOrbiting(body, !body.orbiting);
    });
  }

  /** Create, move, and remove toggle pairs so every held body has one beside it. */
  update(): void {
    const seen = new Set<number>();
    for (const body of this.world.bodies) {
      if (!body.held) continue;
      seen.add(body.id);
      let pair = this.pairs.get(body.id);
      if (!pair) {
        pair = this.build(body);
        this.pairs.set(body.id, pair);
        this.root.append(pair.root);
      }
      const p = this.camera.project(body.x, body.y, 0, this.point);
      pair.root.style.left = `${p.x + Math.max(body.radius, body.hitRadius) + MODIFIER_GAP}px`;
      pair.root.style.top = `${p.y}px`;
      pair.lock.classList.toggle('modifier-active', body.locked);
      pair.orbit.classList.toggle('modifier-active', body.orbiting);
    }
    for (const [id, pair] of this.pairs) {
      if (seen.has(id)) continue;
      pair.root.remove();
      this.pairs.delete(id);
    }
  }

  private build(body: Body): ModifierPair {
    const root = document.createElement('div');
    root.className = 'modifiers';
    const lock = this.button('modifier-lock', 'Lock', LOCK_ICON, () => {
      this.world.setLocked(body, !body.locked);
    });
    const orbit = this.button('modifier-orbit', 'Orbit', ORBIT_ICON, () => {
      this.world.setOrbiting(body, !body.orbiting);
    });
    root.append(lock, orbit);
    return { root, lock, orbit };
  }

  private button(
    className: string,
    label: string,
    icon: string,
    onPress: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `modifier ${className}`;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<span class="modifier-ring">${icon}</span><span class="modifier-caption">${label}</span>`;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onPress();
    });
    return button;
  }
}
