import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, CurrentTableOrder, Order, OrderPaymentLeg, ProductQuestion, StaffPosMenuProduct, Table } from '../services/api.service';
import { SidebarComponent } from '../shared/sidebar.component';
import { beratzadeMenuCategoryLabel, beratzadeMenuCategorySlug } from '../shared/public-menu-categories';

type SaleMode = 'table' | 'quick_sale' | 'takeaway';
type PaymentMethod = 'cash' | 'terminal' | 'meal_card';

interface PosCategory {
  id: string;
  name: string;
  products: StaffPosMenuProduct[];
  subcategories: Array<{ id: string; name: string; products: StaffPosMenuProduct[] }>;
}

interface CartLine {
  product: StaffPosMenuProduct;
  quantity: number;
  notes: string;
  answers: Partial<Record<string, string | number | string[]>>;
}

interface PayableOrder {
  id: number;
  tableName: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  items: Array<{ product_name: string; quantity: number; price_cents: number; notes?: string | null }>;
  payments: OrderPaymentLeg[];
}

interface CompletedPaymentEntry {
  id: number;
  orderId: number;
  tableName: string;
  paymentMethod: string;
  amountCents: number;
  paidAt: string | null;
}

@Component({
  selector: 'app-staff-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SidebarComponent],
  template: `
    <app-sidebar>
      <main class="pos-page" data-testid="staff-pos">
        <header class="pos-header">
          <div>
            <span class="pos-kicker">BERATZADE KEBAP &amp; KAHVALTI SALONU</span>
            <h1>Satış ekranı</h1>
          </div>
          <div class="pos-header-actions">
            <a routerLink="/staff/orders" class="pos-link">Sipariş takibi</a>
            <button type="button" class="icon-action" (click)="refresh()" aria-label="Yenile" title="Yenile">↻</button>
          </div>
        </header>

        <nav class="sale-modes" aria-label="Satış türü">
          <button type="button" [class.active]="mode() === 'table'" (click)="setMode('table')" data-testid="pos-mode-table">Masada satış</button>
          <button type="button" [class.active]="mode() === 'quick_sale'" (click)="setMode('quick_sale')" data-testid="pos-mode-quick">Hızlı satış</button>
          <button type="button" [class.active]="mode() === 'takeaway'" (click)="setMode('takeaway')" data-testid="pos-mode-takeaway">Gel-al</button>
        </nav>

        @if (error()) { <div class="pos-alert error" role="alert">{{ error() }}</div> }
        @if (success()) { <div class="pos-alert success" role="status">{{ success() }}</div> }

        @if (mode() === 'table' && !selectedTable()) {
          <section class="table-picker" aria-label="Masa seçimi">
            <div class="section-heading"><div><h2>Masa seç</h2><p>Açık hesaba devam et veya boş bir masa başlat.</p></div></div>
            @if (tablesLoading()) {
              <p class="muted">Masalar yükleniyor…</p>
            } @else if (tables().length === 0) {
              <p class="muted">Bu işletmede tanımlı masa bulunamadı.</p>
            } @else {
              <div class="table-grid">
                @for (table of tables(); track table.id) {
                  <button type="button" class="table-choice" [class.occupied]="table.is_active" [disabled]="openingTable()" (click)="openTable(table)" [attr.data-testid]="'pos-table-' + table.id">
                    <span class="table-state-dot"></span>
                    <strong>{{ table.name }}</strong>
                    <small>{{ table.is_active ? 'Açık masa' : 'Boş masa' }}</small>
                    @if (tableOpenTotalLabel(table); as total) {
                      <span class="table-open-total">{{ total }}</span>
                    }
                  </button>
                }
              </div>
            }
          </section>
        } @else {
          @if (leftPanelCollapsed()) {
            <button type="button" class="left-panel-reopen" (click)="leftPanelCollapsed.set(false)" aria-label="Sol paneli a&#231;" data-testid="pos-left-panel-open">Sol paneli a&#231;</button>
          }
          <section class="pos-workspace" [class.pos-workspace--quick-sale]="mode() === 'quick_sale'" [class.pos-workspace--left-collapsed]="leftPanelCollapsed()">
            <aside class="receipt-panel panel">
              <div class="receipt-head">
                <div>
                  <span class="receipt-overline">{{ modeLabel() }}</span>
                  <h2>{{ selectedTable()?.name || (mode() === 'takeaway' ? 'Gel-al fişi' : 'Hızlı satış fişi') }}</h2>
                </div>
                @if (selectedTable()) {
                  <button type="button" class="text-button" (click)="changeTable()" [disabled]="submitting()">Masa değiştir</button>
                }
              </div>

              @if (mode() === 'takeaway' && !payableOrder()) {
                <div class="customer-fields">
                  <label>Müşteri adı<input [(ngModel)]="customerName" maxlength="160" autocomplete="name" placeholder="İsteğe bağlı" /></label>
                  <label>Telefon<input [(ngModel)]="customerPhone" maxlength="40" autocomplete="tel" placeholder="İsteğe bağlı" /></label>
                </div>
              }

              @if (currentOrder(); as sent) {
                <section class="sent-items" data-testid="pos-sent-order">
                  <div class="subsection-title"><strong>Gönderilmiş hesap</strong><span>#{{ sent.id }}</span></div>
                  @for (item of sent.items; track item.id) {
                    <div class="sent-line">
                      <span><b>{{ item.quantity }} ×</b> {{ item.product_name }}@if (item.notes) { <small>{{ item.notes }}</small> }</span>
                      <strong>{{ price(item.price_cents * item.quantity) }}</strong>
                    </div>
                  }
                  <div class="sent-total"><span>Hesap tutarı</span><strong>{{ price(sent.total_cents) }}</strong></div>
                </section>
              }

              @if (payableOrder(); as payable) {
                <section class="payment-summary" data-testid="pos-payment-summary">
                  <div class="subsection-title"><strong>Ödeme özeti</strong><span>#{{ payable.id }}</span></div>
                  <div class="summary-line"><span>Genel toplam</span><strong>{{ price(payable.amountDue) }}</strong></div>
                  <div class="summary-line"><span>Alınan ödeme</span><strong>{{ price(payable.amountPaid) }}</strong></div>
                  @for (payment of payable.payments; track payment.id) {
                    <div class="payment-history-line"><span>{{ paymentMethodLabel(payment.payment_method) }} · {{ payment.paid_at | date:'HH:mm' }}</span><strong>{{ price(payment.amount_cents) }}</strong></div>
                  }
                  <div class="summary-line remaining"><span>Kalan</span><strong>{{ price(payable.amountRemaining) }}</strong></div>
                </section>
              }

              <section class="draft-section">
                <div class="subsection-title"><strong>{{ payableOrder() ? 'Yeni ürünler' : 'Adisyon taslağı' }}</strong><span>{{ cartCount() }} ürün</span></div>
                @if (cart().length === 0) {
                  <p class="empty-cart">Ürün seçmek için menüden bir karta dokun.</p>
                } @else {
                  <div class="cart-lines">
                    @for (line of cart(); track lineKey(line.product)) {
                      <article class="cart-line">
                        <div class="cart-line-title"><strong>{{ line.product.name }}</strong><button type="button" class="remove-line" (click)="removeLine(line.product)" aria-label="Ürünü taslaktan kaldır">×</button></div>
                        <div class="cart-line-bottom">
                          <div class="qty-control"><button type="button" (click)="changeQuantity(line.product, -1)" [attr.aria-label]="line.product.name + ' azalt'">−</button><span>{{ line.quantity }}</span><button type="button" (click)="changeQuantity(line.product, 1)" [attr.aria-label]="line.product.name + ' artır'">+</button></div>
                          <strong>{{ price(line.product.price_cents * line.quantity) }}</strong>
                        </div>
                        <input class="line-note" [ngModel]="line.notes" (ngModelChange)="setLineNote(line.product, $event)" maxlength="500" [placeholder]="'Ürün notu (isteğe bağlı)'" />
                        @for (question of line.product.questions ?? []; track question.id) {
                          <label class="customization-field">
                            <span>{{ question.label }}@if (question.required) { <b>*</b> }</span>
                            @if (question.type === 'choice' && question.multi) {
                              <span class="customization-options">
                                @for (option of questionOptions(question); track option) {
                                  <label><input type="checkbox" [checked]="hasAnswer(line, question, option)" (change)="toggleAnswer(line.product, question, option, $any($event.target).checked)" />{{ option }}</label>
                                }
                              </span>
                            } @else if (question.type === 'choice') {
                              <select [ngModel]="line.answers[question.id] ?? ''" (ngModelChange)="setAnswer(line.product, question, $event)">
                                <option value="">Seçiniz</option>
                                @for (option of questionOptions(question); track option) { <option [value]="option">{{ option }}</option> }
                              </select>
                            } @else if (question.type === 'scale') {
                              <input type="number" [min]="scaleBounds(question).min" [max]="scaleBounds(question).max" [ngModel]="line.answers[question.id] ?? ''" (ngModelChange)="setAnswer(line.product, question, $event)" />
                            } @else {
                              <input type="text" maxlength="500" [ngModel]="line.answers[question.id] ?? ''" (ngModelChange)="setAnswer(line.product, question, $event)" />
                            }
                          </label>
                        }
                      </article>
                    }
                  </div>
                }
                <label class="order-note">Sipariş notu<textarea [ngModel]="orderNotesValue" (ngModelChange)="orderNotesValue = $event" rows="2" maxlength="2000" placeholder="Personel veya mutfak notu"></textarea></label>
                <div class="draft-total"><span>Ara toplam</span><strong>{{ price(draftTotal()) }}</strong></div>
                @if (mode() === 'quick_sale') {
                  @if (!paymentOptionsOpen()) {
                    <button type="button" class="primary-button" (click)="openPaymentOptions()" [disabled]="cart().length === 0 || submitting() || processingPayment()" data-testid="pos-open-payment">Ödeme al</button>
                  }
                } @else {
                  <button type="button" class="primary-button" (click)="submitOrder()" [disabled]="cart().length === 0 || submitting() || currentOrderLoading()" data-testid="pos-submit-order">
                    {{ submitting() ? 'Kaydediliyor…' : mode() === 'table' ? 'Siparişi mutfağa gönder' : 'Siparişi kaydet' }}
                  </button>
                }
              </section>

              @if (mode() === 'quick_sale' && paymentOptionsOpen() && cart().length > 0 && !payableOrder()) {
                <section class="collect-payment" data-testid="pos-payment-choices">
                  <h3>Ödeme yöntemi</h3>
                  <div class="method-pills payment-choices" role="group" aria-label="Ödeme yöntemi">
                    <button type="button" (click)="checkoutQuickSale('cash')" [disabled]="submitting() || processingPayment()" data-testid="pos-pay-cash">Nakit</button>
                    <button type="button" (click)="checkoutQuickSale('terminal')" [disabled]="submitting() || processingPayment()" data-testid="pos-pay-terminal">POS</button>
                    <button type="button" (click)="checkoutQuickSale('meal_card')" [disabled]="submitting() || processingPayment()" data-testid="pos-pay-meal-card">Yemek kartı</button>
                  </div>
                  <p class="payment-hint">POS ve yemek kart&#305; tahsilat&#305;n&#305; harici cihazda tamamlad&#305;ktan sonra ilgili se&#231;ene&#287;e bas.</p>
                </section>
              }

              @if (payableOrder(); as payable) {
                @if (payable.amountRemaining > 0) {
                  <section class="collect-payment" data-testid="pos-payment-form">
                    <h3>Ödeme al</h3>
                    <div class="method-pills" role="group" aria-label="Ödeme yöntemi">
                      <button type="button" [class.active]="paymentMethod === 'cash'" (click)="setPaymentMethod('cash')">Nakit</button>
                      <button type="button" [class.active]="paymentMethod === 'terminal'" (click)="setPaymentMethod('terminal')">POS</button>
                      <button type="button" [class.active]="paymentMethod === 'meal_card'" (click)="setPaymentMethod('meal_card')">Yemek kartı</button>
                    </div>
                    @if (paymentMethod === 'cash') {
<label class="amount-field">Alınan nakit<input type="number" min="0" step="0.01" [ngModel]="cashReceived" (ngModelChange)="setCashReceived($event)" data-testid="pos-cash-received" /></label>
                      <p class="change-line">Para üstü <strong>{{ price(cashChange()) }}</strong></p>
                    } @else {
                      <label class="amount-field">Tahsil edilecek tutar<input type="number" min="0.01" step="0.01" [ngModel]="paymentAmount" (ngModelChange)="setPaymentAmount($event)" /></label>
                    }
                    <button type="button" class="primary-button pay-button" (click)="collectPayment()" [disabled]="processingPayment() ||  paymentAmountCents() < 1 || paymentAmountCents() > payable.amountRemaining" data-testid="pos-collect-payment">
                      {{ processingPayment() ? 'Kaydediliyor…' : 'Tahsilatı kaydet' }}
                    </button>
                    <p class="payment-hint">Ödeme seçimi POS veya yemek kartı cihazını çalıştırmaz; seçilen yöntemi tahsilat kaydına işler.</p>
                  </section>
                } @else {
                  <section class="paid-summary" role="status" data-testid="pos-payment-complete">
                    <strong>Hesap tamamen ödendi. Masa boşaltıldı.</strong>
                    <button type="button" class="secondary-button" (click)="printReceipt()">Hesap özetini yazdır</button>
                  </section>
                }
              }

            </aside>

            <aside class="category-panel panel" aria-label="Kategoriler ve tamamlanan &#246;demeler" data-testid="pos-left-panel">
              <div class="left-panel-heading">
                <h2>Kategoriler</h2>
                <button type="button" class="left-panel-close" (click)="leftPanelCollapsed.set(true)" aria-label="Sol paneli sola kayd&#305;r&#305;p kapat" title="Sol paneli kapat" data-testid="pos-left-panel-close">&#x2039;</button>
              </div>
              <nav class="category-list" aria-label="&#220;r&#252;n kategorileri">
              @if (menuLoading()) { <p class="muted">Yükleniyor…</p> }
              <button type="button" class="category-button" [class.active]="selectedCategory() === 'all'" (click)="selectCategory('all')">
                <span>Tüm ürünler</span><small>{{ allProductCount() }}</small>
              </button>
              @for (category of visibleCategories(); track category.id) {
                <button type="button" class="category-button" [class.active]="selectedCategory() === category.id" (click)="selectCategory(category.id)">
                  <span>{{ category.name }}</span><small>{{ categoryProductCount(category) }}</small>
                </button>
              }
              </nav>
<section class="completed-payments" data-testid="pos-completed-payments" aria-label="Tamamlanan ödemeler">
                <div class="subsection-title"><strong>Tamamlanan ödemeler</strong><span>{{ completedPayments().length }}</span></div>
                @if (completedPayments().length === 0) {
                  <p class="empty-payments">Henüz tamamlanan ödeme yok.</p>
                } @else {
                  @for (payment of completedPayments(); track payment.id) {
                    <div class="completed-payment-row">
                      <span><strong>#{{ payment.orderId }}</strong> · {{ payment.tableName }}<small>{{ paymentMethodLabel(payment.paymentMethod) }} ? {{ payment.paidAt ? (payment.paidAt | date:'dd.MM HH:mm') : 'Saat bilgisi yok' }}</small></span>
                      <b>{{ price(payment.amountCents) }}</b>
                    </div>
                  }
                }
              </section>
            </aside>

            <section class="product-panel">
              <div class="product-toolbar">
                <div><h2>{{ selectedCategoryName() }}</h2><p>Ürüne dokunarak adisyona ekle.</p></div>
                <label class="product-search"><span>Ürün ara</span><input type="search" [(ngModel)]="searchText" placeholder="Ürün adı veya açıklama" data-testid="pos-product-search" /></label>
              </div>
              @if (selectedCategoryObject(); as activeCategory) {
                @if (activeCategory.subcategories.length > 0) {
                  <nav class="subcategory-chips" aria-label="Alt kategoriler" data-testid="pos-subcategory-chips">
                    <button type="button" class="subcategory-chip" [class.active]="selectedSubcategory() === 'all'" (click)="selectSubcategory('all')">Tümü</button>
                    @for (subcategory of activeCategory.subcategories; track subcategory.id) {
                      <button type="button" class="subcategory-chip" [class.active]="selectedSubcategory() === subcategory.id" (click)="selectSubcategory(subcategory.id)" [attr.data-testid]="'pos-subcategory-' + subcategory.id">
                        {{ subcategory.name }}<small>{{ subcategory.products.length }}</small>
                      </button>
                    }
                  </nav>
                }
              }
              @if (menuLoading()) {
                <div class="panel loading-products">Menü yükleniyor…</div>
              } @else if (visibleProducts().length === 0) {
                <div class="panel empty-products">Bu kategoride uygun ürün bulunmuyor.</div>
              } @else {
                <div class="product-grid">
                  @for (product of visibleProducts(); track trackProduct(product)) {
                    <button type="button" class="product-card" [disabled]="!product.available || payableOrder()?.amountRemaining === 0" (click)="addProduct(product)" [attr.data-testid]="'pos-product-' + product.source + '-' + product.id">
                      @if (product.image_url) { <img [src]="product.image_url" [alt]="''" loading="lazy" /> } @else { <span class="product-placeholder" aria-hidden="true">✦</span> }
                      <span class="product-copy"><strong>{{ product.name }}</strong>@if (product.description) { <small>{{ product.description }}</small> }</span>
                      <span class="product-card-price">{{ price(product.price_cents) }}</span>
                    </button>
                  }
                </div>
              }
            </section>
          </section>
        }
      </main>
    </app-sidebar>
  `,
  styles: [`
    :host { display:block; color:#29231f; }
    .pos-page { max-width:1800px; margin:0 auto; padding:1.1rem; }
    .left-panel-reopen { margin:0 0 .55rem; padding:.45rem .65rem; border:1px solid #dfd4ca; border-radius:.55rem; background:#fffdfa; color:#552622; font:inherit; font-size:.75rem; font-weight:750; cursor:pointer; }
    .pos-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .pos-kicker { color:#80644d; font-size:.65rem; font-weight:800; letter-spacing:.14em; }
    .pos-header h1 { margin:.2rem 0 0; font-size:1.45rem; }
    .pos-header-actions { display:flex; align-items:center; gap:.6rem; }
    .pos-link,.icon-action,.sale-modes button,.table-choice,.text-button,.category-button,.primary-button,.secondary-button,.method-pills button { font:inherit; }
    .pos-link { padding:.65rem .8rem; border:1px solid #dfd4ca; border-radius:.65rem; color:#552622; text-decoration:none; font-size:.82rem; font-weight:700; }
    .icon-action { width:42px; height:42px; border:1px solid #dfd4ca; border-radius:.65rem; background:#fffdfa; color:#552622; font-size:1.35rem; cursor:pointer; }
    .sale-modes { display:flex; gap:.4rem; margin-bottom:1rem; padding:.35rem; border:1px solid #e8ded3; border-radius:.8rem; background:#f8f3ed; }
    .sale-modes button { min-height:42px; padding:.5rem 1rem; border:0; border-radius:.55rem; background:transparent; color:#6f6258; font-size:.85rem; font-weight:750; cursor:pointer; }
    .sale-modes button.active { background:#5b2526; color:#fff8ee; box-shadow:0 3px 9px #34171920; }
    .pos-alert { margin:.6rem 0; padding:.75rem .9rem; border-radius:.6rem; font-size:.85rem; }
    .pos-alert.error { border:1px solid #f1b7b7; background:#fff3f2; color:#9c2626; }
    .pos-alert.success { border:1px solid #a7d9af; background:#eef8ef; color:#236c36; }
    .pos-workspace { display:grid; position:relative; transition:grid-template-columns .2s ease; grid-template-areas:'receipt categories products'; grid-template-columns:minmax(290px, 34%) minmax(160px, 15%) minmax(0,1fr); gap:.85rem; align-items:start; }
    .pos-workspace--quick-sale { grid-template-areas:'categories products receipt'; grid-template-columns:minmax(150px, 16%) minmax(0,1fr) minmax(320px, 32%); }
    .pos-workspace--quick-sale.pos-workspace--left-collapsed { grid-template-columns:minmax(0,0fr) minmax(0,1fr) minmax(320px,32%); }
    .pos-workspace:not(.pos-workspace--quick-sale).pos-workspace--left-collapsed { grid-template-columns:minmax(290px,34%) minmax(0,0fr) minmax(0,1fr); }
    .pos-workspace--left-collapsed .category-panel { min-width:0; padding-left:0; padding-right:0; border-left-width:0; border-right-width:0; opacity:0; overflow:hidden; transform:translateX(-1rem); pointer-events:none; }
    .panel { border:1px solid #e8ded3; border-radius:.85rem; background:#fffdfa; box-shadow:0 4px 16px #301d0e0a; }
    .receipt-panel { grid-area:receipt; position:sticky; top:.8rem; max-height:calc(100vh - 1.6rem); overflow:auto; padding:1rem; }
    .receipt-head { display:flex; align-items:flex-start; justify-content:space-between; gap:.5rem; padding-bottom:.75rem; border-bottom:1px solid #eee5dc; }
    .receipt-overline { color:#80644d; font-size:.63rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
    .receipt-head h2 { margin:.2rem 0 0; color:#552622; font-size:1.08rem; }
    .text-button { border:0; background:none; color:#7a3a31; font-size:.72rem; font-weight:700; cursor:pointer; }
    .customer-fields { display:grid; grid-template-columns:1fr 1fr; gap:.5rem; margin:.75rem 0; }
    .customer-fields label,.amount-field { display:grid; gap:.25rem; color:#74675d; font-size:.72rem; font-weight:700; }
    .customer-fields input,.amount-field input,.line-note,.order-note textarea { width:100%; min-width:0; min-height:38px; box-sizing:border-box; padding:.5rem .6rem; border:1px solid #e2d6cc; border-radius:.5rem; background:#fff; color:#2c2520; font:inherit; font-size:.8rem; }
    .sent-items,.payment-summary { margin:.8rem 0; padding-bottom:.75rem; border-bottom:1px solid #eee5dc; }
    .subsection-title,.sent-total,.summary-line,.draft-total,.change-line { display:flex; align-items:center; justify-content:space-between; gap:.6rem; }
    .subsection-title { margin-bottom:.45rem; color:#5d4c40; font-size:.78rem; }
    .subsection-title span { color:#8b7c70; font-size:.7rem; }
    .sent-line { display:flex; justify-content:space-between; gap:.5rem; padding:.32rem 0; font-size:.76rem; }
    .sent-line>span { min-width:0; }
    .sent-line small { display:block; margin:.15rem 0 0 1rem; color:#87796f; }
    .sent-total { margin-top:.5rem; color:#6d5d51; font-size:.75rem; }
    .sent-total strong { color:#382e27; }
    .summary-line { padding:.25rem 0; color:#74675d; font-size:.75rem; }
    .payment-history-line { display:flex; justify-content:space-between; gap:.5rem; padding:.18rem 0; color:#84766b; font-size:.68rem; }
    .summary-line strong { color:#392d26; }
    .summary-line.remaining { margin-top:.2rem; padding-top:.55rem; border-top:1px dashed #d9cbbf; color:#552622; font-weight:800; }
    .summary-line.remaining strong { color:#552622; font-size:1rem; }
    .draft-section { padding-top:.2rem; }
    .empty-cart { margin:.8rem 0; color:#8b7d72; font-size:.78rem; }
    .cart-lines { max-height:35vh; overflow:auto; }
    .cart-line { padding:.55rem 0; border-bottom:1px solid #f0e8e0; }
    .cart-line-title,.cart-line-bottom { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
    .cart-line-title strong { font-size:.78rem; }
    .remove-line { width:26px; height:26px; border:0; border-radius:50%; background:#f8ece8; color:#9e3c32; font-size:1.1rem; cursor:pointer; }
    .cart-line-bottom { margin:.3rem 0; font-size:.76rem; }
    .qty-control { display:inline-flex; align-items:center; gap:.45rem; }
    .qty-control button { width:30px; height:30px; border:1px solid #e2d6cc; border-radius:.45rem; background:#fff; color:#552622; font-size:1rem; font-weight:700; cursor:pointer; }
    .line-note { min-height:32px; padding:.38rem .5rem; font-size:.72rem; }
    .customization-field { display:grid; gap:.3rem; margin:.45rem 0; color:#74675d; font-size:.7rem; font-weight:700; }
    .customization-field>b { color:#a8322e; }
    .customization-field select,.customization-field>input { box-sizing:border-box; width:100%; min-height:34px; padding:.4rem .5rem; border:1px solid #e2d6cc; border-radius:.45rem; background:#fff; color:#2c2520; font:inherit; }
    .customization-options { display:flex; flex-wrap:wrap; gap:.35rem .7rem; }
    .customization-options label { display:inline-flex; align-items:center; gap:.25rem; }
    .order-note { display:grid; gap:.3rem; margin:.7rem 0; color:#74675d; font-size:.7rem; font-weight:700; }
    .order-note textarea { min-height:55px; resize:vertical; }
    .draft-total { margin:.65rem 0; padding-top:.6rem; border-top:1px solid #eadfd5; font-size:.82rem; font-weight:700; }
    .draft-total strong { color:#552622; font-size:1rem; }
    .primary-button,.secondary-button { display:block; width:100%; min-height:44px; padding:.6rem .8rem; border:0; border-radius:.58rem; font-size:.8rem; font-weight:800; cursor:pointer; }
    .primary-button { background:#5b2526; color:#fff9f0; }
    .primary-button:disabled { opacity:.5; cursor:not-allowed; }
    .secondary-button { border:1px solid #d9c8b9; background:#fffdfa; color:#552622; }
    .collect-payment { margin-top:.9rem; padding-top:.8rem; border-top:1px solid #eadfd5; }
    .collect-payment h3 { margin:0 0 .55rem; font-size:.86rem; }
    .method-pills { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.3rem; margin-bottom:.6rem; }
    .method-pills button { min-height:38px; padding:.25rem; border:1px solid #e4d7cb; border-radius:.48rem; background:#fff; color:#685b51; font-size:.66rem; font-weight:800; cursor:pointer; }
    .method-pills button.active { border-color:#6a302e; background:#f7ece6; color:#552622; }
    .amount-field input { margin-top:.1rem; }
    .change-line { margin:.45rem 0; color:#6d5d51; font-size:.72rem; }
    .change-line strong { color:#552622; }
    .pay-button { margin-top:.55rem; }
    .payment-hint { margin:.45rem 0 0; color:#897c72; font-size:.62rem; line-height:1.4; }
    .completed-payments { margin-top:1rem; padding-top:.75rem; border-top:1px solid #eadfd5; }
    .completed-payment-row { display:flex; justify-content:space-between; gap:.55rem; padding:.45rem 0; border-bottom:1px solid #f0e8e0; color:#5d5046; font-size:.68rem; }
    .completed-payment-row span { min-width:0; }
    .completed-payment-row span strong { color:#552622; }
    .completed-payment-row small { display:block; margin-top:.15rem; color:#897b70; font-size:.62rem; }
    .completed-payment-row>b { flex:none; color:#392d26; }
    .empty-payments { color:#897b70; font-size:.68rem; }
    .paid-summary { display:grid; gap:.6rem; margin-top:.8rem; padding:.75rem; border:1px solid #acd8b0; border-radius:.6rem; background:#f0f9ef; color:#236c36; font-size:.76rem; }
    .category-panel { grid-area:categories; position:sticky; top:.8rem; max-height:calc(100vh - 1.6rem); overflow:auto; padding:.75rem; transition:transform .2s ease, opacity .2s ease, padding .2s ease; }
    .left-panel-heading { display:flex; align-items:center; justify-content:space-between; gap:.4rem; }
    .left-panel-heading h2 { margin:.1rem .2rem .6rem; color:#55453a; font-size:.76rem; }
    .left-panel-close { flex:none; width:28px; height:28px; margin-bottom:.4rem; border:1px solid #eadfd5; border-radius:.45rem; background:#fffdfa; color:#552622; font-size:1.2rem; line-height:1; cursor:pointer; }
    .category-list { min-width:0; }
    .left-panel-close:hover,.left-panel-reopen:hover { border-color:#c69a78; background:#f7ece6; }
    .category-button { display:flex; width:100%; align-items:center; justify-content:space-between; gap:.4rem; margin:.2rem 0; padding:.65rem .55rem; border:1px solid transparent; border-radius:.55rem; background:transparent; color:#5d5046; text-align:left; font-size:.74rem; font-weight:700; cursor:pointer; }
    .category-button small { flex:0 0 auto; color:#998a7f; font-size:.65rem; }
    .category-button.active { border-color:#e5cfc0; background:#f7ece6; color:#592626; }
    .subcategory-chips { display:flex; flex:0 0 auto; flex-wrap:wrap; gap:.35rem; margin:.55rem 0 .75rem; padding:.65rem 0; border-top:1px solid #f0e6dd; border-bottom:1px solid #f0e6dd; }
    .subcategory-chip { display:inline-flex; align-items:center; gap:.35rem; max-width:100%; padding:.42rem .72rem; border:1px solid #e8d9ce; border-radius:999px; background:#fffdfa; color:#67584e; font:inherit; font-size:.68rem; font-weight:700; white-space:nowrap; cursor:pointer; }
    .subcategory-chip small { color:#a28f81; font-size:.6rem; }
    .subcategory-chip.active { border-color:#6b3029; background:#6b3029; color:#fff; }
    .subcategory-chip.active small { color:#f4deda; }
    .product-panel { grid-area:products; min-width:0; }
    .product-toolbar { display:flex; align-items:end; justify-content:space-between; gap:.8rem; margin:0 0 .75rem; }
    .product-toolbar h2 { margin:0; color:#552622; font-size:1rem; }
    .product-toolbar p { margin:.2rem 0 0; color:#897b70; font-size:.72rem; }
    .product-search { display:grid; gap:.25rem; width:min(280px,45%); color:#74675d; font-size:.65rem; font-weight:700; }
    .product-search input { width:100%; min-height:40px; box-sizing:border-box; padding:.5rem .65rem; border:1px solid #e2d6cc; border-radius:.55rem; background:#fffdfa; font:inherit; font-size:.78rem; }
    .product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(165px,1fr)); gap:.65rem; }
    .product-card { display:grid; grid-template-rows:92px 1fr auto; min-width:0; min-height:190px; padding:0; overflow:hidden; border:1px solid #e8ded3; border-radius:.75rem; background:#fffdfa; color:#342b25; text-align:left; box-shadow:0 3px 12px #301d0e0a; cursor:pointer; transition:transform .12s ease,border-color .12s ease; }
    .product-card:hover { transform:translateY(-2px); border-color:#c69a78; }
    .product-card:disabled { opacity:.5; cursor:not-allowed; }
    .product-card img,.product-placeholder { display:grid; width:100%; height:92px; object-fit:cover; background:#f0e8dd; }
    .product-placeholder { place-items:center; color:#9a7257; font-size:1.6rem; }
    .product-copy { display:grid; align-content:start; gap:.25rem; padding:.55rem .6rem .25rem; }
    .product-copy strong { overflow-wrap:anywhere; font-size:.77rem; line-height:1.25; }
    .product-copy small { display:-webkit-box; overflow:hidden; color:#81746a; font-size:.65rem; line-height:1.35; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
    .product-card-price { padding:.25rem .6rem .55rem; color:#6a302e; font-size:.78rem; font-weight:850; }
    .loading-products,.empty-products { padding:1.5rem; color:#81746a; text-align:center; font-size:.82rem; }
    .table-picker { padding:1rem; border:1px solid #e8ded3; border-radius:.85rem; background:#fffdfa; }
    .section-heading h2 { margin:0; color:#552622; font-size:1rem; }
    .section-heading p,.muted { color:#897b70; font-size:.78rem; }
    .table-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:.65rem; margin-top:.8rem; }
    .table-choice { display:grid; grid-template-columns:12px 1fr; align-items:center; gap:.15rem .45rem; min-height:80px; padding:.7rem; border:1px solid #ddd5b0; border-radius:.7rem; background:#f4f0b5; color:#332e25; text-align:left; cursor:pointer; }
    .table-choice.occupied { border-color:#8bc291; background:#c3e6c2; }
    .table-choice strong { font-size:.84rem; }
    .table-choice small { grid-column:2; color:#776c5e; font-size:.66rem; }
    .table-open-total { grid-column:2; color:#286a38; font-size:.8rem; font-weight:850; font-variant-numeric:tabular-nums; }
    .table-state-dot { width:9px; height:9px; border-radius:50%; background:#9c8c47; }
    .table-choice.occupied .table-state-dot { background:#328044; }
    @media (max-width:1150px) { .pos-workspace { grid-template-columns:minmax(280px,34%) minmax(145px,17%) minmax(0,1fr); gap:.6rem; } .pos-workspace--quick-sale { grid-template-columns:minmax(125px,17%) minmax(0,1fr) minmax(285px,34%); } .product-grid { grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); } }
    @media (max-width:900px) { .pos-workspace--quick-sale.pos-workspace--left-collapsed { grid-template-areas:'products' 'receipt'; grid-template-columns:minmax(0,1fr); } .pos-workspace:not(.pos-workspace--quick-sale).pos-workspace--left-collapsed { grid-template-areas:'products' 'receipt'; grid-template-columns:minmax(0,1fr); } .pos-workspace--left-collapsed .category-panel { display:none; } .pos-workspace { grid-template-areas:'receipt receipt' 'categories products'; grid-template-columns:minmax(0,1fr) minmax(145px,30%); } .pos-workspace--quick-sale { grid-template-areas:'categories products' 'receipt receipt'; grid-template-columns:minmax(130px,25%) minmax(0,1fr); } .receipt-panel { position:static; max-height:none; } .cart-lines { max-height:34vh; } .category-panel { position:static; max-height:420px; display:flex; flex-direction:column; flex-wrap:nowrap; } .category-list { display:flex; flex-wrap:wrap; gap:.2rem; } }
    @media (max-width:620px) { .pos-page { padding:.7rem; } .pos-header h1 { font-size:1.2rem; } .pos-kicker { font-size:.55rem; } .pos-link { padding:.55rem; font-size:.7rem; } .sale-modes button { flex:1; min-width:0; padding:.45rem .25rem; font-size:.7rem; } .pos-workspace,.pos-workspace--quick-sale { grid-template-areas:'categories' 'products' 'receipt'; grid-template-columns:1fr; } .receipt-panel,.category-panel,.product-panel { grid-column:1; grid-row:auto; } .receipt-panel { padding:.8rem; } .category-panel { max-height:300px; display:flex; flex-direction:column; flex-wrap:nowrap; align-content:stretch; gap:.2rem; } .category-list { display:flex; flex-wrap:wrap; gap:.2rem; } .left-panel-heading { flex:0 0 auto; } .category-button { width:auto; max-width:100%; padding:.5rem; border:1px solid #eee2d7; font-size:.68rem; } .product-toolbar { align-items:stretch; flex-direction:column; } .product-search { width:100%; } .product-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:.45rem; } .product-card { grid-template-rows:82px 1fr auto; min-height:174px; } .product-card img,.product-placeholder { height:82px; } .customer-fields { grid-template-columns:1fr; } .method-pills button { font-size:.62rem; } }
    @media (max-width:360px) { .product-grid { grid-template-columns:1fr; } .pos-header { align-items:flex-start; } }
    @media print { :host { color:#000; } .pos-header,.sale-modes,.category-panel,.product-panel,.pos-header-actions,.collect-payment,.primary-button,.secondary-button,.text-button { display:none !important; } .pos-page { max-width:none; padding:0; } .pos-workspace { display:block; } .receipt-panel { position:static; max-height:none; overflow:visible; border:0; box-shadow:none; } .paid-summary { border:0; background:#fff; color:#000; } }
  `],
})
export class StaffPosComponent {
  private readonly api = inject(ApiService);

  readonly mode = signal<SaleMode>('quick_sale');
  readonly tables = signal<Table[]>([]);
  readonly tableOrders = signal<Order[]>([]);
  readonly tablesLoading = signal(true);
  readonly openingTable = signal(false);
  readonly selectedTable = signal<Table | null>(null);
  readonly staffAccess = signal('');
  readonly tableToken = signal('');
  readonly currentOrder = signal<CurrentTableOrder | null>(null);
  readonly payableOrder = signal<PayableOrder | null>(null);
  readonly menuLoading = signal(false);
  readonly categories = signal<PosCategory[]>([]);
  readonly visibleCategories = computed(() => {
    const categories = this.categories();
    if (this.mode() !== 'quick_sale') return categories;

    const order = ['kahvalti', 'kebaplar-ve-izgaralar', 'gunun-corbalari', 'ev-yemekleri', 'icecekler', 'tatlilar'];
    const hidden = new Set(['et-yemekleri', 'tavuk-yemekleri', 'yan-urunler']);
    return categories
      .filter((category) => !hidden.has(beratzadeMenuCategorySlug(category.id)))
      .map((category, index) => ({ category, index, slug: beratzadeMenuCategorySlug(category.id) }))
      .sort((left, right) => {
        const leftRank = order.indexOf(left.slug);
        const rightRank = order.indexOf(right.slug);
        return (leftRank < 0 ? order.length : leftRank) - (rightRank < 0 ? order.length : rightRank) || left.index - right.index;
      })
      .map(({ category, slug }) => ({
        ...category,
        name: slug === 'kebaplar-ve-izgaralar' ? 'Kebap & Izgara' : beratzadeMenuCategoryLabel(category.name),
      }));
  });
  readonly selectedCategory = signal('all');
  readonly selectedSubcategory = signal('all');
  readonly selectedCategoryObject = computed(() => this.visibleCategories().find((category) => category.id === this.selectedCategory()) ?? null);
  readonly cart = signal<CartLine[]>([]);
  readonly searchText = signal('');
  readonly submitting = signal(false);
  readonly currentOrderLoading = signal(false);
  readonly processingPayment = signal(false);
  readonly paymentOptionsOpen = signal(false);
  readonly completedPayments = signal<CompletedPaymentEntry[]>([]);
  readonly leftPanelCollapsed = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly currency = signal('TRY');
  orderNotesValue = '';
  customerName = '';
  customerPhone = '';
  paymentMethod: PaymentMethod = 'cash';
  paymentAmount = '0.00';
  cashReceived = '0.00';
  private paymentKeyFingerprint = '';
  private paymentKey = '';
  private collectAfterOrderLoad = false;

  readonly cartCount = computed(() => this.cart().reduce((sum, line) => sum + line.quantity, 0));
  readonly draftTotal = computed(() => this.cart().reduce((sum, line) => sum + line.product.price_cents * line.quantity, 0));
  readonly allProductCount = computed(() => this.categories().reduce((sum, category) => sum + this.categoryProductCount(category), 0));
  categoryProductCount(category: PosCategory): number {
    return category.products.length + category.subcategories.reduce((count, subcategory) => count + subcategory.products.length, 0);
  }
  readonly visibleProducts = computed(() => {
    const selected = this.selectedCategory();
    const activeCategory = this.selectedCategoryObject();
    const subcategoryId = this.selectedSubcategory();
    const products = selected === 'all'
      ? this.categories().flatMap((category) => [...category.products, ...category.subcategories.flatMap((subcategory) => subcategory.products)])
      : subcategoryId !== 'all' && activeCategory
        ? activeCategory.subcategories.find((subcategory) => subcategory.id === subcategoryId)?.products ?? []
        : [...(activeCategory?.products ?? []), ...(activeCategory?.subcategories.flatMap((subcategory) => subcategory.products) ?? [])];
    const query = this.normalize(this.searchText());
    return products.filter((product) =>
      product.available &&
      (!query || this.normalize(`${product.name} ${product.description ?? ''} ${product.subcategory ?? ''}`).includes(query)),
    );
  });
  readonly selectedCategoryName = computed(() => {
    if (this.selectedCategory() === 'all') return 'Tüm ürünler';
    const category = this.selectedCategoryObject();
    if (!category) return 'Ürünler';
    return category.subcategories.find((subcategory) => subcategory.id === this.selectedSubcategory())?.name ?? category.name;
  });

  constructor() {
    this.api.getTables().subscribe({
      next: (tables) => {
        this.tables.set([...tables].sort((a, b) => a.name.localeCompare(b.name, 'tr')));
        this.tablesLoading.set(false);
      },
      error: () => {
        this.tables.set([]);
        this.tablesLoading.set(false);
      },
    });
    this.loadMenu();
    this.loadCompletedPayments();
  }

  tableOpenTotalLabel(table: Table): string | null {
    if (!table.is_active || table.id == null || table.active_order_id == null) return null;
    const order = this.tableOrders().find(
      item => item.id === table.active_order_id && item.table_id === table.id,
    );
    if (!order || order.paid_at || order.status === 'paid' || order.status === 'cancelled') return null;
    const cents = order.amount_remaining_cents ?? order.amount_due_cents ?? order.total_cents;
    return cents > 0 ? this.price(cents) : null;
  }

  modeLabel(): string {
    return this.mode() === 'table' ? 'Masada satış' : this.mode() === 'takeaway' ? 'Gel-al' : 'Hızlı satış';
  }

  setMode(mode: SaleMode): void {
    if (this.submitting() || this.processingPayment()) return;
    if (this.cart().length > 0) {
      this.error.set('Önce taslağı kaydet veya taslaktaki ürünleri kaldır.');
      return;
    }
    this.mode.set(mode);
    this.selectedSubcategory.set('all');
    this.error.set('');
    this.success.set('');
    this.selectedTable.set(null);
    this.currentOrder.set(null);
    this.payableOrder.set(null);
    this.staffAccess.set('');
    this.tableToken.set('');
    this.orderNotesValue = '';
    this.customerName = '';
    this.customerPhone = '';
    this.paymentOptionsOpen.set(false);
    this.collectAfterOrderLoad = false;
    this.collectAfterOrderLoad = false;
    this.loadMenu();
  }

  selectCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
    this.selectedSubcategory.set('all');
  }

  selectSubcategory(subcategoryId: string): void {
    this.selectedSubcategory.set(subcategoryId);
  }

  openPaymentOptions(): void {
    if (!this.cart().length || this.submitting() || this.processingPayment()) return;
    this.error.set('');
    this.paymentOptionsOpen.set(true);
  }

  checkoutQuickSale(method: PaymentMethod): void {
    if (this.mode() !== 'quick_sale' || !this.paymentOptionsOpen() || this.submitting() || this.processingPayment()) return;
    this.setPaymentMethod(method);
    if (this.payableOrder()) {
      this.collectPayment();
      return;
    }
    this.collectAfterOrderLoad = true;
    this.submitOrder();
  }

  refresh(): void {
    this.error.set('');
    this.tablesLoading.set(true);
    this.api.getTables().subscribe({
      next: (tables) => {
        this.tables.set([...tables].sort((a, b) => a.name.localeCompare(b.name, 'tr')));
        this.tablesLoading.set(false);
      },
      error: (err) => {
        this.tablesLoading.set(false);
        this.error.set(err.error?.detail || 'Masalar yenilenemedi.');
      },
    });
    this.loadMenu();
    this.loadCompletedPayments();
    const order = this.payableOrder();
    if (order) this.loadOrderRecord(order.id);
  }

  openTable(table: Table): void {
    if (table.id == null || this.openingTable()) return;
    this.error.set('');
    this.openingTable.set(true);
    const continueOpen = () => this.api.getStaffMenuToken(table.id!).subscribe({
      next: (access) => {
        this.staffAccess.set(access.token);
        this.tableToken.set(access.table_token);
        this.selectedTable.set({ ...table, is_active: true });
        this.tables.update((current) => current.map((row) => row.id === table.id ? { ...row, is_active: true } : row));
        this.openingTable.set(false);
        this.refreshTableOrder();
      },
      error: (err) => {
        this.openingTable.set(false);
        this.error.set(err.error?.detail || 'Masa bağlantısı açılamadı.');
      },
    });
    if (table.is_active) {
      continueOpen();
      return;
    }
    this.api.activateTable(table.id).subscribe({
      next: () => continueOpen(),
      error: (err) => {
        this.openingTable.set(false);
        this.error.set(err.error?.detail || 'Masa açılamadı.');
      },
    });
  }

  changeTable(): void {
    if (this.cart().length > 0 || this.submitting()) {
      this.error.set('Masa değiştirmeden önce taslağı gönder veya ürünleri kaldır.');
      return;
    }
    this.selectedTable.set(null);
    this.currentOrder.set(null);
    this.payableOrder.set(null);
    this.tableToken.set('');
    this.staffAccess.set('');
    this.orderNotesValue = '';
  }

  addProduct(product: StaffPosMenuProduct): void {
    if (!product.available || this.payableOrder()?.amountRemaining === 0) return;
    if (this.mode() === 'table' && !this.selectedTable()) {
      this.error.set('Önce masa seç.');
      return;
    }
    this.error.set('');
    this.success.set('');
    this.cart.update((lines) => {
      const existing = lines.find((line) => this.lineKey(line.product) === this.lineKey(product));
      return existing
        ? lines.map((line) => this.lineKey(line.product) === this.lineKey(product) ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line)
        : [...lines, { product, quantity: 1, notes: '', answers: {} }];
    });
  }

  changeQuantity(product: StaffPosMenuProduct, delta: number): void {
    this.cart.update((lines) => lines
      .map((line) => this.lineKey(line.product) === this.lineKey(product) ? { ...line, quantity: Math.max(0, Math.min(99, line.quantity + delta)) } : line)
      .filter((line) => line.quantity > 0));
  }

  removeLine(product: StaffPosMenuProduct): void {
    this.cart.update((lines) => lines.filter((line) => this.lineKey(line.product) !== this.lineKey(product)));
  }

  setLineNote(product: StaffPosMenuProduct, notes: string): void {
    this.cart.update((lines) => lines.map((line) => this.lineKey(line.product) === this.lineKey(product) ? { ...line, notes } : line));
  }

  questionOptions(question: ProductQuestion): string[] {
    if (Array.isArray(question.options)) return question.options.map(String);
    if (question.options && 'choices' in question.options) return question.options.choices.map(String);
    return [];
  }

  scaleBounds(question: ProductQuestion): { min: number; max: number } {
    const options = question.options;
    return options && !Array.isArray(options) && 'min' in options
      ? { min: Number(options.min), max: Number(options.max) }
      : { min: 1, max: 10 };
  }

  hasAnswer(line: CartLine, question: ProductQuestion, option: string): boolean {
    const value = line.answers[question.id];
    return Array.isArray(value) && value.includes(option);
  }

  setAnswer(product: StaffPosMenuProduct, question: ProductQuestion, value: unknown): void {
    this.cart.update((lines) => lines.map((line) => {
      if (this.lineKey(line.product) !== this.lineKey(product)) return line;
      const answers = { ...line.answers };
      if (value === '' || value == null) delete answers[question.id];
      else answers[question.id] = question.type === 'scale' ? Number(value) : String(value);
      return { ...line, answers };
    }));
  }

  toggleAnswer(product: StaffPosMenuProduct, question: ProductQuestion, option: string, checked: boolean): void {
    this.cart.update((lines) => lines.map((line) => {
      if (this.lineKey(line.product) !== this.lineKey(product)) return line;
      const answers = { ...line.answers };
      const previous = answers[question.id];
      const selected = Array.isArray(previous) ? [...previous] as string[] : [];
      const next = checked ? [...new Set([...selected, option])] : selected.filter((item) => item !== option);
      if (next.length) answers[question.id] = next;
      else delete answers[question.id];
      return { ...line, answers };
    }));
  }

  private hasRequiredAnswer(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== undefined && value !== null && value !== '';
  }

  submitOrder(): void {
    const lines = this.cart();
    if (!lines.length || this.submitting()) return;
    const missing = lines.find((line) => (line.product.questions ?? []).some((question) =>
      question.required && !this.hasRequiredAnswer(line.answers[question.id]),
    ));
    if (missing) {
      this.collectAfterOrderLoad = false;
      this.error.set(`“${missing.product.name}” için zorunlu ürün seçeneğini tamamla.`);
      return;
    }
    this.error.set('');
    this.success.set('');
    this.submitting.set(true);
    const items = lines.map((line) => {
      const answers = Object.fromEntries(
        Object.entries(line.answers).filter((entry): entry is [string, string | number | string[]] => entry[1] !== undefined),
      );
      return {
        product_id: line.product.id,
        source: line.product.source,
        quantity: line.quantity,
        notes: line.notes.trim() || undefined,
        customization_answers: Object.keys(answers).length ? answers : undefined,
      };
    });
    if (this.mode() === 'table') {
      const access = this.staffAccess();
      const token = this.tableToken();
      if (!access || !token) {
        this.submitting.set(false);
        this.error.set('Masa personel bağlantısı kurulmadı. Masayı yeniden aç.');
        return;
      }
      this.api.submitOrder(token, {
        items,
        notes: this.orderNotesValue.trim() || undefined,
        staff_access: access,
      }).subscribe({
        next: (response) => {
          this.cart.set([]);
          this.orderNotesValue = '';
          this.success.set(`Sipariş #${response.order_id} mutfağa gönderildi.`);
          this.submitting.set(false);
          this.refreshTableOrder();
          this.loadOrderRecord(response.order_id);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err.error?.detail || 'Sipariş kaydedilemedi; taslak korunuyor.');
        },
      });
      return;
    }
    const saleKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
    this.api.createStaffSale({
      idempotency_key: saleKey,
      sale_type: this.mode() === 'takeaway' ? 'takeaway' : 'quick_sale',
      items,
      customer_name: this.customerName.trim() || null,
      customer_phone: this.customerPhone.trim() || null,
      notes: this.orderNotesValue.trim() || null,
    }).subscribe({
      next: (response) => {
        this.cart.set([]);
        this.orderNotesValue = '';
        this.success.set(`Sipariş #${response.id} kaydedildi ve operasyon ekranına iletildi.`);
        this.submitting.set(false);
        const collectAfterLoad = this.collectAfterOrderLoad;
        this.collectAfterOrderLoad = false;
        this.loadOrderRecord(response.id, response.total_cents, collectAfterLoad ? () => this.collectPayment() : undefined);
      },
      error: (err) => {
        this.collectAfterOrderLoad = false;
        this.submitting.set(false);
        this.error.set(err.error?.detail || 'Sipariş kaydedilemedi; taslak korunuyor.');
      },
    });
  }

  setPaymentMethod(method: PaymentMethod): void {
    this.paymentMethod = method;
    this.resetPaymentKey();
    const remaining = this.payableOrder()?.amountRemaining ?? 0;
    this.paymentAmount = (remaining / 100).toFixed(2);
    if (method === 'cash') this.cashReceived = (remaining / 100).toFixed(2);
  }

  setCashReceived(value: string): void {
    this.cashReceived = value;
    const received = this.parseMoney(value);
    const remaining = this.payableOrder()?.amountRemaining ?? 0;
    this.paymentAmount = (Math.min(received, remaining) / 100).toFixed(2);
    this.resetPaymentKey();
  }

  setPaymentAmount(value: string): void {
    this.paymentAmount = value;
    this.resetPaymentKey();
  }

  paymentAmountCents(): number {
    return this.parseMoney(this.paymentAmount);
  }

  cashChange(): number {
    return Math.max(0, this.parseMoney(this.cashReceived) - this.paymentAmountCents());
  }

  collectPayment(): void {
    const order = this.payableOrder();
    const amount = this.paymentAmountCents();
    if (!order || amount < 1 || amount > order.amountRemaining || this.processingPayment()) return;
    this.processingPayment.set(true);
    this.error.set('');
    this.api.recordOrderPayment(order.id, {
      amount_cents: amount,
      payment_method: this.paymentMethod,
      idempotency_key: this.currentPaymentKey(order.id, amount),
    }).subscribe({
      next: (response) => {
        this.processingPayment.set(false);
        this.paymentKey = '';
        this.paymentKeyFingerprint = '';
        this.payableOrder.update((current) => current ? {
          ...current,
          amountDue: response.amount_due_cents,
          amountPaid: response.amount_paid_cents,
          amountRemaining: response.amount_remaining_cents,
          payments: response.payments.filter((payment) => !payment.voided_at),
        } : current);
        this.loadCompletedPayments();
        const saleIsSettled = response.amount_remaining_cents === 0 || response.status === 'paid';
        if (saleIsSettled && this.mode() === 'quick_sale') {
          this.success.set(`Satış #${order.id} tamamlandı. Yeni satışa başlayabilirsiniz.`);
          this.paymentAmount = '0.00';
          this.cashReceived = '0.00';
          this.cart.set([]);
          this.orderNotesValue = '';
          this.paymentOptionsOpen.set(false);
          this.payableOrder.set(null);
          this.currentOrder.set(null);
          this.collectAfterOrderLoad = false;
          return;
        }
        if (saleIsSettled) {
          this.success.set(`Sipariş #${order.id} tamamen ödendi. Masa boşaltıldı.`);
          this.paymentAmount = '0.00';
          this.cashReceived = '0.00';
        } else {
          this.success.set(`Tahsilat kaydedildi. Kalan tutar ${this.price(response.amount_remaining_cents)}.`);
          this.paymentAmount = (response.amount_remaining_cents / 100).toFixed(2);
          if (this.paymentMethod === 'cash') this.cashReceived = this.paymentAmount;
        }
        this.loadOrderRecord(order.id);
        this.api.getTables().subscribe({ next: (tables) => this.tables.set([...tables].sort((a, b) => a.name.localeCompare(b.name, 'tr'))) });
      },
      error: (err) => {
        this.processingPayment.set(false);
        this.error.set(err.error?.detail || 'Tahsilat kaydedilemedi. Masa açık kaldı; aynı işlemi güvenle yeniden deneyebilirsin.');
      },
    });
  }

  printReceipt(): void {
    window.print();
  }

  price(cents: number): string {
    try { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: this.currency() }).format(cents / 100); }
    catch { return `₺${(cents / 100).toFixed(2)}`; }
  }

  paymentMethodLabel(method: string): string {
    return method === 'cash' ? 'Nakit' : method === 'terminal' ? 'POS' : method === 'meal_card' ? 'Yemek kart?' : method;
  }

  trackProduct(product: StaffPosMenuProduct): string {
    return this.lineKey(product);
  }

  lineKey(product: StaffPosMenuProduct): string {
    return `${product.source}:${product.id}`;
  }

  private loadMenu(): void {
    const mode = this.mode();
    this.menuLoading.set(true);
    this.api.getStaffPosMenu(mode).subscribe({
      next: (menu) => {
        this.currency.set(menu.currency || 'TRY');
        const categories = (menu.category_tree ?? []).map((category) => ({
          id: category.id,
          name: category.name,
          subcategories: (category.subcategories ?? []).map((subcategory) => ({
            id: subcategory.id,
            name: subcategory.name,
            products: subcategory.products,
          })),
          products: [
            ...category.products,
            ...(category.subcategories ?? []).flatMap((subcategory) => subcategory.products),
          ],
        }));
        this.categories.set(categories.filter((category) => category.products.length > 0));
        if (this.selectedCategory() !== 'all' && !this.categories().some((category) => category.id === this.selectedCategory())) {
          this.selectedCategory.set('all');
        }
        this.menuLoading.set(false);
      },
      error: (err) => {
        this.menuLoading.set(false);
        this.error.set(err.error?.detail || 'Satılabilir ürünler yüklenemedi.');
      },
    });
  }

  private refreshTableOrder(): void {
    const token = this.tableToken();
    if (!token) return;
    this.currentOrderLoading.set(true);
    this.api.getCurrentOrder(token).subscribe({
      next: (response) => {
        this.currentOrder.set(response.order);
        this.currentOrderLoading.set(false);
        if (response.order) this.loadOrderRecord(response.order.id);
      },
      error: (err) => {
        this.currentOrderLoading.set(false);
        this.error.set(err.error?.detail || 'Masanın açık hesabı yüklenemedi.');
      },
    });
  }

  private loadOrderRecord(orderId: number, fallbackDue?: number, afterLoad?: () => void): void {
    this.api.getOrders().subscribe({
      next: (orders: Order[]) => {
        this.tableOrders.set(orders);
        this.setCompletedPayments(orders);
        const order = orders.find((item) => item.id === orderId);
        if (!order) {
          if (fallbackDue != null) {
            this.payableOrder.set({ id: orderId, tableName: this.selectedTable()?.name || this.modeLabel(), amountDue: fallbackDue, amountPaid: 0, amountRemaining: fallbackDue, items: [], payments: [] });
            afterLoad?.();
          }
          return;
        }
        this.payableOrder.set({
          id: order.id,
          tableName: order.table_name || this.modeLabel(),
          amountDue: order.amount_due_cents ?? order.total_cents,
          amountPaid: order.amount_paid_cents ?? 0,
          amountRemaining: order.amount_remaining_cents ?? order.total_cents,
          items: (order.items ?? []).map((item) => ({ product_name: item.product_name, quantity: item.quantity, price_cents: item.price_cents, notes: item.notes })),
          payments: (order.payments ?? []).filter((payment) => !payment.voided_at),
        });
        const remaining = order.amount_remaining_cents ?? order.total_cents;
        this.paymentAmount = (remaining / 100).toFixed(2);
        if (this.paymentMethod === 'cash') this.cashReceived = this.paymentAmount;
        afterLoad?.();
      },
      error: () => {
        if (fallbackDue != null) {
          this.payableOrder.set({ id: orderId, tableName: this.selectedTable()?.name || this.modeLabel(), amountDue: fallbackDue, amountPaid: 0, amountRemaining: fallbackDue, items: [], payments: [] });
          afterLoad?.();
        }
      },
    });
  }

  private loadCompletedPayments(): void {
    this.api.getOrders().subscribe({ next: (orders) => {
      this.tableOrders.set(orders);
      this.setCompletedPayments(orders);
    } });
  }

  private setCompletedPayments(orders: Order[]): void {
    const entries = orders.flatMap((order) => (order.payments ?? [])
      .filter((payment) => !payment.voided_at)
      .map((payment) => ({
        id: payment.id,
        orderId: order.id,
        tableName: order.table_name,
        paymentMethod: payment.payment_method,
        amountCents: payment.amount_cents,
        paidAt: payment.paid_at ?? null,
      } satisfies CompletedPaymentEntry))
    );
    entries.sort((left, right) => (right.paidAt ?? '').localeCompare(left.paidAt ?? ''));
    this.completedPayments.set(entries.slice(0, 20));
  }

  private currentPaymentKey(orderId: number, amount: number): string {
    const fingerprint = `${orderId}:${amount}:${this.paymentMethod}`;
    if (fingerprint !== this.paymentKeyFingerprint || !this.paymentKey) {
      this.paymentKeyFingerprint = fingerprint;
      this.paymentKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
    }
    return this.paymentKey;
  }

  private resetPaymentKey(): void {
    this.paymentKeyFingerprint = '';
    this.paymentKey = '';
  }

  private parseMoney(value: string): number {
    let normalized = (value || '').trim().replace(/\s/g, '');
    if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
    const amount = Number.parseFloat(normalized);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
  }



  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  }
}
