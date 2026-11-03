import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'https://localhost:18443';
const origin = new URL(base).origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Password tests require an isolated local environment');
assert.ok(process.env.SMOKE_CREDENTIALS_PATH, 'Synthetic credentials are required');
const fixture = JSON.parse(readFileSync(process.env.SMOKE_CREDENTIALS_PATH, 'utf8'));
for (const role of ['owner', 'admin', 'waiter', 'kitchen']) assert.ok(fixture[role]?.email && fixture[role]?.password);
assert.ok(Number.isInteger(fixture.tenant_id));

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  headless: true,
  acceptInsecureCerts: true,
  args: ['--no-sandbox', '--ignore-certificate-errors'],
});
const passed = [], runtimeErrors = [], forbiddenExternalWrites = [];
let phase = 'chooser';

async function page() {
  const context = await browser.createBrowserContext();
  const result = await context.newPage();
  result.on('pageerror', error => runtimeErrors.push(error.name));
  await result.setRequestInterception(true);
  result.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && new URL(request.url()).origin !== origin) {
      forbiddenExternalWrites.push(request.method());
      void request.abort('blockedbyclient');
    } else {
      void request.continue();
    }
  });
  return result;
}

async function visit(page, path) {
  const response = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 60000 });
  assert.equal(response.status(), 200, 'SPA route ' + path.split('?')[0]);
}

async function at(page, path) {
  await page.waitForFunction(expected => location.pathname === expected, { timeout: 30000 }, path);
}

async function apiStatus(page, path, expected) {
  const status = await page.evaluate(async path => (await fetch('/api' + path, { credentials: 'include' })).status, path);
  assert.equal(status, expected, 'API permissions ' + path);
}

async function login(page, role, portal, destination) {
  phase = `${portal}-login:${role}`;
  await visit(page, `/${portal}/login?tenant=${fixture.tenant_id}`);
  await page.waitForSelector('#email');
  await page.type('#email', fixture[role].email);
  await page.type('#password', fixture[role].password);
  const response = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/token');
  await page.click('form button[type=submit]');
  assert.equal((await response).status(), 200, 'Password accepted for synthetic ' + role);
  await at(page, destination);
  const cookie = (await page.cookies()).find(cookie => cookie.name === 'access_token');
  assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
}

try {
  const chooser = await page();
  await visit(chooser, '/login?tenant=' + fixture.tenant_id);
  for (const portal of ['staff', 'admin']) {
    const selector = `[data-testid="login-portal-${portal}"]`;
    await chooser.waitForSelector(selector);
    const href = await chooser.$eval(selector, element => element.href);
    const url = new URL(href);
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, `/${portal}/login`);
    assert.equal(url.searchParams.get('tenant'), String(fixture.tenant_id));
  }
  await chooser.click('[data-testid="login-portal-staff"]');
  await at(chooser, '/staff/login');
  await chooser.waitForSelector('#password');
  await visit(chooser, '/login?tenant=' + fixture.tenant_id);
  await chooser.click('[data-testid="login-portal-admin"]');
  await at(chooser, '/admin/login');
  await chooser.waitForSelector('#password');
  passed.push('Two entry cards open separate staff/admin login URLs and preserve restaurant context');

  const anonymousStaff = await page(), anonymousAdmin = await page();
  await visit(anonymousStaff, '/staff/pos');
  await at(anonymousStaff, '/staff/login');
  await visit(anonymousAdmin, '/settings');
  await at(anonymousAdmin, '/admin/login');
  passed.push('Protected POS/settings deep links use their corresponding login screen');

  for (const portal of ['staff', 'admin']) {
    phase = 'invalid-password:' + portal;
    const invalid = await page();
    await visit(invalid, `/${portal}/login?tenant=${fixture.tenant_id}`);
    await invalid.type('#email', fixture.waiter.email);
    await invalid.type('#password', 'not-the-synthetic-account-password');
    await invalid.click('form button[type=submit]');
    await invalid.waitForSelector('.error-banner');
    assert.equal(new URL(invalid.url()).pathname, `/${portal}/login`);
  }
  passed.push('Incorrect passwords stay on the selected portal and do not create an authenticated session');

  const waiter = await page();
  await login(waiter, 'waiter', 'staff', '/staff/pos');
  await waiter.reload({ waitUntil: 'networkidle2' });
  await at(waiter, '/staff/pos');
  await apiStatus(waiter, '/tenant/settings', 403);
  for (const path of ['/settings', '/users', '/reports', '/products']) {
    phase = 'waiter-route:' + path;
    await visit(waiter, path);
    await waiter.waitForFunction(restricted => location.pathname !== restricted, {}, path);
  }
  assert.equal(await waiter.$('a[href="/settings"]'), null, 'Staff navigation must not expose settings');
  passed.push('Staff login opens POS; reload retains session; management routes/API remain forbidden');

  const rejected = await page();
  phase = 'waiter-admin-login-denied';
  await visit(rejected, '/admin/login?tenant=' + fixture.tenant_id);
  await rejected.type('#email', fixture.waiter.email);
  await rejected.type('#password', fixture.waiter.password);
  await rejected.click('form button[type=submit]');
  await rejected.waitForSelector('.error-banner', { timeout: 30000 });
  assert.equal(new URL(rejected.url()).pathname, '/admin/login');
  const rejectedStatus = await rejected.evaluate(async () => (await fetch('/api/tenant/settings')).status);
  assert.ok([401, 403].includes(rejectedStatus));
  await visit(rejected, '/settings');
  await rejected.waitForFunction(() => location.pathname !== '/settings');
  passed.push('Staff credentials entered through the admin form cannot become an admin session');

  const kitchen = await page();
  await login(kitchen, 'kitchen', 'staff', '/kitchen');
  await apiStatus(kitchen, '/tenant/settings', 403);
  passed.push('Kitchen staff reach their operational screen and cannot read management settings');

  const owner = await page();
  await login(owner, 'owner', 'admin', '/settings');
  await apiStatus(owner, '/tenant/settings', 200);
  await visit(owner, '/staff/pos');
  await at(owner, '/staff/pos');
  await visit(owner, '/settings');
  await owner.reload({ waitUntil: 'networkidle2' });
  await at(owner, '/settings');
  passed.push('Owner admin login opens settings and can switch between administration and POS');

  const ownerStaff = await page(), manager = await page();
  await login(ownerStaff, 'owner', 'staff', '/staff/pos');
  await visit(ownerStaff, '/settings');
  await at(ownerStaff, '/settings');
  await login(manager, 'admin', 'admin', '/settings');
  await visit(manager, '/staff/pos');
  await at(manager, '/staff/pos');
  passed.push('Owner may choose the staff entry without losing real permissions; admin can access both panels');

  assert.deepEqual(runtimeErrors, []);
  assert.deepEqual(forbiddenExternalWrites, []);
  console.log(JSON.stringify({ passed, runtimeErrors: 0, productionMutations: 0 }));
} catch (error) {
  let message = error.message;
  for (const role of ['owner', 'admin', 'waiter', 'kitchen']) {
    for (const secret of [fixture[role].password, fixture[role].email]) message = message.split(secret).join('[redacted]');
  }
  if (fixture.table_token) message = message.split(fixture.table_token).join('[redacted]');
  console.error(JSON.stringify({ phase, message, passed, runtimeErrors }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
