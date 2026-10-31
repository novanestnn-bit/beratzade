import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'https://localhost:18443';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local isolated deployment fixture');
assert.ok(process.env.SMOKE_CREDENTIALS_PATH, 'SMOKE_CREDENTIALS_PATH must name the isolated fixture file');
const fixture = JSON.parse(readFileSync(process.env.SMOKE_CREDENTIALS_PATH, 'utf8'));
const httpOnly = process.env.REALTIME_ENABLED === 'false';
const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  headless: true, acceptInsecureCerts: true,
  args: ['--no-sandbox', '--ignore-certificate-errors'],
});
const results = [];
const errors = [];
let websocketHandshakes = 0;
let websocketMessages = 0;
let websocketAttempts = 0;
let wsTokenRequests = 0;
async function pageFor(context) {
  const page = await context.newPage();
  if (httpOnly) {
    await page.exposeFunction('__recordWebSocketAttempt', () => { websocketAttempts++; });
    await page.evaluateOnNewDocument(() => {
      window.WebSocket = new Proxy(window.WebSocket, {
        construct() {
          window.__recordWebSocketAttempt();
          throw new Error('HTTP-only mode attempted a WebSocket connection');
        },
      });
    });
  }
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/ws-token') wsTokenRequests++;
  });
  page.on('pageerror', (error) => errors.push(error.name));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin !== new URL(base).origin || response.status() < 400) return;
    if (response.status() === 401 && url.pathname === '/api/users/me') return;
    if (response.status() === 403 && url.pathname === '/api/tenant/settings') return;
    errors.push(`HTTP ${response.status()} ${url.pathname.replace(/(\/menu\/)[^/]+/, '$1[redacted]')}`);
  });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  cdp.on('Network.webSocketHandshakeResponseReceived', (event) => {
    if (event.response.status === 101) websocketHandshakes++;
  });
  cdp.on('Network.webSocketFrameReceived', () => { websocketMessages++; });
  return page;
}
async function visit(page, route, label = route) {
  const response = await page.goto(base + route, { waitUntil: 'networkidle2', timeout: 30000 });
  assert.equal(response.status(), 200, `Direct route ${label}`);
}
async function login(page, role) {
  await visit(page, `/login?tenant=${fixture.tenant_id}`);
  await page.waitForSelector('#email');
  await page.type('#email', fixture[role].email);
  await page.type('#password', fixture[role].password);
  await page.click('form button[type=submit]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 20000 });
  const cookies = await page.cookies();
  const access = cookies.find((cookie) => cookie.name === 'access_token');
  assert.ok(access?.httpOnly && access?.secure && access?.sameSite === 'Lax', 'Secure HttpOnly Lax auth cookie survives API proxy');
}
try {
  const guestContext = await browser.createBrowserContext();
  const guest = await pageFor(guestContext);
  await visit(guest, '/');
  assert.equal(new URL(guest.url()).pathname, '/beratzade');
  if (httpOnly) assert.ok(await guest.$('[data-testid="http-only-notice"]'), 'HTTP-only refresh notice is visible');
  const slug = 'beratzade-kebap-kahvalti-salonu';
  await visit(guest, `/public-menu/${slug}?lang=tr`);
  await guest.waitForFunction(() => document.body.innerText.includes('Kahvaltı'));
  await visit(guest, `/public-menu/${slug}/kategori/kahvalti?lang=tr`);
  await guest.waitForFunction(() => document.body.innerText.includes('Readiness Menemen'));
  await guest.reload({ waitUntil: 'networkidle2' });
  assert.ok(await guest.evaluate(() => document.body.innerText.includes('Readiness Menemen')));
  results.push('Public menu direct URL and refresh');
  for (const width of [360, 390, 768, 1440]) {
    await guest.setViewport({ width, height: 900 });
    assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), `Responsive width ${width}`);
  }
  results.push('Mobile/tablet/desktop widths');
  if (httpOnly) {
    await visit(guest, `/menu/${fixture.table_token}`, 'QR menu');
    await guest.waitForFunction(() => document.body.innerText.includes('Readiness Menemen'));
    await visit(guest, `/display/${fixture.table_token}`, 'Customer display');
    results.push('QR menu and customer display through HTTP');
  }
  await visit(guest, '/staff/pos');
  await guest.waitForFunction(() => location.pathname === '/login');
  results.push('Anonymous staff access blocked');
  const staffContext = await browser.createBrowserContext();
  const staff = await pageFor(staffContext);
  await login(staff, 'waiter');
  await visit(staff, '/staff/pos');
  await staff.waitForFunction(() => document.body.innerText.includes('Readiness Menemen'));
  assert.equal(await staff.evaluate(async () => (await fetch('/api/tenant/settings', { credentials: 'include' })).status), 403);
  await visit(staff, '/staff/orders');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const saleStatus = await staff.evaluate(async () => {
    const menu = await (await fetch('/api/staff/pos-menu?sale_type=quick_sale')).json();
    const product = menu.category_tree.flatMap((category) => category.products).find((item) => item.name === 'Readiness Menemen');
    return (await fetch('/api/orders/staff-sale', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotency_key: crypto.randomUUID(), sale_type: 'quick_sale', items: [{ product_id: product.id, source: 'product', quantity: 1 }] }),
    })).status;
  });
  assert.equal(saleStatus, 200, 'Isolated staff sale is created');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (!httpOnly) assert.ok(websocketMessages > 0, 'Redis order update arrives through the WebSocket bridge');
  await staff.reload({ waitUntil: 'networkidle2' });
  assert.ok(await staff.evaluate(() => document.body.innerText.includes('Readiness Menemen')), 'Saved HTTP order is visible after refresh');
  await visit(staff, '/settings');
  await staff.waitForFunction(() => location.pathname !== '/settings');
  results.push('Staff login, POS and admin authorization');
  const adminContext = await browser.createBrowserContext();
  const admin = await pageFor(adminContext);
  await login(admin, 'admin');
  await visit(admin, '/settings');
  assert.equal(new URL(admin.url()).pathname, '/settings');
  assert.equal(await admin.evaluate(async () => (await fetch('/api/tenant/settings', { credentials: 'include' })).status), 200);
  assert.equal(await admin.evaluate(async () => {
    const user = await (await fetch('/api/users/me')).json();
    return ['hashed_password', 'otp_secret', 'token_version', 'otp_recovery_codes'].some((key) => key in user);
  }), false, 'Current-user response contains no authentication internals');
  results.push('Admin login and settings direct URL');
  if (httpOnly) {
    assert.equal(websocketAttempts, 0, 'All WebSocket constructors stay disabled');
    assert.equal(websocketHandshakes, 0);
    assert.equal(wsTokenRequests, 0, 'No realtime authentication request is sent');
    results.push('HTTP-only: no WS attempts or WS-token requests; HTTP order saved and refreshed');
  } else {
    assert.ok(websocketHandshakes > 0, 'Production WS origin connects through bridge');
    results.push('Authenticated WebSocket handshake and Redis order update');
  }
  assert.deepEqual(errors, [], 'No unexpected local network or runtime errors');
  console.log(JSON.stringify({ passed: results, websocketAttempts, wsTokenRequests, websocketHandshakes, websocketMessages, runtimeErrors: errors.length }));
} catch (error) {
  console.error(error.message.split(fixture.table_token).join('[redacted]'));
  console.error(JSON.stringify({ completed: results, runtimeErrors: errors }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
