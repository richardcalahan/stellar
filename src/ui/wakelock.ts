/**
 * Keeps the screen from dimming while the playground is open. A wake lock is
 * released whenever the page is hidden, so it is re-requested when the page
 * becomes visible again, and on the next touch in case the browser wanted a
 * gesture first. Browsers without the API just fall back to their own timers.
 */
export function keepScreenAwake(): void {
  if (!('wakeLock' in navigator)) return;

  let sentinel: WakeLockSentinel | null = null;

  const request = async (): Promise<void> => {
    if (sentinel !== null || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    } catch {
      // Denied (low battery, or the page is not visible). Try again on the next chance.
    }
  };

  window.addEventListener('pointerdown', () => void request(), { passive: true });
  document.addEventListener('visibilitychange', () => void request());
  void request();
}
