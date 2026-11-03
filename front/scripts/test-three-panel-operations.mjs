import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'https://localhost:18443';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'This mutating test is restricted to an isolated local environment');
assert.ok(process.env.SMOKE_CREDENTIALS_PATH);
const fixture = JSON.parse(readFileSync(process.env.SMOKE_CREDENTIALS_PATH, 'utf8'));
assert.ok(fixture.owner && fixture.admin && fixture.waiter && fixture.kitchen && fixture.table_token);
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true, acceptInsecureCerts: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
const passed = [];
const runtimeErrors = [];
const serverErrors = [];
let websocketAttempts = 0;
let phase = 'login';
async function page() {
  const context = await browser.createBrowserContext();
  const result = await context.newPage();
  result.on('dialog', dialog => dialog.accept());
  result.on('pageerror', error => runtimeErrors.push(error.name));
  result.on('response', response => {
    if (response.status() >= 500) serverErrors.push(response.status() + ' ' + new URL(response.url()).pathname.replace(/\/menu\/[^/]+/, '/menu/[redacted]'));
  });
  const cdp = await result.createCDPSession();
  await cdp.send('Network.enable');
  cdp.on('Network.webSocketCreated', () => websocketAttempts++);
  return result;
}
async function visit(page, path) {
  const response = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 60000 });
  assert.equal(response.status(), 200);
}
async function login(page, role) {
  phase = 'login:' + role;
  await visit(page, '/' + (['owner', 'admin'].includes(role) ? 'admin' : 'staff') + '/login?tenant=' + fixture.tenant_id);
  await page.type('#email', fixture[role].email);
  await page.type('#password', fixture[role].password);
  const request = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/token');
  await page.click('form button[type=submit]');
  assert.equal((await request).status(), 200, 'Password login: ' + role);
  await page.waitForFunction(() => !['/login', '/staff/login', '/admin/login'].includes(location.pathname));
  const cookie = (await page.cookies()).find(cookie => cookie.name === 'access_token');
  assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
}
async function api(page, path, method = 'GET', body, status = 200) {
  const response = await page.evaluate(async ({ path, method, body }) => {
    const result = await fetch('/api' + path, { method, credentials: 'include', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    let data;
    try { data = await result.json(); } catch { data = null; }
    return { status: result.status, data };
  }, { path, method, body });
  assert.equal(response.status, status, method + ' ' + path.replace(fixture.table_token, '[redacted]'));
  return response.data;
}
async function see(page, text) {
  await page.waitForFunction(text => document.body.textContent.includes(text), {}, text);
}
try {
  const admin = await page(), manager = await page(), staff = await page(), kitchen = await page(), guest = await page();
  await login(admin, 'owner');
  await login(manager, 'admin');
  await login(staff, 'waiter');
  await login(kitchen, 'kitchen');
  passed.push('Owner/admin/waiter/kitchen password logins and Secure/HttpOnly/SameSite session cookies');
  phase = 'admin';
  await visit(admin, '/settings');
  const settings = await api(admin, '/tenant/settings');
  assert.equal(settings.id, fixture.tenant_id);
  await api(admin, '/tenant/settings', 'PUT', { description: 'Isolated three-panel operations', custom_subcategories: { 'Kahvaltı': ['Fırın Ürünleri'] } });
  const product = await api(admin, '/products', 'POST', { name: 'Isolated operations product ' + randomUUID().slice(0, 8), category: 'Kahvaltı', subcategory: 'Fırın Ürünleri', price_cents: 14000, is_active: true });
  await api(admin, '/products/' + product.id, 'PUT', { name: product.name, category: 'Kahvaltı', subcategory: 'Fırın Ürünleri', price_cents: 15000, is_active: true });
  await visit(admin, '/products');
  await see(admin, product.name);
  await visit(guest, '/beratzade');
  const menu = await api(guest, '/public/tenants/' + fixture.tenant_id + '/menu?lang=tr');
  const publicProduct = menu.categories.flatMap(category => category.products).find(row => row.name === product.name);
  assert.equal(publicProduct.price_cents, 15000);
  passed.push('Admin settings, category/product/price API changes appear in product UI and public menu');
  phase = 'admin-users';
  const staffUser = await api(admin, '/users', 'POST', { email: 'isolated-' + randomUUID() + '@amvara.de', password: randomUUID() + randomUUID(), full_name: 'Isolated managed staff', role: 'waiter' });
  await api(admin, '/users/' + staffUser.id, 'PUT', { full_name: 'Isolated updated staff' });
  await visit(admin, '/users');
  await see(admin, 'Isolated updated staff');
  phase = 'admin-tables';
  const floors = await api(admin, '/floors');
  const floor = floors[0] || await api(admin, '/floors', 'POST', { name: 'Operations floor' });
  const tableName = 'OP-' + randomUUID().slice(0, 8);
  const managedTable = await api(admin, '/tables', 'POST', { name: tableName, seat_count: 4, floor_id: floor.id }, 201);
  fixture.table_token = managedTable.token;
  await api(admin, '/tables/' + managedTable.id, 'PUT', { name: tableName, seat_count: 6 });
  await visit(admin, '/tables');
  await see(admin, tableName);
  passed.push('Admin staff creation/update and table creation/update reflected in their screens');
  phase = 'authorization';
  await api(staff, '/tenant/settings', 'GET', undefined, 403);
  await api(staff, '/users', 'POST', { email: 'forbidden@amvara.de', password: randomUUID(), role: 'owner' }, 403);
  await api(staff, '/products', 'POST', { name: 'Forbidden test', price_cents: 100 }, 403);
  await api(staff, '/products/' + product.id, 'PUT', { is_active: false }, 403);
  for (const restricted of ['/settings', '/users', '/reports']) {
    await visit(staff, restricted);
    await staff.waitForFunction(path => location.pathname !== path, {}, restricted);
  }
  await api(kitchen, '/tenant/settings', 'GET', undefined, 403);
  await api(kitchen, '/orders/staff-sale', 'POST', { idempotency_key: randomUUID(), sale_type: 'quick_sale', items: [{ product_id: product.id, source: 'product', quantity: 1 }] }, 403);
  for (const restricted of ['/staff/pos', '/settings', '/users', '/reports']) {
    await visit(kitchen, restricted);
    await kitchen.waitForFunction(path => location.pathname !== path, {}, restricted);
  }
  await api(manager, '/users/' + staffUser.id, 'DELETE', undefined, 403);
  await api(guest, '/tenant/settings', 'GET', undefined, 401);
  passed.push('Anonymous, waiter and kitchen roles cannot use admin APIs/screens or escalate roles');
  phase = 'staff-pos';
  const tables = await api(staff, '/tables');
  const table = tables.find(row => row.token === fixture.table_token);
  assert.ok(table);
  await visit(staff, '/staff/pos');
  await staff.waitForSelector('[data-testid="pos-mode-table"]');
  await staff.click('[data-testid="pos-mode-table"]');
  await staff.waitForSelector('[data-testid="pos-table-' + table.id + '"]');
  const activating = staff.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/tables/' + table.id + '/activate');
  await staff.click('[data-testid="pos-table-' + table.id + '"]');
  const activationResponse = await activating;
  assert.equal(activationResponse.status(), 200);
  const activation = await activationResponse.json();
  const selector = '[data-testid="pos-product-product-' + product.id + '"]';
  await staff.waitForSelector(selector);
  await staff.click(selector);
  const sent = staff.waitForResponse(response => response.request().method() === 'POST' && /\/api\/menu\/[^/]+\/order$/.test(new URL(response.url()).pathname));
  await staff.click('[data-testid="pos-submit-order"]');
  const sentResponse = await sent;
  assert.equal(sentResponse.status(), 200);
  const orderId = (await sentResponse.json()).order_id;
  await staff.waitForSelector('[data-testid="pos-sent-order"]');
  passed.push('Waiter POS selects table, adds product and submits a real isolated order through UI');
  phase = 'customer-order';
  await visit(guest, '/menu/' + fixture.table_token);
  await see(guest, product.name);
  const nameInput = await guest.$('.name-input');
  if (nameInput) await guest.click('.modal-actions .btn-secondary');
  const added = await guest.evaluate(name => {
    for (const button of document.querySelectorAll('.add-to-cart-btn,.quick-add-btn')) {
      let parent = button.parentElement;
      for (let level = 0; parent && level < 4; level++, parent = parent.parentElement) {
        if (parent.textContent.includes(name) && parent.querySelectorAll('.add-to-cart-btn,.quick-add-btn').length === 1) { button.click(); return true; }
      }
    }
    return false;
  }, product.name);
  assert.equal(added, true);
  await guest.waitForSelector('.cart-sheet');
  if (await guest.$('.cart-summary-cta')) await guest.click('.cart-summary-cta');
  await guest.waitForSelector('.place-order-btn');
  const ordered = guest.waitForResponse(response => response.request().method() === 'POST' && /\/api\/menu\/[^/]+\/order$/.test(new URL(response.url()).pathname));
  await guest.click('.place-order-btn');
  await guest.waitForSelector('.pin-input');
  await guest.type('.pin-input', activation.pin);
  await guest.$eval('.pin-input', element => element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })));
  const guestResponse = await ordered;
  assert.equal(guestResponse.status(), 200);
  assert.equal((await guestResponse.json()).order_id, orderId);
  let order = (await api(staff, '/orders')).find(row => row.id === orderId);
  assert.equal(order.items.reduce((sum, item) => sum + item.quantity, 0), 2);
  assert.equal(order.total_cents, 30000);
  passed.push('Anonymous QR customer submits via UI into same table/order/database at current product price');
  phase = 'kitchen';
  await visit(kitchen, '/kitchen');
  await see(kitchen, product.name);
  for (const item of order.items) {
    await api(kitchen, '/orders/' + orderId + '/items/' + item.id + '/status', 'PUT', { status: 'preparing' });
    await api(kitchen, '/orders/' + orderId + '/items/' + item.id + '/status', 'PUT', { status: 'ready' });
  }
  order = (await api(staff, '/orders')).find(row => row.id === orderId);
  assert.ok(order.items.every(item => item.status === 'ready'));
  await visit(staff, '/staff/orders');
  await see(staff, product.name);
  for (const item of order.items) await api(staff, '/orders/' + orderId + '/items/' + item.id + '/status', 'PUT', { status: 'delivered' });
  passed.push('Kitchen sees same order, advances preparation/ready; waiter sees and delivers items');
  phase = 'payment';
  await api(kitchen, '/orders/' + orderId + '/payments', 'POST', { amount_cents: 1, payment_method: 'cash', idempotency_key: randomUUID() }, 403);
  await api(guest, '/orders/' + orderId + '/payments', 'POST', { amount_cents: 1, payment_method: 'cash', idempotency_key: randomUUID() }, 401);
  if (!await api(staff, '/cash-register/current')) await api(staff, '/cash-register/open', 'POST', { opening_cash_cents: 0 });
  const key = randomUUID();
  const partial = await api(staff, '/orders/' + orderId + '/payments', 'POST', { amount_cents: 10000, payment_method: 'cash', idempotency_key: key });
  assert.equal(partial.amount_remaining_cents, 20000);
  const retry = await api(staff, '/orders/' + orderId + '/payments', 'POST', { amount_cents: 10000, payment_method: 'cash', idempotency_key: key });
  assert.equal(retry.payments.length, 1);
  await visit(staff, '/staff/pos');
  await staff.click('[data-testid="pos-mode-table"]');
  await staff.waitForSelector('[data-testid="pos-table-' + table.id + '"]');
  await staff.click('[data-testid="pos-table-' + table.id + '"]');
  await staff.waitForSelector('[data-testid="pos-payment-form"]');
  await staff.evaluate(() => [...document.querySelectorAll('[data-testid="pos-payment-form"] .method-pills button')].find(button => button.textContent.trim() === 'POS').click());
  const paymentRequest = staff.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/orders/' + orderId + '/payments');
  await staff.click('[data-testid="pos-collect-payment"]');
  const paymentResponse = await paymentRequest;
  assert.equal(paymentResponse.status(), 200);
  const paid = await paymentResponse.json();
  assert.equal(paid.amount_remaining_cents, 0);
  assert.equal(paid.payments.length, 2);
  await staff.waitForSelector('[data-testid="pos-payment-complete"]');
  await api(staff, '/tables/' + table.id + '/close', 'POST', {});
  await api(guest, '/menu/' + fixture.table_token, 'GET', undefined, 403);
  passed.push('Partial cash plus terminal payment, duplicate-payment protection and account/table closure');
  phase = 'reports';
  const today = new Date().toISOString().slice(0, 10);
  const reports = await api(admin, '/reports/sales?from_date=' + today + '&to_date=' + today);
  assert.ok(JSON.stringify(reports).includes('30000'), 'Paid sale amount reaches admin reports');
  await visit(admin, '/reports');
  await admin.waitForSelector('app-sidebar');
  assert.equal(new URL(admin.url()).pathname, '/reports');
  await api(admin, '/users/' + staffUser.id, 'DELETE');
  const hidden = await api(admin, '/products/' + product.id, 'PUT', { is_active: false });
  assert.equal(hidden.is_active, false);
  const after = await api(guest, '/public/tenants/' + fixture.tenant_id + '/menu');
  assert.ok(!after.categories.flatMap(category => category.products).some(row => row.id === product.id));
  passed.push('Admin reports reflect paid sale; deactivated product disappears from customer menu');
  assert.equal(websocketAttempts, 0);
  assert.deepEqual(runtimeErrors, []);
  assert.deepEqual(serverErrors, []);
  console.log(JSON.stringify({ passed, websocketAttempts, runtimeErrors: runtimeErrors.length, serverErrors: serverErrors.length, productionMutations: 0 }));
} catch (error) {
  let message = error.message;
  for (const value of [fixture.table_token, ...['owner', 'admin', 'waiter', 'kitchen'].map(role => fixture[role].password)]) message = message.split(value).join('[redacted]');
  console.error(JSON.stringify({ phase, message, passed, runtimeErrors, serverErrors }));
  process.exitCode = 1;
} finally { await browser.close(); }
