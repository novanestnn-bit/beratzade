import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'https://localhost:18443';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'UI fixtures are restricted to localhost');
const tenant = { id: 1, name: 'Beratzade Kebap & Kahvaltı Salonu', public_slug: 'beratzade-ui-fixture', currency_code: 'TRY', logo_filename: null, header_background_filename: null };
const item = (id, source, name, overrides = {}) => ({ id, source, name, price_cents: 9500, price_formatted: '95.00', description: 'Synthetic browser-only menu fixture.', category: 'Kahvaltı', subcategory: null, image_url: null, available: true, ...overrides });
const legacy = item(1, 'product', 'Isolated restaurant dish with a deliberately long name to verify readable mobile cards', { image_url: '/uploads/ui-fixture.svg' });
const linked = item(1, 'tenant_product', 'Other source with the same numeric id', { subcategory: 'Sandviçler', price_cents: 12500, image_url: '/uploads/ui-missing.webp' });
const salad = item(2, 'product', 'Isolated fresh salad', { category: 'Mezeler ve Salatalar', price_cents: 1234567 });
const menu = {
  tenant_id: tenant.id, tenant_name: tenant.name, currency: 'TRY', lang: 'tr',
  categories: [{ id: 'kahvalti', name: 'Kahvaltı', products: [legacy, linked] }, { id: 'mezeler-ve-salatalar', name: 'Mezeler ve Salatalar', products: [salad] }],
  category_tree: [{ id: 'kahvalti', name: 'Kahvaltı', products: [legacy], subcategories: [{ id: 'sandvicler', name: 'Sandviçler', products: [linked] }] }, { id: 'mezeler-ve-salatalar', name: 'Mezeler ve Salatalar', products: [salad], subcategories: [] }],
};
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true, acceptInsecureCerts: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
const passed = [], runtimeErrors = [], stockPhotoRequests = [], writeRequests = [];
let phase = 'setup';
try {
  const page = await browser.newPage();
  page.on('pageerror', error => runtimeErrors.push(error.name));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    const json = data => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writeRequests.push(request.method());
      void request.abort('blockedbyclient');
    } else if (path === '/api/public/tenants') void json([tenant]);
    else if (/^\/api\/public\/tenants\/(1|beratzade-ui-fixture)\/menu$/.test(path)) void json(menu);
    else if (/^\/api\/public\/tenants\/(1|beratzade-ui-fixture)$/.test(path)) void json(tenant);
    else if (path === '/api/uploads/ui-fixture.svg') void request.respond({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#e8e1d6"/><circle cx="50" cy="50" r="28" fill="#fffdf8"/></svg>' });
    else if (path === '/api/uploads/ui-missing.webp') void request.respond({ status: 404, body: '' });
    else {
      if (path.startsWith('/menu-categories/')) stockPhotoRequests.push(path);
      void request.continue();
    }
  });
  async function visit(path) { const response = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 60000 }); assert.equal(response.status(), 200); }
  async function noOverflow() { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Viewport must not overflow horizontally'); }
  phase = 'home-product-link';
  await page.setViewport({ width: 390, height: 844 });
  await visit('/beratzade');
  await page.waitForSelector('.featured-card[data-product-key="tenant_product:1"]');
  await noOverflow();
  const target = new URL(await page.$eval('.featured-card[data-product-key="tenant_product:1"]', element => element.href));
  assert.equal(target.searchParams.get('product'), 'tenant_product:1');
  assert.ok(target.pathname.endsWith('/kategori/kahvalti'));
  await page.click('.featured-card[data-product-key="tenant_product:1"]');
  await page.waitForSelector('.public-menu-detail[data-product-key="tenant_product:1"]');
  assert.equal(await page.$eval('.public-menu-detail h2', element => element.textContent), linked.name);
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.public-menu-detail[data-product-key="tenant_product:1"]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.public-menu-detail'));
  await page.waitForFunction(() => !new URL(location.href).searchParams.has('product'));
  passed.push('Home product links open the exact source/id, survive reload and close through Escape');

  phase = 'category-and-cards';
  await visit('/public-menu/beratzade-ui-fixture');
  await page.waitForSelector('.beratzade-category-card');
  assert.equal(await page.$$eval('.beratzade-category-card', cards => cards.length), 2);
  assert.ok((await page.$eval('.beratzade-category-grid', element => element.textContent)).includes('Mezeler'));
  await page.click('a.beratzade-category-card[href*="kahvalti"]');
  await page.waitForSelector('.public-menu-product[data-product-key="product:1"]');
  await page.waitForSelector('.public-menu-product[data-product-key="tenant_product:1"]');
  assert.equal(await page.$$eval('.public-menu-product', cards => cards.length), 2, 'Both parent dishes and subcategory dishes remain visible');
  await page.waitForFunction(() => !document.querySelector('.public-menu-product[data-product-key="tenant_product:1"] img'));
  assert.ok(await page.$('.public-menu-product[data-product-key="tenant_product:1"] .public-menu-product-placeholder'));
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewport({ width, height: 900 });
    await noOverflow();
    const maximum = await page.$$eval('.public-menu-product-image-wrap', images => Math.max(...images.map(image => image.getBoundingClientRect().width)));
    assert.ok(maximum <= 120, 'Food thumbnails must remain compact at width ' + width);
  }
  passed.push('Published categories stay visible; parent/subcategory dishes, equal ids and broken images render safely at four viewport sizes');

  phase = 'modal-focus-and-back';
  await page.click('.public-menu-product[data-product-key="product:1"] .public-menu-product-card');
  await page.waitForSelector('.public-menu-detail[data-product-key="product:1"]');
  await page.waitForFunction(() => document.activeElement?.classList.contains('public-menu-detail-close'));
  assert.equal(await page.$eval('.public-menu-detail h2', element => element.textContent), legacy.name);
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => !!document.activeElement?.closest('.public-menu-detail')));
  await page.goBack({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => !document.querySelector('.public-menu-detail'));
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
  await visit('/public-menu/beratzade-ui-fixture?product=product%3A999');
  await page.waitForSelector('[data-testid="public-menu-product-unavailable"]');
  assert.equal(await page.$('.public-menu-detail'), null);
  passed.push('Product dialog traps focus, restores scrolling on browser Back and never substitutes another product for an invalid link');
  assert.deepEqual(stockPhotoRequests, []);
  assert.deepEqual(writeRequests, []);
  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ passed, stockPhotoRequests: 0, writeRequests: 0, runtimeErrors: 0, productionMutations: 0 }));
} catch (error) {
  console.error(JSON.stringify({ phase, message: error.message, passed, runtimeErrors }));
  process.exitCode = 1;
} finally { await browser.close(); }
