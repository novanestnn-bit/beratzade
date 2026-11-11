import type { PublicTenantMenuCategory, PublicTenantMenuProduct } from '../services/api.service';
import { orderBeratzadeMenuCategories } from '../shared/public-menu-categories';
import {
  BERATZADE_MENU_SECTIONS,
  beratzadeProductGroup,
  beratzadeProductMatchesGroup,
  beratzadeSectionForProduct,
  categoryForProduct,
  categoryProducts,
  matchesMenuSearch,
  menuProducts,
  publicImageUrl,
  publicProductKey,
} from './public-menu-presentation';

function product(id: number, source: 'product' | 'tenant_product', name = 'Isolated dish'): PublicTenantMenuProduct {
  return { id, source, name, price_cents: 1500, price_formatted: '15.00', description: null, category: null, subcategory: null, image_url: null, available: true };
}

describe('restaurant public menu presentation', () => {
  it('finds Turkish dish names without accents and regardless of search word order', () => {
    const dish = product(1, 'product', 'Çıtır Tavuk Dürüm');
    expect(matchesMenuSearch(dish, 'durum citir')).toBeTrue();
    expect(matchesMenuSearch(dish, '  TAVUK   dürüm ')).toBeTrue();
    expect(matchesMenuSearch(dish, 'tavuk kebap')).toBeFalse();
  });
  it('searches category and description without hiding a dish for whitespace input', () => {
    const dish = { ...product(1, 'product', 'Ayran'), description: 'Soğuk içecek', category: 'İçecekler' };
    expect(matchesMenuSearch(dish, 'icecek soguk')).toBeTrue();
    expect(matchesMenuSearch(dish, '  ')).toBeTrue();
    expect(matchesMenuSearch(dish, 'salata')).toBeFalse();
  });
  it('keeps equal ids from different product sources distinct', () => {
    expect(publicProductKey(product(7, 'product'))).not.toBe(publicProductKey(product(7, 'tenant_product')));
  });
  it('finds the product category using its source as well as its id', () => {
    const legacy = product(7, 'product'), tenant = product(7, 'tenant_product');
    const categories = [{ id: 'one', name: 'One', products: [legacy] }, { id: 'two', name: 'Two', products: [tenant] }];
    expect(categoryForProduct(categories, tenant)?.id).toBe('two');
  });
  it('includes direct and nested dishes once without losing dishes in categories with children', () => {
    const direct = product(1, 'product'), child = product(2, 'tenant_product');
    const category = { id: 'main', name: 'Main', products: [direct], subcategories: [{ id: 'child', name: 'Child', products: [child, direct] }] };
    expect(categoryProducts(category)).toEqual([direct, child]);
    expect(menuProducts([category, { id: 'duplicate', name: 'Duplicate', products: [direct] }])).toEqual([direct, child]);
  });
  it('does not silently hide published salad, meat, chicken or side categories', () => {
    const ids = ['mezeler-ve-salatalar', 'et-yemekleri', 'tavuk-yemekleri', 'yan-urunler'];
    const categories: PublicTenantMenuCategory[] = ids.map(id => ({ id, name: id, products: [product(1, 'product')] }));
    expect(orderBeratzadeMenuCategories(categories).map(category => category.id).sort()).toEqual(ids.sort());
  });
  it('keeps differently named products distinct when reading older responses without source', () => {
    const a = { ...product(1, 'product', 'One'), source: undefined }, b = { ...product(1, 'product', 'Two'), source: undefined };
    expect(publicProductKey(a)).not.toBe(publicProductKey(b));
  });
  it('uses the actual API image or a neutral empty placeholder', () => {
    expect(publicImageUrl(null, '/api')).toBe('');
    expect(publicImageUrl('/uploads/89/products/food.webp', '/api')).toBe('/api/uploads/89/products/food.webp');
    expect(publicImageUrl('https://images.invalid/food.webp', '/api')).toBe('https://images.invalid/food.webp');
    for (const value of ['javascript:alert(1)', 'data:text/html,test', '//images.invalid/photo.jpg']) expect(publicImageUrl(value, '/api')).toBe('');
  });

  it('defines the two menu sections with seven breakfast groups and nine grill groups', () => {
    expect(BERATZADE_MENU_SECTIONS.map(section => section.id)).toEqual(['kahvalti', 'kebap-sulu-yemekler']);
    expect(BERATZADE_MENU_SECTIONS[0].groups.length).toBe(7);
    expect(BERATZADE_MENU_SECTIONS[1].groups.length).toBe(9);
  });

  it('groups current products for display without changing their API values', () => {
    const toast = { ...product(1, 'product', 'Kaşarlı Tost'), category: 'Kahvaltı' };
    const grill = { ...product(2, 'tenant_product', 'Adana Kebap Servis'), category: 'Izgara & Kebap Çeşitleri' };
    const stew = { ...product(3, 'product', 'Günün Yemeği'), category: 'Günün Yemekleri' };
    const tea = { ...product(4, 'product', 'Küçük Çay'), category: 'İçecekler' };
    const breakfast = product(5, 'product', 'Serpme Kahvaltı');
    const egg = product(6, 'product', 'Sade Menemen');
    const pastry = product(7, 'product', 'Sigara Böreği');
    const wrap = product(8, 'product', 'Adana Dürüm');
    const chickenRice = product(9, 'product', 'Tavuklu Pilav');
    const burger = product(10, 'product', 'Hamburger');
    const dessert = product(11, 'product', 'Fırın Sütlaç');
    const snack = product(12, 'product', 'Çıtır Tavuk');

    expect(beratzadeProductGroup(toast)).toBe('tost-cesitleri');
    expect(beratzadeProductGroup(grill)).toBe('izgara-kebap');
    expect(beratzadeProductGroup(stew)).toBe('gunluk-sulu-yemekler');
    expect(beratzadeProductGroup(breakfast)).toBe('serpme-kahvalti');
    expect(beratzadeProductGroup(egg)).toBe('menemen-cesitleri');
    expect(beratzadeProductGroup(pastry)).toBe('borek-hamur-isleri');
    expect(beratzadeProductGroup(wrap)).toBe('durum-cesitleri');
    expect(beratzadeProductGroup(chickenRice)).toBe('pilav');
    expect(beratzadeProductGroup(burger)).toBe('hamburger');
    expect(beratzadeProductGroup(dessert)).toBe('tatlilar');
    expect(beratzadeProductGroup(snack)).toBe('aperatifler-ara-sicaklar');
    expect(beratzadeProductMatchesGroup(tea, 'icecek-cesitleri')).toBeTrue();
    expect(beratzadeSectionForProduct(toast)).toBe('kahvalti');
    expect(toast.price_cents).toBe(1500);
    expect(toast.name).toBe('Kaşarlı Tost');
  });

  it('maps the full approved menu category set to the two requested QR sections', () => {
    const cases: Array<[string, string, 'kahvalti' | 'kebap-sulu-yemekler']> = [
      ['Börekler & Hamur İşleri', 'borek-hamur-isleri', 'kahvalti'],
      ['Tost Çeşitleri', 'tost-cesitleri', 'kahvalti'],
      ['Beratzade Sandviç Menüsü', 'sandvic-menusu', 'kahvalti'],
      ['Menemen Çeşitleri', 'menemen-cesitleri', 'kahvalti'],
      ['Omlet & Sahanda Yumurta', 'omlet-sahanda', 'kahvalti'],
      ['Kahvaltı Tabağı', 'kahvalti-tabagi', 'kahvalti'],
      ['Serpme Kahvaltı', 'serpme-kahvalti', 'kahvalti'],
      ['Izgara & Kebap Çeşitleri', 'izgara-kebap', 'kebap-sulu-yemekler'],
      ['Pilav', 'pilav', 'kebap-sulu-yemekler'],
      ['Dürüm Çeşitleri', 'durum-cesitleri', 'kebap-sulu-yemekler'],
      ['Aperatifler & Ara Sıcaklar', 'aperatifler-ara-sicaklar', 'kebap-sulu-yemekler'],
      ['Hamburger', 'hamburger', 'kebap-sulu-yemekler'],
      ['Günlük Sulu Yemekler', 'gunluk-sulu-yemekler', 'kebap-sulu-yemekler'],
      ['Tatlılar', 'tatlilar', 'kebap-sulu-yemekler'],
      ['İçecek Çeşitleri', 'icecek-cesitleri', 'kebap-sulu-yemekler'],
      ['Çorba Çeşitleri', 'corba-cesitleri', 'kebap-sulu-yemekler'],
    ];

    for (const [category, group, section] of cases) {
      const item = { ...product(1, 'product'), category };
      expect(beratzadeProductGroup(item)).withContext(category).toBe(group);
      expect(beratzadeSectionForProduct(item)).withContext(category).toBe(section);
    }
  });
});
