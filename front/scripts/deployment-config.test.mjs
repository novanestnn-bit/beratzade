import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { runtimeConfig, runtimeScript } from './write-vercel-runtime.mjs';
import { buildOptions } from './build.mjs';

const deployment = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
const source = readFileSync(new URL('../src/environments/environment.prod.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function production(config = {}, protocol = 'https:') {
  const context = {
    exports: {}, URL,
    require: () => ({ commitHash: 'test', version: 'test' }),
    window: { location: { host: 'frontend.invalid', protocol }, ...config },
  };
  vm.runInNewContext(compiled, context);
  return context.exports.environment;
}

test('explicit HTTPS API and WSS bridge hosts are preserved', () => {
  const environment = production({ __API_URL__: 'https://api.invalid/', __WS_URL__: 'wss://bridge.invalid/ws/' });
  assert.equal(environment.apiUrl, 'https://api.invalid');
  assert.equal(environment.wsUrl, 'wss://bridge.invalid/ws');
});
test('same-origin API proxy and relative WS stay supported', () => {
  const environment = production({ __API_URL__: '/api', __WS_URL__: '/ws' });
  assert.equal(environment.apiUrl, '/api');
  assert.equal(environment.wsUrl, '/ws');
});
test('HTTPS pages reject insecure or credential-bearing service addresses', () => {
  for (const url of ['http://api.invalid', '//api.invalid', 'https://user:password@api.invalid', 'invalid']) {
    assert.equal(production({ __API_URL__: url }).apiUrl, '/api');
  }
  for (const url of ['ws://bridge.invalid/ws', '//bridge.invalid', 'wss://user:password@bridge.invalid/ws']) {
    assert.equal(production({ __WS_URL__: url }).wsUrl, 'wss://frontend.invalid/ws');
  }
});
test('browser config contains only whitelisted public values', () => {
  const output = runtimeScript({ WS_URL: 'wss://bridge.invalid/ws', SECRET_KEY: 'not-public', DATABASE_URL: 'not-public' });
  assert.equal(runtimeConfig({ WS_URL: 'wss://bridge.invalid/ws' }).__API_URL__, '/api');
  assert.ok(!output.includes('not-public'));
  assert.ok(!output.includes('SECRET_KEY'));
  assert.ok(!output.includes('DATABASE_URL'));
});
test('unsafe configured WebSocket URLs block release without exposing input', () => {
  for (const value of ['ws://bridge.invalid', 'wss://user:secret@bridge.invalid', 'wss://bridge.invalid?token=secret']) {
    assert.throws(() => runtimeConfig({ WS_URL: value }), (error) => !error.message.includes('secret'));
  }
});
test('a secret Stripe key cannot enter the browser bundle', () => {
  assert.throws(() => runtimeConfig({ WS_URL: 'wss://bridge.invalid/ws', STRIPE_PUBLISHABLE_KEY: 'sk_synthetic' }), /publishable key/);
});
test('explicit HTTP-only release needs no WebSocket URL and emits none', () => {
  const config = runtimeConfig({ REALTIME_ENABLED: 'false' });
  assert.equal(config.__REALTIME_ENABLED__, false);
  assert.equal(config.__WS_URL__, '');
  const environment = production(config);
  assert.equal(environment.realtimeEnabled, false);
  assert.equal(environment.wsUrl, '');
  assert.equal(environment.apiUrl, '/api');
  assert.ok(!runtimeScript({ REALTIME_ENABLED: 'false' }).includes('wss://'));
});
test('missing or empty WebSocket URL automatically selects HTTP-only even with realtime requested', () => {
  for (const WS_URL of [undefined, '', '   ']) {
    for (const REALTIME_ENABLED of [undefined, 'true', 'false']) {
      const config = runtimeConfig({ WS_URL, REALTIME_ENABLED });
      assert.equal(config.__REALTIME_ENABLED__, false);
      assert.equal(config.__WS_URL__, '');
      assert.equal(production(config).wsUrl, '');
      assert.equal(production(config).realtimeEnabled, false);
    }
  }
});

test('configured realtime stays enabled unless explicitly disabled and invalid switches fail', () => {
  assert.equal(production().realtimeEnabled, true);
  assert.equal(runtimeConfig({ WS_URL: 'wss://bridge.invalid/ws' }).__REALTIME_ENABLED__, true);
  assert.throws(() => runtimeConfig({ REALTIME_ENABLED: 'invalid' }), /REALTIME_ENABLED/);
  assert.equal(runtimeConfig({ WS_URL: 'wss://bridge.invalid/ws', REALTIME_ENABLED: 'false' }).__REALTIME_ENABLED__, false);
});
test('npm run build uses static Angular on Vercel and preserves other build configurations', () => {
  assert.deepEqual(buildOptions([], { VERCEL: '1' }), { vercel: true, args: ['build', '--configuration', 'production-static'] });
  assert.deepEqual(buildOptions(['--vercel'], {}), { vercel: true, args: ['build', '--configuration', 'production-static'] });
  assert.deepEqual(buildOptions(['--configuration', 'production-static'], {}), { vercel: false, args: ['build', '--configuration', 'production-static'] });
  assert.deepEqual(buildOptions([], {}), { vercel: false, args: ['build'] });
});
test('API rewrite strips only the API prefix and precedes the SPA fallback', () => {
  const route = deployment.routes[0];
  const expression = new RegExp(`^(?:${route.src})$`);
  assert.equal('/api/health/db'.replace(expression, route.dest), 'https://beratzade.onrender.com/health/db');
  assert.ok(!expression.test('/apiary'));
  assert.equal(route.headers['Cache-Control'], 'private, no-store');
  const fallback = new RegExp(`^(?:${deployment.routes.at(-1).src})$`);
  for (const path of ['/menu', '/public-menu', '/login', '/staff/pos', '/settings', '/public-menu/beratzade/kategori/kahvalti']) assert.ok(fallback.test(path));
  assert.ok(!fallback.test('/missing.js'));
  assert.ok(deployment.routes.some((route) => route.handle === 'filesystem'));
});
test('Vercel uses a static Angular build and requires manual Git deployment', () => {
  assert.equal(deployment.outputDirectory, 'dist/front/browser');
  assert.equal(deployment.buildCommand, 'npm run build');
  assert.equal(deployment.installCommand, 'npm ci --ignore-scripts');
  assert.equal(deployment.git.deploymentEnabled, false);
  assert.equal(deployment.routes.find((route) => route.src === '/').headers.Location, '/beratzade');
});
