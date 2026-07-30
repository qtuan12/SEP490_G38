export const isPWAMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isUrlParam = new URLSearchParams(window.location.search).get('standalone') === 'true' ||
                     new URLSearchParams(window.location.search).get('pwa') === 'true';
  return isStandaloneMode || isIOSStandalone || isUrlParam;
};

/** Strict check: app is actually running as an installed/standalone PWA (ignores the internal ?standalone=true navigation param). */
export const isRunningStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
};

/** iPhone/iPad running Safari — includes iPadOS which reports as "MacIntel" but has touch support. */
export const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};
