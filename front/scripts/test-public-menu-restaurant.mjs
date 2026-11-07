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
  category_tree: [{ id: 'kahvalti', name: 'Kahvaltı', products: [legacy], subcategories: [{ id: 'sandvicler', name: 'Sandviçler', products: [linked] }, { id: 'empty-unpublished', name: 'Empty browser-only subcategory', products: [] }] }, { id: 'mezeler-ve-salatalar', name: 'Mezeler ve Salatalar', products: [salad], subcategories: [] }],
};
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true, acceptInsecureCerts: true, args: ['--no-sandbox', '--ignore-certificate-errors'] });
const fixtureProducts = new Map([legacy, linked, salad].map(product => [`${product.source}:${product.id}`, product]));
const passed = [], runtimeErrors = [], decorativeImageRequests = [], decorativeImageFailures = [], writeRequests = [];
let phase = 'setup';
try {
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.on('pageerror', error => runtimeErrors.push(error.name));
  page.on('response', response => {
    if (new URL(response.url()).pathname.startsWith('/menu-categories/') && response.status() >= 400) decorativeImageFailures.push(response.status());
  });
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
      // These local assets come from the user's attachments and may decorate the
      // restaurant hero. They must never silently become a dish's own photograph.
      if (path.startsWith('/menu-categories/')) decorativeImageRequests.push(path);
      void request.continue();
    }
  });
  async function visit(path) { const response = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 60000 }); assert.equal(response.status(), 200); }
  async function noOverflow() { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Viewport must not overflow horizontally'); }
  async function visibleProductKeys(expected) {
    await page.waitForFunction(keys => {
      const actual = [...document.querySelectorAll('.public-menu-product[data-product-key]')].map(card => card.getAttribute('data-product-key')).sort();
      return JSON.stringify(actual) === JSON.stringify(keys);
    }, {}, [...expected].sort());
  }
  async function searchMenu(query, expected) {
    await page.$eval('.public-menu-search input', (input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, query);
    await visibleProductKeys(expected);
    if (query.trim()) {
      await page.waitForSelector('.menu-result-count');
      assert.match(await page.$eval('.menu-result-count', element => element.textContent), new RegExp('(^|\\D)' + expected.length + '(\\D|$)'), 'Search count must match the rendered source-qualified dishes');
    }
  }
  async function productImagesMatchApi(selector) {
    const cards = await page.$$(selector);
    assert.ok(cards.length > 0, 'API product cards must be present');
    for (const card of cards) {
      await card.scrollIntoView();
      const key = await card.evaluate(element => element.getAttribute('data-product-key'));
      const product = fixtureProducts.get(key);
      assert.ok(product, 'Each card must keep its source-qualified API identity');
      if (product.image_url === '/uploads/ui-fixture.svg') {
        await page.waitForFunction(({ selector, key }) => {
          const card = [...document.querySelectorAll(selector)].find(element => element.getAttribute('data-product-key') === key);
          const image = card?.querySelector('img');
          return !!image?.complete && image.naturalWidth > 0;
        }, {}, { selector, key });
      } else if (product.image_url === '/uploads/ui-missing.webp') {
        await page.waitForFunction(({ selector, key }) => {
          const card = [...document.querySelectorAll(selector)].find(element => element.getAttribute('data-product-key') === key);
          return !!card && !card.querySelector('img');
        }, {}, { selector, key });
      }
      const rendered = await card.evaluate(element => ({
        text: element.textContent,
        images: [...element.querySelectorAll('img')].map(image => image.src),
        imageBackgrounds: [element, ...element.querySelectorAll('*')].filter(node => getComputedStyle(node).backgroundImage.includes('url(')).length,
      }));
      assert.ok(rendered.text.includes(product.name), 'A card must display the name for its own source/id');
      assert.equal(rendered.imageBackgrounds, 0, 'Product cards must not replace an API photo with a decorative background');
      if (product.image_url === '/uploads/ui-fixture.svg') {
        assert.deepEqual(rendered.images, [new URL('/api' + product.image_url, base).href], 'Dish photograph must match this exact API product');
      } else {
        assert.deepEqual(rendered.images, [], 'A missing dish photo must remain a neutral placeholder');
      }
    }
  }
  phase = 'restaurant-home-responsive';
  await visit('/beratzade');
  await page.waitForSelector('.featured-card[data-product-key="tenant_product:1"]');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewport({ width, height: 900 });
    await noOverflow();
    assert.ok((await page.$eval('.hero h1', element => element.textContent.trim())).length > 0, 'Restaurant hero must have a readable heading');
    const heroMenu = new URL(await page.$eval('.hero a[href*="/public-menu/"]', element => element.href));
    assert.equal(heroMenu.pathname, '/public-menu/beratzade-ui-fixture');
    assert.ok(await page.$('header a[href*="/public-menu/beratzade-ui-fixture"]'), 'Main navigation must retain the restaurant menu');
    for (const anchor of ['hakkimizda', 'iletisim']) {
      assert.ok(await page.$('#' + anchor), 'Restaurant information target must exist: ' + anchor);
      assert.ok(await page.$(`a[href="#${anchor}"]`), 'Restaurant navigation must reach its information section');
    }
    await productImagesMatchApi('.featured-card[data-product-key]');
  }
  passed.push('Restaurant home, menu CTA and navigation work at four widths; every dish keeps its own API photograph or a neutral placeholder');
  phase = 'home-product-link';
  await page.setViewport({ width: 390, height: 844 });
  await visit('/beratzade');
  await page.waitForSelector('.featured-card[data-product-key="tenant_product:1"]');
  await noOverflow();
  phase = 'mobile-home-anchor-navigation';
  await page.click('.mobile-toggle');
  await page.waitForSelector('#restaurant-mobile-nav a[href="#hakkimizda"]', { visible: true });
  await page.click('#restaurant-mobile-nav a[href="#hakkimizda"]');
  await page.waitForFunction(() => {
    const navigation = document.getElementById('restaurant-mobile-nav');
    return document.querySelector('.mobile-toggle')?.getAttribute('aria-expanded') === 'false'
      && (!navigation || getComputedStyle(navigation).display === 'none');
  });
  await page.waitForFunction(() => {
    const section = document.getElementById('hakkimizda')?.getBoundingClientRect();
    return location.pathname === '/beratzade' && !!document.querySelector('.hero')
      && !!section && section.top < innerHeight && section.bottom > 0;
  });
  assert.equal(new URL(page.url()).pathname, '/beratzade', 'Mobile section links must not follow the document base URL to the application root');
  assert.ok(await page.$('.hero'), 'In-page navigation must keep the restaurant home mounted');
  passed.push('Mobile About navigation closes the menu and scrolls within the restaurant page without leaving /beratzade');
  phase = 'home-product-link';
  const target = new URL(await page.$eval('.featured-card[data-product-key="tenant_product:1"]', element => element.href));
  assert.equal(target.searchParams.get('product'), 'tenant_product:1');
  assert.ok(target.pathname.endsWith('/kategori/kahvalti'));
  await page.click('.featured-card[data-product-key="tenant_product:1"]');
  await page.waitForSelector('.public-menu-detail[data-product-key="tenant_product:1"]');
  assert.equal(await page.$eval('.public-menu-detail h2', element => element.textContent), linked.name);
  await productImagesMatchApi('.public-menu-detail[data-product-key]');
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.public-menu-detail[data-product-key="tenant_product:1"]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.public-menu-detail'));
  await page.waitForFunction(() => !new URL(location.href).searchParams.has('product'));
  passed.push('Home product links open the exact source/id, survive reload and close through Escape');

  phase = 'category-and-cards';
  await visit('/public-menu/beratzade-ui-fixture?lang=tr');
  await page.waitForSelector('.beratzade-category-card');
  assert.equal(await page.$$eval('.beratzade-category-card', cards => cards.length), 2);
  assert.ok((await page.$eval('.beratzade-category-grid', element => element.textContent)).includes('Mezeler'));
  await visibleProductKeys([...fixtureProducts.keys()]);
  assert.equal(await page.$('section[aria-labelledby*="empty-unpublished"], a[href*="empty-unpublished"]'), null, 'An empty subcategory must not become a navigation destination or menu section');
  assert.equal(await page.evaluate(() => document.body.textContent.includes('Empty browser-only subcategory')), false, 'An empty subcategory must not appear as a menu section');
  const tools = await page.$eval('.beratzade-menu-tools', element => ({
    position: getComputedStyle(element).position,
    search: !!element.querySelector('input[type="search"]'),
    links: [...element.querySelectorAll('.menu-quick-categories a')].map(link => ({ path: new URL(link.href).pathname, text: link.textContent.trim(), active: link.getAttribute('aria-current') })),
  }));
  assert.equal(tools.position, 'sticky', 'The menu search and category bar must remain sticky');
  assert.equal(tools.search, true);
  assert.equal(tools.links.length, 3, 'Quick navigation must include all dishes and both non-empty categories');
  assert.equal(tools.links[0].path, '/public-menu/beratzade-ui-fixture');
  assert.equal(tools.links[0].text, 'Tüm menü');
  assert.equal(tools.links[0].active, 'page');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewport({ width, height: 900 });
    await noOverflow();
    await visibleProductKeys([...fixtureProducts.keys()]);
    const maximum = await page.$$eval('.public-menu-product-image-wrap', images => Math.max(...images.map(image => image.getBoundingClientRect().width)));
    assert.ok(maximum <= 120, 'Menu index thumbnails must remain compact at width ' + width);
    await productImagesMatchApi('.public-menu-product[data-product-key]');
  }
  passed.push('Menu index shows both categories and all three source-qualified dishes with sticky search/all navigation, no empty subcategory and no overflow at four widths');

  phase = 'menu-search-normalization';
  await searchMenu('NUMERIC sandvicler', ['tenant_product:1']);
  await searchMenu('Sandviçler SAME', ['tenant_product:1']);
  await searchMenu('browser-only KAHVALTI', ['product:1', 'tenant_product:1']);
  await searchMenu('SALATALAR fresh', ['product:2']);
  await searchMenu('fresh salatalar', ['product:2']);
  await searchMenu('', [...fixtureProducts.keys()]);
  passed.push('Search handles Turkish accents, case, word order, category and description without changing product identities');

  phase = 'collapsed-category-search';
  const categoryToggle = '#cat-kahvalti .public-menu-category-toggle';
  await page.click(categoryToggle);
  await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-expanded') === 'false', {}, categoryToggle);
  await visibleProductKeys(['tenant_product:1', 'product:2']);
  await searchMenu('isolated dish', ['product:1']);
  await page.waitForSelector('.public-menu-product[data-product-key="product:1"]', { visible: true });
  assert.equal(await page.$eval(categoryToggle, button => button.getAttribute('aria-expanded')), 'true', 'A matching dish must be revealed even when its category was collapsed');
  await page.click('.public-menu-search-clear');
  await page.waitForFunction(() => document.querySelector('.public-menu-search input')?.value === '');
  await visibleProductKeys(['tenant_product:1', 'product:2']);
  assert.equal(await page.$eval(categoryToggle, button => button.getAttribute('aria-expanded')), 'false', 'Clearing search must restore the prior collapsed state');
  await page.click(categoryToggle);
  await visibleProductKeys([...fixtureProducts.keys()]);
  passed.push('Search reveals a matching dish inside a collapsed category and clearing search restores the user’s previous category state');

  phase = 'empty-search-results';
  await searchMenu('zzzz-no-fixture-match', []);
  await page.waitForSelector('.public-menu-no-results .menu-retry', { visible: true });
  const noResults = await page.$eval('.public-menu-no-results', element => ({ title: element.querySelector('h2')?.textContent.trim(), text: element.textContent }));
  assert.equal(noResults.title, 'Aradığınızı bulamadık');
  assert.ok(noResults.text.includes('Farklı bir ürün adı deneyin veya tüm menüye dönün.'));
  assert.ok(!noResults.text.includes('MENU_EXPERIENCE.'), 'The empty search state must render translated copy');
  await page.click('.public-menu-no-results .menu-retry');
  await visibleProductKeys([...fixtureProducts.keys()]);
  assert.equal(await page.$('.public-menu-no-results'), null);
  assert.equal(await page.$eval('.public-menu-search input', input => input.value), '');
  passed.push('No-match search gives a translated explanation and a working clear action that restores the full menu');

  phase = 'category-and-cards';
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
    await productImagesMatchApi('.public-menu-product[data-product-key]');
  }
  passed.push('Published categories stay visible; parent/subcategory dishes, equal ids and broken images render safely at four viewport sizes');

  phase = 'modal-focus-and-back';
  await page.click('.public-menu-product[data-product-key="product:1"] .public-menu-product-card');
  await page.waitForSelector('.public-menu-detail[data-product-key="product:1"]');
  await page.waitForFunction(() => document.activeElement?.classList.contains('public-menu-detail-close'));
  assert.equal(await page.$eval('.public-menu-detail h2', element => element.textContent), legacy.name);
  await productImagesMatchApi('.public-menu-detail[data-product-key]');
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
  assert.deepEqual(decorativeImageFailures, [], 'User-supplied decorative assets must load successfully');
  assert.deepEqual(writeRequests, []);
  assert.deepEqual(runtimeErrors, []);
  console.log(JSON.stringify({ passed, decorativeImageRequests: [...new Set(decorativeImageRequests)].length, nonApiProductImages: 0, writeRequests: 0, runtimeErrors: 0, productionMutations: 0 }));
} catch (error) {
  console.error(JSON.stringify({ phase, message: error.message, passed, runtimeErrors }));
  process.exitCode = 1;
} finally { await browser.close(); }
