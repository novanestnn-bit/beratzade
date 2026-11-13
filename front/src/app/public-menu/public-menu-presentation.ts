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
      { id: 'borek-hamur-isleri', label: 'Börekler & Hamur İşleri', labelKey: '', image: '/menu-categories/kahvalti.webp' },
      { id: 'tost-cesitleri', label: 'Tost Çeşitleri', labelKey: '', image: '/menu-categories/kahvalti.webp' },
      { id: 'sandvic-menusu', label: 'Beratzade Sandviç Menüsü', labelKey: '', image: '/menu-categories/kahvalti.webp' },
      { id: 'menemen-cesitleri', label: 'Menemen Çeşitleri', labelKey: '', image: '/menu-categories/kahvalti.webp' },
      { id: 'omlet-sahanda', label: 'Omlet & Sahanda Yumurta', labelKey: '', image: '/menu-categories/kahvalti.webp' },
      { id: 'kahvalti-tabagi', label: 'Kahvaltı Tabağı', labelKey: '', image: '/menu-categories/kahvalti.webp' },
      { id: 'serpme-kahvalti', label: 'Serpme Kahvaltı', labelKey: '', image: '/menu-categories/kahvalti.webp' },
    ],
  },
  {
    id: 'kebap-sulu-yemekler',
    label: 'Kebap & Sulu Yemekler',
    labelKey: 'MENU_EXPERIENCE.SECTION_GRILL',
    descriptionKey: 'MENU_EXPERIENCE.SECTION_GRILL_DESCRIPTION',
    image: '/menu-categories/kebaplar-ve-izgaralar.webp',
    groups: [
      { id: 'izgara-kebap', label: 'Izgara & Kebap Çeşitleri', labelKey: '', image: '/menu-categories/kebaplar-ve-izgaralar.webp' },
      { id: 'pilav', label: 'Pilav', labelKey: '', image: '/menu-categories/kebaplar-ve-izgaralar.webp' },
      { id: 'durum-cesitleri', label: 'Dürüm Çeşitleri', labelKey: '', image: '/menu-categories/kebaplar-ve-izgaralar.webp' },
      { id: 'aperatifler-ara-sicaklar', label: 'Aperatifler & Ara Sıcaklar', labelKey: '', image: '/menu-categories/mezeler-ve-salatalar.webp' },
      { id: 'hamburger', label: 'Hamburger', labelKey: '', image: '/menu-categories/kebaplar-ve-izgaralar.webp' },
      { id: 'gunluk-sulu-yemekler', label: 'Günlük Sulu Yemekler', labelKey: '', image: '/menu-categories/ev-yemekleri.webp' },
      { id: 'tatlilar', label: 'Tatlılar', labelKey: '', image: '/menu-categories/tatlilar.webp' },
      { id: 'icecek-cesitleri', label: 'İçecek Çeşitleri', labelKey: '', image: '/menu-categories/icecekler.webp' },
      { id: 'corba-cesitleri', label: 'Çorba Çeşitleri', labelKey: '', image: '/menu-categories/gunun-corbalari.webp' },
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
  const categoryName = normalizeMenuText(product.category ?? '');
  const category = normalizeMenuText(`${product.category ?? ''} ${product.subcategory ?? ''}`);
  const text = `${name} ${category}`;

  const explicitGroups: Record<string, string> = {
    'borekler ve hamur isleri': 'borek-hamur-isleri',
    'tost cesitleri': 'tost-cesitleri',
    'beratzade sandvic menusu': 'sandvic-menusu',
    'menemen cesitleri': 'menemen-cesitleri',
    'omlet ve sahanda yumurta': 'omlet-sahanda',
    'kahvalti tabagi': 'kahvalti-tabagi',
    'serpme kahvalti': 'serpme-kahvalti',
    'izgara ve kebap cesitleri': 'izgara-kebap',
    pilav: 'pilav',
    'durum cesitleri': 'durum-cesitleri',
    'aperatifler ve ara sicaklar': 'aperatifler-ara-sicaklar',
    hamburger: 'hamburger',
    'gunluk sulu yemekler': 'gunluk-sulu-yemekler',
    tatlilar: 'tatlilar',
    'icecek cesitleri': 'icecek-cesitleri',
    'corba cesitleri': 'corba-cesitleri',
  };
  if (explicitGroups[categoryName]) return explicitGroups[categoryName];
  const normalizedCategory = categoryName.replace(/\s+/g, ' ').trim();
  const legacyCategoryGroups: Record<string, string> = {
    kahvalti: hasAny(name, ['serpme']) ? 'serpme-kahvalti'
      : hasAny(name, ['kahvalti tabagi']) ? 'kahvalti-tabagi'
        : hasAny(name, ['menemen']) ? 'menemen-cesitleri'
          : hasAny(name, ['omlet', 'sahanda', 'yumurta']) ? 'omlet-sahanda'
            : hasAny(name, ['tost']) ? 'tost-cesitleri'
              : hasAny(name, ['sandvic']) ? 'sandvic-menusu' : 'borek-hamur-isleri',
    'kebaplar ve izgaralar': hasAny(name, ['durum']) ? 'durum-cesitleri'
      : hasAny(name, ['pilav']) ? 'pilav' : 'izgara-kebap',
    'gunun yemekleri': 'gunluk-sulu-yemekler',
    'gunun corbalari': 'corba-cesitleri',
    'icecekler': 'icecek-cesitleri',
    'yan urunler': 'aperatifler-ara-sicaklar',
  };
  if (legacyCategoryGroups[normalizedCategory]) return legacyCategoryGroups[normalizedCategory];

  if (hasAny(text, ['icecek', 'beverage', 'drink', 'cay', 'kahve', 'nescafe', 'oralet', 'portakal suyu', 'maden suyu', 'ayran', 'cola']) || name === 'su' || name === 'water') {
    return 'icecek-cesitleri';
  }
  if (hasAny(text, ['corba', 'soup'])) return 'corba-cesitleri';
  if (hasAny(text, ['tatli', 'dessert', 'sutlac', 'kunefe'])) return 'tatlilar';
  if (hasAny(text, ['serpme'])) return 'serpme-kahvalti';
  if (hasAny(text, ['kahvalti tabagi', 'breakfast plate'])) return 'kahvalti-tabagi';
  if (hasAny(text, ['omlet', 'omelet', 'sahanda'])) return 'omlet-sahanda';
  if (hasAny(text, ['menemen'])) return 'menemen-cesitleri';
  if (hasAny(text, ['kahvalti', 'breakfast'])) {
    if (hasAny(text, ['menemen'])) return 'menemen-cesitleri';
    if (hasAny(text, ['omlet', 'omelet', 'yumurta', 'egg'])) return 'omlet-sahanda';
    if (hasAny(text, ['tost', 'toast'])) return 'tost-cesitleri';
    if (hasAny(text, ['sandvic', 'sandwich'])) return 'sandvic-menusu';
    if (hasAny(text, ['borek', 'boreg', 'gozleme', 'pankek', 'pancake', 'krep', 'pogaca', 'acma', 'simit', 'hamur', 'pastry'])) return 'borek-hamur-isleri';
    return 'kahvalti-tabagi';
  }
  if (hasAny(text, ['menemen'])) return 'menemen-cesitleri';
  if (hasAny(text, ['omlet', 'omelet', 'sahanda', 'yumurta', 'egg'])) return 'omlet-sahanda';
  if (hasAny(text, ['tost', 'toast'])) return 'tost-cesitleri';
  if (hasAny(text, ['sandvic', 'sandwich'])) return 'sandvic-menusu';
  if (hasAny(text, ['borek', 'boreg', 'gozleme', 'pankek', 'pancake', 'krep', 'pogaca', 'acma', 'simit', 'hamur', 'pastry'])) return 'borek-hamur-isleri';
  if (hasAny(category, ['corba', 'soup'])) return 'corba-cesitleri';
  if (hasAny(text, ['burger', 'hamburger'])) return 'hamburger';
  if (hasAny(text, ['durum', 'wrap', 'dürüm'])) return 'durum-cesitleri';
  if (hasAny(text, ['citir', 'snitzel', 'schnitzel', 'peynir cubuk', 'sogan halkasi', 'patates kroket', 'aperatif', 'atistirmalik', 'starter', 'appetizer'])) return 'aperatifler-ara-sicaklar';
  if (hasAny(text, ['izgara', 'kebap', 'sis', 'pirzola', 'kofte', 'ciger', 'grill', 'grilled'])) return 'izgara-kebap';
  if (hasAny(text, ['gunun yemek', 'gunluk yemek', 'ev yemek', 'sulu yemek', 'daily meal', 'stew'])) return 'gunluk-sulu-yemekler';
  if (hasAny(text, ['pilav', 'rice'])) return 'pilav';
  if (hasAny(category, ['kahvalti', 'breakfast'])) return 'kahvalti-tabagi';
  if (hasAny(category, ['yan urun', 'side'])) return 'aperatifler-ara-sicaklar';

  // Keep any existing but unrecognized API item visible without changing its data.
  return 'hamburger';
}

export function beratzadeSectionForProduct(product: PublicTenantMenuProduct): BeratzadeSectionId {
  const group = beratzadeProductGroup(product);
  return ['kahvalti-tabagi', 'serpme-kahvalti', 'menemen-cesitleri', 'omlet-sahanda', 'tost-cesitleri', 'sandvic-menusu', 'borek-hamur-isleri'].includes(group) ? 'kahvalti' : 'kebap-sulu-yemekler';
}

export function beratzadeProductMatchesGroup(product: PublicTenantMenuProduct, groupId: string): boolean {
  const actualGroup = beratzadeProductGroup(product);
  if (actualGroup === groupId) return true;
  return groupId === 'icecek-cesitleri' && actualGroup === 'icecek-cesitleri';
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
    if (isNonSellableMenuHeading(product.name, product.category)) continue;
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
  if (value.startsWith('/menu-images/beratzade/')) return value;
  const base = apiUrl.replace(/\/$/, '');
  return value.startsWith('/') ? base + value : `${base}/${value}`;
}
