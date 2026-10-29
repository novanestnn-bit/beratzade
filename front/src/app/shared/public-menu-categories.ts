import type { PublicTenantMenuCategory } from '../services/api.service';
import { publicMenuCategorySlug } from './public-menu-path';

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

const hiddenCategorySlugs = [
  'et-yemekleri',
  'tavuk-yemekleri',
  'yan-urunler',
  'mezeler-ve-salatalar',
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
    .filter((category) => !hiddenCategorySlugs.includes(beratzadeMenuCategorySlug(category.id)))
    .map((category, index) => ({ category, index }))
    .sort((left, right) => {
      const leftRank = rank.get(beratzadeMenuCategorySlug(left.category.id)) ?? preferredOrder.length;
      const rightRank = rank.get(beratzadeMenuCategorySlug(right.category.id)) ?? preferredOrder.length;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ category }) => category);
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
