import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { ApiService, StaffPosMenuProduct, Table } from '../services/api.service';
import { StaffPosComponent } from './staff-pos.component';

describe('POS order confirmation and selected table', () => {
  const product = { id: 31, source: 'product', name: 'Isolated dish', price_cents: 2500, available: true } as StaffPosMenuProduct;
  const tableA = { id: 11, name: 'Isolated A', is_active: true } as Table;
  const tableB = { id: 12, name: 'Isolated B', is_active: true } as Table;
  let fixtures: ComponentFixture<StaffPosComponent>[];
  let api: any;
  function create(): StaffPosComponent {
    const fixture = TestBed.createComponent(StaffPosComponent);
    fixtures.push(fixture);
    return fixture.componentInstance;
  }
  beforeEach(() => {
    localStorage.clear();
    fixtures = [];
    api = {
      getCurrentUser: () => ({ id: 77, tenant_id: 88, role: 'owner' }),
      getTables: jasmine.createSpy().and.returnValue(of([])),
      getOrders: jasmine.createSpy().and.returnValue(of([])),
      getStaffPosMenu: jasmine.createSpy().and.returnValue(of({ currency: 'TRY', category_tree: [], categories: [] })),
      getStaffMenuToken: jasmine.createSpy().and.callFake((id: number) => of({ token: 'isolated-access', table_token: 'isolated-table-' + id })),
      getCurrentOrder: jasmine.createSpy().and.returnValue(of({ order: null })),
      activateTable: jasmine.createSpy().and.returnValue(of({})),
      submitOrder: jasmine.createSpy().and.returnValue(throwError(() => ({ status: 0 }))),
      createStaffSale: jasmine.createSpy().and.returnValue(throwError(() => ({ status: 0 }))),
    };
    TestBed.configureTestingModule({ imports: [StaffPosComponent, TranslateModule.forRoot()], providers: [{ provide: ApiService, useValue: api }] });
    TestBed.overrideComponent(StaffPosComponent, { set: { template: '' } });
  });
  afterEach(() => {
    fixtures.forEach(fixture => { if (!fixture.componentRef.hostView.destroyed) fixture.destroy(); });
    localStorage.clear();
  });

  it('keeps an uncertain batch immutable and retries its original key after reload without persisting staff access', () => {
    const pos = create();
    pos.setMode('table');
    pos.openTable(tableA);
    pos.addProduct(product);
    pos.submitOrder();
    const first = api.submitOrder.calls.mostRecent().args[1];
    expect(pos.orderUncertain()).toBeTrue();
    pos.changeQuantity(product, 1);
    pos.removeLine(product);
    pos.addProduct(product);
    pos.setMode('takeaway');
    pos.changeTable();
    expect(pos.cart()[0].quantity).toBe(1);
    expect(pos.mode()).toBe('table');
    expect(pos.selectedTable()?.id).toBe(tableA.id);
    const saved = JSON.parse(localStorage.getItem('pos-draft:v1:88:77')!);
    expect(saved.pendingSubmission.body.staff_access).toBeUndefined();
    fixtures[0].destroy();
    const restored = create();
    expect(restored.orderUncertain()).toBeTrue();
    api.submitOrder.and.returnValue(of({ order_id: 501 }));
    restored.submitOrder();
    const retry = api.submitOrder.calls.mostRecent().args[1];
    expect(retry.idempotency_key).toBe(first.idempotency_key);
    expect(retry.items).toEqual(first.items);
    expect(restored.orderUncertain()).toBeFalse();
    expect(restored.cart()).toEqual([]);
    expect(api.activateTable).not.toHaveBeenCalled();
  });

  it('retains uncertainty after a later rejected retry instead of allowing a replacement order', () => {
    const pos = create();
    pos.setMode('table');pos.openTable(tableA);pos.addProduct(product);pos.submitOrder();
    api.submitOrder.and.returnValue(throwError(() => ({ status: 403, error: { detail: 'Table closed' } })));
    pos.submitOrder();
    expect(pos.orderUncertain()).toBeTrue();
    pos.setMode('quick_sale');
    expect(pos.mode()).toBe('table');
  });

  it('does not send a new batch if its recovery snapshot cannot be stored', () => {
    const pos = create();pos.setMode('table');pos.openTable(tableA);pos.addProduct(product);
    spyOn(Storage.prototype, 'setItem').and.throwError('storage unavailable');
    pos.submitOrder();
    expect(api.submitOrder).not.toHaveBeenCalled();
    expect(pos.submitting()).toBeFalse();
    expect(pos.cart().length).toBe(1);
  });

  it('blocks a replacement counter sale until its restored unpaid order is reconciled', () => {
    localStorage.setItem('pos-draft:v1:88:77', JSON.stringify({ at: Date.now(), mode: 'quick_sale', cart: [], paymentOrderId: 501 }));
    const pos = create();
    expect(pos.counterSaleAwaitingPayment()).toBeTrue();
    pos.addProduct(product);pos.setMode('table');
    expect(pos.cart()).toEqual([]);
    expect(pos.mode()).toBe('quick_sale');
    expect(api.createStaffSale).not.toHaveBeenCalled();
  });

  it('restores a lost counter-sale response using the same sale body and key', () => {
    const pos = create();pos.addProduct(product);pos.submitOrder();
    expect(pos.orderUncertain()).toBeTrue();
    const first = api.createStaffSale.calls.mostRecent().args[0];
    fixtures[0].destroy();
    const restored = create();
    api.createStaffSale.and.returnValue(of({ id: 601, total_cents: 2500 }));
    restored.submitOrder();
    expect(api.createStaffSale.calls.mostRecent().args[0]).toEqual(first);
    expect(restored.orderUncertain()).toBeFalse();
    expect(restored.payableOrder()?.id).toBe(601);
    expect(restored.counterSaleAwaitingPayment()).toBeTrue();
    expect(restored.cart()).toEqual([]);
  });

  it('retains an expired uncertain batch and its original idempotency key', () => {
    const pos = create();pos.setMode('table');pos.openTable(tableA);pos.addProduct(product);pos.submitOrder();
    const first = api.submitOrder.calls.mostRecent().args[1];
    fixtures[0].destroy();
    const key = 'pos-draft:v1:88:77';
    const draft = JSON.parse(localStorage.getItem(key)!);
    draft.at = Date.now() - 24 * 3600000;
    localStorage.setItem(key, JSON.stringify(draft));
    const restored = create();
    expect(restored.orderUncertain()).toBeTrue();
    restored.submitOrder();
    const retry = api.submitOrder.calls.mostRecent().args[1];
    expect(retry.idempotency_key).toBe(first.idempotency_key);
    expect(retry.items).toEqual(first.items);
  });

  it('retains an expired in-flight payment as uncertain even before its response was lost', () => {
    localStorage.setItem('pos-draft:v1:88:77', JSON.stringify({
      at: Date.now() - 24 * 3600000, tenantId: 88, userId: 77, mode: 'table', tableId: 11, cart: [],
      paymentOrderId: 501, paymentKey: 'isolated-payment-key', paymentFingerprint: '501:2500:cash',
      paymentMethod: 'cash', paymentAmount: '25.00', paymentUncertain: false,
    }));
    const pos = create();
    expect(pos.paymentUncertain()).toBeTrue();
    expect((pos as any).paymentKey).toBe('isolated-payment-key');
    expect(pos.paymentAmountCents()).toBe(2500);
    pos.setMode('takeaway');
    expect(pos.mode()).toBe('table');
  });

  it('expires ordinary drafts and rejects an expired pending batch from a different restaurant', () => {
    const key = 'pos-draft:v1:88:77';
    localStorage.setItem(key, JSON.stringify({ at: Date.now() - 24 * 3600000, mode: 'takeaway', cart: [{ product, quantity: 1 }] }));
    expect(create().cart()).toEqual([]);
    localStorage.setItem(key, JSON.stringify({
      at: Date.now() - 24 * 3600000, tenantId: 999, userId: 77, mode: 'takeaway', cart: [{ product, quantity: 1 }],
      pendingSubmission: { mode: 'takeaway', tableId: null, body: { sale_type: 'takeaway', idempotency_key: 'isolated-other-tenant-key', items: [{ product_id: 31, quantity: 1 }] } },
    }));
    const restored = create();
    expect(restored.orderUncertain()).toBeFalse();
    expect(restored.cart()).toEqual([]);
  });

  it('does not revive an expired pending order for a different table', () => {
    localStorage.setItem('pos-draft:v1:88:77', JSON.stringify({
      at: Date.now() - 24 * 3600000, tenantId: 88, userId: 77, mode: 'table', tableId: 11, cart: [{ product, quantity: 1 }],
      pendingSubmission: { mode: 'table', tableId: 12, body: { idempotency_key: 'isolated-other-table-key', items: [{ product_id: 31, quantity: 1 }] } },
    }));
    const restored = create();
    expect(restored.orderUncertain()).toBeFalse();
    expect(restored.cart()).toEqual([]);
  });

  it('ignores late table and bill responses belonging to a previous selection', () => {
    const pos = create();pos.setMode('table');
    const aMenu = new Subject<any>(), bMenu = new Subject<any>(), aBill = new Subject<any[]>(), bBill = new Subject<any[]>();
    api.getCurrentOrder.and.callFake((token: string) => token.endsWith('11') ? aMenu : bMenu);
    api.getOrders.and.returnValues(aBill, bBill);
    const a = { id: 501, table_id: 11, table_name: 'A', total_cents: 2500, amount_remaining_cents: 2500, items: [], payments: [] };
    const b = { id: 502, table_id: 12, table_name: 'B', total_cents: 5000, amount_remaining_cents: 5000, items: [], payments: [] };
    pos.openTable(tableA);aMenu.next({ order: a });
    pos.changeTable();pos.openTable(tableB);bMenu.next({ order: b });bBill.next([a, b]);
    expect(pos.payableOrder()?.id).toBe(502);
    aBill.next([a]);aMenu.next({ order: a });
    expect(pos.selectedTable()?.id).toBe(12);
    expect(pos.currentOrder()?.id).toBe(502);
    expect(pos.payableOrder()?.id).toBe(502);
  });
});
