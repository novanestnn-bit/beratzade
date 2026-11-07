import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:14200';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Test is restricted to localhost');

const tenant = {
  id: 19,
  name: 'Beratzade Kebap & Kahvaltı Salonu',
  public_slug: 'beratzade-test-fixture',
  currency_code: 'TRY',
  logo_filename: null,
  header_background_filename: null,
};
const product = (id, name, category, image_url = null) => ({
  id,
  source: 'product',
  name,
  price_cents: 100,
  price_formatted: '1.00',
  description: 'Synthetic menu UI fixture.',
  category,
  subcategory: null,
  image_url,
  available: true,
});
const products = [
  product(1, 'Menemen', 'Kahvaltı'),
  product(2, 'Tost', 'Kahvaltı'),
  product(3, 'Adana Kebap', 'Kebaplar ve Izgaralar'),
];
const categories = [
  { id: 'kahvalti', name: 'Kahvaltı', products: products.slice(0, 2), subcategories: [] },
  { id: 'kebaplar-ve-izgaralar', name: 'Kebaplar ve Izgaralar', products: [products[2]], subcategories: [] },
];
const menu = {
  tenant_id: tenant.id,
  tenant_name: tenant.name,
  currency: 'TRY',
  categories,
  category_tree: categories,
};

const browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  headless: true,
  args: ['--no-sandbox'],
});
const writes = [];
const runtimeErrors = [];
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`);
      return request.abort('blockedbyclient');
    }
    if (url.pathname === '/api/public/tenants/beratzade-test-fixture') {
      return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(tenant) });
    }
    if (url.pathname === `/api/public/tenants/${tenant.id}/menu`) {
      return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(menu) });
    }
    return request.continue();
  });

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${base}/public-menu/${tenant.public_slug}?lang=tr`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.beratzade-choice-card');
  assert.equal(await page.$$eval('.beratzade-choice-card', cards => cards.length), 2);
  assert.deepEqual(
    await page.$$eval('.beratzade-choice-card', cards => cards.map(card => card.dataset.section)),
    ['kahvalti', 'kebap-sulu-yemekler'],
  );
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 391, 'Main menu must fit a phone viewport');

  await page.click('.beratzade-choice-card[data-section="kahvalti"]');
  await page.waitForSelector('.beratzade-group-card');
  assert.equal(await page.$$eval('.beratzade-group-card', cards => cards.length), 6);
  assert.match(new URL(page.url()).searchParams.get('section'), /kahvalti/);

  await page.click('.beratzade-menu-home-link');
  await page.waitForSelector('.beratzade-choice-card');
  await page.click('.beratzade-choice-card[data-section="kebap-sulu-yemekler"]');
  await page.waitForSelector('.beratzade-group-card');
  assert.equal(await page.$$eval('.beratzade-group-card', cards => cards.length), 8);

  await page.click('.beratzade-group-card[data-group="izgara-kebap"]');
  await page.waitForSelector('.public-menu-product[data-product-key="product:3"]');
  const rendered = await page.$eval('.public-menu-product[data-product-key="product:3"]', card => card.innerText);
  assert.match(rendered, /Adana Kebap/);
  assert.match(rendered, /₺1,00/);
  await page.click('.public-menu-product-card');
  await page.waitForSelector('.public-menu-detail[data-product-key="product:3"]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.public-menu-detail'));

  assert.deepEqual(writes, [], 'No API write requests may be made');
  assert.deepEqual(runtimeErrors, [], 'Browser must have no runtime errors');
  console.log(JSON.stringify({
    result: 'passed',
    data: 'synthetic browser-only fixture; not an API integration test',
    viewport: '390x844',
    entryCards: 2,
    breakfastGroups: 6,
    grillGroups: 8,
    orderWrites: 0,
    runtimeErrors: 0,
  }));
} finally {
  await browser.close();
}
