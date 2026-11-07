import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AudioService } from '../services/audio.service';
import { MenuComponent } from './menu.component';

describe('QR order batch reliability', () => {
  let api: any, fixture: ComponentFixture<MenuComponent>, menu: MenuComponent;
  const product = { id: 31, name: 'Isolated dish', price_cents: 2500, _source: 'product' } as any;
  beforeEach(() => {
    localStorage.clear();
    api = { getCurrentUser: () => null, submitOrder: jasmine.createSpy(), getPublicServiceRequests: () => of([]) };
    TestBed.configureTestingModule({ imports: [MenuComponent, TranslateModule.forRoot()], providers: [
      { provide: ApiService, useValue: api }, { provide: AudioService, useValue: {} },
      { provide: ActivatedRoute, useValue: { snapshot: { params: { token: 'isolated-qr-table' }, queryParams: {} } } },
    ] });
    TestBed.overrideComponent(MenuComponent, { set: { template: '' } });
    fixture = TestBed.createComponent(MenuComponent);menu = fixture.componentInstance;
    (menu as any).tableToken = 'isolated-qr-table';(menu as any).sessionId = 'isolated-device';
    menu.tableIsActive.set(true);menu.tableRequiresPin.set(false);
    spyOn<any>(menu, 'loadMenu').and.stub();spyOn<any>(menu, 'loadStoredOrders').and.stub();spyOn<any>(menu, 'loadOrderHistory').and.stub();
    menu.addToCart(product);
  });
  afterEach(() => { fixture.destroy();localStorage.clear(); });

  it('locks the cart before geolocation and sends only the frozen batch', async () => {
    let acceptLocation!: PositionCallback;
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(success => { acceptLocation = success; });
    const response = new Subject<any>();api.submitOrder.and.returnValue(response);
    menu.submitOrder();
    expect(menu.submitting()).toBeTrue();expect(api.submitOrder).not.toHaveBeenCalled();
    menu.incrementItem(menu.cart()[0]);menu.addToCart(product);menu.decrementItem(menu.cart()[0]);
    expect(menu.cart()[0].quantity).toBe(1);
    menu.submitOrder();
    acceptLocation({ coords: { latitude: 1, longitude: 1 } } as GeolocationPosition);
    await Promise.resolve();await Promise.resolve();
    expect(api.submitOrder.calls.count()).toBe(1);
    expect(api.submitOrder.calls.mostRecent().args[1].items[0].quantity).toBe(1);
    response.next({ order_id: 501 });expect(menu.cart()).toEqual([]);
  });

  it('replays the original key/body after a lost response and locks all item mutations', async () => {
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((_success, fail) => fail?.({ code: 1 } as GeolocationPositionError));
    api.submitOrder.and.returnValue(throwError(() => ({ status: 0 })));
    menu.submitOrder();await Promise.resolve();await Promise.resolve();
    expect(menu.orderUncertain()).toBeTrue();
    const first = api.submitOrder.calls.mostRecent().args[1];
    menu.incrementItem(menu.cart()[0]);menu.decrementItem(menu.cart()[0]);menu.addToCart(product);
    expect(menu.cart()[0].quantity).toBe(1);
    const snapshot = JSON.parse(localStorage.getItem('qr-draft:isolated-qr-table:isolated-device')!);
    expect(snapshot.pendingSubmission.pin).toBeUndefined();expect(snapshot.pendingSubmission.staff_access).toBeUndefined();
    expect(snapshot.pendingSubmission.latitude).toBeUndefined();
    api.submitOrder.and.returnValue(of({ order_id: 501 }));
    menu.retryPendingOrder();await Promise.resolve();await Promise.resolve();
    const retry = api.submitOrder.calls.mostRecent().args[1];
    expect(retry.idempotency_key).toBe(first.idempotency_key);expect(retry.items).toEqual(first.items);
    expect(menu.orderUncertain()).toBeFalse();expect(menu.cart()).toEqual([]);
  });

  it('keeps the draft without sending if local recovery storage is unavailable', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('unavailable');
    menu.submitOrder();
    expect(api.submitOrder).not.toHaveBeenCalled();expect(menu.submitting()).toBeFalse();expect(menu.cart().length).toBe(1);
  });

  it('restores the uncertain batch after reload without generating a replacement key', async () => {
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((_success, fail) => fail?.({ code: 1 } as GeolocationPositionError));
    localStorage.setItem('session_isolated-qr-table', 'isolated-device');
    api.submitOrder.and.returnValue(throwError(() => ({ status: 0 })));
    menu.submitOrder();await Promise.resolve();await Promise.resolve();
    const first = api.submitOrder.calls.mostRecent().args[1];
    fixture.destroy();
    fixture = TestBed.createComponent(MenuComponent);menu = fixture.componentInstance;
    spyOn<any>(menu, 'loadMenu').and.stub();spyOn<any>(menu, 'loadStoredOrders').and.stub();spyOn<any>(menu, 'loadOrderHistory').and.stub();
    menu.ngOnInit();
    expect(menu.orderUncertain()).toBeTrue();expect(menu.cart()[0].quantity).toBe(1);
    expect(menu.showNameModal()).toBeFalse();
    api.submitOrder.and.returnValue(of({ order_id: 501 }));
    menu.retryPendingOrder();await Promise.resolve();await Promise.resolve();
    expect(api.submitOrder.calls.mostRecent().args[1].idempotency_key).toBe(first.idempotency_key);
    expect(menu.orderUncertain()).toBeFalse();expect(menu.cart()).toEqual([]);
  });

  it('retains an expired uncertain QR batch with the same table session and key', async () => {
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((_success, fail) => fail?.({ code: 1 } as GeolocationPositionError));
    localStorage.setItem('session_isolated-qr-table', 'isolated-device');
    api.submitOrder.and.returnValue(throwError(() => ({ status: 0 })));
    menu.submitOrder();await Promise.resolve();await Promise.resolve();
    const first = api.submitOrder.calls.mostRecent().args[1];
    fixture.destroy();
    const key = 'qr-draft:isolated-qr-table:isolated-device';
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.at = Date.now() - 24 * 3600000;
    localStorage.setItem(key, JSON.stringify(draft));
    fixture = TestBed.createComponent(MenuComponent);menu = fixture.componentInstance;
    spyOn<any>(menu, 'loadMenu').and.stub();spyOn<any>(menu, 'loadStoredOrders').and.stub();spyOn<any>(menu, 'loadOrderHistory').and.stub();
    menu.ngOnInit();
    expect(menu.orderUncertain()).toBeTrue();
    menu.retryPendingOrder();await Promise.resolve();await Promise.resolve();
    expect(api.submitOrder.calls.mostRecent().args[1].idempotency_key).toBe(first.idempotency_key);
    expect(api.submitOrder.calls.mostRecent().args[1].items).toEqual(first.items);
  });

  it('expires ordinary QR drafts instead of reviving a previous service cart', () => {
    localStorage.setItem('session_isolated-qr-table', 'isolated-device');
    localStorage.setItem('qr-draft:isolated-qr-table:isolated-device', JSON.stringify({
      at: Date.now() - 24 * 3600000, tableToken: 'isolated-qr-table', sessionId: 'isolated-device', cart: menu.cart(),
    }));
    menu.cart.set([]);menu.ngOnInit();
    expect(menu.cart()).toEqual([]);
    expect(menu.orderUncertain()).toBeFalse();
  });

  it('rejects a pending QR snapshot copied from another table or session', () => {
    localStorage.setItem('session_isolated-qr-table', 'isolated-device');
    localStorage.setItem('qr-draft:isolated-qr-table:isolated-device', JSON.stringify({
      at: Date.now() - 24 * 3600000, tableToken: 'different-table', sessionId: 'different-session', cart: menu.cart(),
      pendingSubmission: { idempotency_key: 'isolated-foreign-qr-key', session_id: 'different-session', items: [{ product_id: 31, quantity: 1 }] },
    }));
    menu.cart.set([]);menu.ngOnInit();
    expect(menu.cart()).toEqual([]);
    expect(menu.orderUncertain()).toBeFalse();
    expect(api.submitOrder).not.toHaveBeenCalled();
  });

  it('uses the real closed-table tenant for the read-only public menu entry', () => {
    api.getMenu = jasmine.createSpy().and.returnValue(throwError(() => ({ status: 403, error: { detail: { code: 'TABLE_CLOSED', tenant_id: 349, tenant_name: 'Isolated restaurant' } } })));
    (menu.loadMenu as jasmine.Spy).and.callThrough();
    menu.loadMenu();
    expect(menu.closedTenantId()).toBe(349);
    expect(menu.tableClosed()).toBeTrue();
    expect(menu.tableIsActive()).toBeFalse();
    expect(api.submitOrder).not.toHaveBeenCalled();
    api.getMenu.and.returnValue(throwError(() => ({ status: 403, error: { detail: { code: 'TABLE_CLOSED', tenant_id: 350 } } })));
    (menu as any).syncHttp();
    expect(menu.closedTenantId()).toBe(350);
  });

  it('does not invent a restaurant when a closed-table response has no tenant identity', () => {
    api.getMenu = jasmine.createSpy().and.returnValue(throwError(() => ({ status: 403, error: { detail: { code: 'TABLE_CLOSED' } } })));
    (menu.loadMenu as jasmine.Spy).and.callThrough();
    menu.loadMenu();
    expect(menu.closedTenantId()).toBeNull();
  });
});
