import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
  DestroyRef,
  afterNextRender,
  HostListener,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, Meta, SafeResourceUrl, SafeStyle, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiService,
  PublicTenantMenuCategory,
  PublicTenantMenuProduct,
  PublicTenantMenuResponse,
  TenantSummary,
} from '../services/api.service';
import { PublicGuestHeaderComponent } from '../shared/public-guest-header.component';
import { LanguagePickerComponent } from '../shared/language-picker.component';
import { resolvePublicPrimaryColor } from '../shared/public-brand-colors';
import {
  beratzadeMenuCategoryLabel,
  beratzadeMenuCategorySlug,
  orderBeratzadeMenuCategories,
  orderBeratzadeSubcategories,
} from '../shared/public-menu-categories';
import { publicMenuCategorySlug, publicMenuTenantRef } from '../shared/public-menu-path';
import { isBeratzadeMenuTenant } from '../shared/beratzade-menu';
import { publicBookRouterLink } from '../shared/public-book-path';
import { LanguageService } from '../services/language.service';
import { LegalLinksComponent } from '../shared/legal-links.component';
import { formatMoneyCents } from '../shared/currency-symbol';
import {
  BERATZADE_MENU_SECTIONS,
  BeratzadeMenuGroup,
  BeratzadeMenuSection,
  beratzadeProductMatchesGroup,
  categoryProducts,
  matchesMenuSearch,
  menuProducts,
  publicImageUrl,
  publicProductKey,
} from './public-menu-presentation';

@Component({
  selector: 'app-public-menu',
  standalone: true,
  imports: [RouterLink, TranslateModule, PublicGuestHeaderComponent, LanguagePickerComponent, LegalLinksComponent],
  templateUrl: './public-menu.component.html',
  styleUrls: ['../book/book.component.scss', './public-menu.component.scss'],
})
export class PublicMenuComponent implements OnInit, OnDestroy {
  readonly resolvePublicPrimaryColor = resolvePublicPrimaryColor;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private language = inject(LanguageService);
  private sanitizer = inject(DomSanitizer);
  private title = inject(Title);
  private meta = inject(Meta);
  private destroyRef = inject(DestroyRef);

  tenantId = signal(0);
  tenant = signal<TenantSummary | null>(null);
  menu = signal<PublicTenantMenuResponse | null>(null);
  logoUrl = signal<string | null>(null);
  loading = signal(true);
  menuLoading = signal(false);
  searchTerm = signal('');
  categorySlug = signal('');
  subcategorySlug = signal('');
  menuSectionSlug = signal('');
  menuGroupSlug = signal('');
  activeCategoryId = signal('');
  selectedProduct = signal<PublicTenantMenuProduct | null>(null);
  failedImageIds = signal<Set<string>>(new Set());
  productUnavailable = signal(false);
  readonly refreshFailed = signal(false);
  readonly totalProducts = computed(() => menuProducts(this.menuCategories()).length);
  readonly beratzadeSections = BERATZADE_MENU_SECTIONS;
  readonly activeBeratzadeSection = computed(() =>
    this.beratzadeSections.find(section => section.id === this.menuSectionSlug()) ?? null,
  );
  readonly activeBeratzadeGroup = computed(() =>
    this.activeBeratzadeSection()?.groups.find(group => group.id === this.menuGroupSlug()) ?? null,
  );
  readonly isBeratzadeLanding = computed(() =>
    this.isBeratzadeMenuOnly() && !this.activeBeratzadeSection() && !this.isCategoryRoute(),
  );
  readonly isBeratzadeSectionLanding = computed(() =>
    this.isBeratzadeMenuOnly() && !!this.activeBeratzadeSection() && !this.activeBeratzadeGroup(),
  );
  readonly isBeratzadeGroupView = computed(() =>
    this.isBeratzadeMenuOnly() && !!this.activeBeratzadeSection() && !!this.activeBeratzadeGroup(),
  );
  readonly resultCount = computed(() => this.visibleCategories().reduce((count, category) => count + category.products.length, 0));
  private menuRequestVersion = 0;
  private productQuery = '';
  private productTrigger: HTMLElement | null = null;
  private previousBodyOverflow = '';
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  errorKind = signal<'invalid_tenant' | 'tenant_not_found' | 'menu_load_failed' | null>(null);
  /** Category ids collapsed by user toggle (default: all expanded). */
  private collapsedCategoryIds = signal<Set<string>>(new Set());

  googleMapsUrl = computed(() => this.tenant()?.public_google_maps_url?.trim() || null);
  openstreetmapUrl = computed(() => this.tenant()?.public_openstreetmap_url?.trim() || null);
  hasAnyProducts = computed(() => this.menuCategories().some((category) => categoryProducts(category).length > 0));
  hasSearchResults = computed(() => this.visibleCategories().length > 0);
  activeCategory = computed(() => {
    const slug = this.categorySlug();
    const categories = this.isBeratzadeMenuOnly() ? this.orderedCategories() : this.categories();
    return slug
      ? categories.find((category) => this.categoryRouteSlug(category.id) === slug) ?? null
      : null;
  });
  activeSubcategory = computed(() => {
    const slug = this.subcategorySlug();
    return slug
      ? this.activeCategory()?.subcategories?.find((subcategory) => this.categoryRouteSlug(subcategory.id) === slug) ?? null
      : null;
  });
  isCategoryRoute = computed(() => Boolean(this.categorySlug()));
  isBeratzadeMenuOnly = computed(() => {
    const tenant = this.tenant();
    if (!tenant) return false;
    return isBeratzadeMenuTenant(tenant.name, tenant.public_slug);
  });

  constructor() {
    afterNextRender(() => this.updateDocumentTitle());
  }

  private menuSync: ReturnType<typeof setInterval> | null = null;
  ngOnInit(): void {
    this.menuSync = setInterval(() => { if (this.tenantId() && document.visibilityState === "visible") this.reloadMenu(true); }, 60000);
    const langParam = this.route.snapshot.queryParamMap.get('lang');
    if (langParam?.trim()) {
      this.language.setLanguage(langParam.trim());
    }

    merge(
      this.translate.onLangChange,
      this.translate.onTranslationChange,
      this.translate.onDefaultLangChange,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateDocumentTitle();
        if (this.tenant() && !this.errorKind()) {
          this.reloadMenu();
        }
      });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const nextCategorySlug = params.get('categorySlug') ?? '';
      const nextSubcategorySlug = params.get('subcategorySlug') ?? '';
      if (nextCategorySlug !== this.categorySlug()) {
        this.categorySlug.set(nextCategorySlug);
        this.searchTerm.set('');
        this.setSelectedProduct(null);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
      }
      if (nextSubcategorySlug !== this.subcategorySlug()) {
        this.subcategorySlug.set(nextSubcategorySlug);
        this.searchTerm.set('');
        this.setSelectedProduct(null);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const nextSection = params.get('section') ?? '';
      const nextGroup = params.get('group') ?? '';
      if (nextSection !== this.menuSectionSlug() || nextGroup !== this.menuGroupSlug()) {
        this.menuSectionSlug.set(nextSection);
        this.menuGroupSlug.set(nextGroup);
        this.searchTerm.set('');
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
      }
      this.productQuery = params.get('product') ?? '';
      this.syncSelectedProduct();
      this.updateDocumentTitle();
    });

    const refParam = (this.route.snapshot.paramMap.get('tenantId') || '').trim();
    if (!refParam) {
      this.errorKind.set('invalid_tenant');
      this.loading.set(false);
      this.updateDocumentTitle();
      return;
    }
    const numericId = /^\d+$/.test(refParam) ? parseInt(refParam, 10) : NaN;
    if (Number.isFinite(numericId) && numericId >= 1) {
      this.tenantId.set(numericId);
    }
    this.updateDocumentTitle();

    this.api.getPublicTenant(refParam).subscribe({
      next: (t) => {
        this.tenant.set(t);
        this.tenantId.set(t.id);
        this.logoUrl.set(this.api.getTenantLogoUrl(t.logo_filename ?? undefined, t.id));
        const canonical = String(publicMenuTenantRef(t));
        if (canonical && canonical !== refParam) {
          const categorySlug = this.categorySlug();
          const subcategorySlug = this.subcategorySlug();
          const canonicalRoute = categorySlug
            ? [
                '/public-menu',
                canonical,
                'kategori',
                categorySlug,
                ...(subcategorySlug ? [subcategorySlug] : []),
              ]
            : ['/public-menu', canonical];
          void this.router.navigate(canonicalRoute, {
            replaceUrl: true,
            queryParamsHandling: 'preserve',
          });
        }
        this.loadMenu(t.id);
      },
      error: () => {
        this.errorKind.set('tenant_not_found');
        this.loading.set(false);
        this.updateDocumentTitle();
      },
    });
  }

  ngOnDestroy(): void {
    if (this.menuSync) clearInterval(this.menuSync);
    if (this.focusTimer) clearTimeout(this.focusTimer);
    this.setSelectedProduct(null);
    // Title reset handled by next navigation.
  }

  private loadMenu(tenantId: number): void {
    this.menuLoading.set(true);
    const version = ++this.menuRequestVersion;
    this.api.getPublicTenantMenu(tenantId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        if (version !== this.menuRequestVersion) return;
        this.refreshFailed.set(false);
        this.menu.set(data);
        this.syncSelectedProduct();
        this.menuLoading.set(false);
        this.loading.set(false);
        this.updateDocumentTitle();
      },
      error: () => {
        if (version !== this.menuRequestVersion) return;
        this.errorKind.set('menu_load_failed');
        this.menuLoading.set(false);
        this.loading.set(false);
        this.updateDocumentTitle();
      },
    });
  }

  private reloadMenu(background = false): void {
    const tid = this.tenantId();
    if (!tid) return;
    if (!background) this.menuLoading.set(true);
    const version = ++this.menuRequestVersion;
    this.api.getPublicTenantMenu(tid).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        if (version !== this.menuRequestVersion) return;
        this.refreshFailed.set(false);
        this.menu.set(data);
        this.syncSelectedProduct();
        this.menuLoading.set(false);
        this.loading.set(false);
        this.updateDocumentTitle();
      },
      error: () => {
        if (version !== this.menuRequestVersion) return;
        this.refreshFailed.set(true);
        this.menuLoading.set(false);
        this.loading.set(false);
        if (!this.menu()) this.errorKind.set('menu_load_failed');
        this.updateDocumentTitle();
      },
    });
  }

  categories(): PublicTenantMenuCategory[] {
    return this.menu()?.categories ?? [];
  }

  menuCategories(): PublicTenantMenuCategory[] {
    return this.isBeratzadeMenuOnly()
      ? this.menu()?.category_tree ?? this.categories()
      : this.categories();
  }

  orderedCategories(): PublicTenantMenuCategory[] {
    return orderBeratzadeMenuCategories(this.menuCategories()).filter(category => categoryProducts(category).length > 0);
  }

  orderedSubcategories(category: PublicTenantMenuCategory): PublicTenantMenuCategory[] {
    return orderBeratzadeSubcategories(category.name, category.subcategories ?? []).filter(child => child.products.length > 0);
  }

  beratzadeSectionProductCount(section: BeratzadeMenuSection): number {
    const groupIds = new Set(section.groups.map(group => group.id));
    return menuProducts(this.menuCategories()).filter(product =>
      [...groupIds].some(groupId => beratzadeProductMatchesGroup(product, groupId)),
    ).length;
  }

  beratzadeGroupProductCount(group: BeratzadeMenuGroup): number {
    return menuProducts(this.menuCategories()).filter(product => beratzadeProductMatchesGroup(product, group.id)).length;
  }

  openBeratzadeSection(section: BeratzadeMenuSection): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: section.id, group: null, product: null },
      queryParamsHandling: 'merge',
    });
  }

  openBeratzadeGroup(group: BeratzadeMenuGroup): void {
    const section = this.activeBeratzadeSection();
    if (!section) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: section.id, group: group.id, product: null },
      queryParamsHandling: 'merge',
    });
  }

  backToBeratzadeLanding(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: null, group: null, product: null },
      queryParamsHandling: 'merge',
    });
  }

  backToBeratzadeSection(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { group: null, product: null },
      queryParamsHandling: 'merge',
    });
  }

  categoryImage(category: PublicTenantMenuCategory): string {
    const product = categoryProducts(category).find(product => this.hasProductImage(product));
    return product ? this.productImageUrl(product.image_url) : '';
  }

  editorialImage(): string {
    if (this.activeBeratzadeGroup()) return this.activeBeratzadeGroup()!.image;
    if (this.activeBeratzadeSection()) return this.activeBeratzadeSection()!.image;
    const category = this.activeCategory();
    const slug = category ? this.categoryRouteSlug(category.id) : 'kebaplar-ve-izgaralar';
    const available = ['kahvalti', 'kebaplar-ve-izgaralar', 'mezeler-ve-salatalar', 'gunun-corbalari', 'ev-yemekleri', 'icecekler', 'tatlilar'];
    return `/menu-categories/${available.includes(slug) ? slug : 'kebaplar-ve-izgaralar'}.webp`;
  }

  categoryImageFailed(category: PublicTenantMenuCategory): void {
    const product = categoryProducts(category).find(product => this.hasProductImage(product));
    if (product) this.productImageFailed(product);
  }

  categoryProductCount(category: PublicTenantMenuCategory): number {
    return categoryProducts(category).length;
  }

  private categorySections(category: PublicTenantMenuCategory): PublicTenantMenuCategory[] {
    const children = this.orderedSubcategories(category);
    const nested = new Set(children.flatMap(child => child.products).map(publicProductKey));
    return [
      { ...category, products: category.products.filter(product => !nested.has(publicProductKey(product))) },
      ...children.map(child => ({ ...child, id: `${category.id}--${child.id}` })),
    ];
  }

  visibleCategories(): PublicTenantMenuCategory[] {
    const query = this.searchTerm().trim();
    const selected = this.activeCategory();
    if (this.isBeratzadeMenuOnly() && this.menuSectionSlug()) {
      const section = this.activeBeratzadeSection();
      const group = this.activeBeratzadeGroup();
      if (!section || !group) return [];
      const products = menuProducts(this.menuCategories())
        .filter(product => beratzadeProductMatchesGroup(product, group.id))
        .filter(product => matchesMenuSearch(product, query, `${section.label} ${group.label}`));
      return products.length ? [{ id: group.id, name: group.label, products }] : [];
    }
    if (this.isCategoryRoute() && !selected) return [];
    if (this.isCategoryRoute() && this.subcategorySlug() && !this.activeSubcategory()) return [];
    const source = this.isBeratzadeMenuOnly() ? selected
      ? this.activeSubcategory() ? [this.activeSubcategory()!] : this.categorySections(selected)
      : this.orderedCategories().flatMap(category => this.categorySections(category))
      : selected ? [selected] : this.categories();
    const seen = new Set<string>();
    return source
      .map((category) => ({
        ...category,
        products: category.products.filter(product => {
          const key = publicProductKey(product);
          if (seen.has(key) || !matchesMenuSearch(product, query, `${selected?.name ?? ''} ${category.name}`)) return false;
          seen.add(key);
          return true;
        }),
      }))
      .filter((category) => category.products.length > 0);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(input?: HTMLInputElement): void {
    this.searchTerm.set('');
    (input ?? document.querySelector<HTMLInputElement>('.public-menu-search input'))?.focus();
  }

  retryMenu(): void {
    if (this.errorKind()) {
      this.errorKind.set(null);
      this.loading.set(true);
      this.loadMenu(this.tenantId());
    } else this.reloadMenu(true);
  }

  backToTop(): void {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  scrollToCategory(categoryId: string): void {
    this.activeCategoryId.set(categoryId);
    document.getElementById(`cat-${categoryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  categoryRouteSlug(categoryId: string): string {
    return this.isBeratzadeMenuOnly()
      ? beratzadeMenuCategorySlug(categoryId)
      : publicMenuCategorySlug(categoryId);
  }

  menuRouterLink(): (string | number)[] {
    return ['/public-menu', this.tenant()?.public_slug?.trim() || this.tenantId()];
  }

  categoryRouterLink(category: PublicTenantMenuCategory): (string | number)[] {
    return [...this.menuRouterLink(), 'kategori', this.categoryRouteSlug(category.id)];
  }

  subcategoryRouterLink(
    category: PublicTenantMenuCategory,
    subcategoryId: string,
  ): (string | number)[] {
    return [...this.categoryRouterLink(category), this.categoryRouteSlug(subcategoryId)];
  }

  languageQueryParams(): Record<string, string> {
    return { lang: this.translate.currentLang || this.language.getLanguage() || 'tr' };
  }

  openProductDetails(product: PublicTenantMenuProduct): void {
    this.productTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.setSelectedProduct(product);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { product: publicProductKey(product) }, queryParamsHandling: 'merge' });
  }

  closeProductDetails(): void {
    this.setSelectedProduct(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { product: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  readonly productKey = publicProductKey;

  private syncSelectedProduct(): void {
    if (!this.menu()) return;
    const product = menuProducts(this.menuCategories()).find(product => publicProductKey(product) === this.productQuery) ?? null;
    this.productUnavailable.set(Boolean(this.productQuery) && !product);
    this.setSelectedProduct(product);
  }

  private setSelectedProduct(product: PublicTenantMenuProduct | null): void {
    const wasOpen = Boolean(this.selectedProduct());
    this.selectedProduct.set(product);
    if (typeof document === 'undefined') return;
    if (product && !wasOpen) {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.focusTimer = setTimeout(() => document.querySelector<HTMLButtonElement>('.public-menu-detail-close')?.focus(), 0);
    } else if (!product && wasOpen) {
      document.body.style.overflow = this.previousBodyOverflow;
      if (this.productTrigger?.isConnected) this.productTrigger.focus({ preventScroll: true });
    }
  }

  @HostListener('document:keydown', ['$event'])
  dialogKeydown(event: KeyboardEvent): void {
    if (!this.selectedProduct()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeProductDetails();
    } else if (event.key === 'Tab') {
      const controls = Array.from(document.querySelectorAll<HTMLElement>('.public-menu-detail button, .public-menu-detail a[href], .public-menu-detail [tabindex="0"]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (first && (!controls.includes(document.activeElement as HTMLElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
  }

  productImageFailed(product: PublicTenantMenuProduct): void {
    this.failedImageIds.update((ids) => new Set(ids).add(publicProductKey(product)));
  }

  hasProductImage(product: PublicTenantMenuProduct): boolean {
    return Boolean(this.productImageUrl(product.image_url) && !this.failedImageIds().has(publicProductKey(product)));
  }

  isCategoryExpanded(categoryId: string): boolean {
    return Boolean(this.searchTerm().trim()) || !this.collapsedCategoryIds().has(categoryId);
  }

  toggleCategory(categoryId: string): void {
    this.collapsedCategoryIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  /** Translation key for known API category names; falls back to raw value. */
  getCategoryLabel(category: string): string {
    if (this.isBeratzadeMenuOnly()) {
      return beratzadeMenuCategoryLabel(category);
    }
    const keyMap: Record<string, string> = {
      Starters: 'PRODUCTS.CATEGORY_STARTERS',
      'Main Course': 'PRODUCTS.CATEGORY_MAIN_COURSE',
      Desserts: 'PRODUCTS.CATEGORY_DESSERTS',
      Beverages: 'PRODUCTS.CATEGORY_BEVERAGES',
      Sides: 'PRODUCTS.CATEGORY_SIDES',
      Other: 'PUBLIC_MENU.CATEGORY_OTHER',
    };
    const key = keyMap[category];
    if (key) return this.translate.instant(key);
    return category;
  }

  categoryPanelId(categoryId: string): string {
    return `public-menu-cat-panel-${categoryId}`;
  }

  categoryToggleAriaLabel(category: PublicTenantMenuCategory): string {
    const name = this.getCategoryLabel(category.name);
    const key = this.isCategoryExpanded(category.id)
      ? 'PUBLIC_MENU.COLLAPSE_CATEGORY'
      : 'PUBLIC_MENU.EXPAND_CATEGORY';
    return this.translate.instant(key, { category: name });
  }

  displayName(): string {
    return this.menu()?.tenant_name?.trim() || this.tenant()?.name?.trim() || '';
  }

  getLogoSafeUrl(url: string | null): SafeResourceUrl | string {
    if (!url) return '';
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  headerBackgroundStyle(): SafeStyle | null {
    const filename = this.tenant()?.header_background_filename;
    const tid = this.tenant()?.id;
    if (!filename || tid == null) return null;
    const url = this.api.getTenantHeaderBackgroundUrl(filename, tid);
    return this.sanitizer.bypassSecurityTrustStyle(`url('${url}')`);
  }

  productImageUrl(url: string | null | undefined): string {
    return publicImageUrl(url, environment.apiUrl);
  }

  formatPrice(product: { price_cents: number }): string {
    return formatMoneyCents(this.translate, product.price_cents, this.menu()?.currency);
  }

  /** Build WhatsApp wa.me link from phone string (e.g. +34 612 345 678 -> https://wa.me/34612345678). */
  getWhatsAppUrl(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    return `https://wa.me/${digits}`;
  }

  /** Canonical guest booking link (#415). */
  bookRouterLink(): (string | number)[] {
    const t = this.tenant();
    if (t) return publicBookRouterLink(t);
    return ['/book', this.tenantId()];
  }

  private updateDocumentTitle(): void {
    const name = this.displayName();
    const err = this.errorKind();
    let key: string;
    if (this.loading() && !err) {
      key = 'PUBLIC_MENU.LOADING';
    } else if (err === 'invalid_tenant') {
      key = 'PUBLIC_MENU.INVALID_TENANT';
    } else if (err === 'tenant_not_found') {
      key = 'PUBLIC_MENU.TENANT_NOT_FOUND';
    } else if (err === 'menu_load_failed') {
      key = 'PUBLIC_MENU.LOAD_FAILED';
    } else if (name && this.isBeratzadeMenuOnly() && this.activeBeratzadeGroup()) {
      key = 'PUBLIC_MENU.PAGE_TITLE';
    } else if (name) {
      key = 'PUBLIC_MENU.PAGE_TITLE';
    } else {
      key = 'PUBLIC_MENU.PAGE_TITLE';
    }
    const pageTitle = this.translate.instant(key);
    const title = name ? `${name} — ${pageTitle}` : pageTitle;
    const description = name ? `${name} — ${pageTitle}` : pageTitle;
    this.title.setTitle(title);
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ name: 'description', content: description });
    if (name) {
      this.meta.updateTag({ property: 'og:site_name', content: name });
    } else {
      this.meta.removeTag('property="og:site_name"');
    }
  }
}
