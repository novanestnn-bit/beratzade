import type { PublicTenantMenuCategory, PublicTenantMenuProduct } from '../services/api.service';
import { isNonSellableMenuHeading } from '../shared/menu-product-rules';

export type BeratzadeSectionId = 'kahvalti' | 'kebap-sulu-yemekler';

export interface BeratzadeMenuGroup {
  id: string;
  label: string;
  labelKey: string;
  image: string;
}

export interface BeratzadeMenuSection {
  id: BeratzadeSectionId;
  label: string;
  labelKey: string;
  descriptionKey: string;
  image: string;
  groups: BeratzadeMenuGroup[];
}

export const BERATZADE_MENU_SECTIONS: BeratzadeMenuSection[] = [
  {
    id: 'kahvalti',
    label: 'Kahvaltı',
    labelKey: 'MENU_EXPERIENCE.SECTION_BREAKFAST',
    descriptionKey: 'MENU_EXPERIENCE.SECTION_BREAKFAST_DESCRIPTION',
    image: '/menu-categories/kahvalti.webp',
    groups: [
      { id: 'kahvalti-tabaklari', label: 'Kahvaltı Tabakları', labelKey: 'MENU_EXPERIENCE.GROUP_BREAKFAST_PLATES', image: '/menu-categories/kahvalti.webp' },
      { id: 'menemen-yumurta', label: 'Menemen & Yumurta', labelKey: 'MENU_EXPERIENCE.GROUP_EGGS', image: '/menu-categories/kahvalti.webp' },
      { id: 'tost-sandvic', label: 'Tost & Sandviç', labelKey: 'MENU_EXPERIENCE.GROUP_TOAST', image: '/menu-categories/kahvalti.webp' },
      { id: 'borek-hamur-isleri', label: 'Börek & Hamur İşleri', labelKey: 'MENU_EXPERIENCE.GROUP_PASTRIES', image: '/menu-categories/kahvalti.webp' },
      { id: 'gunluk-corba', label: 'Günlük Çorbalar', labelKey: 'MENU_EXPERIENCE.GROUP_SOUPS', image: '/menu-categories/gunun-corbalari.webp' },
      { id: 'kahvalti-icecekleri', label: 'İçecekler', labelKey: 'MENU_EXPERIENCE.GROUP_DRINKS', image: '/menu-categories/icecekler.webp' },
    ],
  },
  {
    id: 'kebap-sulu-yemekler',
    label: 'Kebap & Sulu Yemekler',
    labelKey: 'MENU_EXPERIENCE.SECTION_GRILL',
    descriptionKey: 'MENU_EXPERIENCE.SECTION_GRILL_DESCRIPTION',
    image: '/menu-categories/kebaplar-ve-izgaralar.webp',
    groups: [
      { id: 'izgara-kebap', label: 'Izgara & Kebap Çeşitleri', labelKey: 'MENU_EXPERIENCE.GROUP_GRILL', image: '/menu-categories/kebaplar-ve-izgaralar.webp' },
      { id: 'durumler', label: 'Dürümler', labelKey: 'MENU_EXPERIENCE.GROUP_WRAPS', image: '/menu-categories/kebaplar-ve-izgaralar.webp' },
      { id: 'gunluk-sulu-yemekler', label: 'Günlük Sulu Yemekler', labelKey: 'MENU_EXPERIENCE.GROUP_DAILY_MEALS', image: '/menu-categories/ev-yemekleri.webp' },
      { id: 'tavuk-pilav', label: 'Tavuk & Pilav Çeşitleri', labelKey: 'MENU_EXPERIENCE.GROUP_CHICKEN_RICE', image: '/menu-categories/kebaplar-ve-izgaralar.webp' },
      { id: 'hamburger-ozel-tabaklar', label: 'Hamburger & Özel Tabaklar', labelKey: 'MENU_EXPERIENCE.GROUP_BURGERS', image: '/menu-categories/kebaplar-ve-izgaralar.webp' },
      { id: 'atistirmaliklar', label: 'Atıştırmalıklar', labelKey: 'MENU_EXPERIENCE.GROUP_SNACKS', image: '/menu-categories/mezeler-ve-salatalar.webp' },
      { id: 'tatlilar', label: 'Tatlılar', labelKey: 'MENU_EXPERIENCE.GROUP_DESSERTS', image: '/menu-categories/tatlilar.webp' },
      { id: 'yemek-icecekleri', label: 'İçecekler', labelKey: 'MENU_EXPERIENCE.GROUP_DRINKS', image: '/menu-categories/icecekler.webp' },
    ],
  },
];

const normalizeMenuText = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/&/g, ' ve ').replace(/[^a-z0-9]+/g, ' ').trim();

const hasAny = (value: string, needles: string[]): boolean =>
  needles.some((needle) => value.includes(needle));

/** Virtual grouping for the public display only; product data remains exactly as returned by the API. */
export function beratzadeProductGroup(product: PublicTenantMenuProduct): string {
  const name = normalizeMenuText(product.name);
  const category = normalizeMenuText(`${product.category ?? ''} ${product.subcategory ?? ''}`);
  const text = `${name} ${category}`;

  if (hasAny(text, ['icecek', 'beverage', 'drink', 'cay', 'kahve', 'nescafe', 'oralet', 'portakal suyu', 'maden suyu', 'ayran', 'cola']) || name === 'su' || name === 'water') {
    return category.includes('kahvalti') ? 'kahvalti-icecekleri' : 'yemek-icecekleri';
  }
  if (hasAny(text, ['corba', 'soup'])) return 'gunluk-corba';
  if (hasAny(text, ['tatli', 'dessert', 'sutlac', 'kunefe'])) return 'tatlilar';
  if (hasAny(text, ['kahvalti', 'breakfast'])) {
    if (hasAny(text, ['menemen', 'omlet', 'yumurta', 'egg'])) return 'menemen-yumurta';
    if (hasAny(text, ['tost', 'toast', 'sandvic', 'sandwich'])) return 'tost-sandvic';
    if (hasAny(text, ['borek', 'boreg', 'gozleme', 'pankek', 'pancake', 'krep', 'pogaca', 'acma', 'simit', 'hamur', 'pastry'])) return 'borek-hamur-isleri';
    return 'kahvalti-tabaklari';
  }
  if (hasAny(text, ['menemen', 'omlet', 'yumurta', 'egg', 'kahvalti tabagi', 'serpme'])) return 'menemen-yumurta';
  if (hasAny(text, ['tost', 'toast', 'sandvic', 'sandwich'])) return 'tost-sandvic';
  if (hasAny(text, ['borek', 'boreg', 'gozleme', 'pankek', 'pancake', 'krep', 'pogaca', 'acma', 'simit', 'hamur', 'pastry'])) return 'borek-hamur-isleri';
  if (hasAny(category, ['corba', 'soup'])) return 'gunluk-corba';
  if (hasAny(text, ['burger', 'hamburger'])) return 'hamburger-ozel-tabaklar';
  if (hasAny(text, ['durum', 'wrap', 'dürüm'])) return 'durumler';
  if (hasAny(text, ['citir', 'snitzel', 'schnitzel', 'peynir cubuk', 'sogan halkasi', 'patates kroket', 'aperatif', 'atistirmalik', 'starter', 'appetizer'])) return 'atistirmaliklar';
  if (hasAny(text, ['izgara', 'kebap', 'sis', 'pirzola', 'kofte', 'ciger', 'grill', 'grilled'])) return 'izgara-kebap';
  if (hasAny(text, ['gunun yemek', 'gunluk yemek', 'ev yemek', 'sulu yemek', 'daily meal', 'stew'])) return 'gunluk-sulu-yemekler';
  if (hasAny(text, ['tavuk', 'chicken', 'pilav', 'rice'])) return 'tavuk-pilav';
  if (hasAny(category, ['kahvalti', 'breakfast'])) return 'kahvalti-tabaklari';
  if (hasAny(category, ['yan urun', 'side'])) return 'atistirmaliklar';

  // Keep any existing but unrecognized API item visible without changing its data.
  return 'hamburger-ozel-tabaklar';
}

export function beratzadeSectionForProduct(product: PublicTenantMenuProduct): BeratzadeSectionId {
  const group = beratzadeProductGroup(product);
  return ['kahvalti-tabaklari', 'menemen-yumurta', 'tost-sandvic', 'borek-hamur-isleri', 'gunluk-corba', 'kahvalti-icecekleri'].includes(group)
    ? 'kahvalti'
    : 'kebap-sulu-yemekler';
}

export function beratzadeProductMatchesGroup(product: PublicTenantMenuProduct, groupId: string): boolean {
  const actualGroup = beratzadeProductGroup(product);
  if (actualGroup === groupId) return true;
  const isDrinkGroup = groupId === 'kahvalti-icecekleri' || groupId === 'yemek-icecekleri';
  return isDrinkGroup && (actualGroup === 'kahvalti-icecekleri' || actualGroup === 'yemek-icecekleri');
}

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
  return uniqueMenuProducts(products);
}

export function menuProducts(categories: PublicTenantMenuCategory[]): PublicTenantMenuProduct[] {
  return uniqueMenuProducts(categories.flatMap(categoryProducts));
}

const normalizeDuplicateField = (value: string | null | undefined): string =>
  normalizeMenuText(value ?? '');

function isApprovedUrfaDuplicate(a: PublicTenantMenuProduct, b: PublicTenantMenuProduct): boolean {
  return normalizeDuplicateField(a.name) === 'urfa kebap servis'
    && normalizeDuplicateField(b.name) === 'urfa kebap servis'
    && normalizeDuplicateField(a.category) === normalizeDuplicateField(b.category)
    && normalizeDuplicateField(a.subcategory) === normalizeDuplicateField(b.subcategory)
    && a.price_cents === b.price_cents
    && normalizeDuplicateField(a.description) === normalizeDuplicateField(b.description);
}

function uniqueMenuProducts(products: PublicTenantMenuProduct[]): PublicTenantMenuProduct[] {
  const result: PublicTenantMenuProduct[] = [];
  const indexes = new Map<string, number>();
  for (const product of products) {
    if (isNonSellableMenuHeading(product.name)) continue;
    const key = publicProductKey(product);
    const existingIndex = indexes.get(key);
    if (existingIndex !== undefined) continue;

    const duplicateIndex = result.findIndex(candidate => isApprovedUrfaDuplicate(candidate, product));
    if (duplicateIndex >= 0) {
      // Prefer the business-approved row when it is present; exact canonical
      // spelling is the fallback for a future catalog that has different IDs.
      const existing = result[duplicateIndex];
      const productIsCanonical = product.id === 613 || product.name.trim() === 'Urfa Kebap Servis';
      const existingIsCanonical = existing.id === 613 || existing.name.trim() === 'Urfa Kebap Servis';
      if (productIsCanonical && !existingIsCanonical) {
        result[duplicateIndex] = product;
      }
      continue;
    }
    indexes.set(key, result.length);
    result.push(product);
  }
  return result;
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
