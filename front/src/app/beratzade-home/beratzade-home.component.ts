import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeStyle, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ApiService, PublicTenantMenuCategory, PublicTenantMenuProduct, PublicTenantMenuResponse, TenantSummary } from '../services/api.service';
import { environment } from '../../environments/environment';
import { LegalLinksComponent } from '../shared/legal-links.component';
import {
  beratzadeMenuCategoryLabel,
  beratzadeMenuCategorySlug,
  orderBeratzadeMenuCategories,
} from '../shared/public-menu-categories';

@Component({
  selector: 'app-beratzade-home',
  standalone: true,
  imports: [LegalLinksComponent],
  templateUrl: './beratzade-home.component.html',
  styleUrl: './beratzade-home.component.scss',
})
export class BeratzadeHomeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly sanitizer = inject(DomSanitizer);
  tenant = signal<TenantSummary | null>(null);
  menu = signal<PublicTenantMenuResponse | null>(null);
  loading = signal(true);
  failed = signal(false);
  categories = computed(() => this.menu()?.categories ?? []);
  menuCategories = computed(() =>
    orderBeratzadeMenuCategories(this.menu()?.category_tree ?? this.categories()),
  );
  dailyMenuSections = computed(() =>
    [
      { sourceName: 'Günün Çorbaları', title: 'Günün Çorbaları' },
      { sourceName: 'Günün Yemekleri', title: 'Ev Yemekleri' },
    ].flatMap(({ sourceName, title }) => {
      const category = this.categories().find((item) => item.name === sourceName);
      return category
        ? [{ category, title, products: category.products.filter((product) => product.available) }]
        : [];
    }),
  );
  menuPath = computed(() => this.tenant() ? `/public-menu/${this.tenant()?.public_slug || this.tenant()?.id}?lang=tr` : '#menu-kategorileri');
  logoUrl = computed(() => this.api.getTenantLogoUrl(this.tenant()?.logo_filename, this.tenant()?.id));

  ngOnInit(): void {
    this.title.setTitle('Beratzade Kebap & Kahvaltı Salonu');
    this.api.waitForInitialAuthCheck().subscribe(() => {
      const user = this.api.getCurrentUser();
      if (user) {
if (user.role === 'courier') void this.router.navigate(['/courier']);
        else if (user.provider_id != null) void this.router.navigate(['/provider']);
        else void this.router.navigate(['/dashboard']);
        return;
      }
      this.loadRestaurant();
    });
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
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const base = environment.apiUrl.replace(/\/$/, '');
    return url.startsWith('/') ? base + url : `${base}/${url}`;
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
    const category = this.categories().find((item) => item.products.some((candidate) => candidate.id === product.id));
    return category ? this.categoryMenuPath(category) : this.menuPath();
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
