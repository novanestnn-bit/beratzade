import type { PublicTenantMenuCategory } from '../services/api.service';
import { publicMenuCategorySlug } from './public-menu-path';
import { BERATZADE_MENU_SECTIONS, beratzadeProductGroup } from '../public-menu/public-menu-presentation';

const preferredSubcategoryOrder: Record<string, string[]> = {
  kahvalti: ['firin-urunleri', 'sandvicler', 'menemenler', 'yumurta-cesitleri'],
  'kebaplar-ve-izgaralar': ['et', 'tavuk'],
  'mezeler-ve-salatalar': ['meze', 'salata'],
  icecekler: ['sicak', 'soguk'],
};

const preferredOrder = [
  'kahvalti',
  'kebaplar-ve-izgaralar',
  'gunun-corbalari',
  'ev-yemekleri',
  'icecekler',
  'tatlilar',
];

export function beratzadeMenuCategorySlug(categoryId: string): string {
  const slug = publicMenuCategorySlug(categoryId);
  return slug === 'gunun-yemekleri' ? 'ev-yemekleri' : slug;
}

export function beratzadeMenuCategoryLabel(categoryName: string): string {
  const slug = publicMenuCategorySlug(categoryName);
  if (slug === 'gunun-yemekleri') return 'Ev Yemekleri';
  if (slug === 'kebaplar-ve-izgaralar') return 'Kebap & Izgara';
  if (slug === 'mezeler-ve-salatalar') return 'Mezeler & Salatalar';
  return categoryName;
}

export function orderBeratzadeMenuCategories(
  categories: PublicTenantMenuCategory[],
): PublicTenantMenuCategory[] {
  const rank = new Map(preferredOrder.map((slug, index) => [slug, index]));
  return categories
    .map((category, index) => ({ category, index }))
    .sort((left, right) => {
      const leftRank = rank.get(beratzadeMenuCategorySlug(left.category.id)) ?? preferredOrder.length;
      const rightRank = rank.get(beratzadeMenuCategorySlug(right.category.id)) ?? preferredOrder.length;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ category }) => category);
}

/** Use the same virtual menu groups in staff POS and customer QR without rewriting Product rows. */
export function groupBeratzadeProductsForStaff<T extends {
  id: number;
  source?: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  price_cents: number;
  price_formatted?: string;
  description?: string | null;
  image_url?: string | null;
  available?: boolean;
}>(products: T[]): Array<{ id: string; name: string; products: T[]; subcategories: Array<{ id: string; name: string; products: T[] }> }> {
  const groups = BERATZADE_MENU_SECTIONS.flatMap(section => section.groups);
  return groups.map(group => {
    const items = products.filter(product => beratzadeProductGroup(product as PublicTenantMenuCategory['products'][number]) === group.id);
    const names = [...new Set(items.map(product => product.subcategory).filter((name): name is string => !!name))];
    return {
      id: group.id,
      name: group.label,
      products: items.filter(product => !product.subcategory),
      subcategories: names.map(name => ({
        id: publicMenuCategorySlug(name),
        name,
        products: items.filter(product => product.subcategory === name),
      })),
    };
  });
}

export function orderBeratzadeCategoryNames(names: string[], enabled: boolean): string[] {
  if (!enabled) return names;
  const canonical = BERATZADE_MENU_SECTIONS.flatMap(section => section.groups.map(group => group.label));
  const rank = new Map(canonical.map((name, index) => [name, index]));
  return [...names].sort((left, right) =>
    (rank.get(left) ?? canonical.length) - (rank.get(right) ?? canonical.length)
      || left.localeCompare(right, 'tr'),
  );
}

export function orderBeratzadeSubcategories(
  categoryName: string,
  subcategories: PublicTenantMenuCategory[],
): PublicTenantMenuCategory[] {
  const preferred = preferredSubcategoryOrder[publicMenuCategorySlug(categoryName)] ?? [];
  const rank = new Map(preferred.map((slug, index) => [slug, index]));
  return subcategories
    .map((subcategory, index) => ({ subcategory, index }))
    .sort((left, right) => {
      const leftSlug = publicMenuCategorySlug(left.subcategory.id);
      const rightSlug = publicMenuCategorySlug(right.subcategory.id);
      const leftRank = rank.get(leftSlug) ?? preferred.length;
      const rightRank = rank.get(rightSlug) ?? preferred.length;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ subcategory }) => subcategory);
}
