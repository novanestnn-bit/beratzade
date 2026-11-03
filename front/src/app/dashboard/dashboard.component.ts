import { Component, inject, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../shared/sidebar.component';
import { TranslateModule } from '@ngx-translate/core';
import { PermissionService } from '../services/permission.service';
import {
  ApiService,
  TenantUiModuleKey,
  WorkSession,
  workSessionOpenExceedsContract,
} from '../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SidebarComponent, RouterLink, TranslateModule],
  template: `
    <app-sidebar>
        <div class="page-header">
          <h1>{{ 'DASHBOARD.TITLE' | translate }}</h1>
        </div>

        <div class="welcome-section">
          <h2>{{ 'DASHBOARD.WELCOME_BACK' | translate }}</h2>
          <p class="welcome-text">{{ 'DASHBOARD.WELCOME_TEXT' | translate }}</p>
        </div>

        <div class="quick-actions">
          @if (canUseStaffPos()) {
          <a routerLink="/staff/pos" class="action-card" data-testid="dashboard-main-sales">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
              </svg>
            </div>
            <span class="action-label">{{ 'STAFF_POS.NAV_LABEL' | translate }}</span>
          </a>
          }
          @if (canViewMyShift()) {
            <a routerLink="/my-shift" class="action-card" data-testid="dashboard-my-shift">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <span class="action-label">{{ 'DASHBOARD.MY_SHIFT_TITLE' | translate }}</span>
              @if (shiftStatusLoading()) {
                <span class="action-desc">{{ 'DASHBOARD.MY_SHIFT_LOADING' | translate }}</span>
              } @else if (shiftOpen(); as sh) {
                <span class="action-desc action-desc-shift-on">{{ 'DASHBOARD.MY_SHIFT_DESC_ON' | translate }}</span>
                @if (shiftExceedsContract()) {
                  <span class="action-desc action-desc-shift-overtime" data-testid="dashboard-my-shift-overtime">{{
                    'DASHBOARD.MY_SHIFT_OVERTIME' | translate
                  }}</span>
                }
              } @else {
                <span class="action-desc">{{ 'DASHBOARD.MY_SHIFT_DESC_OFF' | translate }}</span>
              }
            </a>
          }
          @if (canViewOrders()) {
          <a routerLink="/staff/orders" class="action-card">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
            </div>
            <span class="action-label">{{ 'DASHBOARD.ORDERS_TITLE' | translate }}</span>
            <span class="action-desc">{{ 'DASHBOARD.ORDERS_DESC' | translate }}</span>
          </a>
          }
          @if (canViewReservations() && moduleEnabled('reservations')) {
          <a routerLink="/reservations" class="action-card">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <span class="action-label">{{ 'DASHBOARD.RESERVATIONS_TITLE' | translate }}</span>
            <span class="action-desc">{{ 'DASHBOARD.RESERVATIONS_DESC' | translate }}</span>
          </a>
          }
          @if (canViewTables() && moduleEnabled('tables')) {
          <a routerLink="/tables" class="action-card">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <span class="action-label">{{ 'DASHBOARD.TABLES_TITLE' | translate }}</span>
            <span class="action-desc">{{ 'DASHBOARD.TABLES_DESC' | translate }}</span>
          </a>
          }
          @if (canViewOrders() && moduleEnabled('kitchen_bar')) {
          <a routerLink="/kitchen" class="action-card">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M6 8h.01M10 8h.01M14 8h.01M6 12h12M6 16h8"/>
              </svg>
            </div>
            <span class="action-label">{{ 'DASHBOARD.KITCHEN_TITLE' | translate }}</span>
            <span class="action-desc">{{ 'DASHBOARD.KITCHEN_DESC' | translate }}</span>
          </a>
          <a routerLink="/bar" class="action-card">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/>
                <path d="M9 14h6M9 18h6"/>
              </svg>
            </div>
            <span class="action-label">{{ 'DASHBOARD.BEVERAGES_TITLE' | translate }}</span>
            <span class="action-desc">{{ 'DASHBOARD.BEVERAGES_DESC' | translate }}</span>
          </a>
          }
          @if (canShowAdminSections()) {
          <a routerLink="/products" class="action-card">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              </svg>
            </div>
            <span class="action-label">{{ 'DASHBOARD.PRODUCTS_TITLE' | translate }}</span>
            <span class="action-desc">{{ 'DASHBOARD.PRODUCTS_DESC' | translate }}</span>
          </a>
          }
          @if (canViewCustomers()) {
          <a routerLink="/customers" class="action-card">
            <div class="action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <span class="action-label">{{ 'DASHBOARD.CUSTOMERS_TITLE' | translate }}</span>
            <span class="action-desc">{{ 'DASHBOARD.CUSTOMERS_DESC' | translate }}</span>
          </a>
          }
          @if (canShowAdminSections()) {
            @if (moduleEnabled('working_plan')) {
            <a routerLink="/working-plan" class="action-card">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <span class="action-label">{{ 'DASHBOARD.WORKING_PLAN_TITLE' | translate }}</span>
              <span class="action-desc">{{ 'DASHBOARD.WORKING_PLAN_DESC' | translate }}</span>
            </a>
            }
            @if (moduleEnabled('inventory')) {
            <a routerLink="/inventory" class="action-card">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                </svg>
              </div>
              <span class="action-label">{{ 'DASHBOARD.INVENTORY_TITLE' | translate }}</span>
              <span class="action-desc">{{ 'DASHBOARD.INVENTORY_DESC' | translate }}</span>
            </a>
            }
            <a routerLink="/reports" class="action-card">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <span class="action-label">{{ 'DASHBOARD.REPORTS_TITLE' | translate }}</span>
              <span class="action-desc">{{ 'DASHBOARD.REPORTS_DESC' | translate }}</span>
            </a>
            @if (moduleEnabled('users')) {
            <a routerLink="/users" class="action-card">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <span class="action-label">{{ 'DASHBOARD.USERS_TITLE' | translate }}</span>
              <span class="action-desc">{{ 'DASHBOARD.USERS_DESC' | translate }}</span>
            </a>
            }
            <a routerLink="/settings" class="action-card">
              <div class="action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
              </div>
              <span class="action-label">{{ 'DASHBOARD.SETTINGS_TITLE' | translate }}</span>
              <span class="action-desc">{{ 'DASHBOARD.SETTINGS_DESC' | translate }}</span>
            </a>
          }
        </div>

    </app-sidebar>
  `,
  styles: [`
    .page-header {
      margin-bottom: var(--space-6);

      h1 {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--color-text);
      }
    }

    .welcome-section {
      margin-bottom: var(--space-6);

      h2 {
        font-size: 1.75rem;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: var(--space-2);
      }

      .welcome-user {
        color: var(--color-text-muted);
        margin-bottom: var(--space-1);

        strong {
          color: var(--color-text);
        }
      }

      .welcome-text {
        color: var(--color-text-muted);
      }
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); /* Increased from 200px */
      gap: var(--space-4);
    }

    .action-card {
      display: flex;
      flex-direction: column;
      padding: var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      text-decoration: none;
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
      }
    }

    .action-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary-light);
      border-radius: var(--radius-md);
      color: var(--color-primary);
      margin-bottom: var(--space-4);
    }

    .action-label {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: var(--space-1);
    }

    .action-desc {
      font-size: 0.875rem;
      color: var(--color-text-muted);
    }

    .action-desc-shift-on {
      color: var(--color-success, #15803d);
      font-weight: 500;
    }

    .action-desc-shift-overtime {
      display: block;
      margin-top: var(--space-1);
      color: var(--color-warning-strong, #b45309);
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .quick-actions {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private permissions = inject(PermissionService);
  private api = inject(ApiService);

  user = signal(this.api.getCurrentUser());
  canShowAdminSections = computed(() => this.permissions.isAdmin(this.user()));
  canUseStaffPos = computed(() => this.permissions.hasAllPermissions(this.user(), 'product:read', 'order:update_status'));
  canViewOrders = computed(() => this.permissions.hasPermission(this.user(), 'order:read'));
  canViewCustomers = computed(() => this.permissions.isAdmin(this.user()) && this.permissions.canAccessRoute(this.user(), '/customers'));
  canViewMyShift = computed(() => this.permissions.canAccessRoute(this.user(), '/my-shift'));
  canViewReservations = computed(() => this.permissions.hasPermission(this.user(), 'reservation:read'));
  canViewTables = computed(() => this.permissions.canAccessRoute(this.user(), '/tables'));

  /** Open work session when clocked in; null when not; only loaded when `canViewMyShift`. */
  shiftOpen = signal<WorkSession | null>(null);
  shiftStatusLoading = signal(false);
  private shiftUiTick = signal(0);
  private shiftTicker: ReturnType<typeof setInterval> | null = null;

  shiftExceedsContract = computed(() => {
    this.shiftUiTick();
    return workSessionOpenExceedsContract(this.shiftOpen());
  });

  ngOnInit() {
    this.api.ensureTenantUiModulesLoaded().subscribe();
    const u = this.api.getCurrentUser();
    this.user.set(u);
    if (this.permissions.canAccessRoute(u, '/my-shift')) {
      this.shiftStatusLoading.set(true);
      this.api.getMyOpenWorkSession().subscribe({
        next: (s) => {
          this.shiftOpen.set(s);
          this.shiftStatusLoading.set(false);
          if (this.shiftTicker != null) {
            clearInterval(this.shiftTicker);
            this.shiftTicker = null;
          }
          if (s) {
            this.shiftTicker = setInterval(() => this.shiftUiTick.update((x) => x + 1), 60_000);
          }
        },
        error: () => {
          this.shiftOpen.set(null);
          this.shiftStatusLoading.set(false);
          if (this.shiftTicker != null) {
            clearInterval(this.shiftTicker);
            this.shiftTicker = null;
          }
        },
      });
    }
  }

  ngOnDestroy(): void {
    if (this.shiftTicker != null) {
      clearInterval(this.shiftTicker);
      this.shiftTicker = null;
    }
  }

  moduleEnabled(key: TenantUiModuleKey): boolean {
    return this.api.isUiModuleEnabled(key);
  }

}
