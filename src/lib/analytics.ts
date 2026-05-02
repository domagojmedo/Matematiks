type GoatCounterVars = {
  path?: string;
  title?: string;
  referrer?: string;
  event?: boolean;
};

type GoatCounter = {
  count?: (vars: GoatCounterVars) => void;
  no_onload?: boolean;
};

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

export function trackPageView(path: string): void {
  window.goatcounter?.count?.({ path });
}

export function trackEvent(name: string): void {
  window.goatcounter?.count?.({ path: name, event: true });
}
