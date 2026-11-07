import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ApiService } from '../services/api.service';
import { StaffPosComponent } from './staff-pos.component';

describe('POS uncertain payment recovery', () => {
  let api: any;
  let fixtures: ComponentFixture<StaffPosComponent>[];
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
      getTables: () => of([]), getOrders: () => of([]),
      getStaffPosMenu: () => of({ currency: 'TRY', category_tree: [], categories: [] }),
      recordOrderPayment: jasmine.createSpy(),
    };
    TestBed.configureTestingModule({ imports: [StaffPosComponent, TranslateModule.forRoot()], providers: [{ provide: ApiService, useValue: api }] });
    TestBed.overrideComponent(StaffPosComponent, { set: { template: '' } });
  });
  afterEach(() => {
    fixtures.forEach(fixture => { if (!fixture.componentRef.hostView.destroyed) fixture.destroy(); });
    localStorage.clear();
  });
  function preparePayment(pos: StaffPosComponent): void {
    pos.payableOrder.set({ id: 501, tableId: null, tableName: 'Isolated counter', amountDue: 2500, amountPaid: 0, amountRemaining: 2500, items: [], payments: [] });
    pos.setPaymentAmount('25.00');
  }

  it('keeps a first timeout payment immutable and recoverable after reload', () => {
    const pos = create();preparePayment(pos);
    api.recordOrderPayment.and.returnValue(throwError(() => ({ status: 408 })));
    pos.collectPayment();
    const first = api.recordOrderPayment.calls.mostRecent().args[1];
    expect(pos.paymentUncertain()).toBeTrue();
    pos.setPaymentAmount('10.00');pos.setPaymentMethod('terminal');pos.setMode('table');
    expect(pos.paymentAmountCents()).toBe(2500);
    expect(pos.paymentMethod).toBe('cash');expect(pos.mode()).toBe('quick_sale');
    const draft = JSON.parse(localStorage.getItem('pos-draft:v1:88:77')!);
    expect(draft.paymentKey).toBe(first.idempotency_key);
    expect(draft.paymentFingerprint).toBe('501:2500:cash');
    expect(draft.paymentUncertain).toBeTrue();
    fixtures[0].destroy();
    const restored = create();
    expect(restored.paymentUncertain()).toBeTrue();
    expect((restored as any).paymentKey).toBe(first.idempotency_key);
    expect(restored.paymentAmountCents()).toBe(2500);
  });

  it('keeps an unknown first result locked through rejected retries until payment success', () => {
    const pos = create();preparePayment(pos);
    api.recordOrderPayment.and.returnValue(throwError(() => ({ status: 0 })));
    pos.collectPayment();
    const first = api.recordOrderPayment.calls.mostRecent().args[1];
    for (const status of [401, 403, 408, 409, 429]) {
      api.recordOrderPayment.and.returnValue(throwError(() => ({ status })));
      pos.collectPayment();
      expect(pos.paymentUncertain()).withContext(`retry status ${status}`).toBeTrue();
      expect(api.recordOrderPayment.calls.mostRecent().args).toEqual([501, first]);
      pos.setPaymentAmount('10.00');pos.setPaymentMethod('terminal');
      expect(pos.paymentAmountCents()).toBe(2500);expect(pos.paymentMethod).toBe('cash');
    }
    api.recordOrderPayment.and.returnValue(of({ status: 'paid', amount_due_cents: 2500, amount_paid_cents: 2500, amount_remaining_cents: 0, payments: [] }));
    pos.collectPayment();
    expect(api.recordOrderPayment.calls.mostRecent().args).toEqual([501, first]);
    expect(pos.paymentUncertain()).toBeFalse();
    expect((pos as any).paymentKey).toBe('');
    pos.setMode('table');expect(pos.mode()).toBe('table');
  });
});
