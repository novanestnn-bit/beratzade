import type { PublicTenantMenuCategory, PublicTenantMenuProduct } from '../services/api.service';

/** Product ids belong to separate tables; the source is part of their public identity. */
export function publicProductKey(product: PublicTenantMenuProduct): string {
  const source = product.source;
  if (source === 'product' || source === 'tenant_product') return `${source}:${product.id}`;
  // Older cached responses have no source. Keep distinct names distinct rather than
  // silently opening a different row that happens to have the same numeric id.
  return `public:${product.id}:${encodeURIComponent(product.name)}`;
}

export function categoryProducts(category: PublicTenantMenuCategory): PublicTenantMenuProduct[] {
  const products = [...category.products, ...(category.subcategories ?? []).flatMap(child => child.products)];
  return [...new Map(products.map(product => [publicProductKey(product), product])).values()];
}

export function menuProducts(categories: PublicTenantMenuCategory[]): PublicTenantMenuProduct[] {
  return [...new Map(categories.flatMap(categoryProducts).map(product => [publicProductKey(product), product])).values()];
}

export function categoryForProduct(
  categories: PublicTenantMenuCategory[],
  product: PublicTenantMenuProduct,
): PublicTenantMenuCategory | undefined {
  const key = publicProductKey(product);
  return categories.find(category => categoryProducts(category).some(item => publicProductKey(item) === key));
}

/** API image paths are relative to the backend; arbitrary protocols are never rendered. */
export function publicImageUrl(url: string | null | undefined, apiUrl: string): string {
  const value = url?.trim();
  if (!value || value.startsWith('//') || /[\u0000-\u001f]/.test(value)) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return '';
  const base = apiUrl.replace(/\/$/, '');
  return value.startsWith('/') ? base + value : `${base}/${value}`;
}
