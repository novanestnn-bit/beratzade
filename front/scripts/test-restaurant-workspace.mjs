import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'https://localhost:18443';
const origin = new URL(base).origin;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Only a disposable local test environment is supported');
assert.ok(['http:', 'https:'].includes(new URL(base).protocol), 'Only the local HTTP test server is supported');
assert.ok(process.env.SMOKE_CREDENTIALS_PATH, 'Synthetic fixture credentials are required');
const fixture = JSON.parse(readFileSync(process.env.SMOKE_CREDENTIALS_PATH, 'utf8'));
assert.ok(Number.isInteger(fixture.tenant_id) && typeof fixture.table_token === 'string' && fixture.table_token.length >= 16);
for (const role of ['owner', 'admin', 'waiter', 'kitchen']) {
  assert.ok(/^(?:readiness-(?:admin|waiter)|operations-(?:owner|kitchen))@amvara\.de$/.test(fixture[role]?.email || ''), 'Only generated local fixture accounts are accepted');
  assert.ok(typeof fixture[role]?.password === 'string' && fixture[role].password.length >= 16);
}

const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true, acceptInsecureCerts: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
const passed = [], runtimeErrors = [], blockedWrites = [];
const states = new WeakMap();
let isolated = false, phase = 'fixture-guard', temporaryEmail = '';

const until = async (check, label, milliseconds = 10000) => {
  const deadline = Date.now() + milliseconds;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(label);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

async function page() {
  const context = await browser.createBrowserContext();
  const result = await context.newPage();
  const state = { settingsWrites: [], exportQueries: [], cashRegisterRequests: [], deleteCount: 0, failDeleteId: null, failDeleteOnce: false, dialogDecision: 'accept', dialogs: 0 };
  states.set(result, state);
  result.on('pageerror', error => runtimeErrors.push(error.name));
  result.on('dialog', async dialog => {
    state.dialogs++;
    if (state.dialogDecision === 'dismiss') await dialog.dismiss();
    else await dialog.accept();
  });
  await result.setRequestInterception(true);
  result.on('request', async request => {
    const url = new URL(request.url()), method = request.method();
    const writes = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (writes && (!isolated || url.origin !== origin)) {
      blockedWrites.push(method);
      await request.abort('blockedbyclient');
      return;
    }
    if (method === 'PUT' && url.pathname === '/api/tenant/settings') state.settingsWrites.push(JSON.parse(request.postData() || '{}'));
    if (method === 'GET' && url.pathname === '/api/reports/export') state.exportQueries.push(Object.fromEntries(url.searchParams));
    if (url.pathname.startsWith('/api/cash-register/')) state.cashRegisterRequests.push(method + ' ' + url.pathname);
    if (method === 'DELETE' && url.pathname === '/api/users/' + state.failDeleteId) {
      state.deleteCount++;
      if (state.failDeleteOnce) {
        state.failDeleteOnce = false;
        await request.respond({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Isolated retryable failure' }) });
        return;
      }
    }
    await request.continue();
  });
  return result;
}

async function visit(page, path) {
  const response = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 60000 });
  assert.equal(response.status(), 200, 'SPA route ' + path.split('?')[0]);
}

async function api(page, path, method = 'GET', body, expected = 200) {
  const response = await page.evaluate(async ({ path, method, body }) => {
    const result = await fetch('/api' + path, { method, credentials: 'include', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await result.json(); } catch { }
    return { status: result.status, data };
  }, { path, method, body });
  assert.equal(response.status, expected, 'Local API status: ' + method + ' ' + path.split(fixture.table_token).join('[redacted]'));
  return response.data;
}

async function input(page, selector, value) {
  await page.$eval(selector, (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(value));
}

async function login(page, role) {
  await visit(page, '/' + (['owner', 'admin'].includes(role) ? 'admin' : 'staff') + '/login?tenant=' + fixture.tenant_id);
  await page.type('#email', fixture[role].email);
  await page.type('#password', fixture[role].password);
  await page.click('form button[type=submit]');
  await page.waitForFunction(() => !['/login', '/admin/login', '/staff/login'].includes(location.pathname));
}

try {
  const probe = await page();
  await visit(probe, '/beratzade');
  const proof = await probe.evaluate(async ({ tenantId, token }) => {
    const tenantResponse = await fetch('/api/public/tenants/' + tenantId);
    const menuResponse = await fetch('/api/public/tenants/' + tenantId + '/menu?lang=en');
    const tableResponse = await fetch('/api/menu/' + encodeURIComponent(token));
    if (![tenantResponse, menuResponse, tableResponse].every(response => response.status === 200)) return { verified: false };
    const tenant = await tenantResponse.json(), menu = await menuResponse.json(), table = await tableResponse.json();
    return { verified: tenant.id === tenantId && menu.tenant_id === tenantId && tenant.name.startsWith('Beratzade Kebap') && menu.categories.flatMap(category => category.products).some(product => product.name === 'Readiness Menemen' && product.price_cents === 12500) && table.table_name === 'T01' };
  }, { tenantId: fixture.tenant_id, token: fixture.table_token });
  assert.ok(proof.verified, 'Synthetic DB marker and random fixture table token must match before writes');
  isolated = true;
  passed.push('Loopback origin, generated account identities, synthetic product and random table marker verified before any write');

  const owner = await page(), waiter = await page(), manager = await page();
  await login(owner, 'owner');
  await login(waiter, 'waiter');
  await login(manager, 'admin');
  phase = 'table-permissions';
  const floors = await api(owner, '/floors');
  const floor = floors[0] || await api(owner, '/floors', 'POST', { name: 'Workspace isolated floor' });
  const table = await api(owner, '/tables', 'POST', { name: 'Workspace-' + randomUUID().slice(0, 8), floor_id: floor.id }, 201);
  await visit(waiter, '/tables');
  await waiter.waitForSelector('[data-testid="tables-view-toggle"]');
  await waiter.waitForFunction(name => document.body.textContent.includes(name), {}, table.name);
  assert.equal(await waiter.$('[data-testid="tables-add-table"]'), null);
  assert.equal(await waiter.$('[data-testid^="table-edit-"]'), null);
  assert.equal(await waiter.$('[data-testid^="table-delete-"]'), null);
  await waiter.click('[data-testid="view-mode-table"]');
  assert.equal(await waiter.$('[data-testid^="table-edit-"]'), null);
  await visit(owner, '/tables');
  await owner.waitForSelector('[data-testid="tables-add-table"]');
  assert.ok(await owner.$('[data-testid="table-edit-' + table.id + '"]'));
  passed.push('Waiter tile/list views hide table creation/edit/delete; owner retains table management');

  phase = 'report-dirty-export';
  await visit(owner, '/reports');
  await owner.waitForSelector('[data-testid="reports-applied-range"]');
  const oldRange = await owner.$eval('[data-testid="reports-applied-range"]', element => element.textContent);
  const oldFrom = await owner.$eval('[data-testid="reports-from"]', element => element.value);
  const from = oldFrom === '2026-01-01' ? '2025-12-01' : '2026-01-01';
  const to = from === '2026-01-01' ? '2026-01-31' : '2025-12-31';
  await input(owner, '[data-testid="reports-from"]', from);
  await input(owner, '[data-testid="reports-to"]', to);
  await owner.waitForSelector('[data-testid="reports-filters-pending"]');
  for (const selector of ['reports-export-csv', 'reports-export-excel']) assert.equal(await owner.$eval('[data-testid="' + selector + '"]', element => element.disabled), true);
  assert.equal(await owner.$eval('[data-testid="reports-applied-range"]', element => element.textContent), oldRange);
  const exportsBefore = states.get(owner).exportQueries.length;
  await owner.evaluate(() => document.querySelector('[data-testid="reports-export-csv"]').click());
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(states.get(owner).exportQueries.length, exportsBefore);
  await owner.click('.header-actions > .btn-primary');
  await owner.waitForFunction(({ from, to }) => {
    const range = document.querySelector('[data-testid="reports-applied-range"]')?.textContent || '';
    return range.includes(from) && range.includes(to) && !document.querySelector('[data-testid="reports-filters-pending"]');
  }, {}, { from, to });
  const exportResponse = owner.waitForResponse(response => new URL(response.url()).pathname === '/api/reports/export');
  await owner.click('[data-testid="reports-export-csv"]');
  assert.equal((await exportResponse).status(), 200);
  const exported = states.get(owner).exportQueries.at(-1);
  assert.equal(exported.from_date, from);
  assert.equal(exported.to_date, to);
  passed.push('Unsaved report dates disable export and preserve the applied range; explicit refresh exports exactly that range');

  phase = 'user-delete-retry';
  temporaryEmail = 'workspace-' + randomUUID() + '@amvara.de';
  const user = await api(owner, '/users', 'POST', { email: temporaryEmail, password: randomUUID() + randomUUID(), full_name: 'Isolated workspace staff', role: 'waiter' });
  await visit(owner, '/users');
  await owner.waitForSelector('.user-card');
  const ownerState = states.get(owner);
  ownerState.failDeleteId = user.id;
  ownerState.failDeleteOnce = true;
  await owner.evaluate(email => {
    const card = [...document.querySelectorAll('.user-card')].find(card => card.querySelector('.user-email')?.textContent?.trim() === email);
    card.querySelector('.user-actions .btn-danger').click();
  }, temporaryEmail);
  await owner.waitForSelector('[data-testid="user-delete-dialog"]');
  await owner.click('[data-testid="user-delete-submit"]');
  await owner.waitForSelector('[data-testid="user-delete-error"]');
  assert.ok(await owner.$('[data-testid="user-delete-dialog"]'));
  assert.equal(ownerState.deleteCount, 1);
  const deleted = owner.waitForResponse(response => response.request().method() === 'DELETE' && new URL(response.url()).pathname === '/api/users/' + user.id);
  await owner.click('[data-testid="user-delete-submit"]');
  assert.ok([200, 204].includes((await deleted).status()));
  await owner.waitForFunction(() => !document.querySelector('[data-testid="user-delete-dialog"]'));
  assert.equal(ownerState.deleteCount, 2);
  assert.ok(!(await api(owner, '/users')).some(item => item.id === user.id));
  passed.push('Failed user deletion keeps its confirmation and inline error; a deliberate retry succeeds without reopening the dialog');

  phase = 'settings-sparse-patch';
  await visit(owner, '/settings');
  await owner.waitForSelector('#name');
  const baseline = await api(owner, '/tenant/settings');
  const phone = '+900000000001';
  await api(manager, '/tenant/settings', 'PUT', { phone });
  const name = 'Beratzade Kebap & Kahvaltı Salonu - isolated workspace ' + randomUUID().slice(0, 8);
  await input(owner, '#name', name);
  ownerState.dialogDecision = 'dismiss';
  const dialogsBefore = ownerState.dialogs;
  await owner.evaluate(() => document.querySelector('a[href="/staff/pos"]').click());
  await until(() => ownerState.dialogs > dialogsBefore, 'Unsaved settings navigation must request confirmation');
  assert.equal(new URL(owner.url()).pathname, '/settings');
  assert.equal(await owner.$eval('#name', element => element.value), name);
  ownerState.dialogDecision = 'accept';
  const writtenBefore = ownerState.settingsWrites.length;
  const saved = owner.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/tenant/settings');
  await owner.click('form:has(#name) [data-testid="settings-save"]');
  assert.equal((await saved).status(), 200);
  assert.equal(ownerState.settingsWrites.length, writtenBefore + 1);
  assert.deepEqual(Object.keys(ownerState.settingsWrites.at(-1)).sort(), ['name']);
  const after = await api(owner, '/tenant/settings');
  assert.equal(after.name, name);
  assert.ok(after.phone === phone, 'A concurrent manager phone change must survive an unrelated name save');
  const savedDialogs = ownerState.dialogs;
  await owner.evaluate(() => document.querySelector('a[href="/staff/pos"]').click());
  await owner.waitForFunction(() => location.pathname === '/staff/pos');
  assert.equal(ownerState.dialogs, savedDialogs, 'A successfully saved settings form must not warn on exit');
  await api(manager, '/tenant/settings', 'PUT', { name: baseline.name, phone: baseline.phone ?? null });
  passed.push('Settings save only changed fields, protect unsaved navigation and preserve another manager’s concurrent changes');

  phase = 'cash-register-hidden';
  for (const person of [owner, waiter]) {
    await visit(person, '/staff/pos');
    assert.equal(await person.$('[data-testid="cash-register"]'), null, 'POS must not show register controls');
    assert.equal(await person.$('[data-testid="pos-completed-payments"]'), null, 'POS must not show turnover history');
    assert.deepEqual(states.get(person).cashRegisterRequests, [], 'POS should not call cash register endpoints');
  }
  passed.push('Owner and waiter POS screens hide cash register/turnover and do not poll or submit register actions');

  phase = 'cash-register-absent-after-reload';
  const uncertain = await page();
  await login(uncertain, 'waiter');
  await visit(uncertain, '/staff/pos');
  const uncertainState = states.get(uncertain);
  await uncertain.reload({ waitUntil: 'networkidle2' });
  assert.equal(await uncertain.$('[data-testid="cash-register"]'), null);
  assert.equal(await uncertain.$('[data-testid="pos-completed-payments"]'), null);
  assert.deepEqual(uncertainState.cashRegisterRequests, []);
  passed.push('Cash register controls and turnover remain absent after reloading POS');

  assert.deepEqual(blockedWrites, []);
  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ passed, productionMutations: 0, runtimeErrors: 0, automaticCashRetries: 0 }));
} catch (error) {
  let message = error.message;
  for (const value of [fixture.table_token, temporaryEmail, ...['owner', 'admin', 'waiter', 'kitchen'].flatMap(role => [fixture[role].email, fixture[role].password])]) if (value) message = message.split(value).join('[redacted]');
  console.error(JSON.stringify({ phase, message, passed, runtimeErrors }));
  process.exitCode = 1;
} finally { await browser.close(); }
