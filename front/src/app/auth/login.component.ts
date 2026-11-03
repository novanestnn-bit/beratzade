import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ApiService, type TenantSummary } from '../services/api.service';
import { ApiErrorMessageService } from '../services/api-error-message.service';
import { LanguagePickerComponent } from '../shared/language-picker.component';
import { LegalLinksComponent } from '../shared/legal-links.component';
import { isRestaurantAdmin, LoginPortal, restaurantHome } from './login-destination';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, TranslateModule, LanguagePickerComponent, LegalLinksComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-header-row">
            <div>
              <h1>{{ (portal === 'staff' ? 'LOGIN_PORTAL.STAFF' : portal === 'admin' ? 'LOGIN_PORTAL.ADMIN' : 'LOGIN_PORTAL.CHOOSE') | translate }}</h1>
              <p>{{ (portal === 'staff' ? 'LOGIN_PORTAL.STAFF_DESCRIPTION' : portal === 'admin' ? 'LOGIN_PORTAL.ADMIN_DESCRIPTION' : 'AUTH.SIGN_IN_ACCOUNT') | translate }}</p>
            </div>
            <app-language-picker></app-language-picker>
          </div>
        </div>

        @if (selectedTenant()) {
          <div class="tenant-context" data-testid="login-tenant-context">
            @if (selectedTenantLogoUrl()) {
              <img [src]="selectedTenantLogoUrl()!" [alt]="selectedTenant()!.name" class="tenant-context-logo" />
            }
            <div class="tenant-context-copy">
              <span>{{ 'AUTH.LOGGING_INTO' | translate }}</span>
              <strong>{{ selectedTenant()!.name }}</strong>
            </div>
            <a routerLink="/">{{ 'AUTH.CHANGE_RESTAURANT' | translate }}</a>
          </div>
        }

        @if (!portal) {
          <nav class="portal-options" [attr.aria-label]="'LOGIN_PORTAL.CHOOSE' | translate">
            <a routerLink="/staff/login" [queryParams]="forgotPasswordQueryParams" data-testid="login-portal-staff">
              <strong>{{ 'LOGIN_PORTAL.STAFF' | translate }}</strong>
              <span>{{ 'LOGIN_PORTAL.STAFF_DESCRIPTION' | translate }}</span>
            </a>
            <a routerLink="/admin/login" [queryParams]="forgotPasswordQueryParams" data-testid="login-portal-admin">
              <strong>{{ 'LOGIN_PORTAL.ADMIN' | translate }}</strong>
              <span>{{ 'LOGIN_PORTAL.ADMIN_DESCRIPTION' | translate }}</span>
            </a>
          </nav>
        } @else {
        <a class="portal-switch" routerLink="/login" [queryParams]="forgotPasswordQueryParams">{{ 'LOGIN_PORTAL.SWITCH' | translate }}</a>
        @if (showOtpStep()) {
          <p class="otp-prompt">{{ 'AUTH.OTP_ENTER_CODE' | translate }}</p>
          <p class="otp-recovery-hint">{{ 'AUTH.OTP_RECOVERY_HINT' | translate }}</p>
          <form (ngSubmit)="onSubmitOtp()">
            <div class="form-group">
              <label for="otp-code">{{ 'AUTH.OTP_CODE' | translate }}</label>
              <input 
                id="otp-code" 
                type="text" 
                inputmode="text" 
                maxlength="19"
                [(ngModel)]="otpCode" 
                name="otpCode"
                data-testid="login-otp-code"
                [placeholder]="'AUTH.OTP_CODE_PLACEHOLDER' | translate"
                autocomplete="one-time-code"
              >
            </div>
            @if (error()) {
              <div class="error-banner">{{ error() }}</div>
            }
            <button type="submit" class="btn-submit" [disabled]="!canSubmitOtp() || loading()">
              {{ loading() ? ('AUTH.VERIFYING' | translate) : ('AUTH.VERIFY_OTP' | translate) }}
            </button>
            <button type="button" class="btn-back" (click)="backToPassword()">{{ 'AUTH.BACK' | translate }}</button>
          </form>
        } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="email">{{ 'AUTH.EMAIL' | translate }}</label>
            <input 
              id="email" 
              type="email" 
              name="username"
              formControlName="username" 
              [placeholder]="translate.instant('AUTH.EMAIL_PLACEHOLDER')"
              autocomplete="email"
            >
            @if (form.get('username')?.touched && form.get('username')?.invalid) {
              <div class="field-error">{{ 'AUTH.INVALID_EMAIL' | translate }}</div>
            }
          </div>

          <div class="form-group">
            <label for="password">{{ 'AUTH.PASSWORD' | translate }}</label>
            <div class="input-with-toggle">
              <input 
                id="password" 
                [type]="showPassword() ? 'text' : 'password'" 
                name="password"
                formControlName="password"
                [placeholder]="translate.instant('AUTH.PASSWORD_PLACEHOLDER')"
                autocomplete="current-password"
              >
              <button type="button" class="pw-toggle" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? ('AUTH.HIDE_PASSWORD' | translate) : ('AUTH.SHOW_PASSWORD' | translate)" tabindex="-1">
                @if (showPassword()) {
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                } @else {
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            <div class="forgot-row">
              <a routerLink="/forgot-password" [queryParams]="forgotPasswordQueryParams">{{ 'AUTH.FORGOT_PASSWORD' | translate }}</a>
            </div>
          </div>

          @if (error()) {
            <div class="error-banner">{{ error() }}</div>
          }

          <button type="submit" class="btn-submit" [disabled]="loading()">
            {{ loading() ? ('AUTH.SIGNING_IN' | translate) : ('AUTH.SIGN_IN' | translate) }}
          </button>
        </form>
        }
        }

        @if (legalTermsUrl() || legalPrivacyUrl()) {
          <app-legal-links [termsUrl]="legalTermsUrl()" [privacyUrl]="legalPrivacyUrl()" />
        }
      </div>
    </div>
  `,
  styles: [`
    .portal-options { display: grid; gap: 1rem; margin-block: 1rem; }
    .portal-options a { display: grid; gap: .5rem; padding: 1.25rem; border: 2px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); background: var(--color-surface); text-decoration: none; }
    .portal-options a:hover, .portal-options a:focus-visible { border-color: var(--color-primary); outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .portal-options span { line-height: 1.5; font-size: .875rem; }
    .portal-switch { display: inline-block; margin-bottom: 1rem; color: var(--color-primary); }
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-5);
      background: var(--color-bg);
    }

    .auth-card {
      width: 100%;
      max-width: 400px;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      padding: var(--space-8);
    }

    .input-with-toggle {
      position: relative;
      display: flex;
    }
    .input-with-toggle input {
      flex: 1;
      padding-inline-end: 2.75rem;
    }
    .input-with-toggle .pw-toggle {
      position: absolute;
      inset-inline-end: var(--space-2);
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      padding: var(--space-1);
      cursor: pointer;
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .input-with-toggle .pw-toggle:hover {
      color: var(--color-text);
    }

    .auth-header {
      margin-bottom: var(--space-6);

      .auth-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-4);
      }

      h1 {
        font-size: 1.75rem;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: var(--space-2);
      }

      p {
        color: var(--color-text-muted);
        font-size: 0.9375rem;
      }
    }

    .tenant-context {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      margin-bottom: var(--space-5);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }

    .tenant-context-logo {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--radius-md);
      object-fit: contain;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      flex: 0 0 auto;
    }

    .tenant-context-copy {
      min-width: 0;
      flex: 1;
    }

    .tenant-context-copy span {
      display: block;
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      line-height: 1.2;
    }

    .tenant-context-copy strong {
      display: block;
      color: var(--color-text);
      font-size: 0.9375rem;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tenant-context a {
      color: var(--color-primary);
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
    }

    .tenant-context a:hover {
      text-decoration: underline;
    }

    .error-banner {
      background: rgba(220, 38, 38, 0.1);
      color: var(--color-error);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      margin-bottom: var(--space-4);
    }

    .btn-submit {
      width: 100%;
      padding: var(--space-4);
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--radius-md);
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease;

      &:hover:not(:disabled) {
        background: var(--color-primary-hover);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .otp-prompt {
      color: var(--color-text-muted);
      font-size: 0.9375rem;
      margin-bottom: var(--space-2);
    }
    .otp-recovery-hint {
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      margin-bottom: var(--space-4);
    }
    .btn-back {
      width: 100%;
      margin-top: var(--space-3);
      padding: var(--space-3);
      background: transparent;
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: 0.9375rem;
      cursor: pointer;
    }
    .btn-back:hover {
      background: var(--color-bg);
    }
    .forgot-row {
      margin-top: var(--space-2);
      text-align: end;
    }
    .forgot-row a {
      font-size: 0.875rem;
      color: var(--color-primary);
      text-decoration: none;
    }
    .forgot-row a:hover {
      text-decoration: underline;
    }

    .field-error {
      margin-top: var(--space-2);
      color: var(--color-error);
      font-size: 0.8125rem;
    }
  `]
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  translate = inject(TranslateService);
  private apiErr = inject(ApiErrorMessageService);
  readonly portal: LoginPortal | null = this.route.snapshot.data['loginPortal'] === 'staff' ? 'staff' : this.route.snapshot.data['loginPortal'] === 'admin' ? 'admin' : null;

  legalTermsUrl = signal<string | null>(null);
  legalPrivacyUrl = signal<string | null>(null);
  selectedTenant = signal<TenantSummary | null>(null);
  selectedTenantLogoUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getPublicLegalUrls().subscribe({
      next: (u) => {
        this.legalTermsUrl.set(u.terms_of_service_url ?? null);
        this.legalPrivacyUrl.set(u.privacy_policy_url ?? null);
      },
      error: () => {},
    });
    this.loadSelectedTenant();
  }

  error = signal<string>('');
  loading = signal(false);
  showOtpStep = signal(false);
  otpTempToken = signal<string | null>(null);
  otpCode = '';

  form = this.fb.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
  showPassword = signal(false);

  /** Preserve tenant picker query param on forgot-password link. */
  get forgotPasswordQueryParams(): Record<string, string> {
    const t = this.route.snapshot.queryParamMap.get('tenant');
    return t ? { tenant: t } : {};
  }

  private loadSelectedTenant(): void {
    const tenantParam = this.route.snapshot.queryParamMap.get('tenant');
    const tenantId = tenantParam != null ? Number.parseInt(tenantParam, 10) : NaN;
    if (!Number.isInteger(tenantId) || tenantId <= 0) return;

    this.api.getPublicTenant(tenantId).subscribe({
      next: (tenant) => {
        this.selectedTenant.set(tenant);
        this.selectedTenantLogoUrl.set(this.api.getTenantLogoUrl(tenant.logo_filename, tenant.id));
      },
      error: () => {
        this.selectedTenant.set(null);
        this.selectedTenantLogoUrl.set(null);
      },
    });
  }

  /** iOS Safari Keychain can fill inputs without updating the reactive form model. */
  private syncLoginFieldsFromDom(): void {
    const emailEl = document.getElementById('email') as HTMLInputElement | null;
    const passwordEl = document.getElementById('password') as HTMLInputElement | null;
    this.form.patchValue(
      {
        username: emailEl?.value ?? this.form.get('username')?.value ?? '',
        password: passwordEl?.value ?? this.form.get('password')?.value ?? '',
      },
      { emitEvent: false },
    );
  }

  onSubmit() {
    this.syncLoginFieldsFromDom();
    this.form.updateValueAndValidity({ emitEvent: false });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set('');
    this.loading.set(true);

    const username = this.form.get('username')?.value ?? '';
    const password = this.form.get('password')?.value ?? '';
    const tenantId = this.route.snapshot.queryParams['tenant'];
    const id = tenantId != null ? parseInt(tenantId, 10) : undefined;
    this.api.login(username, password, isNaN(id as number) ? undefined : id).subscribe({
      next: () => this.finishSignIn(),
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403 && err.error?.require_otp && err.error?.temp_token) {
          this.otpTempToken.set(err.error.temp_token);
          this.showOtpStep.set(true);
          this.error.set('');
        } else if (err.status === 429) {
          this.error.set(this.apiErr.fromHttpError(err, 'AUTH.LOGIN_RATE_LIMITED'));
        } else {
          this.error.set(this.apiErr.fromHttpError(err, 'AUTH.LOGIN_FAILED'));
        }
      },
    });
  }

  onSubmitOtp() {
    const token = this.otpTempToken();
    const code = (this.otpCode || '').trim();
    if (!token || !this.canSubmitOtp()) return;
    this.error.set('');
    this.loading.set(true);
    this.api.loginWithOtp(token, code).subscribe({
      next: () => this.finishSignIn(),
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.apiErr.fromHttpError(err, 'API_ERRORS.INVALID_OTP_CODE'));
      }
    });
  }

  private finishSignIn(): void {
    this.api.checkAuth().subscribe({
      next: user => {
        if (!user) { this.loading.set(false); this.error.set(this.translate.instant('AUTH.LOGIN_FAILED')); return; }
        if (this.portal === 'admin' && (!isRestaurantAdmin(user.role) || user.provider_id != null)) {
          this.api.logout().subscribe(() => {
            this.loading.set(false);
            this.form.controls.password.reset('');
            this.backToPassword();
            this.error.set(this.translate.instant('LOGIN_PORTAL.ADMIN_ONLY'));
          });
          return;
        }
        const destination = user.role === 'courier' ? '/courier'
          : user.provider_id != null ? '/provider'
          : user.role === 'platform_operator' ? '/platform'
          : restaurantHome(user.role, this.portal);
        const navigate = () => { this.loading.set(false); void this.router.navigate([destination]); };
        if (user.tenant_id != null) {
          this.api.getSaasSubscription().subscribe({
            next: sub => {
              if (sub.enabled && !sub.has_access) { this.loading.set(false); void this.router.navigate(['/paywall']); }
              else navigate();
            },
            error: navigate,
          });
        } else navigate();
      },
      error: () => { this.loading.set(false); this.error.set(this.translate.instant('AUTH.LOGIN_FAILED')); },
    });
  }

  /** Accept 6-digit TOTP or an 8-char recovery code (with optional dashes). */
  canSubmitOtp(): boolean {
    const raw = (this.otpCode || '').trim();
    if (/^\d{6}$/.test(raw)) return true;
    const norm = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return norm.length === 8;
  }

  backToPassword() {
    this.showOtpStep.set(false);
    this.otpTempToken.set(null);
    this.otpCode = '';
    this.error.set('');
  }
}
