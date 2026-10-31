import {
  Component,
  computed,
  inject,
  signal,
  OnInit,
  OnDestroy,
  DestroyRef,
  afterNextRender,
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
  beratzadeCategoryVisual,
  BeratzadeCategoryVisual,
} from '../shared/beratzade-category-visuals';
import {
  beratzadeMenuCategoryLabel,
  beratzadeMenuCategorySlug,
  orderBeratzadeMenuCategories,
  orderBeratzadeSubcategories,
} from '../shared/public-menu-categories';
import { publicMenuCategorySlug, publicMenuTenantRef } from '../shared/public-menu-path';
import { publicBookRouterLink } from '../shared/public-book-path';
import { LanguageService } from '../services/language.service';
import { LegalLinksComponent } from '../shared/legal-links.component';
import { formatMoneyCents } from '../shared/currency-symbol';

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
  activeCategoryId = signal('');
  selectedProduct = signal<PublicTenantMenuProduct | null>(null);
  failedImageIds = signal<Set<number>>(new Set());
  failedCategoryImageIds = signal<Set<string>>(new Set());
  errorKind = signal<'invalid_tenant' | 'tenant_not_found' | 'menu_load_failed' | null>(null);
  /** Category ids collapsed by user toggle (default: all expanded). */
  private collapsedCategoryIds = signal<Set<string>>(new Set());

  googleMapsUrl = computed(() => this.tenant()?.public_google_maps_url?.trim() || null);
  openstreetmapUrl = computed(() => this.tenant()?.public_openstreetmap_url?.trim() || null);
  hasAnyProducts = computed(() => this.categories().some((category) => category.products.length > 0));
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
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR');
    const name = normalize(tenant.name.replace(/&/g, ' ve ').replace(/\s+/g, ' ').trim());
    return name === 'beratzade kebap ve kahvalti salonu' || name === 'beratzade kebap kahvalti salonu' || normalize(tenant.public_slug ?? '').startsWith('beratzade-');
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
        this.selectedProduct.set(null);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
      }
      if (nextSubcategorySlug !== this.subcategorySlug()) {
        this.subcategorySlug.set(nextSubcategorySlug);
        this.searchTerm.set('');
        this.selectedProduct.set(null);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
      }
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
    // Title reset handled by next navigation.
  }

  private loadMenu(tenantId: number): void {
    this.menuLoading.set(true);
    this.api.getPublicTenantMenu(tenantId).subscribe({
      next: (data) => {
        this.menu.set(data);
        this.menuLoading.set(false);
        this.loading.set(false);
        this.updateDocumentTitle();
      },
      error: () => {
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
    this.api.getPublicTenantMenu(tid).subscribe({
      next: (data) => {
        this.menu.set(data);
        this.menuLoading.set(false);
      },
      error: () => {
        this.menuLoading.set(false);
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
    return orderBeratzadeMenuCategories(this.menuCategories());
  }

  orderedSubcategories(category: PublicTenantMenuCategory): PublicTenantMenuCategory[] {
    return orderBeratzadeSubcategories(category.name, category.subcategories ?? []);
  }

  categoryVisual(categoryId: string): BeratzadeCategoryVisual | null {
    return beratzadeCategoryVisual(categoryId);
  }

  categoryImageFailed(categoryId: string): void {
    this.failedCategoryImageIds.update((ids) => new Set(ids).add(categoryId));
  }

  hasCategoryImageFailed(categoryId: string): boolean {
    return this.failedCategoryImageIds().has(categoryId);
  }

  visibleCategories(): PublicTenantMenuCategory[] {
    const query = this.normalizeSearchText(this.searchTerm());
    const selected = this.activeCategory();
    if (this.isCategoryRoute() && !selected) return [];
    if (this.isBeratzadeMenuOnly() && selected) {
      const source = this.activeSubcategory()
        ? [this.activeSubcategory()!]
        : selected.subcategories?.length
          ? query
            ? [selected, ...selected.subcategories]
            : []
          : [selected];
      if (!query) {
        return source.filter((category) => category.products.length > 0);
      }
      return source
        .map((category) => ({
          ...category,
          products: category.products.filter((product) =>
            this.normalizeSearchText(`${product.name} ${product.description ?? ''}`).includes(query),
          ),
        }))
        .filter((category) => category.products.length > 0);
    }
    const source = this.isBeratzadeMenuOnly()
      ? this.orderedCategories()
      : selected
        ? [selected]
        : this.categories();
    if (!query) {
      return source.filter(
        (category) =>
          category.products.length > 0 ||
          (this.isBeratzadeMenuOnly() && Boolean(category.subcategories?.length)),
      );
    }
    return source
      .map((category) => ({
        ...category,
        products: category.products.filter((product) =>
          this.normalizeSearchText(`${product.name} ${product.description ?? ''}`).includes(query),
        ),
      }))
      .filter((category) => category.products.length > 0);
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase(this.translate.currentLang || 'tr-TR')
      .replace(/ı/g, 'i');
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(input?: HTMLInputElement): void {
    this.searchTerm.set('');
    input?.focus();
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
    this.selectedProduct.set(product);
  }

  closeProductDetails(): void {
    this.selectedProduct.set(null);
  }

  productImageFailed(productId: number): void {
    this.failedImageIds.update((ids) => new Set(ids).add(productId));
  }

  hasProductImage(product: PublicTenantMenuProduct): boolean {
    return Boolean(product.image_url && !this.failedImageIds().has(product.id));
  }

  isCategoryExpanded(categoryId: string): boolean {
    return !this.collapsedCategoryIds().has(categoryId);
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
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = environment.apiUrl.replace(/\/$/, '');
    return url.startsWith('/') ? base + url : `${base}/${url}`;
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
