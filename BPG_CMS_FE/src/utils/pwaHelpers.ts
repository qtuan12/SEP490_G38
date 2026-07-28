export const isPWAMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  const isUrlParam = new URLSearchParams(window.location.search).get('standalone') === 'true' || 
                     new URLSearchParams(window.location.search).get('pwa') === 'true';
  return isStandaloneMode || isIOSStandalone || isUrlParam;
};
