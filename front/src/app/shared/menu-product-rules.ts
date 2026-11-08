const normalizeMenuProductName = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** A category heading accidentally stored as a product must never be purchasable. */
export function isNonSellableMenuHeading(name: string | null | undefined): boolean {
  return normalizeMenuProductName(name ?? '') === 'gunluk sulu yemekler';
}

export interface CustomerMenuProductLike {
  id?: number;
  name: string;
  price_cents: number;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
}

const normalizeDuplicateValue = (value: string | null | undefined): string =>
  (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR');

function isApprovedUrfaDuplicate(a: CustomerMenuProductLike, b: CustomerMenuProductLike): boolean {
  return normalizeDuplicateValue(a.name) === 'urfa kebap servis'
    && normalizeDuplicateValue(b.name) === 'urfa kebap servis'
    && normalizeDuplicateValue(a.category) === normalizeDuplicateValue(b.category)
    && normalizeDuplicateValue(a.subcategory) === normalizeDuplicateValue(b.subcategory)
    && normalizeDuplicateValue(a.description) === normalizeDuplicateValue(b.description)
    && a.price_cents === b.price_cents;
}

/** Menu-only duplicate suppression; persistent product/order records are untouched. */
export function filterCustomerMenuProducts<T extends CustomerMenuProductLike>(products: T[]): T[] {
  const visible: T[] = [];
  for (const product of products) {
    if (isNonSellableMenuHeading(product.name)) continue;
    const duplicateIndex = visible.findIndex(candidate => isApprovedUrfaDuplicate(candidate, product));
    if (duplicateIndex < 0) {
      visible.push(product);
      continue;
    }
    if (product.id === 613 && visible[duplicateIndex].id !== 613) {
      visible[duplicateIndex] = product;
    }
  }
  return visible;
}
