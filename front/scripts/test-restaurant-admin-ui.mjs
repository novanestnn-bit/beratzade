import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const require=createRequire(import.meta.url),puppeteer=require('puppeteer-core');
const base=process.env.BASE_URL||'https://localhost:18443';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Disposable local environment only');
const fixture=JSON.parse(readFileSync(process.env.SMOKE_CREDENTIALS_PATH,'utf8'));
const browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,headless:true,acceptInsecureCerts:true,args:['--ignore-certificate-errors']});
const passed=[];let phase='login';
try {
 const page=await browser.newPage();await page.goto(base+'/admin/login?tenant='+fixture.tenant_id,{waitUntil:'networkidle2'});await page.type('#email',fixture.admin.email);await page.type('#password',fixture.admin.password);await page.click('form button[type=submit]');await page.waitForFunction(()=>location.pathname==='/settings');
 await page.waitForSelector('[data-testid="settings-advanced-toggle"]');
 const advancedSelector='[data-testid="settings-nav"] button[hidden]';assert.ok(await page.$(advancedSelector));
 await page.click('[data-testid="settings-advanced-toggle"]');await page.waitForFunction(()=>document.querySelectorAll('[data-testid="settings-nav"] button[hidden]').length===0);
 passed.push('Restaurant settings show daily operations first and retain advanced options behind an explicit toggle');
 phase='draft-create';await page.goto(base+'/products',{waitUntil:'networkidle2'});await page.waitForSelector('.page-header-actions > .btn-primary');await page.click('.page-header-actions > .btn-primary');await page.waitForSelector('#name');
 assert.equal(await page.$eval('[data-testid="product-published"]',e=>e.checked),false);
 const name='Isolated draft '+randomUUID().slice(0,8);await page.type('#name',name);await page.$eval('#price',e=>{e.value='42';e.dispatchEvent(new Event('input',{bubbles:true}))});
 const createdResponse=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/products');await page.click('form button[type=submit]');const created=await createdResponse;assert.ok([200,201].includes(created.status()));const product=await created.json();assert.equal(product.is_active,false);
 const getMenu=()=>page.evaluate(async id=>(await fetch('/api/public/tenants/'+id+'/menu')).json(),fixture.tenant_id);
 assert.ok(!(await getMenu()).categories.flatMap(c=>c.products).some(p=>p.id===product.id&&p.name===name));
 await page.waitForSelector('.publication-badge.is-draft');passed.push('A new product is a draft and is absent from the customer menu until explicitly published');
 phase='publish';const row='tr';await page.evaluate(name=>{const tr=[...document.querySelectorAll('tbody tr')].find(e=>e.textContent.includes(name));tr.querySelector('.actions .icon-btn').click()},name);await page.waitForSelector('[data-testid="product-published"]');await page.click('[data-testid="product-published"]');
 const updatedResponse=page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname==='/api/products/'+product.id);await page.click('form button[type=submit]');assert.equal((await updatedResponse).status(),200);
 const visible=(await getMenu()).categories.flatMap(c=>c.products).find(p=>p.id===product.id&&p.name===name);assert.equal(visible.price_cents,4200);passed.push('Publishing the verified product updates the same customer menu at the configured restaurant price');
 assert.ok((await page.title()).includes('Beratzade'));console.log(JSON.stringify({passed,productionMutations:0}));
}catch(e){let message=e.message;for(const role of ['admin','owner','waiter','kitchen'])for(const value of [fixture[role]?.email,fixture[role]?.password])if(value)message=message.split(value).join('[redacted]');console.error(JSON.stringify({phase,message,passed}));process.exitCode=1}finally{await browser.close()}
