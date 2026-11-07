import type { PublicTenantMenuCategory, PublicTenantMenuProduct } from '../services/api.service';

/** Turkish accents, word order and category names should not prevent finding a dish. */
export function matchesMenuSearch(product: PublicTenantMenuProduct, query: string, context = ''): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR').replace(/ı/g, 'i');
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const text = normalize(`${product.name} ${product.description ?? ''} ${product.category ?? ''} ${product.subcategory ?? ''} ${context}`);
  return words.every(word => text.includes(word));
}

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
