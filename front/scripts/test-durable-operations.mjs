import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const base = process.env.BASE_URL || 'https://localhost:18443';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Isolated local environment only');
const fixture = JSON.parse(readFileSync(process.env.SMOKE_CREDENTIALS_PATH, 'utf8'));
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, headless: true, acceptInsecureCerts: true, args: ['--no-sandbox','--ignore-certificate-errors'] });
const passed = [];
let phase = 'setup', token = '';
async function createPage() {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  return page;
}
async function visit(page, path) { await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 60000 }); }
async function login(page, role) {
  await visit(page, '/' + (['owner','admin'].includes(role) ? 'admin' : 'staff') + '/login?tenant='+fixture.tenant_id);
  await page.type('#email',fixture[role].email);await page.type('#password',fixture[role].password);
  await page.click('form button[type=submit]');
  await page.waitForFunction(()=>!['/login','/staff/login','/admin/login'].includes(location.pathname));
}
async function api(page,path,method='GET',body,status=200) {
  const response=await page.evaluate(async({path,method,body})=>{const r=await fetch('/api'+path,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};},{path,method,body});
  assert.equal(response.status,status,method+' '+path.split(token||'never').join('[redacted]'));
  return response.data;
}
try {
  const owner=await createPage(),staff=await createPage(),guest=await createPage();
  await login(owner,'owner');await login(staff,'waiter');await visit(guest,'/beratzade');
  const floors=await api(owner,'/floors');
  const floor=floors[0]||await api(owner,'/floors','POST',{name:'Durable test floor'});
  const product=await api(owner,'/products','POST',{name:'Durable isolated '+randomUUID().slice(0,8),price_cents:2000,category:'Kahvaltı',is_active:true});
  const table=await api(owner,'/tables','POST',{name:'D-'+randomUUID().slice(0,8),floor_id:floor.id},201);token=table.token;
  phase='draft-reload';
  await visit(staff,'/staff/pos');
  const productSelector='[data-testid="pos-product-product-'+product.id+'"]';
  await staff.waitForSelector(productSelector);await staff.click(productSelector);
  await staff.waitForSelector('.cart-line');
  await staff.reload({waitUntil:'networkidle2'});await staff.waitForSelector('.cart-line');
  assert.ok((await staff.$eval('.cart-lines',e=>e.textContent)).includes(product.name));
  await staff.click('.cart-line .remove-line');
  await staff.click('[data-testid="pos-mode-table"]');await staff.waitForSelector('[data-testid="pos-table-'+table.id+'"]');await staff.click('[data-testid="pos-table-'+table.id+'"]');
  await staff.waitForSelector(productSelector);await staff.click(productSelector);
  await staff.setOfflineMode(true);await staff.click('[data-testid="pos-submit-order"]');
  await staff.waitForFunction(()=>!document.querySelector('[data-testid="pos-submit-order"]').disabled);
  assert.ok(await staff.$('.cart-line'));
  await staff.setOfflineMode(false);await staff.reload({waitUntil:'networkidle2'});await staff.waitForSelector('.cart-line');
  passed.push('POS draft survives reload and offline submission; closed tables are not automatically opened');
  phase='lost-order-response';
  let dropOrder=true,forwardError='',orderId=null;
  await staff.setRequestInterception(true);
  const intercept=async request=>{
    if(dropOrder&&request.method()==='POST'&&/\/api\/menu\/[^/]+\/order$/.test(new URL(request.url()).pathname)) {
      dropOrder=false;
      try {
        const r=await fetch('http://127.0.0.1:18020'+new URL(request.url()).pathname.replace(/^\/api/,''),{method:'POST',headers:{'Content-Type':'application/json'},body:request.postData()});
        assert.equal(r.status,200);orderId=(await r.json()).order_id;
      }catch(error){forwardError=error.name;}
      await request.abort('failed');
    }else await request.continue();
  };
  staff.on('request',intercept);
  const pendingRetry = await staff.$('[data-testid="pos-retry-order"]');
  await staff.click(pendingRetry && await pendingRetry.isVisible() ? '[data-testid="pos-retry-order"]' : '[data-testid="pos-submit-order"]');
  await staff.waitForFunction(()=>!document.querySelector('[data-testid="pos-submit-order"]').disabled);
  assert.equal(forwardError,'');assert.ok(orderId);
  await staff.reload({waitUntil:'networkidle2'});await staff.waitForSelector('.cart-line');
  const retried=staff.waitForResponse(r=>r.request().method()==='POST'&&/\/api\/menu\/[^/]+\/order$/.test(new URL(r.url()).pathname));
  const restoredRetry = await staff.$('[data-testid="pos-retry-order"]');
  await staff.click(restoredRetry && await restoredRetry.isVisible() ? '[data-testid="pos-retry-order"]' : '[data-testid="pos-submit-order"]');const retry=await retried;assert.equal(retry.status(),200);assert.equal((await retry.json()).order_id,orderId);
  await staff.waitForFunction(()=>!document.querySelector('.cart-line'));
  staff.off('request',intercept);await staff.setRequestInterception(false);
  let order=(await api(staff,'/orders')).find(row=>row.id===orderId);assert.equal(order.total_cents,2000);assert.equal(order.items.reduce((sum,i)=>sum+i.quantity,0),1);
  passed.push('Committed order with lost HTTP response is retried after reload without duplicate items/orders');
  phase='concurrent-order';
  const access=await api(staff,'/tables/'+table.id+'/staff-menu-token');
  const concurrentBody={idempotency_key:randomUUID(),staff_access:access.token,items:[{product_id:product.id,source:'product',quantity:1}]};
  const concurrent=await staff.evaluate(async({token,body})=>Promise.all([1,2].map(async()=>{const r=await fetch('/api/menu/'+token+'/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};})),{token,body:concurrentBody});
  assert.ok(concurrent.every(r=>r.status===200&&r.body.order_id===orderId));
  order=(await api(staff,'/orders')).find(row=>row.id===orderId);assert.equal(order.total_cents,4000);
  passed.push('Concurrent identical order submissions add one logical batch');
  phase='durable-call';
  const message='Durable call '+randomUUID().slice(0,8),callBody={message,idempotency_key:randomUUID()};
  const call=await api(guest,'/menu/'+token+'/call-waiter','POST',callBody);
  assert.equal((await api(guest,'/menu/'+token+'/call-waiter','POST',callBody)).request_id,call.request_id);
  const requestSelector='[data-testid="service-request-'+call.request_id+'"]';
  await staff.waitForSelector(requestSelector,{timeout:20000});
  await staff.reload({waitUntil:'networkidle2'});await staff.waitForSelector(requestSelector);
  await staff.click(requestSelector+' [data-testid="request-acknowledge"]');
  await staff.waitForFunction(id=>!document.querySelector('[data-testid="service-request-'+id+'"] [data-testid="request-acknowledge"]'),{},call.request_id);
  assert.equal((await api(staff,'/service-requests')).find(r=>r.id===call.request_id).status,'acknowledged');
  await visit(guest,'/menu/'+token);await guest.waitForSelector('[data-testid="customer-service-requests"]');
  assert.equal((await api(guest,'/menu/'+token+'/service-requests')).find(r=>r.id===call.request_id).status,'acknowledged');
  await staff.setOfflineMode(true);await staff.click(requestSelector+' [data-testid="request-resolve"]');
  await staff.waitForSelector('[data-testid="service-requests-offline"]');assert.ok(await staff.$(requestSelector));
  await staff.setOfflineMode(false);await staff.waitForFunction(()=>!document.querySelector('[data-testid="service-requests-offline"]'),{timeout:20000});
  await staff.click(requestSelector+' [data-testid="request-resolve"]');await staff.waitForFunction(id=>!document.querySelector('[data-testid="service-request-'+id+'"]'),{},call.request_id);
  assert.equal((await api(staff,'/service-requests?include_resolved=true')).find(r=>r.id===call.request_id).status,'resolved');
  passed.push('Call persists across reload, appears in POS, acknowledges/resolves durably, and survives offline status changes');
  phase='durable-payment-request';
  const paymentCall={payment_method:'cash',message:'Isolated payment request',idempotency_key:randomUUID()};
  const paymentRequest=await api(guest,'/menu/'+token+'/order/'+orderId+'/request-payment','POST',paymentCall);
  assert.equal((await api(guest,'/menu/'+token+'/order/'+orderId+'/request-payment','POST',paymentCall)).request_id,paymentRequest.request_id);
  await staff.waitForSelector('[data-testid="service-request-'+paymentRequest.request_id+'"]',{timeout:20000});
  phase='lost-payment-response';
  await staff.bringToFront();
  await staff.waitForSelector('[data-testid="pos-payment-form"]');
  await staff.evaluate(()=>[...document.querySelectorAll('[data-testid="pos-payment-form"] .method-pills button')].find(e=>e.textContent.trim()==='POS').click());
  await staff.waitForFunction(()=>Number(document.querySelector('[data-testid="pos-payment-form"] .amount-field input')?.value)===40,{timeout:20000});
  await staff.evaluate(()=>{const input=document.querySelector('[data-testid="pos-payment-form"] .amount-field input');input.value='30.00';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await staff.waitForFunction(()=>!document.querySelector('[data-testid="pos-collect-payment"]').disabled);
  let dropPayment=true,paymentBody;
  const auth=(await staff.cookies()).find(c=>c.name==='access_token').value;
  await staff.setRequestInterception(true);
  const interceptPayment=async request=>{
    if(dropPayment&&request.method()==='POST'&&new URL(request.url()).pathname==='/api/orders/'+orderId+'/payments') {
      dropPayment=false;paymentBody=JSON.parse(request.postData());
      try{const r=await fetch('http://127.0.0.1:18020/orders/'+orderId+'/payments',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'access_token='+auth},body:request.postData()});assert.equal(r.status,200);}catch(error){forwardError=error.name;}
      await request.abort('failed');
    }else await request.continue();
  };
  staff.on('request',interceptPayment);await staff.click('[data-testid="pos-collect-payment"]');
  phase='payment-error-visible';
  await staff.waitForFunction(()=>document.querySelector('[role="alert"]')!==null);
  assert.equal(forwardError,'');assert.ok(paymentBody?.idempotency_key);
  staff.off('request',interceptPayment);await staff.setRequestInterception(false);
  phase='payment-reload';
  await staff.reload({waitUntil:'networkidle2'});
  const ledger=await api(staff,'/orders/'+orderId+'/payments');assert.equal(ledger.payments.length,1);assert.equal(ledger.amount_remaining_cents,1000);
  await staff.waitForSelector('[data-testid="pos-collect-payment"]');
  phase='payment-replay';
  const replayResponse=staff.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/orders/'+orderId+'/payments');
  await staff.click('[data-testid="pos-collect-payment"]');const replay=await replayResponse;assert.equal(replay.status(),200);assert.equal((await replay.json()).payments.length,1);
  phase='payment-replay-complete';
  await staff.waitForFunction(()=>!document.querySelector('[data-testid="pos-collect-payment"]').disabled);
  const settledResponse=staff.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/orders/'+orderId+'/payments');
  await staff.click('[data-testid="pos-collect-payment"]');assert.equal((await settledResponse).status(),200);
  phase='payment-final-status';
  const settled=await api(staff,'/orders/'+orderId+'/payments');assert.equal(settled.payments.length,2);assert.equal(settled.amount_remaining_cents,0);
  const all=await api(staff,'/service-requests?include_resolved=true');assert.equal(all.find(r=>r.id===paymentRequest.request_id).status,'resolved');
  passed.push('Payment request is durable; committed payment with lost response is reconciled after reload and retry does not charge twice');
  console.log(JSON.stringify({passed,productionMutations:0,redisRequired:false,websocketRequired:false}));
}catch(error){let message=error.message;for(const value of [token,fixture.table_token,...['owner','admin','waiter','kitchen'].map(role=>fixture[role].password)])if(value)message=message.split(value).join('[redacted]');console.error(JSON.stringify({phase,message,passed}));process.exitCode=1;}
finally{await browser.close();}
