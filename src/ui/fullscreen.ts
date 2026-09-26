/**
 * A small button that puts the page into fullscreen, hidden while fullscreen
 * is active. iOS Safari does not allow fullscreen for a web page, so there the
 * button never appears; Add to Home Screen with the web app manifest is the
 * route to a chrome-free view on an iPad.
 *
 * This uses click, not pointerdown: a fullscreen request needs user
 * activation, and a touch pointerdown does not count as one.
 */
export function installFullscreenButton(root: HTMLElement): void {
  if (!document.fullscreenEnabled) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fullscreen';
  button.textContent = 'Fullscreen';
  button.setAttribute('aria-label', 'Enter fullscreen');

  button.addEventListener('click', () => {
    void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
      // The browser declined (no activation, or a policy). Nothing to do.
    });
  });

  const sync = (): void => {
    button.hidden = document.fullscreenElement !== null;
  };
  document.addEventListener('fullscreenchange', sync);
  sync();

  root.append(button);
}
