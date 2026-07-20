type TelemetryPayload = {
  type: 'page_performance' | 'runtime_error' | 'unhandled_rejection';
  route: string;
  value?: number;
  detail?: string;
};

let initialized = false;

function safeRoute() {
  return `${window.location.pathname}`.slice(0, 160);
}

function send(payload: TelemetryPayload) {
  const body = JSON.stringify({ ...payload, route: safeRoute() });
  if (body.length > 3500) return;
  const blob = new Blob([body], { type: 'application/json' });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/telemetry', blob);
  } else {
    void fetch('/api/telemetry', { method: 'POST', body: blob, keepalive: true }).catch(() => undefined);
  }
}

function compactError(value: unknown) {
  const text = value instanceof Error ? value.message : String(value);
  return text.replace(/https?:\/\/\S+/g, '[url]').slice(0, 240);
}

export function initTelemetry() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    send({ type: 'runtime_error', route: safeRoute(), detail: compactError(event.error ?? event.message) });
  });
  window.addEventListener('unhandledrejection', (event) => {
    send({ type: 'unhandled_rejection', route: safeRoute(), detail: compactError(event.reason) });
  });

  window.addEventListener('load', () => {
    window.setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!navigation) return;
      send({ type: 'page_performance', route: safeRoute(), value: Math.round(navigation.loadEventEnd - navigation.startTime) });
    }, 0);
  }, { once: true });
}
