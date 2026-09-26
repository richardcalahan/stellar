import { RESET_HOLD_MS } from '../sim/constants';

/** Distance from the corner to the centre of the info button, in CSS pixels. */
export const INFO_INSET = 40;

const ICON =
  '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<circle cx="12" cy="7.5" r="1.4" fill="currentColor"/>' +
  '<rect x="10.8" y="10.2" width="2.4" height="7.5" rx="1" fill="currentColor"/>' +
  '</svg>';

const INSTRUCTIONS = [
  'Touch an icon in a Touch and Drag card and pull it onto the table.',
  'Let go to drop it. Let go while moving to throw it.',
  'While holding something, press Lock to freeze it or Orbit to put it in orbit around the nearest big thing. With a mouse, press L or O.',
  'Push bodies together to merge them. Heavier stars burn hotter, bluer, and faster.',
  'Find the habitable zone: not too close, not too far. Given time, life begins.',
];

const SCIENCE = [
  'The Sun burns for 200 seconds here. Real stars like it burn for ten billion years.',
  'Stars under eight suns puff off a nebula and leave a white dwarf. Heavier ones explode and leave a pulsar, or above twenty suns a black hole.',
  'A white dwarf that grows past 1.4 suns detonates completely.',
  'Nebula dust that gathers and slows collapses into new protostars.',
  'Half of all Nuclear Age worlds destroy themselves. The rest reach the Space Age and send out ships.',
];

/**
 * The purple info button in the top right corner and the panel it opens:
 * how to play, some science, and a reset you have to hold.
 */
export class InfoPanel {
  private readonly panel: HTMLElement;
  private holdTimer = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly onReset: () => void,
  ) {
    this.panel = this.buildPanel();
    this.panel.hidden = true;
    root.append(this.panel);
    root.append(this.buildButton());
  }

  /** The button sits in the top right corner; the panel opens in the middle. */
  layout(width: number, height: number): void {
    for (const button of this.root.querySelectorAll<HTMLElement>('.info-button')) {
      button.style.left = `${width - INFO_INSET}px`;
      button.style.top = `${INFO_INSET}px`;
    }
    this.panel.style.left = `${width / 2}px`;
    this.panel.style.top = `${height / 2}px`;
  }

  private open(): void {
    this.panel.hidden = false;
  }

  private close(): void {
    this.panel.hidden = true;
    this.cancelHold();
  }

  private buildButton(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'info-button';
    button.setAttribute('aria-label', 'Information');
    button.innerHTML = ICON;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.panel.hidden) this.open();
      else this.close();
    });
    return button;
  }

  private buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'info-panel';

    const title = document.createElement('h1');
    title.textContent = 'Stellar Playground';
    panel.append(title);

    panel.append(this.section('How to play', INSTRUCTIONS));
    panel.append(this.section('What is going on', SCIENCE));

    const actions = document.createElement('div');
    actions.className = 'info-actions';

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'info-reset';
    reset.innerHTML = '<span class="info-reset-fill"></span><span>Hold to reset the table</span>';
    reset.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      reset.classList.add('info-reset-holding');
      this.holdTimer = window.setTimeout(() => {
        reset.classList.remove('info-reset-holding');
        this.onReset();
        this.close();
      }, RESET_HOLD_MS);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      reset.addEventListener(type, () => {
        reset.classList.remove('info-reset-holding');
        this.cancelHold();
      });
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'info-close';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    });

    actions.append(reset, closeButton);
    panel.append(actions);
    panel.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    return panel;
  }

  private section(heading: string, items: readonly string[]): HTMLElement {
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = heading;
    const list = document.createElement('ul');
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item;
      list.append(li);
    }
    section.append(h2, list);
    return section;
  }

  private cancelHold(): void {
    if (this.holdTimer !== 0) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = 0;
    }
  }
}
