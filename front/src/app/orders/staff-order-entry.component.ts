import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService, CurrentTableOrder, CurrentTableOrderItem, Floor, MenuResponse, Product, Table } from '../services/api.service';

interface StaffOrderLine {
  product: Product;
  quantity: number;
  notes: string;
}

@Component({
  selector: 'app-staff-order-entry',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="staff-order-shell">
      <header class="staff-order-topbar">
        <div class="staff-order-brand">
          <strong>Beratzade</strong>
          <span>Personel sipariş ekranı</span>
        </div>
        <div class="staff-order-account">
          <span>{{ staffDisplayName() }}</span>
          @if (isManagementUser()) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="returnToManagement()" data-testid="staff-order-return-management">Yönetim paneline dön</button>
          }
          <button type="button" class="btn btn-secondary btn-sm" (click)="logout()" data-testid="staff-order-logout">Çıkış yap</button>
        </div>
      </header>
      <main class="staff-order-page" data-testid="staff-order-entry">
        <header class="page-header">
          <div>
            <h1>{{ 'STAFF_ORDER_ENTRY.TITLE' | translate }}</h1>
          </div>
        </header>

        @if (error()) {
          <div class="error-banner" role="alert">{{ error() }}</div>
        }
        @if (successOrderId(); as orderId) {
          <div class="success-banner" role="status" data-testid="order-send-success">{{ 'STAFF_ORDER_ENTRY.ORDER_SENT' | translate: { id: orderId } }}</div>
        }

        @if (selectedTable(); as table) {
          <div class="selected-table-bar">
            <div>
              <span class="eyebrow">{{ 'STAFF_ORDER_ENTRY.SELECTED_TABLE' | translate }}</span>
              <h2>{{ table.name }}</h2>
            </div>
            <button type="button" class="btn btn-secondary" (click)="changeTable()" [disabled]="submitting()" data-testid="change-staff-table">
              {{ 'STAFF_ORDER_ENTRY.CHANGE_TABLE' | translate }}
            </button>
          </div>

          @if (menuLoading()) {
            <div class="loading-state" role="status">{{ 'STAFF_ORDER_ENTRY.LOADING_MENU' | translate }}</div>
          } @else if (menu(); as loadedMenu) {
            @if (loadedMenu.products.length === 0) {
              <section class="empty-state">
                <h2>{{ 'STAFF_ORDER_ENTRY.NO_PRODUCTS' | translate }}</h2>
                <p>{{ 'STAFF_ORDER_ENTRY.NO_PRODUCTS_HINT' | translate }}</p>
              </section>
            } @else {
              <div class="order-toolbar">
                <label class="search-field">
                  <span>{{ 'STAFF_ORDER_ENTRY.SEARCH_PRODUCTS' | translate }}</span>
                  <input type="search" [ngModel]="searchText()" (ngModelChange)="searchText.set($event)" [placeholder]="'STAFF_ORDER_ENTRY.SEARCH_PLACEHOLDER' | translate" />
                </label>
                <label class="category-field">
                  <span>{{ 'STAFF_ORDER_ENTRY.CATEGORY' | translate }}</span>
                  <select [ngModel]="selectedCategory()" (ngModelChange)="selectedCategory.set($event)">
                    <option value="">{{ 'STAFF_ORDER_ENTRY.ALL_CATEGORIES' | translate }}</option>
                    @for (category of categoryNames(); track category) {
                      <option [value]="category">{{ category }}</option>
                    }
                  </select>
                </label>
              </div>

              <div class="order-layout">
                <section class="product-panel" aria-label="{{ 'STAFF_ORDER_ENTRY.MENU_PRODUCTS' | translate }}">
                  @for (group of productGroups(); track group.category) {
                    <section class="product-group">
                      <h2>{{ group.category }}</h2>
                      <div class="product-grid">
                        @for (product of group.products; track product.id) {
                          <article class="product-card">
                            <div class="product-copy">
                              <h3>{{ product.name }}</h3>
                              @if (product.subcategory) { <span class="product-subcategory">{{ product.subcategory }}</span> }
                              @if (product.description) { <p>{{ product.description }}</p> }
                            </div>
                            <div class="product-card-footer">
                              <strong>{{ formatPrice(product.price_cents) }}</strong>
                              <button type="button" class="btn btn-primary btn-sm" (click)="addProduct(product)" [disabled]="!product.id" [attr.data-testid]="'add-menu-product-' + product.id">
                                {{ 'STAFF_ORDER_ENTRY.ADD_PRODUCT' | translate }}
                              </button>
                            </div>
                          </article>
                        }
                      </div>
                    </section>
                  } @empty {
                    <div class="empty-state">{{ 'STAFF_ORDER_ENTRY.NO_SEARCH_RESULTS' | translate }}</div>
                  }
                </section>

                <aside class="cart-panel" aria-label="{{ 'STAFF_ORDER_ENTRY.CURRENT_ORDER' | translate }}">
                  @if (currentOrderLoading()) {
                    <p class="submitted-order-loading" role="status">{{ 'STAFF_ORDER_ENTRY.LOADING_SENT_ORDER' | translate }}</p>
                  } @else if (currentOrder(); as sentOrder) {
                    <section class="submitted-order" aria-label="{{ 'STAFF_ORDER_ENTRY.SENT_ORDER' | translate }}" data-testid="staff-sent-order">
                      <div class="sent-order-heading">
                        <h3>{{ 'STAFF_ORDER_ENTRY.SENT_ORDER' | translate }}</h3>
                        <span>#{{ sentOrder.id }}</span>
                      </div>
                      @for (item of sentOrder.items; track item.id) {
                        <article class="sent-order-line" [attr.data-testid]="'staff-sent-order-item-' + item.id">
                          <div class="sent-order-line-main">
                            <strong>{{ item.quantity }} × {{ item.product_name }}</strong>
                            <span>{{ formatPrice(item.price_cents * item.quantity) }}</span>
                          </div>
                          @if (item.notes?.trim()) { <small>{{ item.notes }}</small> }
                          @if (item.customization_summary) { <small>{{ item.customization_summary }}</small> }
                          @if (item.line_modifiers_summary) { <small>{{ item.line_modifiers_summary }}</small> }
                        </article>
                      }
                      @if (sentOrder.notes?.trim()) {
                        <p class="sent-order-note">{{ sentOrder.notes }}</p>
                      }
                      <div class="sent-order-total"><span>{{ 'STAFF_ORDER_ENTRY.TOTAL' | translate }}</span><strong>{{ formatPrice(sentOrder.total_cents) }}</strong></div>
                    </section>
                  } @else {
                    <p class="sent-order-empty">{{ 'STAFF_ORDER_ENTRY.NO_SENT_ORDER' | translate }}</p>
                  }
                  @if (cart().length > 0) {
                    <div class="draft-order-divider" role="separator"></div>
                  }
                  <div class="cart-heading">
                    <h2>{{ 'STAFF_ORDER_ENTRY.DRAFT_ORDER' | translate }}</h2>
                    <span>{{ cartCount() }}</span>
                  </div>
                  @if (cart().length === 0) {
                    <p class="cart-empty">{{ 'STAFF_ORDER_ENTRY.EMPTY_ORDER' | translate }}</p>
                  } @else {
                    <div class="cart-lines">
                      @for (line of cart(); track line.product.id) {
                        <article class="cart-line">
                          <div class="cart-line-heading">
                            <div><strong>{{ line.product.name }}</strong><small>{{ formatPrice(line.product.price_cents * line.quantity) }}</small></div>
                            <button type="button" class="remove-line" (click)="removeProduct(line.product.id!)" [attr.aria-label]="'STAFF_ORDER_ENTRY.REMOVE_PRODUCT' | translate">×</button>
                          </div>
                          <div class="line-controls">
                            <button type="button" (click)="changeQuantity(line.product.id!, -1)" [attr.aria-label]="'STAFF_ORDER_ENTRY.DECREASE' | translate">−</button>
                            <span>{{ line.quantity }}</span>
                            <button type="button" (click)="changeQuantity(line.product.id!, 1)" [attr.aria-label]="'STAFF_ORDER_ENTRY.INCREASE' | translate">+</button>
                          </div>
                          <label class="line-note">
                            {{ 'STAFF_ORDER_ENTRY.ITEM_NOTE' | translate }}
                            <input type="text" [ngModel]="line.notes" (ngModelChange)="setLineNotes(line.product.id!, $event)" [placeholder]="'STAFF_ORDER_ENTRY.ITEM_NOTE_PLACEHOLDER' | translate" />
                          </label>
                        </article>
                      }
                    </div>
                    <label class="order-note">
                      {{ 'STAFF_ORDER_ENTRY.ORDER_NOTE' | translate }}
                      <textarea rows="3" [ngModel]="orderNotes()" (ngModelChange)="orderNotes.set($event)" [placeholder]="'STAFF_ORDER_ENTRY.ORDER_NOTE_PLACEHOLDER' | translate"></textarea>
                    </label>
                    <div class="cart-total"><span>{{ 'STAFF_ORDER_ENTRY.TOTAL' | translate }}</span><strong>{{ formatPrice(orderTotal()) }}</strong></div>
                  }
                  <button type="button" class="btn btn-primary submit-order" (click)="submitOrder()" [disabled]="cart().length === 0 || submitting()" data-testid="submit-staff-order">
                    {{ (submitting() ? 'STAFF_ORDER_ENTRY.SENDING' : 'STAFF_ORDER_ENTRY.SUBMIT_ORDER') | translate }}
                  </button>
                </aside>
              </div>
            }
          }
        } @else if (loading()) {
          <div class="loading-state" role="status">{{ 'STAFF_ORDER_ENTRY.LOADING' | translate }}</div>
        } @else if (tables().length === 0) {
          <section class="empty-state">
            <h2>{{ 'STAFF_ORDER_ENTRY.NO_TABLES' | translate }}</h2>
            <p>{{ 'STAFF_ORDER_ENTRY.NO_TABLES_HINT' | translate }}</p>
          </section>
        } @else {
          @if (floors().length > 0) {
            <nav class="table-floor-tabs" [attr.aria-label]="'STAFF_ORDER_ENTRY.FLOORS' | translate" data-testid="staff-floor-tabs">
              <button type="button" class="table-floor-tab" [class.active]="selectedFloorId() === null" (click)="selectedFloorId.set(null)" data-testid="staff-all-floors">
                {{ 'STAFF_ORDER_ENTRY.ALL_FLOORS' | translate }}
              </button>
              @for (floor of floors(); track floor.id) {
                <button type="button" class="table-floor-tab" [class.active]="selectedFloorId() === floor.id" (click)="selectedFloorId.set(floor.id!)" [attr.data-testid]="'staff-floor-' + floor.id">
                  {{ floor.name }}
                </button>
              }
            </nav>
          }
          <section class="table-grid" aria-label="{{ 'STAFF_ORDER_ENTRY.TABLES' | translate }}">
            @for (table of sortedTables(); track table.id) {
              <article class="table-card" [class.table-card--open]="table.is_active !== false" [class.table-card--closed]="table.is_active === false" [attr.data-testid]="'staff-table-card-' + table.id">
                <div class="table-card-top">
                  <span class="table-icon" aria-hidden="true">{{ table.seat_count ?? '•' }}</span>
                  <span class="table-state" [class.table-state--active]="table.is_active !== false">
                    {{ (table.is_active === false ? 'STAFF_ORDER_ENTRY.INACTIVE' : 'STAFF_ORDER_ENTRY.ACTIVE') | translate }}
                  </span>
                </div>
                <h2>{{ table.name }}</h2>
                <p>{{ 'STAFF_ORDER_ENTRY.SEATS' | translate: { count: table.seat_count ?? 0 } }}</p>
                @if (table.assigned_waiter_name || table.effective_waiter_name) {
                  <p class="table-waiter">{{ table.assigned_waiter_name || table.effective_waiter_name }}</p>
                }
                <button type="button" class="btn btn-primary order-table-button" [disabled]="openingTableId() === table.id" (click)="startOrder(table)" [attr.data-testid]="'start-table-order-' + table.id">
                  {{ (openingTableId() === table.id ? 'STAFF_ORDER_ENTRY.OPENING' : table.is_active === false ? 'STAFF_ORDER_ENTRY.ACTIVATE_AND_ORDER' : 'STAFF_ORDER_ENTRY.START_ORDER') | translate }}
                </button>
              </article>
            }
          </section>
        }
      </main>
    </div>
  `,
  styles: [`
    .staff-order-shell { min-height:100vh; background:var(--color-bg); }
    .staff-order-topbar { position:sticky; top:0; z-index:20; display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.75rem max(1rem,calc((100vw - 1440px)/2)); border-bottom:1px solid var(--color-border); background:var(--color-surface); }
    .staff-order-brand,.staff-order-account { display:flex; align-items:center; gap:.75rem; }
    .staff-order-brand strong { color:var(--color-primary); font-size:1.05rem; }
    .staff-order-brand span,.staff-order-account span { color:var(--color-text-muted); font-size:.82rem; }
    .staff-order-page { max-width: 1440px; margin: 0 auto; padding: 1rem; font-size:.875rem; }
    .page-header,.selected-table-bar { display:flex; align-items:center; justify-content:space-between; gap:.75rem; margin-bottom:.85rem; }
    .page-header h1,.selected-table-bar h2 { margin:0; color:var(--color-text); font-size:1.25rem; }
    .eyebrow { margin:0; color:var(--color-primary); font-size:.75rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    .table-floor-tabs { display:flex; gap:.45rem; overflow-x:auto; margin:0 0 1rem; padding:.1rem 0 .55rem; }
    .table-floor-tab { flex:0 0 auto; padding:.55rem .9rem; border:0; border-radius:7px; background:#e5e7eb; color:#273142; font-weight:650; cursor:pointer; }
    .table-floor-tab.active { background:#202b3d; color:white; }
    .table-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:.55rem; }
    .table-card,.product-card,.cart-panel,.empty-state,.loading-state { border:1px solid var(--color-border); border-radius:var(--radius-lg); background:var(--color-surface); box-shadow:var(--shadow-sm); }
    .table-card { position:relative; display:flex; min-width:0; min-height:156px; flex-direction:column; align-items:center; justify-content:center; padding:.8rem .7rem 2.55rem; text-align:center; transition:transform .15s ease,box-shadow .15s ease; }
    .table-card:hover { transform:translateY(-1px); box-shadow:0 6px 14px rgba(23,32,48,.16); }
    .table-card--open { border-color:#80bc87; background:#bfe8c2; }
    .table-card--closed { border-color:#dedc72; background:#f4f294; }
    .table-card-top { position:absolute; top:.5rem; left:.6rem; display:flex; width:auto; align-items:center; }
    .table-icon { display:none; }
    .table-state { display:inline-flex; align-items:center; gap:.35rem; padding:.22rem .55rem; border-radius:999px; background:rgba(255,255,255,.68); color:#626b79; font-size:.7rem; font-weight:700; }
    .table-state--active { color:#166534; }
    .table-state-dot { width:.45rem; height:.45rem; border-radius:50%; background:currentColor; }
    .table-card h2 { margin:.5rem 0 .1rem; color:#182235; font-size:1rem; }
    .table-card p { margin:.1rem 0; color:#364153; font-size:.75rem; }
    .table-state { font-size:.64rem; }
    .table-card p.table-waiter { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .order-table-button { position:absolute; right:.35rem; bottom:.35rem; left:.35rem; width:calc(100% - .7rem); }
    .order-toolbar { display:flex; gap:.7rem; align-items:end; margin-bottom:.75rem; padding:.7rem; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); }
    .order-toolbar label,.order-note,.line-note { display:flex; flex-direction:column; gap:.4rem; color:var(--color-text-muted); font-size:.82rem; font-weight:600; }
    .search-field { flex:1; }
    .category-field { min-width:min(260px,40%); }
    .order-toolbar input,.order-toolbar select,.line-note input,.order-note textarea { width:100%; min-height:42px; padding:.6rem .7rem; border:1px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); color:var(--color-text); }
    .order-layout { display:grid; grid-template-columns:minmax(0,1fr) 350px; gap:1rem; align-items:start; }
    .product-group { margin-bottom:1.25rem; }
    .product-group h2 { margin:0 0 .7rem; font-size:1rem; }
    .product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:.75rem; }
    .product-card { display:flex; min-height:150px; flex-direction:column; justify-content:space-between; padding:.9rem; }
    .product-copy h3 { margin:0; font-size:.98rem; }
    .product-copy p { margin:.45rem 0; color:var(--color-text-muted); font-size:.84rem; line-height:1.4; }
    .product-subcategory { display:inline-block; margin-top:.25rem; color:var(--color-text-muted); font-size:.75rem; }
    .product-card-footer { display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-top:.8rem; }
    .cart-panel { position:sticky; top:1rem; padding:1rem; }
    .submitted-order { margin-bottom:1rem; padding-bottom:.8rem; border-bottom:1px solid var(--color-border); }
    .sent-order-heading,.sent-order-line-main,.sent-order-total { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
    .sent-order-heading h3 { margin:0; font-size:.9rem; }
    .sent-order-heading>span,.sent-order-line-main>span,.sent-order-line small,.sent-order-note,.sent-order-empty,.submitted-order-loading { color:var(--color-text-muted); font-size:.75rem; }
    .sent-order-line { padding:.55rem 0; border-bottom:1px solid var(--color-border); }
    .sent-order-line-main strong { font-size:.8rem; }
    .sent-order-line small { display:block; margin-top:.2rem; }
    .sent-order-note { margin:.6rem 0 0; }
    .sent-order-total { margin-top:.65rem; font-size:.8rem; }
    .sent-order-empty,.submitted-order-loading { margin:.25rem 0 .75rem; }
    .cart-heading,.cart-line-heading,.cart-total { display:flex; align-items:center; justify-content:space-between; gap:.6rem; }
    .cart-heading h2 { margin:0; font-size:1.05rem; }
    .cart-heading>span { min-width:26px; padding:.2rem .45rem; border-radius:999px; background:var(--color-primary-light); color:var(--color-primary); text-align:center; font-weight:700; }
    .cart-empty { padding:1rem 0; color:var(--color-text-muted); font-size:.9rem; }
    .cart-lines { max-height:48vh; overflow:auto; }
    .cart-line { padding:.9rem 0; border-bottom:1px solid var(--color-border); }
    .cart-line-heading strong,.cart-line-heading small { display:block; }
    .cart-line-heading small { margin-top:.25rem; color:var(--color-text-muted); }
    .remove-line { border:0; background:transparent; color:#9f1239; font-size:1.3rem; cursor:pointer; }
    .line-controls { display:inline-flex; align-items:center; gap:.75rem; margin:.6rem 0; }
    .line-controls button { width:30px; height:30px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-surface); color:var(--color-text); font-size:1.1rem; cursor:pointer; }
    .line-note { margin-top:.25rem; }
    .order-note { margin-top:1rem; }
    .order-note textarea { resize:vertical; }
    .cart-total { margin:1rem 0; padding-top:.8rem; border-top:1px solid var(--color-border); color:var(--color-text); }
    .submit-order { width:100%; }
    .loading-state,.empty-state { padding:2rem; text-align:center; }
    .empty-state p { color:var(--color-text-muted); }
    .selected-table-bar { align-items:center; padding:1rem; border:1px solid var(--color-border); border-radius:var(--radius-lg); background:var(--color-surface); }
    .success-banner { margin-bottom:1rem; padding:.8rem 1rem; border:1px solid #86efac; border-radius:var(--radius-md); background:#f0fdf4; color:#166534; }
    @media(max-width:900px) { .order-layout{grid-template-columns:minmax(0,1fr) 310px;} }
    @media(max-width:720px) { .staff-order-topbar{padding:.65rem .8rem;} .staff-order-page{padding:1rem;} .page-header{flex-direction:column;} .page-header>.btn{width:100%;} .order-layout{grid-template-columns:1fr;} .cart-panel{position:static;order:-1;} .cart-lines{max-height:none;} }
    @media(max-width:420px) { .staff-order-brand{align-items:flex-start;flex-direction:column;gap:.1rem;} .staff-order-account{gap:.45rem;} .staff-order-account span{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} }
    @media(max-width:480px) { .table-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;} .table-card{min-height:180px;padding:.8rem;} .table-card h2{font-size:1rem;} .order-toolbar{align-items:stretch;flex-direction:column;} .category-field{min-width:0;} .product-grid{grid-template-columns:1fr;} .selected-table-bar{align-items:flex-start;flex-direction:column;} }
    @media(max-width:360px) { .table-grid{grid-template-columns:1fr;} }
  `],
})
export class StaffOrderEntryComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  staffDisplayName(): string {
    const user = this.api.getCurrentUser();
    return user?.full_name || user?.email || 'Personel';
  }

  isManagementUser(): boolean {
    const role = this.api.getCurrentUser()?.role;
    return role === 'owner' || role === 'admin';
  }

  returnToManagement(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  logout(): void {
    this.api.logout().subscribe(() => void this.router.navigateByUrl('/staff/login'));
  }

  readonly tables = signal<Table[]>([]);
  readonly floors = signal<Floor[]>([]);
  readonly selectedFloorId = signal<number | null>(null);
  readonly selectedTable = signal<Table | null>(null);
  readonly loading = signal(true);
  readonly menuLoading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly successOrderId = signal<number | null>(null);
  readonly openingTableId = signal<number | null>(null);
  readonly menu = signal<MenuResponse | null>(null);
  readonly currentOrder = signal<CurrentTableOrder | null>(null);
  readonly currentOrderLoading = signal(false);
  readonly tableToken = signal('');
  readonly staffAccess = signal('');
  readonly cart = signal<StaffOrderLine[]>([]);
  readonly submittedProductIds = signal(new Set<number>());
  readonly orderNotes = signal('');
  readonly searchText = signal('');
  readonly selectedCategory = signal('');

  readonly sortedTables = computed(() =>
    [...this.tables()]
      .filter(table => this.selectedFloorId() == null || table.floor_id === this.selectedFloorId())
      .sort((a, b) => (a.floor_id ?? 0) - (b.floor_id ?? 0) || a.name.localeCompare(b.name, 'tr')),
  );
  readonly categoryNames = computed(() =>
    [...new Set((this.menu()?.products ?? []).map((product) => product.category?.trim() || 'Diğer'))].sort((a, b) => a.localeCompare(b, 'tr')),
  );
  readonly filteredProducts = computed(() => {
    const query = this.normalize(this.searchText());
    return (this.menu()?.products ?? []).filter((product) => {
      const category = product.category?.trim() || 'Diğer';
      const matchesCategory = !this.selectedCategory() || category === this.selectedCategory();
      const matchesSearch = !query || this.normalize(`${product.name} ${product.description ?? ''} ${product.category ?? ''} ${product.subcategory ?? ''}`).includes(query);
      return matchesCategory && matchesSearch;
    });
  });
  readonly productGroups = computed(() => {
    const groups = new Map<string, Product[]>();
    for (const product of this.filteredProducts()) {
      const category = product.category?.trim() || 'Diğer';
      groups.set(category, [...(groups.get(category) ?? []), product]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr')).map(([category, products]) => ({ category, products }));
  });
  readonly cartCount = computed(() => this.cart().reduce((sum, line) => sum + line.quantity, 0));
  readonly orderTotal = computed(() => this.cart().reduce((sum, line) => sum + line.product.price_cents * line.quantity, 0));

  constructor() {
    this.api.getFloors().subscribe({
      next: floors => this.floors.set([...floors].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))),
      error: () => this.floors.set([]),
    });
    this.api.getTables().subscribe({
      next: (tables) => {
        this.tables.set(tables);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Masalar yüklenemedi. Lütfen yeniden deneyin.');
        this.loading.set(false);
      },
    });
  }

  startOrder(table: Table): void {
    if (!table.id || this.openingTableId() !== null) return;
    this.error.set('');
    this.successOrderId.set(null);
    this.currentOrder.set(null);
    this.currentOrderLoading.set(false);
    this.openingTableId.set(table.id);
    const continueToMenu = () => this.loadStaffMenu(table);
    if (table.is_active === false) {
      this.api.activateTable(table.id).subscribe({
        next: () => {
          const activated = { ...table, is_active: true };
          this.tables.update((current) => current.map((item) => item.id === table.id ? activated : item));
          continueToMenu();
        },
        error: (err) => {
          this.error.set(err.error?.detail || 'Masa açılamadı. Masa açma yetkinizi kontrol edin.');
          this.openingTableId.set(null);
        },
      });
      return;
    }
    continueToMenu();
  }

  private loadStaffMenu(table: Table): void {
    if (!table.id) return;
    this.menuLoading.set(true);
    this.api.getStaffMenuToken(table.id).subscribe({
      next: (access) => {
        this.tableToken.set(access.table_token);
        this.staffAccess.set(access.token);
        this.api.getMenu(access.table_token, access.token).subscribe({
          next: (menu) => {
            this.menu.set(menu);
            this.selectedTable.set(table);
            this.cart.set([]);
            this.orderNotes.set('');
            this.searchText.set('');
            this.selectedCategory.set('');
            this.refreshCurrentOrder(access.table_token, () => {
              this.menuLoading.set(false);
              this.openingTableId.set(null);
            });
          },
          error: (err) => {
            this.error.set(err.error?.detail || 'Menü yüklenemedi. Lütfen tekrar deneyin.');
            this.menuLoading.set(false);
            this.openingTableId.set(null);
          },
        });
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Personel sipariş bağlantısı oluşturulamadı.');
        this.menuLoading.set(false);
        this.openingTableId.set(null);
      },
    });
  }

  changeTable(): void {
    if (this.submitting()) return;
    this.selectedTable.set(null);
    this.menu.set(null);
    this.currentOrder.set(null);
    this.currentOrderLoading.set(false);
    this.submittedProductIds.set(new Set());
    this.tableToken.set('');
    this.staffAccess.set('');
    this.cart.set([]);
    this.orderNotes.set('');
    this.error.set('');
    this.successOrderId.set(null);
  }

  addProduct(product: Product): void {
    if (!product.id) return;
    if (this.submittedProductIds().has(product.id)) {
      this.error.set('Bu ürün bu siparişe zaten gönderildi. Aynı ürünü yeniden gönderememek için gönderilen satırı önce yöneticiniz düzeltsin.');
      return;
    }
    this.error.set('');
    this.cart.update((lines) => {
      const existing = lines.find((line) => line.product.id === product.id);
      return existing
        ? lines.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...lines, { product, quantity: 1, notes: '' }];
    });
  }

  changeQuantity(productId: number, delta: number): void {
    this.cart.update((lines) => lines
      .map((line) => line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line)
      .filter((line) => line.quantity > 0));
  }

  setLineNotes(productId: number, notes: string): void {
    this.cart.update((lines) => lines.map((line) => line.product.id === productId ? { ...line, notes } : line));
  }

  removeProduct(productId: number): void {
    this.cart.update((lines) => lines.filter((line) => line.product.id !== productId));
  }

  submitOrder(): void {
    const table = this.selectedTable();
    const lines = this.cart();
    if (!table?.id || lines.length === 0 || this.submitting()) return;
    this.error.set('');
    this.successOrderId.set(null);
    this.submitting.set(true);
    // Staff links expire; obtain a fresh short-lived token when the order is sent.
    this.api.getStaffMenuToken(table.id).subscribe({
      next: (access) => {
        this.staffAccess.set(access.token);
        this.tableToken.set(access.table_token);
        this.api.submitOrder(access.table_token, {
          items: lines.map((line) => ({
            product_id: line.product.id!,
            quantity: line.quantity,
            notes: line.notes.trim() || undefined,
            source: line.product._source || undefined,
          })),
          notes: this.orderNotes().trim() || undefined,
          staff_access: access.token,
        }).subscribe({
          next: (response) => {
            this.successOrderId.set(response.order_id);
            this.cart.set([]);
            this.orderNotes.set('');
            this.submitting.set(false);
            this.refreshCurrentOrder(access.table_token);
          },
          error: (err) => {
            this.error.set(err.error?.detail || 'Sipariş gönderilemedi. Lütfen tekrar deneyin.');
            this.submitting.set(false);
          },
        });
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Personel sipariş yetkisi doğrulanamadı.');
        this.submitting.set(false);
      },
    });
  }

  formatPrice(priceCents: number): string {
    const currency = this.menu()?.tenant_currency_code || this.menu()?.tenant_currency || 'TRY';
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(priceCents / 100);
    } catch {
      return `₺${(priceCents / 100).toFixed(2)}`;
    }
  }

  private refreshCurrentOrder(tableToken: string, onComplete?: () => void): void {
    this.currentOrderLoading.set(true);
    this.api.getCurrentOrder(tableToken).subscribe({
      next: (response) => {
        this.currentOrder.set(response.order);
        this.submittedProductIds.set(new Set((response.order?.items ?? [])
          .filter((item: CurrentTableOrderItem) => item.status !== 'cancelled')
          .map((item: CurrentTableOrderItem) => item.product_id)));
        this.currentOrderLoading.set(false);
        onComplete?.();
      },
      error: (err) => {
        this.currentOrder.set(null);
        this.submittedProductIds.set(new Set());
        this.currentOrderLoading.set(false);
        this.error.set(err.error?.detail || 'Gönderilmiş siparişler yüklenemedi.');
        onComplete?.();
      },
    });
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}
