import { commitHash, version } from './commit-hash';

/** Explicit HTTPS origins support split hosting; Vercel uses the same-origin /api proxy. */
function getApiUrl(): string {
  if (typeof window === 'undefined') return '/api';
  const raw = (window as any).__API_URL__;
  if (!raw) return '/api';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.replace(/\/$/, '');
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && window.location.protocol === 'http:')) return '/api';
    if (u.username || u.password) return '/api';
    return raw.replace(/\/$/, '');
  } catch (_) {}
  return '/api';
}

function getWsUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__REALTIME_ENABLED__ === false) return '';
  if (typeof window === 'undefined') return '';
  const raw = (window as any).__WS_URL__;
  if (!raw) return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.replace(/\/$/, '');
  try {
    const u = new URL(raw);
    if (u.protocol === 'wss:' || (u.protocol === 'ws:' && window.location.protocol === 'http:')) {
      if (!u.username && !u.password) return raw.replace(/\/$/, '');
    }
  } catch (_) {}
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
}

export const environment = {
  production: true,
  staging: false,
  realtimeEnabled: typeof window === 'undefined' || (window as any).__REALTIME_ENABLED__ !== false,
  apiUrl: getApiUrl(),
  wsUrl: getWsUrl(),
  stripePublishableKey: (typeof window !== 'undefined' && (window as any).__STRIPE_PUBLISHABLE_KEY__) || '',
  version,
  commitHash,
};
