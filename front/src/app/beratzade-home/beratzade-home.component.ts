import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeStyle, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService, PublicTenantMenuCategory, PublicTenantMenuProduct, PublicTenantMenuResponse, TenantSummary } from '../services/api.service';
import { environment } from '../../environments/environment';
import { LegalLinksComponent } from '../shared/legal-links.component';
import { categoryForProduct, categoryProducts, publicImageUrl, publicProductKey } from '../public-menu/public-menu-presentation';
import {
  beratzadeMenuCategoryLabel,
  beratzadeMenuCategorySlug,
  orderBeratzadeMenuCategories,
} from '../shared/public-menu-categories';

@Component({
  selector: 'app-beratzade-home',
  standalone: true,
  imports: [LegalLinksComponent, RouterLink, TranslateModule],
  templateUrl: './beratzade-home.component.html',
  styleUrl: './beratzade-home.component.scss',
})
export class BeratzadeHomeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly title = inject(Title);
  private readonly sanitizer = inject(DomSanitizer);
  tenant = signal<TenantSummary | null>(null);
  menu = signal<PublicTenantMenuResponse | null>(null);
  loading = signal(true);
  failed = signal(false);
  failedImages = signal(new Set<string>());
  categories = computed(() => this.menu()?.categories ?? []);
  menuCategories = computed(() =>
    orderBeratzadeMenuCategories(this.menu()?.category_tree ?? this.categories())
      .filter(category => categoryProducts(category).length > 0),
  );
  menuSections = computed(() => this.menuCategories().map(category => ({
    category,
    title: this.categoryLabel(category),
    products: categoryProducts(category).filter(product => product.available).slice(0, 4),
  })).filter(section => section.products.length > 0));
  menuPath = computed(() => this.tenant() ? `/public-menu/${this.tenant()?.public_slug || this.tenant()?.id}?lang=tr` : '#menu-kategorileri');
  logoUrl = computed(() => this.api.getTenantLogoUrl(this.tenant()?.logo_filename, this.tenant()?.id));

  ngOnInit(): void {
    this.title.setTitle('Beratzade Kebap & Kahvaltı Salonu');
    this.loadRestaurant();
  }

  private loadRestaurant(): void {
    this.api.getPublicTenants().subscribe({
      next: (tenants) => {
        const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR');
        const target = tenants.find((tenant) => {
          const name = normalize(tenant.name.replace(/&/g, ' ve ').replace(/\s+/g, ' ').trim());
          const slug = normalize(tenant.public_slug ?? '');
          return name === 'beratzade kebap ve kahvalti salonu' || name === 'beratzade kebap kahvalti salonu' || slug.startsWith('beratzade-');
        });
        if (!target) {
          this.loading.set(false);
          return;
        }
        this.tenant.set(target);
        this.api.getPublicTenantMenu(target.id, 'tr').subscribe({
          next: (menu) => {
            this.menu.set(menu);
            this.loading.set(false);
          },
          error: () => {
            this.failed.set(true);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  imageUrl(url: string | null): string {
    return publicImageUrl(url, environment.apiUrl);
  }

  readonly productKey = publicProductKey;

  productImage(product: PublicTenantMenuProduct): string {
    return this.failedImages().has(publicProductKey(product)) ? '' : this.imageUrl(product.image_url);
  }

  imageFailed(product: PublicTenantMenuProduct): void {
    this.failedImages.update(images => new Set(images).add(publicProductKey(product)));
  }

  productCount(category: PublicTenantMenuCategory): number {
    return categoryProducts(category).length;
  }

  heroStyle(): SafeStyle | null {
    const tenant = this.tenant();
    if (!tenant?.header_background_filename) return null;
    const url = this.api.getTenantHeaderBackgroundUrl(tenant.header_background_filename, tenant.id);
    return this.sanitizer.bypassSecurityTrustStyle(`url('${url}')`);
  }

  price(product: PublicTenantMenuProduct): string {
    const currency = this.menu()?.currency || 'TRY';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(product.price_cents / 100);
  }

  categoryMatches(category: PublicTenantMenuCategory, terms: string[]): boolean {
    const name = category.name.toLocaleLowerCase('tr-TR');
    return terms.some((term) => name.includes(term)) ||
      (terms.includes('kahvaltı') && name.includes('breakfast')) ||
      (terms.includes('kebap') && ['grill', 'barbecue', 'barbeque'].some((term) => name.includes(term)));
  }

  categoryPath(terms: string[]): string {
    const category = this.categories().find((item) => this.categoryMatches(item, terms));
    return category ? this.categoryMenuPath(category) : this.menuPath();
  }

  categoryMenuPath(category: PublicTenantMenuCategory): string {
    const menuPath = this.menuPath().split('?')[0];
    return `${menuPath}/kategori/${beratzadeMenuCategorySlug(category.id)}?lang=tr`;
  }

  categoryLabel(category: PublicTenantMenuCategory): string {
    return beratzadeMenuCategoryLabel(category.name);
  }

  productPath(product: PublicTenantMenuProduct): string {
    const category = categoryForProduct(this.menuCategories(), product);
    const path = category ? this.categoryMenuPath(category) : this.menuPath();
    return `${path}&product=${encodeURIComponent(publicProductKey(product))}`;
  }

  openingHours(): string {
    const raw = this.tenant()?.opening_hours?.trim();
    if (!raw) return '';
    try {
      const schedule = JSON.parse(raw) as Record<string, { open?: string; close?: string; closed?: boolean }>;
      const days: Array<[string, string]> = [['monday', 'Pzt'], ['tuesday', 'Sal'], ['wednesday', 'Çar'], ['thursday', 'Per'], ['friday', 'Cum'], ['saturday', 'Cmt'], ['sunday', 'Paz']];
      return days.map(([key, label]) => {
        const hours = schedule[key];
        if (!hours) return '';
        return `${label} ${hours.closed ? 'Kapalı' : `${hours.open ?? ''}–${hours.close ?? ''}`}`.trim();
      }).filter(Boolean).join(' · ');
    } catch {
      return raw;
    }
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
