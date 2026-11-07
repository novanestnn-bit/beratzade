import { Component, DestroyRef, OnDestroy, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService, CashRegisterSession } from '../services/api.service';
import { LanguageService } from '../services/language.service';
import { PermissionService } from '../services/permission.service';

interface PendingRegisterAction { kind: 'open' | 'close'; sessionId: number | null; }

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  template: `
    @if (allowed) {
      <section class="register" data-testid="cash-register" [attr.aria-label]="'CASH_REGISTER.TITLE' | translate">
        <div class="register-summary">
          <div class="register-title">
            <span class="register-icon" aria-hidden="true">▤</span>
            <div><h2>{{ 'CASH_REGISTER.TITLE' | translate }}</h2>
              <span class="state" [class.state-open]="session()" data-testid="cash-register-status"
                [attr.data-state]="loading() || unavailable() || !!uncertain() ? 'unknown' : session() ? 'open' : 'closed'">
                {{ (loading() ? 'CASH_REGISTER.LOADING' : unavailable() || uncertain() ? 'CASH_REGISTER.CHECK_REQUIRED' : session() ? 'CASH_REGISTER.OPEN' : 'CASH_REGISTER.CLOSED') | translate }}
              </span>
            </div>
          </div>
          @if (session(); as register) {
            <div class="register-balance"><span>{{ 'CASH_REGISTER.EXPECTED' | translate }}</span><strong>{{ money(register.expected_cash_cents) }}</strong></div>
          }
          <div class="register-actions">
            <button type="button" class="register-button secondary" data-testid="cash-register-refresh" (click)="reload()" [disabled]="loading() || busy()">{{ 'CASH_REGISTER.REFRESH' | translate }}</button>
            <button type="button" class="register-button" data-testid="cash-register-toggle" (click)="toggle()" [disabled]="loading() || busy() || unavailable() || !!uncertain()">
              {{ (expanded() ? 'COMMON.CANCEL' : session() ? 'CASH_REGISTER.CLOSE_ACTION' : 'CASH_REGISTER.OPEN_ACTION') | translate }}
            </button>
          </div>
        </div>
        @if (unavailable()) { <p class="register-message warning" role="status">{{ 'CASH_REGISTER.UNAVAILABLE' | translate }}</p> }
        @if (uncertain()) { <p class="register-message warning" role="alert" data-testid="cash-register-uncertain">{{ 'CASH_REGISTER.UNCERTAIN' | translate }}</p> }
        @if (error()) { <p class="register-message warning" role="alert">{{ error() | translate }}</p> }
        @if (lastClosed(); as register) {
          <p class="register-message" role="status">{{ 'CASH_REGISTER.CLOSED_SUMMARY' | translate }} <strong>{{ money(register.counted_cash_cents ?? 0) }}</strong> · {{ 'CASH_REGISTER.VARIANCE' | translate }} <strong>{{ money(register.variance_cents ?? 0) }}</strong></p>
        }
        @if (expanded()) {
          <form class="register-form" (ngSubmit)="submit()">
            <div class="register-form-intro"><strong>{{ (session() ? 'CASH_REGISTER.CLOSE_ACTION' : 'CASH_REGISTER.OPEN_ACTION') | translate }}</strong><p>{{ (session() ? 'CASH_REGISTER.CLOSE_HELP' : 'CASH_REGISTER.OPEN_HELP') | translate }}</p></div>
            <label><span>{{ (session() ? 'CASH_REGISTER.COUNTED_AMOUNT' : 'CASH_REGISTER.OPENING_AMOUNT') | translate }} ({{ currency() }})</span>
              <input type="text" inputmode="decimal" autocomplete="off" name="registerAmount" data-testid="cash-register-amount" [(ngModel)]="amount" [disabled]="busy() || !!uncertain()" required maxlength="14" />
            </label>
            <label><span>{{ 'CASH_REGISTER.NOTE' | translate }}</span><input type="text" name="registerNote" [(ngModel)]="note" [disabled]="busy() || !!uncertain()" maxlength="500" /></label>
            @if (session() && amountCents() !== null) {
              <p class="register-preview">{{ 'CASH_REGISTER.VARIANCE' | translate }}: <strong>{{ money(amountCents()! - session()!.expected_cash_cents) }}</strong></p>
            }
            <button type="submit" class="register-button" data-testid="cash-register-submit" [disabled]="busy() || refreshing() || !!uncertain() || unavailable() || amountCents() === null">{{ (busy() ? 'CASH_REGISTER.SAVING' : session() ? 'CASH_REGISTER.CONFIRM_CLOSE' : 'CASH_REGISTER.CONFIRM_OPEN') | translate }}</button>
          </form>
        }
      </section>
    }
  `,
  styles: [`
    .register { margin:1rem 0; border:1px solid var(--color-border); border-radius:var(--radius-lg); background:var(--color-surface); color:var(--color-text); overflow:hidden; }
    .register-summary { display:flex; align-items:center; gap:1.25rem; padding:1rem 1.25rem; flex-wrap:wrap; }
    .register-title { display:flex; align-items:center; gap:.75rem; margin-right:auto; }
    .register-icon { display:grid; place-items:center; width:42px; height:42px; border-radius:.6rem; background:var(--color-bg); font-size:1.6rem; }
    h2 { margin:0 0 .2rem; font-size:.95rem; } .state { font-size:.78rem; color:var(--color-text-muted); } .state-open { color:#166534; }
    .register-balance { display:grid; gap:.25rem; } .register-balance span { font-size:.72rem; color:var(--color-text-muted); } .register-balance strong { font-size:1.1rem; font-variant-numeric:tabular-nums; }
    .register-actions { display:flex; gap:.5rem; flex-wrap:wrap; } .register-button { min-height:42px; padding:.65rem 1rem; border:1px solid var(--color-primary); border-radius:.5rem; background:var(--color-primary); color:var(--color-on-primary,#fff); font:inherit; font-size:.8rem; font-weight:600; line-height:1.4; cursor:pointer; }
    .register-button.secondary { color:var(--color-text); border-color:var(--color-border); background:var(--color-surface); } button:disabled { opacity:.5; cursor:not-allowed; } button:focus-visible,input:focus-visible { outline:3px solid var(--color-primary); outline-offset:3px; }
    .register-message { margin:0; padding:.9rem 1.25rem; border-top:1px solid var(--color-border); font-size:.82rem; line-height:1.6; } .warning { background:#fff8e7; color:#71420b; }
    .register-form { display:grid; grid-template-columns:1fr 1fr; gap:1rem; padding:1.25rem; border-top:1px solid var(--color-border); background:var(--color-bg); }
    .register-form-intro { grid-column:1/-1; } .register-form-intro p { margin:.4rem 0 0; color:var(--color-text-muted); font-size:.8rem; line-height:1.6; }
    label { display:grid; gap:.5rem; min-width:0; font-size:.8rem; } input { box-sizing:border-box; width:100%; min-height:44px; padding:.7rem; border:1px solid var(--color-border); border-radius:.5rem; background:var(--color-surface); color:var(--color-text); font:inherit; }
    .register-preview { align-self:center; margin:0; font-size:.85rem; } .register-form>.register-button { justify-self:end; min-width:150px; }
    @media(max-width:600px) { .register-summary { padding:1rem; gap:1rem; } .register-actions { width:100%; } .register-actions button { flex:1; } .register-form { padding:1rem; grid-template-columns:minmax(0,1fr); } .register-form>.register-button { width:100%; } }
  `],
})
export class CashRegisterComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly permissions = inject(PermissionService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly currency = input('TRY');
  readonly allowed = this.permissions.hasAllPermissions(this.api.getCurrentUser(), 'order:read', 'order:update_status');
  readonly session = signal<CashRegisterSession | null>(null);
  readonly lastClosed = signal<CashRegisterSession | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly unavailable = signal(false);
  readonly expanded = signal(false);
  readonly error = signal('');
  readonly uncertain = signal<PendingRegisterAction | null>(null);
  amount = '';
  note = '';
  readonly refreshing = signal(false);
  private readonly storageKey = `pos:cash-register-pending:${this.api.getCurrentUser()?.tenant_id}:${this.api.getCurrentUser()?.id}`;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor() {
    try {
      const pending = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (pending && ['open', 'close'].includes(pending.kind)) this.uncertain.set(pending);
    } catch { /* A broken cache must not trigger a financial operation. */ }
    this.reload();
    this.timer = setInterval(() => { if (document.visibilityState === 'visible') this.reload(); }, 10000);
  }

  money(cents: number): string {
    return new Intl.NumberFormat(this.language.getLocale(), { style:'currency', currency:this.currency() }).format(cents / 100);
  }

  amountCents(): number | null {
    const normalized = this.amount.trim().replace(',', '.');
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) return null;
    const cents = Math.round(Number(normalized) * 100);
    return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
  }

  toggle(): void {
    if (this.refreshing() || this.busy() || this.uncertain() || this.unavailable() || this.loading()) return;
    this.expanded.update(value => !value);
    this.amount = '';
    this.note = '';
    this.error.set('');
    this.lastClosed.set(null);
  }

  reload(): void {
    if (!this.allowed || this.refreshing() || this.busy()) return;
    this.refreshing.set(true);
    if (!this.session()) this.loading.set(true);
    this.api.getCurrentCashRegister().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: current => {
        this.refreshing.set(false); this.loading.set(false); this.unavailable.set(false);
        const previousId = this.session()?.id;
        this.session.set(current);
        const pending = this.uncertain();
        if (pending && (pending.kind === 'open' ? !!current : !current || current.id !== pending.sessionId)) this.clearPending();
        if (previousId !== current?.id && !this.uncertain()) { this.expanded.set(false); this.amount = ''; this.note = ''; }
      },
      error: () => { this.refreshing.set(false); this.loading.set(false); this.unavailable.set(true); },
    });
  }

  submit(): void {
    const cents = this.amountCents();
    if (!this.allowed || this.refreshing() || cents === null || this.busy() || this.uncertain() || this.unavailable() || this.loading()) return;
    const pending: PendingRegisterAction = { kind:this.session() ? 'close' : 'open', sessionId:this.session()?.id ?? null };
    try { localStorage.setItem(this.storageKey, JSON.stringify(pending)); }
    catch { this.error.set('CASH_REGISTER.STORAGE_ERROR'); return; }
    this.busy.set(true); this.error.set('');
    const request = pending.kind === 'open'
      ? this.api.openCashRegister({ opening_cash_cents:cents, note:this.note.trim() || null })
      : this.api.closeCashRegister({ counted_cash_cents:cents, note:this.note.trim() || null });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.clearPending(); this.busy.set(false); this.expanded.set(false); this.amount = ''; this.note = '';
        if (result.status === 'closed') { this.lastClosed.set(result); this.session.set(null); }
        else this.session.set(result);
      },
      error: failure => {
        this.busy.set(false);
        if (failure.status === 0 || failure.status >= 500) this.uncertain.set(pending);
        else { this.clearPending(); this.error.set('CASH_REGISTER.SAVE_FAILED'); }
        this.reload();
      },
    });
  }

  private clearPending(): void {
    this.uncertain.set(null);
    try { localStorage.removeItem(this.storageKey); } catch { /* Server state is already confirmed. */ }
  }

  ngOnDestroy(): void { clearInterval(this.timer); }
}
