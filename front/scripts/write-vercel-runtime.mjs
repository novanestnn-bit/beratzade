import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function runtimeConfig(env) {
  let ws;
  try {
    ws = new URL(env.WS_URL);
  } catch {
    throw new Error('WS_URL must be the public wss:// WebSocket bridge URL');
  }
  if (ws.protocol !== 'wss:' || ws.username || ws.password || ws.search || ws.hash) {
    throw new Error('WS_URL must use wss:// without credentials, query parameters or fragments');
  }
  const stripe = env.STRIPE_PUBLISHABLE_KEY || '';
  if (stripe && !/^pk_(test|live)_[A-Za-z0-9]+$/.test(stripe)) {
    throw new Error('STRIPE_PUBLISHABLE_KEY must be a publishable key, never a secret key');
  }
  const ga = env.GOOGLE_ANALYTICS_MEASUREMENT_ID || '';
  if (ga && !/^G-[A-Z0-9]+$/.test(ga)) throw new Error('Invalid public analytics measurement ID');
  // Only these public values enter the browser. Never serialize process.env.
  return {
    __API_URL__: '/api',
    __WS_URL__: ws.href.replace(/\/$/, ''),
    __STRIPE_PUBLISHABLE_KEY__: stripe,
    __GA_MEASUREMENT_ID__: ga,
  };
}

export function runtimeScript(env) {
  return Object.entries(runtimeConfig(env))
    .map(([key, value]) => `window.${key} = ${JSON.stringify(value).replace(/</g, '\\u003c')};`)
    .join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    writeFileSync(new URL('../public/runtime-config.js', import.meta.url), runtimeScript(process.env));
    console.log('Public runtime configuration written; environment values are not logged.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
